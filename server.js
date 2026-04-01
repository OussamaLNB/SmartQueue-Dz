<<<<<<< HEAD
require('dotenv').config();
=======
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// PostgreSQL connection
const pool = new Pool({
<<<<<<< HEAD
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
=======
    user: 'postgres',
    host: 'localhost',
    database: 'smartqueue',
    password: '@Oussama123.', // 🔴 change this
    port: 5432,
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1
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
<<<<<<< HEAD
        const phone = req.body.phone?.replace(/\s/g, "");
=======
        const phone = req.body.phone?.trim();
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1

        if (!phone) {
            return res.status(400).json({ error: 'Phone required' });
        }

        // Algerian phone validation
        if (!/^0[567]\d{8}$/.test(phone)) {
<<<<<<< HEAD
            return res.status(400).json({ error: 'Invalid phone number' });
        }

=======
            return res.json({ message: 'Numéro invalide (ex: 0551234567)' });
        }

        // Insert with today's date
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1
        try {
            await pool.query(
                'INSERT INTO queue (phone, created_date) VALUES ($1, CURRENT_DATE)',
                [phone]
            );
        } catch (err) {
<<<<<<< HEAD
=======
            // UNIQUE(phone, created_date)
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1
            if (err.code === '23505') {
                return res.json({ message: 'Already in today’s queue' });
            }
            throw err;
        }

<<<<<<< HEAD
=======
        // Count today's queue
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1
        const { rows } = await pool.query(
            'SELECT COUNT(*) FROM queue WHERE created_date = CURRENT_DATE'
        );

<<<<<<< HEAD
        const position = parseInt(rows[0].count, 10);
=======
        const position = rows[0].count;
>>>>>>> 0524fb48fabd439f0a395f2d2bc91fcdd85935c1

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