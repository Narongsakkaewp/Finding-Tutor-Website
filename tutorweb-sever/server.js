// tutorweb-server/server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// สร้าง Connection ไปที่ MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// ทดสอบเชื่อมต่อ DB
db.connect((err) => {
    if (err) {
        console.log('DB Connection Failed:', err);
    } else {
        console.log('Connected to MySQL DB');
    }
});

// ตัวอย่าง API ดึง Users
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));