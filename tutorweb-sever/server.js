// tutorweb-server/server.js
const express = require('express');
const mysql = require('mysql2/promise');        // ใช้ promise
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- MySQL Pool ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ทดสอบการเชื่อมต่อ
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Connected to MySQL DB');
    conn.release();
  } catch (err) {
    console.error('DB Connection Failed:', err);
  }
})();

// ---------- APIs ----------

// ประเภทผู้ใช้
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

// ---------- โพสต์นักเรียนตามวิชา (JOIN register เพื่อดึงชื่อจริง) ----------
app.get('/api/subjects/:subject/posts', async (req, res) => {
  try {
    const subject = req.params.subject; // เช่น "Math 1"
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = (page - 1) * limit;

    // ใช้ NOW() เป็นค่า fallback เผื่อไม่มีคอลัมน์ created_at
    const [rows] = await pool.execute(
      `SELECT 
          sp.student_post_id, sp.student_id, sp.subject, sp.description,
          sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, sp.budget,
          COALESCE(sp.created_at, NOW()) AS created_at,
          r.name       AS student_name,
          r.lastname   AS student_lastname
       FROM student_posts sp
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE sp.subject = ?
       ORDER BY sp.student_post_id DESC
       LIMIT ? OFFSET ?`,
      [subject, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM student_posts WHERE subject = ?',
      [subject]
    );

    const items = rows.map(r => {
      const fullName =
        `${r.student_name || ''}${r.student_lastname ? ' ' + r.student_lastname : ''}`.trim();
      return {
        _id: r.student_post_id,
        authorId: {
          name: fullName || `นักเรียน #${r.student_id}`,
          avatarUrl: '' // หากยังไม่มีคอลัมน์รูป ให้ส่งค่าว่างไว้ก่อน
        },
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
      };
    });

    res.json({
      items,
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + items.length < total,
      },
    });
  } catch (e) {
    console.error('GET /api/subjects/:subject/posts error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// รายชื่อติวเตอร์จาก register (type = tutor/teacher)
app.get('/api/tutors', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

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

    const items = rows.map(r => ({
      id: `t-${r.user_id}`,
      dbTutorId: r.user_id,
      name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.user_id}`,
      subject: 'วิชาที่ยังไม่ระบุ',
      rating: 4.8,        // mock เริ่มต้น
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

// โพสต์ติวเตอร์ทั้งหมด/ล่าสุด + กรองด้วย tutorId/subject ได้
app.get('/api/tutor-posts', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

    const tutorId = req.query.tutorId ? parseInt(req.query.tutorId, 10) : null;
    const subject = (req.query.subject || '').trim();

    const where = [];
    const params = [];
    if (Number.isInteger(tutorId)) {
      where.push('tp.tutor_id = ?');
      params.push(tutorId);
    }
    if (subject) {
      where.push('tp.subject LIKE ?');
      params.push(`%${subject}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT
        tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description,
        tp.teaching_days, tp.teaching_time, tp.location, tp.price, tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name, r.lastname
      FROM tutor_posts tp
      LEFT JOIN register r ON r.user_id = tp.tutor_id
      ${whereSql}
      ORDER BY tp.created_at DESC, tp.tutor_post_id DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params
    );

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tutor_posts tp
      ${whereSql}
      `,
      params
    );

    res.json({
      items: rows.map(r => ({
        _id: r.tutor_post_id,
        subject: r.subject,
        content: r.description,
        createdAt: r.created_at,
        authorId: {
          id: r.tutor_id,
          name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.tutor_id}`,
          avatarUrl: ''
        },
        meta: {
          teaching_days: r.teaching_days,
          teaching_time: r.teaching_time,
          location: r.location,
          price: Number(r.price || 0),
          contact_info: r.contact_info
        },
        images: []
      })),
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total
      }
    });
  } catch (e) {
    console.error('GET /api/tutor-posts error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// alias: ให้เรียก /api/tutors/:tutorId/posts ได้เหมือนกัน
app.get('/api/tutors/:tutorId/posts', async (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    if (!Number.isFinite(tutorId)) {
      return res.status(400).json({ message: 'Invalid tutorId' });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT tutor_post_id, tutor_id, subject, description,
              teaching_days, teaching_time, location, price, contact_info,
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
        content: r.description,
        subject: r.subject,
        createdAt: r.created_at,
        images: [],
        meta: {
          teaching_days: r.teaching_days,
          teaching_time: r.teaching_time,
          location: r.location,
          price: Number(r.price || 0),
          contact_info: r.contact_info
        }
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

// สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  try {
    const { name, lastname, email, password, type } = req.body;
    const [dup] = await pool.execute('SELECT 1 FROM register WHERE email = ?', [email]);
    if (dup.length > 0) {
      return res.json({ success: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
    }
    await pool.execute(
      'INSERT INTO register (name, lastname, email, password, type) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, email, password, type]
    );
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});

// สร้างโพสต์ใหม่ (นักเรียน)
app.post('/api/student_posts', async (req, res) => {
  try {
    const { subject, description, preferred_days, preferred_time, location, group_size, budget, contact_info } = req.body;

    await pool.execute(
      `INSERT INTO student_posts (student_id, subject, description, preferred_days, preferred_time, location, group_size, budget, contact_info, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [1, subject, description, preferred_days, preferred_time, location, group_size, budget, contact_info] // student_id แนะนำดึงจาก token session
    );

    res.json({ success: true, message: "โพสต์สำเร็จ" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// 📌 ดึงทุก student_posts พร้อมข้อมูล user
app.get('/api/student_posts', async (req, res) => {
  try {
    const posts = await db.collection('student_posts')
      .aggregate([
        {
          $lookup: {
            from: "users",              // collection users
            localField: "user_id",      // student_posts.user_id
            foreignField: "user_id",    // users.user_id
            as: "user"
          }
        },
        { $unwind: "$user" }, // แตก array user ออกมาเป็น object
        { $sort: { createdAt: -1 } } // โพสต์ล่าสุดขึ้นก่อน
      ])
      .toArray();

    res.json({ success: true, items: posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));