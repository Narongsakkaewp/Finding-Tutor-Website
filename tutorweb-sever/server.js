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

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).send(err);
            if (results.length > 0) {
                res.json({ success: true, user: results[0] });
            } else {
                res.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
            }
        }
    );
});

app.post('/api/register', (req, res) => {
    console.log('req.body:', req.body);
    const { name, lastname, email, password, type } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length > 0) {
            return res.json({ success: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
        }
        db.query(
            'INSERT INTO users (name, lastname, email, password, type) VALUES (?, ?, ?, ?, ?)',
            [name, lastname, email, password, type],
            (err, result) => {
                if (err) return res.status(500).send(err);
                res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
            }
        );
    });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));