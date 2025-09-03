// tutorweb-server/server.js
const express = require('express');
const mysql = require('mysql2/promise'); // ✅ ใช้ promise
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ใช้ Pool เดียวทั้งระบบ
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ✅ ทดสอบเชื่อมต่อ
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Connected to MySQL DB');
    conn.release();
  } catch (err) {
    console.error('DB Connection Failed:', err);
  }
})();

// ------------------- APIs -------------------

// ดึงประเภทผู้ใช้
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute(
      'SELECT type FROM register WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ userType: rows[0].type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper
function normalizeUserType(input) {
  const t = String(input || '').trim().toLowerCase();
  if (['student', 'นักเรียน', 'นักศึกษา', 'std', 'stu'].includes(t)) return 'student';
  if (['tutor', 'teacher', 'ติวเตอร์', 'ครู', 'อาจารย์'].includes(t)) return 'tutor';
  return '';
}

// ล็อกอิน
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT * FROM register WHERE email = ? AND password = ?',
      [email, password]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const user = rows[0];
    const raw = String(user.type || '').trim().toLowerCase();
    const mapped = raw === 'teacher' ? 'tutor' : raw;

    res.json({
      success: true,
      user: { ...user, role: mapped, userType: mapped },
      userType: mapped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// ✅ ดึงโพสต์นักเรียนตามวิชา (MySQL)
app.get('/api/subjects/:subject/posts', async (req, res) => {
  try {
    const subject = req.params.subject; // เช่น "Math 1"
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = (page - 1) * limit;

    // ข้อมูลรายการ
    const [rows] = await pool.execute(
      `SELECT student_post_id, student_id, subject, description,
              preferred_days, preferred_time, location, group_size, budget,
              COALESCE(created_at, NOW()) AS created_at
       FROM student_posts
       WHERE subject = ?
       ORDER BY student_post_id DESC
       LIMIT ? OFFSET ?`,
      [subject, limit, offset]
    );

    // นับทั้งหมด
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM student_posts WHERE subject = ?',
      [subject]
    );

    res.json({
      items: rows.map(r => ({
        _id: r.student_post_id,
        authorId: { name: `นักเรียน #${r.student_id}`, avatarUrl: '' },
        content: r.description,
        meta: {
          preferred_days: r.preferred_days,
          preferred_time: r.preferred_time,
          location: r.location,
          group_size: r.group_size,
          budget: Number(r.budget),
        },
        subject: r.subject,
        createdAt: r.created_at,
        images: [],
      })),
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ ดึงโพสต์ของติวเตอร์ตาม tutorId (ตรงกับ register.user_id)
// ✅ ดึงรายชื่อติวเตอร์จากตาราง register (type = tutor/teacher) แบบมี pagination
app.get('/api/tutors', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

    // ถ้าคุณมีตารางโปรไฟล์อื่น ๆ ค่อย JOIN เพิ่มได้
    const [rows] = await pool.execute(
      `SELECT user_id, name, lastname, email
         FROM register
        WHERE LOWER(type) IN ('tutor','teacher')
        ORDER BY user_id DESC
        LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM register
        WHERE LOWER(type) IN ('tutor','teacher')`
    );

    // map ให้อยู่ในรูปแบบที่หน้า React ใช้ได้ทันที
    const items = rows.map(r => ({
      id: `t-${r.user_id}`,
      dbTutorId: r.user_id,                         // <-- ใช้เรียก /api/tutors/:id/posts
      name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.user_id}`,
      subject: 'วิชาที่ยังไม่ระบุ',                 // ถ้ามี field วิชา/โปรไฟล์ค่อยใส่จริง
      rating: 4.8,
      reviews: 0,
      price: 0,
      city: 'ออนไลน์',
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
      nextSlot: 'ติดต่อกำหนดเวลา'
    }));

    res.json({
      items,
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + items.length < total,
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ ดึงโพสต์ของติวเตอร์รายคน (อย่าลืมสร้างตาราง tutor_posts)
app.get('/api/tutors/:tutorId/posts', async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT tutor_post_id, tutor_id, content,
              COALESCE(created_at, NOW()) AS created_at
         FROM tutor_posts
        WHERE tutor_id = ?
        ORDER BY tutor_post_id DESC
        LIMIT ? OFFSET ?`,
      [tutorId, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tutor_posts WHERE tutor_id = ?`,
      [tutorId]
    );

    res.json({
      items: rows.map(r => ({
        _id: r.tutor_post_id,
        authorId: { name: `ติวเตอร์ #${r.tutor_id}`, avatarUrl: '' },
        content: r.content,
        createdAt: r.created_at,
        images: []
      })),
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total,
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});



// สมัครสมาชิก (เดิม) — เปลี่ยนมาใช้ pool
app.post('/api/register', async (req, res) => {
  try {
    const { user_id, name, lastname, email, password, type } = req.body;
    const [dup] = await pool.execute('SELECT 1 FROM register WHERE email = ?', [email]);
    if (dup.length > 0) {
      return res.json({ success: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
    }
    await pool.execute(
      'INSERT INTO register (user_id, name, lastname, email, password, type) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, name, lastname, email, password, type]
    );
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));