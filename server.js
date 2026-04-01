require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// =======================
// HOME PAGE
// =======================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// =======================
// JOIN QUEUE (PER DAY)
// =======================
app.post('/join-queue', async (req, res) => {
    try {
        const phone = req.body.phone?.replace(/\s/g, "");

        if (!phone) {
            return res.status(400).json({ error: 'Phone required' });
        }

        // Algerian phone validation
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

        const position = parseInt(rows[0].count, 10);

        res.json({ message: `Your number: ${position}` });

    } catch (err) {
        console.error('JOIN ERROR:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// =======================
// GET TODAY'S QUEUE
// =======================
app.get('/queue', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, phone FROM queue WHERE created_date = CURRENT_DATE ORDER BY id ASC'
        );

        res.json(rows);

    } catch (err) {
        console.error('GET QUEUE ERROR:', err);
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
            return res.json({ message: 'Queue is empty' });
        }

        const id = rows[0].id;

        await pool.query(
            'DELETE FROM queue WHERE id = $1',
            [id]
        );

        res.json({ message: 'Served next customer' });

    } catch (err) {
        console.error('SERVE ERROR:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// =======================
// CLEAR TODAY'S QUEUE
// =======================
app.delete('/clear-queue', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM queue WHERE created_date = CURRENT_DATE'
        );

        res.json({ message: 'Queue cleared' });

    } catch (err) {
        console.error('CLEAR ERROR:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// =======================
// START SERVER
// =======================
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});