require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =======================
// CREATE SHOP
// =======================
app.post('/create-shop', async (req, res) => {
  const { name } = req.body;

  if (!name || !/^[a-zA-Z0-9]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid shop name' });
  }

  try {
    await pool.query(
      'INSERT INTO shops (name) VALUES ($1)',
      [name.toLowerCase()]
    );

    res.json({
      shop: name,
      customerLink: `/shop/${name}`,
      ownerLink: `/owner/${name}`
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.json({ error: 'Shop already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// GET SHOPS
// =======================
app.get('/shops', async (req, res) => {
  const { rows } = await pool.query('SELECT name FROM shops');
  res.json(rows);
});

// =======================
// ROUTES
// =======================
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html'))
);

app.get('/shop/:name', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/shop.html'))
);

app.get('/owner/:name', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/owner.html'))
);

app.get('/create', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/create.html'))
);

// =======================
// JOIN QUEUE
// =======================
app.post('/join-queue', async (req, res) => {
  const { phone, shop } = req.body;

  if (!shop) return res.json({ error: 'Invalid shop link' });

  if (!/^0[567]\d{8}$/.test(phone)) {
    return res.json({ error: 'Invalid phone number' });
  }

  try {
    await pool.query(
      'INSERT INTO queue (phone, shop, created_date) VALUES ($1,$2,CURRENT_DATE)',
      [phone, shop]
    );

    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM queue WHERE shop=$1 AND created_date=CURRENT_DATE',
      [shop]
    );

    res.json({ message: `Your number: ${rows[0].count}` });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// GET QUEUE
// =======================
app.get('/queue/:shop', async (req, res) => {
  const { shop } = req.params;

  const { rows } = await pool.query(
    'SELECT id, phone FROM queue WHERE shop=$1 AND created_date=CURRENT_DATE ORDER BY id',
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
    'SELECT id FROM queue WHERE shop=$1 ORDER BY id LIMIT 1',
    [shop]
  );

  if (!rows.length) return res.json({ message: 'Empty' });

  await pool.query('DELETE FROM queue WHERE id=$1', [rows[0].id]);

  res.json({ message: 'Served' });
});

// =======================
app.listen(3000, () => console.log('Server running'));