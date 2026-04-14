require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =======================
// ROUTES PAGES
// =======================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/owner/:shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/owner.html'));
});

app.get('/shop/:shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/create.html'));
});

// =======================
// CREATE SHOP
// =======================

app.post('/create-shop', async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: 'Name required' });

  await pool.query(
    'INSERT INTO shops (name) VALUES ($1) ON CONFLICT DO NOTHING',
    [name]
  );

  res.json({
    customer: `/shop/${name}`,
    owner: `/owner/${name}`
  });
});

// =======================
// JOIN QUEUE
// =======================

app.post('/join-queue', async (req, res) => {
  try {
    const { phone, shop } = req.body;

    if (!phone || !shop) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (!/^0[567]\d{8}$/.test(phone)) {
      return res.json({ error: 'Invalid number' });
    }

    try {
      await pool.query(
        `INSERT INTO queue (phone, shop, created_date)
         VALUES ($1, $2, CURRENT_DATE)`,
        [phone, shop]
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.json({ message: 'Already in queue' });
      }
      throw err;
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM queue 
       WHERE shop = $1 AND created_date = CURRENT_DATE`,
      [shop]
    );

    res.json({ message: `Your number: ${rows[0].count}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// GET QUEUE
// =======================

app.get('/queue/:shop', async (req, res) => {
  const { shop } = req.params;

  const { rows } = await pool.query(
    `SELECT id, phone FROM queue 
     WHERE shop = $1 AND created_date = CURRENT_DATE
     ORDER BY id ASC`,
    [shop]
  );

  res.json(rows);
});

// =======================
// SERVE NEXT
// =======================

app.delete('/serve-next/:shop', async (req, res) => {
  const { shop } = req.params;

  const { rows } = await pool.query(
    `SELECT id FROM queue 
     WHERE shop = $1 AND created_date = CURRENT_DATE
     ORDER BY id ASC LIMIT 1`,
    [shop]
  );

  if (rows.length === 0) {
    return res.json({ message: 'Empty' });
  }

  await pool.query('DELETE FROM queue WHERE id = $1', [rows[0].id]);

  res.json({ message: 'Done' });
});

// =======================
// START
// =======================

app.listen(3000, () => {
  console.log('Server running on port 3000');
});