require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =======================
// HOME PAGE
// =======================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =======================
// OWNER PAGE
// =======================
app.get('/owner', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

// =======================
// JOIN QUEUE
// =======================
app.post('/join-queue', async (req, res) => {
    try {
        const phone = req.body.phone?.replace(/\s/g, "");

        if (!phone) {
            return res.status(400).json({ error: 'Phone required' });
        }

        if (!/^0[567]\d{8}$/.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        try {
            await pool.query(
                'INSERT INTO queue (phone, created_date) VALUES ($1, CURRENT_DATE)',
                [phone]
            );
        } catch (err) {
            if (err.code === '23505') {
                return res.json({ message: 'Already in today’s queue' });
            }
            throw err;
        }

        const { rows } = await pool.query(
            'SELECT COUNT(*) FROM queue WHERE created_date = CURRENT_DATE'
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
app.get('/queue', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, phone FROM queue WHERE created_date = CURRENT_DATE ORDER BY id ASC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =======================
// NOW SERVING
// =======================
app.get('/current', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, phone FROM queue WHERE created_date = CURRENT_DATE ORDER BY id ASC LIMIT 1'
        );

        if (rows.length === 0) {
            return res.json({ message: "None" });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =======================
// SERVE NEXT
// =======================
app.delete('/serve-next', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id FROM queue WHERE created_date = CURRENT_DATE ORDER BY id ASC LIMIT 1'
        );

        if (rows.length === 0) {
            return res.json({ message: 'Queue empty' });
        }

        await pool.query('DELETE FROM queue WHERE id = $1', [rows[0].id]);

        res.json({ message: 'Served next' });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =======================
// CLEAR QUEUE
// =======================
app.delete('/clear-queue', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM queue WHERE created_date = CURRENT_DATE'
        );
        res.json({ message: 'Queue cleared' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(3000, () => console.log('Server running'));