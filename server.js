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
// ROUTES
// =======================

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Shop page
app.get('/shop/:shopId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Owner page
app.get('/owner/:shopId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

// =======================
// JOIN QUEUE
// =======================
app.post('/join-queue', async (req, res) => {
    try {
        const { phone, shop_id } = req.body;

        if (!phone || !shop_id) {
            return res.status(400).json({ error: 'Missing data' });
        }

        if (!/^0[567]\d{8}$/.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        try {
            await pool.query(
                'INSERT INTO queue (phone, created_date, shop_id) VALUES ($1, CURRENT_DATE, $2)',
                [phone, shop_id]
            );
        } catch (err) {
            if (err.code === '23505') {
                return res.json({ message: 'Already in today’s queue' });
            }
            throw err;
        }

        const { rows } = await pool.query(
            'SELECT COUNT(*) FROM queue WHERE created_date = CURRENT_DATE AND shop_id = $1',
            [shop_id]
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
app.get('/queue/:shopId', async (req, res) => {
    const { shopId } = req.params;

    const { rows } = await pool.query(
        'SELECT id, phone FROM queue WHERE created_date = CURRENT_DATE AND shop_id = $1 ORDER BY id ASC',
        [shopId]
    );

    res.json(rows);
});

// =======================
// NOW SERVING
// =======================
app.get('/current/:shopId', async (req, res) => {
    const { shopId } = req.params;

    const { rows } = await pool.query(
        'SELECT id, phone FROM queue WHERE created_date = CURRENT_DATE AND shop_id = $1 ORDER BY id ASC LIMIT 1',
        [shopId]
    );

    if (rows.length === 0) {
        return res.json({ message: "None" });
    }

    res.json(rows[0]);
});

// =======================
// SERVE NEXT
// =======================
app.delete('/serve-next/:shopId', async (req, res) => {
    const { shopId } = req.params;

    const { rows } = await pool.query(
        'SELECT id FROM queue WHERE created_date = CURRENT_DATE AND shop_id = $1 ORDER BY id ASC LIMIT 1',
        [shopId]
    );

    if (rows.length === 0) return res.json({ message: "Empty" });

    await pool.query('DELETE FROM queue WHERE id = $1', [rows[0].id]);

    res.json({ message: "Served" });
});

// =======================
// CLEAR QUEUE
// =======================
app.delete('/clear-queue/:shopId', async (req, res) => {
    const { shopId } = req.params;

    await pool.query(
        'DELETE FROM queue WHERE created_date = CURRENT_DATE AND shop_id = $1',
        [shopId]
    );

    res.json({ message: 'Queue cleared' });
});

app.listen(3000, () => console.log('Server running on port 3000'));