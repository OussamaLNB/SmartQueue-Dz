require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// ─── B2 FIX: trust proxy FIRST — req.ip is correct behind Render's proxy ──────
app.set('trust proxy', 1);

let isShuttingDown = false;

// ─── CORS (before body parser) ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── SHUTDOWN GUARD (before body parser) ──────────────────────────────────────
app.use((req, res, next) => {
  if (isShuttingDown && req.path !== '/health') {
    return res.status(503).json({ error: 'Serveur en cours de redémarrage. Réessayez dans quelques secondes.' });
  }
  next();
});

// ─── B1 + B6 FIX: body parser AFTER CORS, WITH size limit ────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB POOL ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── B5 FIX: VALID_SERVICES whitelist — used on ALL routes ───────────────────
const VALID_SERVICES = new Set([
  'apc-1', 'apc-2', 'clinic-1', 'clinic-2', 'bank-1', 'bank-2'
]);

function validateServiceId(id) {
  return typeof id === 'string' && VALID_SERVICES.has(id);
}

// ─── RATE LIMITER: Token Bucket per IP (O(1)) ─────────────────────────────────
const RATE_LIMIT = {
  capacity: 5,       // max burst
  refillRate: 1/60,  // 1 token per minute
  buckets: new Map(),
};

function checkRateLimit(ip) {
  const now = Date.now() / 1000;
  let b = RATE_LIMIT.buckets.get(ip);
  if (!b) {
    b = { tokens: RATE_LIMIT.capacity, lastRefill: now };
    RATE_LIMIT.buckets.set(ip, b);
  }
  // T(t) = min(C, T_last + r*(t - t_last))
  b.tokens = Math.min(
    RATE_LIMIT.capacity,
    b.tokens + RATE_LIMIT.refillRate * (now - b.lastRefill)
  );
  b.lastRefill = now;
  if (b.tokens >= 1) { b.tokens -= 1; return true; }
  return false;
}

// Prevent memory leak — purge buckets idle > 1 hour
setInterval(() => {
  const cutoff = Date.now() / 1000 - 3600;
  for (const [ip, b] of RATE_LIMIT.buckets) {
    if (b.lastRefill < cutoff) RATE_LIMIT.buckets.delete(ip);
  }
}, 600_000);

// ─── HEALTH CHECK (UptimeRobot keep-alive) ────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── DAILY RESET ──────────────────────────────────────────────────────────────
async function expireOldEntries() {
  try {
    // Expire anything from previous days
    await pool.query(`
      UPDATE queue_entries SET status = 'expired'
      WHERE queue_date < CURRENT_DATE AND status IN ('waiting','serving')
    `);
    // B4 FIX: use serving_at (not created_at) for the 30-min stuck-serving expiry
    await pool.query(`
      UPDATE queue_entries SET status = 'expired'
      WHERE status = 'serving'
        AND queue_date = CURRENT_DATE
        AND serving_at IS NOT NULL
        AND serving_at < NOW() - INTERVAL '30 minutes'
    `);
    console.log('[expiry] done');
  } catch (e) { console.error('[expiry] error:', e.message); }
}
expireOldEntries();
setInterval(expireOldEntries, 3_600_000);

// ─── GET SERVICES ─────────────────────────────────────────────────────────────
app.get('/api/services', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        COUNT(q.id) FILTER (WHERE q.status = 'waiting' AND q.queue_date = CURRENT_DATE) AS waiting_count
      FROM services s
      LEFT JOIN queue_entries q ON q.service_id = s.id
      WHERE s.is_active = true
      GROUP BY s.id
      ORDER BY s.type, s.id
    `);
    res.json(rows);
  } catch (err) {
    console.error('[services]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  }
});

// ─── JOIN QUEUE (advisory lock → exactly-once queue number) ──────────────────
app.post('/api/queue/join', async (req, res) => {
  const { serviceId } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'serviceId requis' });
  if (!validateServiceId(serviceId)) return res.status(400).json({ error: 'Service invalide' }); // B5

  // B2 FIX: with trust proxy set, req.ip is the real client IP
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Trop de requêtes. Attendez une minute avant de réessayer.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Advisory lock: only one join per service at a time
    await client.query(
      `SELECT pg_advisory_xact_lock(abs(hashtext($1 || CURRENT_DATE::text)))`,
      [serviceId]
    );

    const { rows: numRows } = await client.query(`
      SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num
      FROM queue_entries
      WHERE service_id = $1 AND queue_date = CURRENT_DATE
    `, [serviceId]);
    const queueNumber = numRows[0].next_num;

    const { rows: posRows } = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM queue_entries
      WHERE service_id = $1 AND queue_date = CURRENT_DATE AND status = 'waiting'
    `, [serviceId]);
    const position = parseInt(posRows[0].cnt, 10) + 1;

    const { rows: svcRows } = await client.query(
      'SELECT avg_time FROM services WHERE id = $1', [serviceId]
    );
    const avgTime = svcRows[0]?.avg_time || 10;
    const estimatedWait = (position - 1) * avgTime;

    await client.query(`
      INSERT INTO queue_entries (service_id, queue_number, queue_date, status)
      VALUES ($1, $2, CURRENT_DATE, 'waiting')
    `, [serviceId, queueNumber]);

    await client.query('COMMIT');
    res.json({ queueNumber, position, estimatedWait });

  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    console.error('[join]', err.message);
    res.status(500).json({ error: 'Impossible de rejoindre la file. Réessayez.' });
  } finally {
    if (client) client.release();
  }
});

// ─── GET MY STATUS ────────────────────────────────────────────────────────────
app.get('/api/queue/status/:serviceId/:queueNumber', async (req, res) => {
  const { serviceId } = req.params;
  if (!validateServiceId(serviceId)) return res.status(400).json({ error: 'Service invalide' }); // B5

  const queueNumber = parseInt(req.params.queueNumber, 10);
  if (isNaN(queueNumber)) return res.status(400).json({ error: 'Numéro invalide' });

  try {
    const { rows } = await pool.query(`
      SELECT id, service_id, queue_number, queue_date, status, created_at
      FROM queue_entries
      WHERE service_id = $1 AND queue_number = $2 AND queue_date = CURRENT_DATE
    `, [serviceId, queueNumber]);
    if (rows.length === 0) return res.status(404).json({ error: 'Entrée introuvable' });

    const { rows: aheadRows } = await pool.query(`
      SELECT COUNT(*) AS ahead FROM queue_entries
      WHERE service_id = $1 AND queue_date = CURRENT_DATE
        AND status = 'waiting' AND queue_number < $2
    `, [serviceId, queueNumber]);
    const position = parseInt(aheadRows[0].ahead, 10) + 1;

    const { rows: svcRows } = await pool.query(
      'SELECT avg_time FROM services WHERE id = $1', [serviceId]
    );
    const estimatedWait = (position - 1) * (svcRows[0]?.avg_time || 10);

    res.json({ ...rows[0], position, estimatedWait });
  } catch (err) {
    console.error('[status]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  }
});

// ─── CANCEL ───────────────────────────────────────────────────────────────────
app.delete('/api/queue/:serviceId/:queueNumber', async (req, res) => {
  const { serviceId } = req.params;
  if (!validateServiceId(serviceId)) return res.status(400).json({ error: 'Service invalide' }); // B5

  const qNum = parseInt(req.params.queueNumber, 10);
  if (isNaN(qNum)) return res.status(400).json({ error: 'Numéro invalide' });

  try {
    await pool.query(`
      UPDATE queue_entries SET status = 'cancelled'
      WHERE service_id = $1 AND queue_number = $2 AND queue_date = CURRENT_DATE
    `, [serviceId, qNum]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[cancel]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  }
});

// ─── ADMIN: GET QUEUE ─────────────────────────────────────────────────────────
app.get('/api/admin/queue/:serviceId', async (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Non autorisé' });

  const { serviceId } = req.params;
  if (!validateServiceId(serviceId)) return res.status(400).json({ error: 'Service invalide' }); // B5

  try {
    const { rows } = await pool.query(`
      SELECT id, queue_number, status, created_at FROM queue_entries
      WHERE service_id = $1 AND queue_date = CURRENT_DATE
      ORDER BY queue_number ASC
    `, [serviceId]);
    res.json(rows);
  } catch (err) {
    console.error('[admin/queue]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  }
});

// ─── ADMIN: CALL NEXT (FOR UPDATE SKIP LOCKED — concurrent-admin safe) ────────
app.post('/api/admin/call-next/:serviceId', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Non autorisé' });

  const { serviceId } = req.params;
  if (!validateServiceId(serviceId)) return res.status(400).json({ error: 'Service invalide' }); // B5

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(`
      SELECT id, queue_number FROM queue_entries
      WHERE service_id = $1 AND queue_date = CURRENT_DATE AND status = 'waiting'
      ORDER BY queue_number ASC LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [serviceId]);

    if (rows.length === 0) {
      await client.query('COMMIT');
      return res.json({ ok: true, queueNumber: null });
    }

    // B4 FIX: record serving_at so 30-min expiry is measured from call time, not join time
    await client.query(
      `UPDATE queue_entries SET status = 'serving', serving_at = NOW() WHERE id = $1`,
      [rows[0].id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, queueNumber: rows[0].queue_number });

  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    console.error('[call-next]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  } finally {
    if (client) client.release();
  }
});

// ─── ADMIN: MARK SERVED / NOSHOW ─────────────────────────────────────────────
app.put('/api/admin/mark/:entryId', async (req, res) => {
  const { password, status } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Non autorisé' });
  if (!['served', 'noshow'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  // Validate entryId is a real integer — prevents SQL injection via path param
  const entryId = parseInt(req.params.entryId, 10);
  if (isNaN(entryId)) return res.status(400).json({ error: 'ID invalide' });

  try {
    await pool.query(
      'UPDATE queue_entries SET status = $1 WHERE id = $2',
      [status, entryId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[mark]', err.message);
    res.status(500).json({ error: 'Erreur serveur' }); // B3 FIX
  }
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — graceful shutdown started');
  isShuttingDown = true;
  setTimeout(async () => {
    await pool.end();
    console.log('Pool closed — shutdown complete');
    process.exit(0);
  }, 10_000);
});

// ─── CATCH ALL → React SPA ────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SmartQueue DZ running on port ${PORT}`));
