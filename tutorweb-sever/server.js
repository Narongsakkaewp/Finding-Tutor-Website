// tutorweb-server/server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

// ----- เพิ่ม Dependencies สำหรับ Upload -----
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// -----------------------------------------

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// ----- NEW: ตั้งค่า Multer สำหรับการอัปโหลดไฟล์ -----
const uploadDir = 'public/uploads';
// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // บอกให้ multer เก็บไฟล์ที่โฟลเดอร์ public/uploads
  },
  filename: function (req, file, cb) {
    // สร้างชื่อไฟล์ใหม่ที่ไม่ซ้ำกัน -> timestamp-originalname.extension
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });
// ----------------------------------------------------

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

app.get('/api/tutors', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

    // ✅ 1. แก้ไขคำสั่ง SQL ให้ JOIN ตาราง tutor_profiles เพื่อดึงข้อมูลจริง
    const [rows] = await pool.execute(
      `SELECT 
          r.user_id, r.name, r.lastname,
          tp.nickname,
          tp.can_teach_subjects,
          tp.profile_picture_url,
          tp.address,
          tp.hourly_rate
       FROM register r
       LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
       WHERE LOWER(r.type) IN ('tutor','teacher')
       ORDER BY r.user_id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM register
       WHERE LOWER(type) IN ('tutor','teacher')`
    );

    // ✅ 2. แก้ไขการสร้าง object ให้ใช้ข้อมูลจริงจาก Database
    const items = rows.map(r => ({
      id: `t-${r.user_id}`,
      dbTutorId: r.user_id,
      name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.user_id}`,

      // --- ส่วนที่ดึงข้อมูลจริงมาใช้ ---
      nickname: r.nickname || null,
      subject: r.can_teach_subjects || 'ยังไม่ระบุวิชาที่สอน',
      image: r.profile_picture_url || 'https://via.placeholder.com/400', // รูปโปรไฟล์จริง
      city: r.address || 'ยังไม่ระบุที่อยู่',
      price: r.hourly_rate || 0,

      // --- ส่วนนี้ยังเป็นข้อมูลจำลอง (mock) อยู่ ---
      rating: 4.8,
      reviews: 0,
      // nextSlot: 'ติดต่อกำหนดเวลา'
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
    console.error('API /api/tutors Error:', e); // เพิ่ม console.error เพื่อดู error ที่นี่
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
    const me = Number(req.query.me) || 0;

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
        r.name, r.lastname,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
      FROM tutor_posts tp
      LEFT JOIN register r ON r.user_id = tp.tutor_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS c
        FROM posts_favorites
        WHERE post_type='tutor'
        GROUP BY post_id
      ) fvc ON fvc.post_id = tp.tutor_post_id
      LEFT JOIN posts_favorites fme
        ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
      ${whereSql}
      ORDER BY tp.created_at DESC, tp.tutor_post_id DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      [me, ...params]
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
        fav_count: Number(r.fav_count || 0),
        favorited: !!r.favorited,
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
  let connection; // ประกาศ connection ไว้ข้างนอก
  try {
    const { name, lastname, email, password, type } = req.body;

    // (ส่วนตรวจสอบข้อมูลเหมือนเดิม)
    const [dup] = await pool.execute('SELECT 1 FROM register WHERE email = ?', [email]);
    if (dup.length > 0) {
      return res.json({ success: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
    }

    // ✅ 1. เริ่ม Transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'INSERT INTO register (name, lastname, email, password, type) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, email, password, type]
    );

    const newUserId = result.insertId; // <-- ID ของผู้ใช้ใหม่

    // ✅ 2. หลังจาก INSERT สำเร็จ ให้ SELECT ข้อมูลผู้ใช้คนนั้นกลับมาทันที
    const [rows] = await connection.execute(
      'SELECT user_id, name, lastname, email, type FROM register WHERE user_id = ?',
      [newUserId]
    );
    const newUser = rows[0];

    // ✅ 3. Commit Transaction
    await connection.commit();

    // ✅ 4. ส่งข้อมูลผู้ใช้ใหม่ทั้งหมดกลับไปให้ Frontend
    // ทำให้ Response เหมือนกับของ /api/login เป๊ะๆ
    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      user: newUser, // <--- ส่ง user object กลับไป
      userType: newUser.type // <--- ส่ง userType กลับไปด้วย
    });

  } catch (err) {
    if (connection) await connection.rollback(); // ถ้าเกิด Error ให้ Rollback
    console.error('Register API Error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    if (connection) connection.release(); // คืน connection กลับสู่ pool
  }
});

app.get('/api/student_posts', async (req, res) => {
  try {
    const me = Number(req.query.me) || 0;

    const [rows] = await pool.query(`
      SELECT
        sp.student_post_id, sp.student_id, sp.subject, sp.description,
        sp.preferred_days, TIME_FORMAT(sp.preferred_time, '%H:%i') AS preferred_time,
        sp.location, sp.group_size, sp.budget, sp.contact_info, sp.created_at,
        r.name, r.lastname,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE WHEN jme.user_id IS NULL THEN 0 ELSE 1 END AS joined,
        CASE WHEN jme_pending.user_id IS NULL THEN 0 ELSE 1 END AS pending_me,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
      FROM student_posts sp
      LEFT JOIN register r ON r.user_id = sp.student_id
      LEFT JOIN (
        SELECT student_post_id, COUNT(*) AS join_count
        FROM student_post_joins
        WHERE status='approved'
        GROUP BY student_post_id
      ) jc ON jc.student_post_id = sp.student_post_id
      LEFT JOIN student_post_joins jme
        ON jme.student_post_id = sp.student_post_id AND jme.user_id = ? AND jme.status='approved'
      LEFT JOIN student_post_joins jme_pending
        ON jme_pending.student_post_id = sp.student_post_id AND jme_pending.user_id = ? AND jme_pending.status='pending'
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS c
        FROM posts_favorites
        WHERE post_type='student'
        GROUP BY post_id
      ) fvc ON fvc.post_id = sp.student_post_id
      LEFT JOIN posts_favorites fme
        ON fme.post_id = sp.student_post_id AND fme.post_type='student' AND fme.user_id = ?
      ORDER BY sp.student_post_id DESC
    `, [me, me, me]);

    const posts = rows.map(r => ({
      id: r.student_post_id,
      owner_id: r.student_id,
      subject: r.subject || '',
      description: r.description || '',
      preferred_days: r.preferred_days || '',
      preferred_time: r.preferred_time || '',
      location: r.location || '',
      group_size: Number(r.group_size || 0),
      budget: Number(r.budget || 0),
      contact_info: r.contact_info || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      join_count: Number(r.join_count || 0),
      joined: !!r.joined,
      pending_me: !!r.pending_me,
      fav_count: Number(r.fav_count || 0),
      favorited: !!r.favorited,
      user: { first_name: r.name || '', last_name: r.lastname || '', profile_image: '/default-avatar.png' },
    }));

    return res.json(posts);
  } catch (err) {
    console.error('FEED ERR', err);
    return res.status(500).json({ success: false, message: err?.sqlMessage || err?.message || 'Database error' });
  }
});


// ===== helper =====

// helper แปลงเวลาให้เป็น HH:MM:SS
function toSqlTime(t) {
  if (!t) return null;
  // รับ 'HH:MM' หรือ 'HH:MM:SS'
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return null;
}

function sendDbError(res, err) {
  console.error('[DB ERROR]', err);
  return res.status(500).json({
    success: false,
    message: err?.sqlMessage || err?.message || 'Database error',
    code: err?.code || null,
  });
}

// >>> ใหม่: helper ดึงรายชื่อผู้เข้าร่วมของโพสต์
async function getJoiners(postId) {
  const [rows] = await pool.query(
    `SELECT j.user_id, j.joined_at, r.name, r.lastname
       FROM student_post_joins j
       LEFT JOIN register r ON r.user_id = j.user_id
      WHERE j.student_post_id = ?
      ORDER BY j.joined_at ASC, j.user_id ASC`,
    [postId]
  );
  return rows.map(x => ({
    user_id: x.user_id,
    joined_at: x.joined_at,
    name: x.name || '',
    lastname: x.lastname || ''
  }));
}

// ===== POST: สร้างโพสต์ใหม่ =====
app.post('/api/student_posts', async (req, res) => {
  try {
    const {
      user_id,
      subject,
      description,
      preferred_days,
      preferred_time,
      location,
      group_size,
      budget,
      contact_info
    } = req.body;

    // ตรวจข้อมูลฝั่งเซิร์ฟเวอร์ให้ชัด ๆ
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });

    const groupSizeNum = Number(group_size);
    const budgetNum = Number(budget);
    const timeSql = toSqlTime(preferred_time);

    if (!Number.isFinite(groupSizeNum) || groupSizeNum <= 0)
      return res.status(400).json({ success: false, message: 'group_size must be a positive number' });

    if (!Number.isFinite(budgetNum) || budgetNum < 0)
      return res.status(400).json({ success: false, message: 'budget must be a number' });

    if (!timeSql)
      return res.status(400).json({ success: false, message: 'preferred_time must be HH:MM or HH:MM:SS' });

    // (ถ้ามี FK ไป register แนะนำเช็คก่อน)
    const [userExists] = await pool.execute('SELECT 1 FROM register WHERE user_id = ?', [user_id]);
    if (userExists.length === 0)
      return res.status(400).json({ success: false, message: `user_id ${user_id} not found in register` });

    const [result] = await pool.execute(
      `INSERT INTO student_posts
         (student_id, subject, description, preferred_days, preferred_time,
          location, group_size, budget, contact_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, subject, description, preferred_days, timeSql,
        location, groupSizeNum, budgetNum, contact_info]
    );

    const insertId = result.insertId;

    const [rows] = await pool.query(
      `SELECT
         sp.student_post_id, sp.student_id, sp.subject, sp.description,
         sp.preferred_days, sp.preferred_time, sp.location, sp.group_size,
         sp.budget, sp.contact_info, sp.created_at,
         r.name, r.lastname
       FROM student_posts sp
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE sp.student_post_id = ?`,
      [insertId]
    );

    const r = rows[0];
    const created = {
      id: r.student_post_id,
      owner_id: r.student_id,
      subject: r.subject,
      description: r.description,
      preferred_days: r.preferred_days,
      preferred_time: r.preferred_time,
      location: r.location,
      group_size: r.group_size,
      budget: Number(r.budget),
      contact_info: r.contact_info,
      createdAt: r.created_at,
      user: {
        first_name: r.name || '',
        last_name: r.lastname || '',
        profile_image: '/default-avatar.png',
      },
    };

    return res.status(201).json(created);
  } catch (err) {
    return sendDbError(res, err);
  }
});

// สร้างโพสต์ Tutor
app.post('/api/tutor-posts', async (req, res) => {
  console.log('--- ได้รับคำขอ POST ไปยัง /api/tutor-posts ---');

  try {
    console.log('ข้อมูลที่ได้รับ (req.body):', req.body);

    if (!req.body) {
      console.error('!!! ERROR: req.body เป็น undefined! ตรวจสอบว่ามี app.use(express.json()) ในไฟล์ server.js หรือไม่');
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลใน body ของคำขอ' });
    }

    const {
      tutor_id,
      subject,
      description,
      target_student_level,
      teaching_days,
      teaching_time,
      location,
      price,
      contact_info
    } = req.body;

    // --- หน่วยสอดแนม 3: เช็คค่าหลังดึงออกมาจาก req.body ---
    console.log('ดึงข้อมูล tutor_id:', tutor_id);
    console.log('ดึงข้อมูล subject:', subject);

    if (!tutor_id || !subject) {
      console.warn('!!! คำเตือน: ข้อมูลไม่ครบ, tutor_id หรือ subject เป็นค่าว่าง');
      return res.status(400).json({ success: false, message: 'Tutor ID และ Subject เป็นข้อมูลที่จำเป็น' });
    }

    const params = [
      tutor_id,
      subject,
      description || null,
      target_student_level || null,
      teaching_days || null,
      teaching_time || null,
      location || null,
      Number(price) || 0,
      contact_info || null
    ];

    // --- หน่วยสอดแนม 4: เช็คข้อมูลก่อนส่งให้ฐานข้อมูล ---
    console.log('กำลังจะรัน SQL ด้วยข้อมูล:', params);

    const [result] = await pool.execute(
      `INSERT INTO tutor_posts
         (tutor_id, subject, description, target_student_level, teaching_days, teaching_time, location, price, contact_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      params
    );

    console.log('✅ สร้างโพสต์สำเร็จ! Insert ID:', result.insertId);
    res.status(201).json({ success: true, insertId: result.insertId });

  } catch (err) {
    // --- หน่วยสอดแนม 5: ถ้ามี Error ในฐานข้อมูล มันจะแสดงที่นี่ ---
    console.error('!!! ERROR ภายใน CATCH BLOCK:', err);
    res.status(500).json({ success: false, message: 'Database error', error: err.message });
  }
});

// ผู้ใช้กด Join โพสต์
app.post('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me = Number(req.body.user_id);
    if (!Number.isFinite(postId) || !Number.isFinite(me))
      return res.status(400).json({ success: false, message: 'invalid postId or user_id' });

    const [[post]] = await pool.query(
      'SELECT student_id, group_size FROM student_posts WHERE student_post_id = ?',
      [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'post not found' });

    if (post.student_id === me)
      return res.status(400).json({ success: false, message: 'คุณเป็นเจ้าของโพสต์นี้' });

    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ?',
      [postId]
    );
    if (cnt.c >= post.group_size)
      return res.status(409).json({ success: false, message: 'กลุ่มนี้เต็มแล้ว' });

    const [upsertResult] = await pool.query(
      'INSERT IGNORE INTO student_post_joins (student_post_id, user_id) VALUES (?, ?)',
      [postId, me]
    );
    console.log('[JOIN] upsert result:', upsertResult);

    const [[cntApproved]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status = "approved"',
      [postId]
    );

    await pool.query(
      'INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)',
      [post.student_id, 'join_request', `มีคำขอเข้าร่วมโพสต์ #${postId}`, postId]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, related_id, is_read, created_at)
       VALUES (?, 'join_success', ?, ?, 0, NOW())`,
      [me, `คุณเข้าร่วมโพสต์ #${postId} แล้ว`, postId]
    );

    return res.json({ success: true, joined: true, join_count: cntApproved.c });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err?.sqlMessage || err?.message || 'Database error' });
  }
});



// ผู้ใช้ยกเลิก Join
app.delete('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me = Number(req.body?.user_id || req.query.user_id);
    if (!Number.isFinite(postId) || !Number.isFinite(me))
      return res.status(400).json({ success: false, message: 'invalid postId or user_id' });

    await pool.query(
      'DELETE FROM student_post_joins WHERE student_post_id = ? AND user_id = ?',
      [postId, me]
    );

    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ?',
      [postId]
    );

    // >>> ดึงรายชื่อผู้เข้าร่วมล่าสุดหลังยกเลิก
    const joiners = await getJoiners(postId);

    return res.json({ success: true, joined: false, join_count: cnt.c, joiners });
  } catch (err) {
    return sendDbError(res, err);
  }
});

// >>> ใหม่: API ดึงรายชื่อผู้เข้าร่วมของโพสต์
app.get('/api/student_posts/:id/joiners', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid post id' });
    const rows = await getJoiners(postId);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/notifications/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const sql = `
      SELECT n.notification_id, n.type, n.message, n.related_id,
             n.is_read, n.created_at,
             r.name AS firstname, r.lastname
      FROM notifications n
      JOIN register r ON n.user_id = r.user_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `;
    const [results] = await pool.execute(sql, [user_id]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Mark as read
app.put('/api/notifications/read/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new notification
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, type, message, related_id } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)',
      [user_id, type, message, related_id || null]
    );
    res.json({ notification_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 1. GET: ดึงข้อมูลโปรไฟล์ของนักเรียน
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // เราจะ JOIN ตาราง register กับ student_profiles เพื่อดึงข้อมูลทั้งหมดในครั้งเดียว
    const sql = `
      SELECT
        r.name,
        r.lastname,
        r.email,
        sp.* FROM register r
      LEFT JOIN student_profiles sp ON r.user_id = sp.user_id
      WHERE r.user_id = ?
    `;

    const [rows] = await pool.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ส่งข้อมูลโปรไฟล์กลับไป (ถ้ายังไม่มีโปรไฟล์ใน student_profiles ค่าต่างๆ จะเป็น null)
    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});


// 2. PUT: อัปเดต/สร้างข้อมูลโปรไฟล์ของนักเรียน (แก้ไขให้ตรงกับ DB)
app.put('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // ดึงค่าจาก req.body โดยใช้ชื่อที่ถูกต้องจาก Frontend
    // Frontend ของเราส่ง phone_number และ about_me มา
    const {
      nickname,
      phone_number, // รับค่าจาก Frontend
      address,
      grade_level,
      institution,
      faculty,
      major,
      about_me,      // รับค่าจาก Frontend
      profile_picture_url
    } = req.body;

    // เราจะใช้ "UPSERT" logic เหมือนเดิม
    const sql = `
      INSERT INTO student_profiles (
        user_id, nickname, phone, address, grade_level,
        institution, faculty, major, about, profile_picture_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        phone = VALUES(phone),
        address = VALUES(address),
        grade_level = VALUES(grade_level),
        institution = VALUES(institution),
        faculty = VALUES(faculty),
        major = VALUES(major),
        about = VALUES(about),
        profile_picture_url = VALUES(profile_picture_url)
    `;

    // ส่งค่าไปยัง SQL ให้ตรงตามลำดับของเครื่องหมาย ?
    await pool.execute(sql, [
      userId,
      nickname ?? null,
      phone_number ?? null, // ใช้ค่า phone_number ที่รับมาสำหรับคอลัมน์ phone
      address ?? null,
      grade_level ?? null,
      institution ?? null,
      faculty ?? null,
      major ?? null,
      about_me ?? null,      // ใช้ค่า about_me ที่รับมาสำหรับคอลัมน์ about
      profile_picture_url ?? null
    ]);

    res.json({ message: 'Profile updated successfully' });

  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});


// 3. POST: อัปโหลดรูปภาพ
// middleware `upload.single('image')` จะจัดการไฟล์ให้เรา
app.post('/api/upload', upload.single('image'), (req, res) => {
  // 'image' คือ key ที่เราตั้งใน FormData ของ Frontend
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // สร้าง URL เต็มของไฟล์เพื่อให้ Frontend เรียกใช้ได้
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  // ส่ง URL กลับไปให้ Frontend
  res.status(200).json({ imageUrl: imageUrl });
});

// 4. GET: ดึงข้อมูลโปรไฟล์ของติวเตอร์
app.get('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // JOIN ตาราง register กับ tutor_profiles
    const sql = `
      SELECT
        r.name,
        r.lastname,
        r.email,
        tp.* FROM register r
      LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
      WHERE r.user_id = ?
    `;

    const [rows] = await pool.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    // แปลง JSON string กลับเป็น JavaScript object/array ก่อนส่งไป Frontend
    const profile = rows[0];
    if (profile.education) profile.education = JSON.parse(profile.education);
    if (profile.teaching_experience) profile.teaching_experience = JSON.parse(profile.teaching_experience);
    // can_teach_grades และ can_teach_subjects จะส่งเป็น string ไปก่อน

    res.json(profile);

  } catch (err) {
    console.error('Error fetching tutor profile:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});


// 5. PUT: อัปเดต/สร้างข้อมูลโปรไฟล์ของติวเตอร์
app.put('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const body = req.body;

    console.log('Tutor Profile Data received for update:', body);

    // แปลง Array ของ Education และ Experience เป็น JSON string ก่อนบันทึกลง DB
    const educationJson = body.education ? JSON.stringify(body.education) : null;
    const teachingExperienceJson = body.teaching_experience ? JSON.stringify(body.teaching_experience) : null;

    // can_teach_grades และ can_teach_subjects จะถูกส่งมาเป็น string หรือ array แล้วแต่ Frontend
    // ถ้า Frontend ส่งเป็น array ให้ join ด้วย comma
    const canTeachGrades = Array.isArray(body.can_teach_grades) ? body.can_teach_grades.join(',') : (body.can_teach_grades ?? null);
    const canTeachSubjects = Array.isArray(body.can_teach_subjects) ? body.can_teach_subjects.join(',') : (body.can_teach_subjects ?? null);


    const params = [
      userId,
      body.nickname ?? null,
      body.phone ?? null,
      body.address ?? null,
      body.about_me ?? null,
      educationJson,
      teachingExperienceJson,
      canTeachGrades,
      canTeachSubjects,
      body.hourly_rate ?? null, // อัตราค่าสอน
      body.profile_picture_url ?? null
    ];

    const sql = `
      INSERT INTO tutor_profiles (
        user_id, nickname, phone, address, about_me,
        education, teaching_experience, can_teach_grades, can_teach_subjects,
        hourly_rate, profile_picture_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        phone = VALUES(phone),
        address = VALUES(address),
        about_me = VALUES(about_me),
        education = VALUES(education),
        teaching_experience = VALUES(teaching_experience),
        can_teach_grades = VALUES(can_teach_grades),
        can_teach_subjects = VALUES(can_teach_subjects),
        hourly_rate = VALUES(hourly_rate),
        profile_picture_url = VALUES(profile_picture_url)
    `;

    await pool.execute(sql, params);

    res.json({ message: 'Tutor profile updated successfully' });

  } catch (err) {
    console.error('Error updating tutor profile:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// ---------- Favorites ----------
/**
 * ใช้ตาราง:
 *   posts_favorites(user_id INT, post_type ENUM('student','tutor'), post_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *                   UNIQUE KEY uniq_user_post (user_id, post_type, post_id))
 * และคอลัมน์นับยอด:
 *   student_posts.fav_count INT DEFAULT 0
 *   tutor_posts.fav_count   INT DEFAULT 0
 */

// POST /api/favorites/toggle : กดถูกใจ/ยกเลิก
app.post('/api/favorites/toggle', async (req, res) => {
  try {
    const { user_id, post_id, post_type } = req.body || {};
    if (!user_id || !post_id || !['student', 'tutor'].includes(post_type)) {
      return res.status(400).json({ success: false, message: 'invalid payload' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [have] = await conn.query(
        'SELECT fav_id FROM posts_favorites WHERE user_id=? AND post_type=? AND post_id=?',
        [user_id, post_type, post_id]
      );

      let action = 'added';
      if (have.length) {
        await conn.query(
          'DELETE FROM posts_favorites WHERE user_id=? AND post_type=? AND post_id=?',
          [user_id, post_type, post_id]
        );
        action = 'removed';
      } else {
        await conn.query(
          'INSERT INTO posts_favorites (user_id, post_type, post_id) VALUES (?,?,?)',
          [user_id, post_type, post_id]
        );
      }

      // คำนวณยอดล่าสุด
      const [cntRows] = await conn.query(
        'SELECT COUNT(*) AS c FROM posts_favorites WHERE post_type=? AND post_id=?',
        [post_type, post_id]
      );
      const fav_count = Number(cntRows?.[0]?.c || 0);

      // sync ลงตารางโพสต์
      if (post_type === 'student') {
        await conn.query('UPDATE student_posts SET fav_count=? WHERE student_post_id=?', [fav_count, post_id]);
      } else {
        await conn.query('UPDATE tutor_posts SET fav_count=? WHERE tutor_post_id=?', [fav_count, post_id]);
      }

      await conn.commit();
      return res.json({ success: true, action, fav_count });
    } catch (e) {
      await conn.rollback();
      console.error('[favorites/toggle] txn error:', e);
      return res.status(500).json({ success: false, message: e.message || 'db error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[favorites/toggle] error:', e);
    return res.status(500).json({ success: false, message: 'server error' });
  }
});

// (optional) GET รายการที่สนใจของผู้ใช้
// ✅ GET: ดึงรายการที่ผู้ใช้ถูกใจไว้ทั้งหมด
app.get('/api/favorites/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    // ดึงรายการที่ถูกใจจากตาราง favorites
    const [rows] = await pool.query(`
      SELECT 
        f.post_type, 
        f.post_id, 
        f.created_at,
        CASE 
          WHEN f.post_type='student' THEN sp.subject
          ELSE tp.subject 
        END AS subject,
        CASE 
          WHEN f.post_type='student' THEN sp.description
          ELSE tp.description 
        END AS description,
        CASE 
          WHEN f.post_type='student' THEN r.name
          ELSE t.name 
        END AS author
      FROM posts_favorites f
      LEFT JOIN student_posts sp ON f.post_type='student' AND f.post_id = sp.student_post_id
      LEFT JOIN tutor_posts tp   ON f.post_type='tutor' AND f.post_id = tp.tutor_post_id
      LEFT JOIN register r ON sp.student_id = r.user_id
      LEFT JOIN register t ON tp.tutor_id = t.user_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [user_id]);

    res.json({ success: true, items: rows });
  } catch (err) {
    console.error('GET /api/favorites/user error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));


// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));