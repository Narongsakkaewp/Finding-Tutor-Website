// tutorweb-server/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ----- Upload Deps -----
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// -----------------------
const pool = require('./db');
const recommendationRoutes = require('./src/routes/recommendationRoutes');
// -----------------------

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use((req, res, next) => {
    req.db = pool;
    next();
});


// Keyword ชื่อวิชาที่ใช้สำหรับการค้นหา "ติวเตอร์"
const KEYWORD_MAP = {
  // หมวดคณิต
  'math': ['คณิต', 'เลข', 'calculus', 'algebra'],
  'คณิต': ['math', 'calculus'],
  'เลข': ['math'],

  // หมวดภาษา
  'eng': ['อังกฤษ', 'english', 'toeic', 'ielts'],
  'อังกฤษ': ['eng', 'english'],
  'thai': ['ไทย'],
  'ไทย': ['thai'],
  'jap': ['ญี่ปุ่น', 'japanese'],
  'ญี่ปุ่น': ['jap'],

  // หมวดวิทย์
  'sci': ['วิทย์', 'bio', 'chem', 'phy'],
  'วิทย์': ['sci', 'science'],
  'phy': ['ฟิสิกส์'],
  'ฟิสิกส์': ['phy', 'physics'],
  'chem': ['เคมี'],
  'เคมี': ['chem'],
  'bio': ['ชีว'],
  'ชีว': ['bio', 'biology'],

  // หมวดคอมพิวเตอร์
  'com': ['คอม', 'code', 'program', 'python', 'java', 'การเขียนโปรแกรม'],
  'คอม': ['com', 'code', 'it'],
  'code': ['program', 'python', 'react', 'web'],
  'เขียนโปรแกรม': ['code', 'program']
};

// ฟังก์ชันช่วยขยายคำค้นหา
function expandSearchTerm(term) {
  const lowerTerm = term.toLowerCase();
  let terms = [lowerTerm];

  // วนลูปเช็คว่าคำที่พิมพ์มา มีคำเหมือนใน Dictionary ไหม
  Object.keys(KEYWORD_MAP).forEach(key => {
    if (lowerTerm.includes(key)) {
      terms = [...terms, ...KEYWORD_MAP[key]];
    }
  });

  return terms;
}

// Test DB
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Connected to MySQL DB');
    conn.release();
  } catch (err) {
    console.error('DB Connection Failed:', err);
  }
})();

// ----- Multer (upload folder) -----
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });
// ---------------------------------

// ===== helper =====
function toSqlTime(t) {
  if (!t) return null;
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
// student joiners (ใช้ใน student_posts)
async function getJoiners(postId) {
  const [rows] = await pool.query(
    `SELECT j.user_id, j.joined_at, r.name, r.lastname
       FROM student_post_joins j
       LEFT JOIN register r ON r.user_id = j.user_id
      WHERE j.student_post_id = ? AND j.status = 'approved'
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

// ---------- APIs ----------
app.use('/api/recommendations', recommendationRoutes);

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

// ---------- โพสต์นักเรียนตามวิชา ----------
app.get('/api/subjects/:subject/posts', async (req, res) => {
  try {
    const rawSubject = req.params.subject;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);
    const offset = (page - 1) * limit;
    const searchTerms = expandSearchTerm(rawSubject);

    const whereConditions = searchTerms.map(() =>
      `(sp.subject LIKE ? OR sp.description LIKE ?)`
    ).join(' OR ');

    const sqlParams = [];
    searchTerms.forEach(term => {
      const likeTerm = `%${term}%`;
      sqlParams.push(likeTerm, likeTerm);
    });

    const [rows] = await pool.execute(
      `SELECT 
          sp.student_post_id, sp.student_id, sp.subject, sp.description,
          sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, sp.budget,
          sp.grade_level,  /* <--- เพิ่มบรรทัดนี้ เพื่อดึงระดับชั้นออกมา */
          COALESCE(sp.created_at, NOW()) AS created_at,
          r.name        AS student_name,
          r.lastname    AS student_lastname,
          spro.profile_picture_url
        FROM student_posts sp
        LEFT JOIN register r ON r.user_id = sp.student_id
        LEFT JOIN student_profiles spro ON spro.user_id = sp.student_id /* เพิ่ม JOIN รูปโปรไฟล์ */
        WHERE ${whereConditions}
        ORDER BY sp.student_post_id DESC
        LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    );

    // นับจำนวนทั้งหมด (Count)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM student_posts sp WHERE ${whereConditions}`,
      sqlParams
    );

    // Map ข้อมูลส่งกลับ
    const items = rows.map(r => {
      const fullName = `${r.student_name || ''}${r.student_lastname ? ' ' + r.student_lastname : ''}`.trim();
      return {
        _id: r.student_post_id,
        authorId: {
          name: fullName || `นักเรียน #${r.student_id}`,
          avatarUrl: r.profile_picture_url || '/default-avatar.png' /* ส่งรูปไปด้วย */
        },
        content: r.description,
        meta: {
          preferred_days: r.preferred_days,
          preferred_time: r.preferred_time,
          location: r.location,
          group_size: r.group_size,
          budget: Number(r.budget),
          grade_level: r.grade_level || 'ไม่ระบุ',
        },
        grade_level: r.grade_level || 'ไม่ระบุ',
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

// ---------- /api/tutors (รายชื่อติวเตอร์) ----------
app.get('/api/tutors', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

    const searchQuery = (req.query.search || '').trim();

    let whereClause = `WHERE LOWER(r.type) IN ('tutor','teacher')`;
    const params = [];

    if (searchQuery) {
      const searchTerms = expandSearchTerm(searchQuery);
      const orConditions = searchTerms.map(term => `(
          LOWER(r.name) LIKE ? 
          OR LOWER(r.lastname) LIKE ? 
          OR LOWER(tp.nickname) LIKE ? 
          OR LOWER(tp.can_teach_subjects) LIKE ?
          OR LOWER(tp.about_me) LIKE ? 
      )`).join(' OR ');

      whereClause += ` AND (${orConditions})`;

      // ใส่ value เข้า params ตามจำนวนเงื่อนไขที่สร้าง
      searchTerms.forEach(term => {
        const likeTerm = `%${term}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      });
    }

    // ... (ส่วน subject filter ถ้ามี) ...
    const [rows] = await pool.execute(
      `SELECT 
          r.user_id, r.name, r.lastname,
          tp.nickname,
          tp.can_teach_subjects,
          tp.profile_picture_url,
          tp.address,
          tp.hourly_rate,
          tp.about_me
       FROM register r
       LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
       ${whereClause}
       ORDER BY r.user_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM register r
         LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
         ${whereClause}`,
      params
    );

    const items = rows.map(r => ({
      id: `t-${r.user_id}`,
      dbTutorId: r.user_id,
      name: `${r.name || ''} ${r.lastname || ''}`.trim(),
      nickname: r.nickname,
      subject: r.can_teach_subjects || 'ไม่ระบุ',
      image: r.profile_picture_url || '/default-avatar.png',
      city: r.address,
      price: Number(r.hourly_rate || 0),
      about_me: r.about_me || '',
      rating: 0,
      reviews: 0,
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
    console.error('API /api/tutors Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- โพสต์ติวเตอร์ (ฟีด) ----------
app.get('/api/tutor-posts', async (req, res) => {
  console.log("📩 /api/tutor-posts called:", req.query);
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;

    const tutorId = req.query.tutorId ? parseInt(req.query.tutorId, 10) : null;
    const subject = (req.query.subject || '').trim();
    const me = Number(req.query.me) || 0;

    const where = [];
    const params = [];

    // --- เพิ่ม Logic ค้นหา (Search) ---
    if (Number.isInteger(tutorId)) {
      where.push('tp.tutor_id = ?');
      params.push(tutorId);
    }

    // ถ้ามีการค้นหาด้วย subject (รองรับ Smart Search)
    if (subject) {
      const keywords = expandSearchTerm(subject);
      const conditions = keywords.map(() =>
        `(tp.subject LIKE ? OR tp.description LIKE ?)`
      ).join(' OR ');
      where.push(`(${conditions})`);

      keywords.forEach(kw => {
        params.push(`%${kw}%`, `%${kw}%`);
      });
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT
        tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description,
        tp.target_student_level, /* ✅ เพิ่ม: ดึงระดับชั้นออกมา */
        tp.teaching_days, tp.teaching_time, tp.location, tp.group_size, tp.price, tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name, r.lastname,
        tpro.profile_picture_url,
        -- Favorites
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
        -- Joins
        COALESCE(jc.c,0) AS join_count,
        CASE WHEN jme.user_id IS NULL THEN 0 ELSE 1 END AS joined,
        CASE WHEN jme_pending.user_id IS NULL THEN 0 ELSE 1 END AS pending_me
      FROM tutor_posts tp
      LEFT JOIN register r ON r.user_id = tp.tutor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS c
        FROM posts_favorites
        WHERE post_type='tutor'
        GROUP BY post_id
      ) fvc ON fvc.post_id = tp.tutor_post_id
      LEFT JOIN posts_favorites fme
        ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
      LEFT JOIN (
        SELECT tutor_post_id, COUNT(*) AS c
        FROM tutor_post_joins
        GROUP BY tutor_post_id
      ) jc ON jc.tutor_post_id = tp.tutor_post_id
      LEFT JOIN tutor_post_joins jme
        ON jme.tutor_post_id = tp.tutor_post_id AND jme.user_id = ? AND jme.status='approved'
      LEFT JOIN tutor_post_joins jme_pending
        ON jme_pending.tutor_post_id = tp.tutor_post_id AND jme_pending.user_id = ? AND jme_pending.status='pending'
      ${whereSql}
      ORDER BY tp.created_at DESC, tp.tutor_post_id DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      [me, me, me, ...params]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tutor_posts tp ${whereSql}`,
      params
    );

    res.json({
      items: rows.map(r => ({
        _id: r.tutor_post_id,
        subject: r.subject,
        content: r.description,
        createdAt: r.created_at,
        group_size: Number(r.group_size || 0),
        authorId: {
          id: r.tutor_id,
          name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.tutor_id}`,
          avatarUrl: r.profile_picture_url || ''
        },
        meta: {
          target_student_level: r.target_student_level || 'ไม่ระบุ', /* ✅ ส่งค่าระดับชั้นไปให้ Frontend */
          teaching_days: r.teaching_days,
          teaching_time: r.teaching_time,
          location: r.location,
          price: Number(r.price || 0),
          contact_info: r.contact_info
        },
        fav_count: Number(r.fav_count || 0),
        favorited: !!r.favorited,
        join_count: Number(r.join_count || 0),
        joined: !!r.joined,
        pending_me: !!r.pending_me,
        images: []
      })),
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total
      }
    });
  } catch (err) {
    console.error("❌ /api/tutor-posts error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// alias: /api/tutors/:tutorId/posts
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
      `SELECT tutor_post_id, tutor_id, subject, description, target_student_level,
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
          target_student_level: r.target_student_level || 'ไม่ระบุ',
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

// GET single tutor post
app.get('/api/tutor-posts/:id', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid id' });

    const [rows] = await pool.query(`
      SELECT
        tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description,
        tp.teaching_days, tp.teaching_time, tp.location, tp.group_size, tp.price, tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name, r.lastname, tpro.profile_picture_url
      FROM tutor_posts tp
      LEFT JOIN register r       ON r.user_id = tp.tutor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
      WHERE tp.tutor_post_id = ?
      LIMIT 1
    `, [postId]);

    if (!rows.length) return res.status(404).json({ message: 'not found' });

    const r = rows[0];

    // คืนค่า join_count ของผู้ที่อนุมัติแล้วเพื่อให้ UI แสดงตัวเลขได้ถูกต้อง
    try {
      const [[cnt]] = await pool.query(
        'SELECT COUNT(*) AS c FROM tutor_post_joins WHERE tutor_post_id = ? AND status = "approved"',
        [postId]
      );
      return res.json({
        id: r.tutor_post_id,
        owner_id: r.tutor_id,
        subject: r.subject,
        description: r.description,
        group_size: Number(r.group_size || 0),
        meta: {
          teaching_days: r.teaching_days,
          teaching_time: r.teaching_time,
          location: r.location,
          price: Number(r.price || 0),
          contact_info: r.contact_info
        },
        user: { first_name: r.name || '', last_name: r.lastname || '', profile_image: r.profile_picture_url || '' },
        createdAt: r.created_at,
        join_count: Number(cnt.c || 0)
      });
    } catch (e) {
      console.error('Error fetching join count for tutor post:', e);
      return res.json({
        id: r.tutor_post_id,
        owner_id: r.tutor_id,
        subject: r.subject,
        description: r.description,
        meta: {
          teaching_days: r.teaching_days,
          teaching_time: r.teaching_time,
          location: r.location,
          price: Number(r.price || 0),
          contact_info: r.contact_info
        },
        user: { first_name: r.name || '', last_name: r.lastname || '', profile_image: r.profile_picture_url || '' },
        createdAt: r.created_at
      });
    }
  } catch (e) {
    console.error('GET /api/tutor-posts/:id error', e);
    res.status(500).json({ message: 'Server error' });
  }
});


// สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  let connection;
  try {
    const { name, lastname, email, password, type } = req.body;

    const [dup] = await pool.execute('SELECT 1 FROM register WHERE email = ?', [email]);
    if (dup.length > 0) {
      return res.json({ success: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'INSERT INTO register (name, lastname, email, password, type) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, email, password, type]
    );

    const newUserId = result.insertId;

    const [rows] = await connection.execute(
      'SELECT user_id, name, lastname, email, type FROM register WHERE user_id = ?',
      [newUserId]
    );
    const newUser = rows[0];

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      user: newUser,
      userType: newUser.type
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Register API Error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    if (connection) connection.release();
  }
});

// --------- Student Feed ----------
// --------- Student Feed (แก้ไขให้รองรับ Search + ระดับชั้น) ----------
app.get('/api/student_posts', async (req, res) => {
  try {
    const me = Number(req.query.me) || 0;
    const search = (req.query.search || '').trim(); // รับคำค้นหา

    // 1. สร้างเงื่อนไขการค้นหา (Smart Search)
    let searchClause = '';
    const queryParams = [me, me, me]; // พารามิเตอร์เริ่มต้นสำหรับ JOIN (3 ตัว)

    if (search) {
      // ใช้ฟังก์ชัน expandSearchTerm ที่มีอยู่แล้วเพื่อขยายคำค้น
      const keywords = expandSearchTerm(search);

      // สร้างเงื่อนไข OR: ค้นหาใน subject หรือ description
      const conditions = keywords.map(() =>
        `(sp.subject LIKE ? OR sp.description LIKE ?)`
      ).join(' OR ');

      searchClause = `WHERE (${conditions})`;

      // เพิ่มคำค้นหาลงใน parameters (2 ครั้งต่อ 1 คำค้น)
      keywords.forEach(kw => {
        queryParams.push(`%${kw}%`, `%${kw}%`);
      });
    }

    // 2. รัน SQL Query
    const [rows] = await pool.query(`
      SELECT
        sp.student_post_id, sp.student_id, sp.subject, sp.description,
        sp.preferred_days, TIME_FORMAT(sp.preferred_time, '%H:%i') AS preferred_time,
        sp.location, sp.group_size, sp.budget, sp.contact_info, sp.created_at,
        sp.grade_level,  /* ✅ เพิ่ม: ดึงระดับชั้นออกมาด้วย */
        r.name, r.lastname,
        spro.profile_picture_url,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE WHEN jme.user_id IS NULL THEN 0 ELSE 1 END AS joined,
        CASE WHEN jme_pending.user_id IS NULL THEN 0 ELSE 1 END AS pending_me,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
      FROM student_posts sp
      LEFT JOIN register r ON r.user_id = sp.student_id
      LEFT JOIN student_profiles spro ON spro.user_id = sp.student_id
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
      
      ${searchClause} /* ✅ ใส่เงื่อนไขค้นหาตรงนี้ */
      
      ORDER BY sp.student_post_id DESC
    `, queryParams);

    // 3. Map ข้อมูลส่งกลับ
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
      grade_level: r.grade_level || 'ไม่ระบุ', // ✅ ส่งระดับชั้นไปให้ Frontend
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      join_count: Number(r.join_count || 0),
      joined: !!r.joined,
      pending_me: !!r.pending_me,
      fav_count: Number(r.fav_count || 0),
      favorited: !!r.favorited,
      user: {
        first_name: r.name || '',
        last_name: r.lastname || '',
        profile_image: r.profile_picture_url || '/default-avatar.png'
      },
    }));

    return res.json(posts);
  } catch (err) {
    console.error('FEED ERR', err);
    return sendDbError(res, err);
  }
});

// ===== POST: สร้างโพสต์นักเรียน =====
app.post('/api/student_posts', async (req, res) => {
  try {
    const {
      user_id, subject, description, preferred_days, preferred_time,
      location, group_size, budget, contact_info, grade_level
    } = req.body;

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

    const [userExists] = await pool.execute('SELECT 1 FROM register WHERE user_id = ?', [user_id]);
    if (userExists.length === 0)
      return res.status(400).json({ success: false, message: `user_id ${user_id} not found in register` });

    const [result] = await pool.execute(
      `INSERT INTO student_posts
     (student_id, subject, description, grade_level, preferred_days, preferred_time,
      location, group_size, budget, contact_info, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, subject, description, req.body.grade_level || '', preferred_days, timeSql,
        location, groupSizeNum, budgetNum, contact_info]
    );

    const insertId = result.insertId;

    const [rows] = await pool.query(
      `SELECT
         sp.student_post_id, sp.student_id, sp.subject, sp.description,
         sp.preferred_days, sp.preferred_time, sp.location, sp.group_size,
         sp.budget, sp.contact_info, sp.grade_level, sp.created_at,
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
      meta: {
        grade_level: r.grade_level || 'ไม่ระบุ',
      },
      user: {
        first_name: r.name || '',
        last_name: r.lastname || '',
      },

    };
    // ✅ CALL HERE (หลังส่ง response ได้ก็ได้ แต่อย่าให้ throw)
    try {
      const evDate = parseDateFromPreferredDays(r.preferred_days) || new Date().toISOString().slice(0, 10);
      const evTime = toSqlTimeMaybe(r.preferred_time);
      await upsertCalendarEvent({
        user_id: r.student_id,
        post_id: r.student_post_id,
        title: `ติว: ${r.subject}`,
        subject: r.subject,
        event_date: evDate,
        event_time: evTime,
        location: r.location || null
      });

    } catch (e) { console.warn('calendar upsert (student post) failed:', e.message); }


    return res.status(201).json(created);
  } catch (err) {
    return sendDbError(res, err);
  }
});

// ===== POST: สร้างโพสต์ติวเตอร์ =====
app.post('/api/tutor-posts', upload.none(), async (req, res) => {
  console.log('--- POST /api/tutor-posts --- content-type:', req.headers['content-type'], 'body:', req.body);
  try {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลใน body ของคำขอ' });
    }

    const b = req.body;
    const payload = {
      tutor_id: Number(b.tutor_id ?? b.user_id),
      subject: b.subject,
      description: b.description ?? b.details ?? null,
      target_student_level: b.target_student_level ?? b.level ?? null,
      teaching_days: b.teaching_days ?? b.days ?? null,
      teaching_time: b.teaching_time ?? b.time ?? null,
      location: b.location ?? b.place ?? null,
      group_size: Number(b.group_size ?? 0) || 0,
      price: Number(b.price ?? b.hourly_rate ?? 0) || 0,
      contact_info: b.contact_info ?? b.contact ?? null
    };

    if (!payload.tutor_id || !payload.subject) {
      return res.status(400).json({ success: false, message: 'ต้องมี tutor_id และ subject' });
    }

    const sql = `
      INSERT INTO tutor_posts
      (tutor_id, subject, description, target_student_level, teaching_days, teaching_time, location, group_size, price, contact_info, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const vals = [
      payload.tutor_id, payload.subject, payload.description, payload.target_student_level,
      payload.teaching_days, payload.teaching_time, payload.location, payload.group_size, payload.price, payload.contact_info
    ];

    const [result] = await pool.execute(sql, vals);

    const [rows] = await pool.query(
      `SELECT 
      tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description, tp.target_student_level, tp.teaching_days, tp.teaching_time,
      tp.location, tp.group_size, tp.price, tp.contact_info, tp.created_at, r.name, r.lastname
    FROM tutor_posts tp
    LEFT JOIN register r ON r.user_id = tp.tutor_id
    WHERE tp.tutor_post_id = ?`,
      [result.insertId]
    );

    const r = rows[0];
    return res.status(201).json({
      success: true,
      item: {
        id: r.tutor_post_id,
        owner_id: r.tutor_id,
        subject: r.subject,
        description: r.description,
        meta: {
          target_student_level: r.target_student_level || 'ไม่ระบุ',
          teaching_days: r.teaching_days || '',
          teaching_time: r.teaching_time || '',
          location: r.location || '',
          price: r.price || 0,
          contact_info: r.contact_info || ''
        },
        user: {
          first_name: r.name || '',
          last_name: r.lastname || '',

        },
        group_size: Number(r.group_size || 0),
        createdAt: r.created_at
      }
    });

  } catch (err) {
    console.error('POST /api/tutor-posts error:', err);
    return res.status(500).json({ success: false, message: 'Database error', error: err.message });
  }
});

// ===== JOIN CONFIG (student & tutor) =====
const JOIN_CONFIG = {
  student: {
    postsTable: 'student_posts',
    postIdCol: 'student_post_id',
    ownerCol: 'student_id',
    joinsTable: 'student_post_joins',
    joinPostIdCol: 'student_post_id',
    hasCapacity: true,
    capacityCol: 'group_size',
    notifyType: 'join_request',
    notifyMessage: id => `มีคำขอเข้าร่วมโพสต์ #${id}`,
    countApprovedOnly: true,
  },
  tutor: {
    postsTable: 'tutor_posts',
    postIdCol: 'tutor_post_id',
    ownerCol: 'tutor_id',
    joinsTable: 'tutor_post_joins',
    joinPostIdCol: 'tutor_post_id',
    hasCapacity: false,
    capacityCol: null,
    notifyType: 'tutor_join_request',
    notifyMessage: id => `มีคำขอเข้าร่วมโพสต์ติวเตอร์ #${id}`,
    countApprovedOnly: false,
  },
};

// ---------- JOIN/UNJOIN helper ใช้ซ้ำ ----------
async function doJoinUnified(type, postId, me) {
  const cfg = JOIN_CONFIG[type];
  if (!cfg) throw new Error('invalid post type');

  const [[post]] = await pool.query(
    `SELECT ${cfg.ownerCol} AS owner_id${cfg.hasCapacity ? `, ${cfg.capacityCol} AS capacity` : ''} 
     FROM ${cfg.postsTable} WHERE ${cfg.postIdCol} = ?`,
    [postId]
  );
  if (!post) return { http: 404, body: { success: false, message: 'post not found' } };
  if (post.owner_id === me) return { http: 400, body: { success: false, message: 'คุณเป็นเจ้าของโพสต์นี้' } };

  if (cfg.hasCapacity) {
    const [[cnt]] = await pool.query(
      `SELECT COUNT(*) AS c FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ? AND status='approved'`,
      [postId]
    );
    if (cnt.c >= post.capacity) {
      return { http: 409, body: { success: false, message: 'กลุ่มนี้เต็มแล้ว' } };
    }
  }

  // สำหรับ tutor: สร้าง/อัปเดตแถวใน tutor_post_joins เพื่อบันทึกคำขอเข้าร่วม
  if (cfg.joinsTable === 'tutor_post_joins') {
    try {
      await pool.query(
        `INSERT INTO tutor_post_joins
          (tutor_post_id, user_id, status, requested_at, name, lastname)
         SELECT ?, ?, 'pending', NOW(), r.name, r.lastname
         FROM register r
         WHERE r.user_id = ?
         ON DUPLICATE KEY UPDATE
           status = IF(VALUES(status)='pending' AND status <> 'approved', 'pending', status),
           requested_at = VALUES(requested_at),
           name = VALUES(name),
           lastname = VALUES(lastname)
        `,
        [postId, me, me]
      );
    } catch (e) {
      console.error('Insert tutor_post_joins error:', e);
      // ไม่ต้องหยุด flow ของการแจ้งเตือน แต่ log ไว้
    }
  }

  let countSql = `SELECT COUNT(*) AS c FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ?`;
  if (cfg.countApprovedOnly) countSql += ` AND status='approved'`;
  const [[cntRow]] = await pool.query(countSql, [postId]);

  // เตรียมข้อความแจ้งเตือน: ถ้าเป็น tutor ให้ใส่ชื่อผู้ขอเข้าร่วมลงในข้อความด้วย
  let notifyMessage = cfg.notifyMessage(postId);
  if (cfg.joinsTable === 'tutor_post_joins') {
    try {
      const [[actorRow]] = await pool.query('SELECT name, lastname FROM register WHERE user_id = ?', [me]);
      let subject = '';
      try {
        const [[pRow]] = await pool.query('SELECT subject FROM tutor_posts WHERE tutor_post_id = ?', [postId]);
        subject = pRow?.subject || '';
      } catch (e) {
        console.error('Fetch post subject error:', e);
      }

      if (actorRow) {
        notifyMessage = `มีคำขอเข้าร่วมจาก ${actorRow.name || ''}${actorRow.lastname ? ' ' + actorRow.lastname : ''} (โพสต์ติวเตอร์ #${postId}${subject ? `: ${subject}` : ''})`;
      }
    } catch (e) {
      console.error('Fetch actor name error:', e);
    }
  }

  // ✅ แจ้งเตือน (5 คอลัมน์ตามตารางจริง)
  const [ins] = await pool.query(
    'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
    [post.owner_id, me, cfg.notifyType, notifyMessage, postId]
  );
  console.debug('Inserted notification id:', ins.insertId, 'for post', postId, 'actor', me);

  return { http: 200, body: { success: true, joined: true, pending_me: true, join_count: Number(cntRow.c || 0) } };
}

async function doUnjoinUnified(type, postId, me) {
  const cfg = JOIN_CONFIG[type];
  if (!cfg) throw new Error('invalid post type');

  await pool.query(
    `DELETE FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ? AND user_id = ?`,
    [postId, me]
  );
  await deleteCalendarEventForUser(me, postId);

  let countSql = `SELECT COUNT(*) AS c FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ?`;
  if (cfg.countApprovedOnly) countSql += ` AND status='approved'`;
  const [[cntRow]] = await pool.query(countSql, [postId]);

  return { http: 200, body: { success: true, joined: false, pending_me: false, join_count: Number(cntRow.c || 0) } };
}

// ---------- Unified Join/Unjoin ----------
app.post('/api/posts/:type/:id/join', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!JOIN_CONFIG[type]) return res.status(400).json({ success: false, message: 'invalid post type' });
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) {
    return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  }
  try {
    const out = await doJoinUnified(type, postId, me);
    return res.status(out.http).json(out.body);
  } catch (err) {
    console.error('[JOIN unified] error:', err);
    return sendDbError(res, err);
  }
});

app.delete('/api/posts/:type/:id/join', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!JOIN_CONFIG[type]) return res.status(400).json({ success: false, message: 'invalid post type' });
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id || req.query.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) {
    return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  }
  try {
    const out = await doUnjoinUnified(type, postId, me);
    return res.status(out.http).json(out.body);
  } catch (err) {
    console.error('[UNJOIN unified] error:', err);
    return sendDbError(res, err);
  }
});

// ---------- Alias สำหรับ tutor ----------
// JOIN (snake-case)
app.post('/api/tutor_posts/:id/join', async (req, res) => {
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) {
    return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  }
  try {
    const out = await doJoinUnified('tutor', postId, me);

    // Note: notifications are created inside doJoinUnified to keep behavior consistent
    return res.status(out.http).json(out.body);
  } catch (e) {
    console.error('tutor_posts join error', e);
    return sendDbError(res, e);
  }
});
app.delete('/api/tutor_posts/:id/join', async (req, res) => {
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id || req.query.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  try {
    const out = await doUnjoinUnified('tutor', postId, me);
    return res.status(out.http).json(out.body);
  } catch (e) {
    console.error('tutor_posts unjoin error', e);
    return sendDbError(res, e);
  }
});
app.post('/api/tutor-posts/:id/join', async (req, res) => {
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) {
    return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  }
  try {
    const out = await doJoinUnified('tutor', postId, me);

    // Note: notifications are created inside doJoinUnified to keep behavior consistent

    return res.status(out.http).json(out.body);
  } catch (e) {
    console.error('tutor-posts join error', e);
    return sendDbError(res, e);
  }
});
app.delete('/api/tutor-posts/:id/join', async (req, res) => {
  const postId = Number(req.params.id);
  const me = Number(req.body?.user_id || req.query.user_id);
  if (!Number.isFinite(postId) || !Number.isFinite(me)) return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
  try {
    const out = await doUnjoinUnified('tutor', postId, me);
    return res.status(out.http).json(out.body);
  } catch (e) {
    console.error('tutor-posts unjoin error', e);
    return sendDbError(res, e);
  }
});

// ---------- Student Join/Unjoin (เดิม)
app.post('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me = Number(req.body.user_id);
    if (!Number.isFinite(postId) || !Number.isFinite(me)) {
      return res.status(400).json({ success: false, message: 'invalid postId or user_id' });
    }

    const [[post]] = await pool.query(
      'SELECT student_id, group_size FROM student_posts WHERE student_post_id = ?',
      [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'post not found' });

    if (post.student_id === me) {
      return res.status(400).json({ success: false, message: 'คุณเป็นเจ้าของโพสต์นี้' });
    }

    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status="approved"',
      [postId]
    );
    if (cnt.c >= post.group_size) {
      return res.status(409).json({ success: false, message: 'กลุ่มนี้เต็มแล้ว' });
    }

    await pool.query(
      `
      INSERT INTO student_post_joins
        (student_post_id, user_id, status, requested_at, name, lastname)
      SELECT ?, ?, 'pending', NOW(), r.name, r.lastname
      FROM register r
      WHERE r.user_id = ?
      ON DUPLICATE KEY UPDATE
        status       = IF(VALUES(status)='pending' AND status <> 'approved', 'pending', status),
        requested_at = VALUES(requested_at),
        name         = VALUES(name),
        lastname     = VALUES(lastname)
      `,
      [postId, me, me]
    );

    const [[cntApproved]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status="approved"',
      [postId]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
      [post.student_id, me, 'join_request', `มีคำขอเข้าร่วมโพสต์ #${postId}`, postId]
    );

    return res.json({ success: true, joined: true, join_count: Number(cntApproved.c || 0) });
  } catch (err) {
    console.error(err);
    return sendDbError(res, err);
  }
});

// ✅ API ลบโพสต์นักเรียน
app.delete('/api/student_posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    
    // ลบข้อมูลที่เกี่ยวข้องในตาราง joins ก่อน (ถ้าไม่ได้ตั้ง cascade ไว้ใน database)
    await pool.query('DELETE FROM student_post_joins WHERE student_post_id = ?', [postId]);
    
    // ลบโพสต์จริง
    const [result] = await pool.query('DELETE FROM student_posts WHERE student_post_id = ?', [postId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // ลบ Event ในปฏิทินที่เกี่ยวข้องด้วย
    await pool.query('DELETE FROM calendar_events WHERE post_id = ?', [postId]);

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/student_posts/:id error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ✅ API ลบโพสต์ติวเตอร์
app.delete('/api/tutor-posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    
    // ลบข้อมูลที่เกี่ยวข้อง (เช่น favorites, join requests) ถ้ามี
    // await pool.query('DELETE FROM favorites WHERE post_id = ? AND post_type = "tutor"', [postId]); 
    // await pool.query('DELETE FROM tutor_post_joins WHERE tutor_post_id = ?', [postId]);

    // ลบโพสต์จริง
    const [result] = await pool.query('DELETE FROM tutor_posts WHERE tutor_post_id = ?', [postId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/tutor-posts/:id error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// >>> ใหม่: API ดึงรายชื่อผู้เข้าร่วมของโพสต์นักเรียน
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

// >>> ดึงรายชื่อผู้เข้าร่วมโพสต์ติวเตอร์ (approved เท่านั้น)
app.get('/api/tutor_posts/:id/joiners', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid post id' });

    const [rows] = await pool.query(
      `SELECT j.user_id, j.joined_at, r.name, r.lastname
       FROM tutor_post_joins j
       LEFT JOIN register r ON r.user_id = j.user_id
      WHERE j.tutor_post_id = ? AND j.status = 'approved'
      ORDER BY j.joined_at ASC, j.user_id ASC`,
      [postId]
    );

    res.json(rows.map(x => ({ user_id: x.user_id, joined_at: x.joined_at, name: x.name || '', lastname: x.lastname || '' })));
  } catch (e) {
    console.error('GET /api/tutor_posts/:id/joiners error', e);
    return sendDbError(res, e);
  }
});

app.get('/api/student_posts/:id/requests', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) {
      return res.status(400).json({ message: 'invalid post id' });
    }

    const status = (req.query.status || '').trim().toLowerCase();
    const useFilter = ['pending', 'approved', 'rejected'].includes(status);

    const sql = `
      SELECT 
        j.student_post_id, j.user_id, j.status, j.requested_at,
        j.name, j.lastname, r.email
      FROM student_post_joins j
      LEFT JOIN register r ON r.user_id = j.user_id
      WHERE j.student_post_id = ? ${useFilter ? 'AND j.status = ?' : ''}
      ORDER BY j.requested_at DESC
    `;

    const params = useFilter ? [postId, status] : [postId];
    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (e) {
    console.error('GET /api/student_posts/:id/requests error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// >>> อนุมัติ/ปฏิเสธคำขอ ของโพสต์นักเรียน (REWRITE)
app.put('/api/student_posts/:id/requests/:userId', async (req, res) => {
  const postId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);  // ผู้ถูกอนุมัติ/ถูกปฏิเสธ
  const action = String(req.body?.action || '').toLowerCase(); // 'approve' | 'reject'

  if (!Number.isFinite(postId) || !Number.isFinite(targetUserId)) {
    return res.status(400).json({ message: 'invalid ids' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      // ดึง owner เพื่อนำไปใส่ actor_id ใน notifications
      const [[sp]] = await conn.query(
        `SELECT student_id AS owner_id FROM student_posts WHERE student_post_id = ?`,
        [postId]
      );
      if (!sp) {
        conn.release();
        return res.status(404).json({ message: 'post not found' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // อัปเดตสถานะ + เวลา
      const [r] = await conn.query(
        `UPDATE student_post_joins
           SET status = ?, decided_at = NOW(), joined_at = IF(?='approved', NOW(), joined_at)
         WHERE student_post_id = ? AND user_id = ?`,
        [newStatus, newStatus, postId, targetUserId]
      );

      if (!r.affectedRows) {
        conn.release();
        return res.status(404).json({ message: 'request not found' });
      }

      // จัดการปฏิทิน + แจ้งเตือนผู้ถูกอนุมัติ/ปฏิเสธ
      if (newStatus === 'approved') {
        // สร้าง event ให้ owner และผู้ถูกอนุมัติ
        await createCalendarEventsForStudentApproval(postId, targetUserId);

        // ส่งแจ้งเตือนไปหาผู้ถูกอนุมัติ (actor = owner)
        await conn.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
           VALUES (?, ?, ?, ?, ?)`,
          [targetUserId, sp.owner_id, 'join_approved',
            `คำขอของคุณสำหรับโพสต์ #${postId} ได้รับการอนุมัติแล้ว`, postId]
        );
      } else {
        // REJECT: ลบ event ของผู้ถูกปฏิเสธ (ถ้ามี)
        await deleteCalendarEventForUser(targetUserId, postId);

        // แจ้งเตือนผู้ถูกปฏิเสธ (actor = owner)
        await conn.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
           VALUES (?, ?, ?, ?, ?)`,
          [targetUserId, sp.owner_id, 'join_rejected',
            `คำขอของคุณสำหรับโพสต์ #${postId} ถูกปฏิเสธ`, postId]
        );
      }

      conn.release();

      // คืนค่า join_count ปัจจุบันและรายชื่อผู้เข้าร่วมที่อนุมัติแล้ว
      try {
        const [[cnt]] = await pool.query(
          'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status = "approved"',
          [postId]
        );
        const [joiners] = await pool.query(
          'SELECT user_id, name, lastname FROM student_post_joins WHERE student_post_id = ? AND status = "approved" ORDER BY joined_at ASC',
          [postId]
        );
        return res.json({ success: true, status: newStatus, join_count: Number(cnt.c || 0), joiners });
      } catch (e) {
        console.error('Error fetching joiners/count after student request update:', e);
        return res.json({ success: true, status: newStatus });
      }
    } catch (e) {
      conn.release();
      throw e;
    }
  } catch (err) {
    console.error('PUT /api/student_posts/:id/requests/:userId error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// server.js

// >>> ดึงปฏิทินของผู้ใช้ (ฉบับแสดงทั้งหมด ไม่ซ่อนโพสต์)
app.get('/api/calendar/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'invalid user id' });
    }

    // รับช่วงเวลา
    let { start, end } = req.query;
    const today = localDateStr();
    if (!start) { const d = new Date(); d.setDate(d.getDate() - 30); start = localDateStr(d); }
    if (!end) { const d = new Date(); d.setDate(d.getDate() + 30); end = localDateStr(d); }

    // 1) ดึงอีเวนต์นัดหมาย (Calendar Events)
    // ใช้ uniqueCalMap เพื่อกรองเฉพาะ event ที่ id ซ้ำกันเองในตาราง (ป้องกัน error DB)
    const [rowsCal] = await pool.query(
      `SELECT event_id, user_id, post_id, title, subject, event_date, event_time, location, created_at
       FROM calendar_events
       WHERE user_id = ?
         AND (event_date BETWEEN ? AND ? OR event_date IS NULL)
       ORDER BY COALESCE(event_date, ?) ASC`,
      [userId, start, end, today]
    );

    const uniqueCalMap = new Map();
    rowsCal.forEach(r => {
      const key = r.post_id ? `post-${r.post_id}-${r.subject}` : `evt-${r.event_id}`;
      if (!uniqueCalMap.has(key)) {
        uniqueCalMap.set(key, {
          event_id: r.event_id,
          user_id: r.user_id,
          post_id: r.post_id,
          title: r.title, // เช่น "ติว: คณิต"
          subject: r.subject,
          event_date: r.event_date,
          event_time: r.event_time,
          location: r.location || null,
          created_at: r.created_at,
          source: 'calendar'
        });
      }
    });
    const calItems = Array.from(uniqueCalMap.values());

    // 2) ดึงโพสต์หาติวเตอร์ (student_posts)
    // ✅ แก้ไข: ไม่มีการกรองทิ้ง (ลบ .filter ออก) แสดงหมดเลย
    const [rowsStudentPosts] = await pool.query(
      `SELECT student_post_id, student_id, subject, preferred_days, preferred_time, location, created_at
       FROM student_posts
       WHERE student_id = ?`,
      [userId]
    );

    const studentPostsAsEvents = rowsStudentPosts.map(p => {
      const event_date = parseDateFromPreferredDays(p.preferred_days);
      const event_time = toSqlTimeMaybe(p.preferred_time);
      return {
        event_id: `sp-${p.student_post_id}`,
        user_id: p.student_id,
        post_id: p.student_post_id,
        title: `โพสต์หาครู: ${p.subject || 'เรียนพิเศษ'}`, // เปลี่ยนชื่อให้ชัดเจน
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'student_post'
      };
    });

    // 3) ดึงโพสต์สอนพิเศษ (tutor_posts)
    // ✅ แก้ไข: ไม่มีการกรองทิ้ง (ลบ .filter ออก) แสดงหมดเลย
    const [rowsTutorPosts] = await pool.query(
      `SELECT tutor_post_id, tutor_id, subject, teaching_days, teaching_time, location, created_at
       FROM tutor_posts
       WHERE tutor_id = ?`,
      [userId]
    );

    const tutorPostsAsEvents = rowsTutorPosts.map(p => {
      const event_date = parseDateFromPreferredDays(p.teaching_days);
      const event_time = toSqlTimeMaybe(p.teaching_time);
      return {
        event_id: `tp-${p.tutor_post_id}`,
        user_id: p.tutor_id,
        post_id: p.tutor_post_id,
        title: `โพสต์รับสอน: ${p.subject || 'วิชาทั่วไป'}`, // เปลี่ยนชื่อให้ชัดเจน
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_post'
      };
    });

    // รวมทั้งหมด
    const allEvents = [...calItems, ...studentPostsAsEvents, ...tutorPostsAsEvents];

    // กรองเฉพาะที่มีวันที่ถูกต้อง และอยู่ในช่วงเวลา
    const items = allEvents
      .filter(ev => ev.event_date && ev.event_date >= start && ev.event_date <= end)
      .sort((a, b) => {
        const da = a.event_date || '9999-12-31';
        const db = b.event_date || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return (a.event_time || '00:00:00') < (b.event_time || '00:00:00') ? -1 : 1;
      });

    return res.json({ items, range: { start, end } });
  } catch (e) {
    console.error('GET /api/calendar/:userId error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// === ดึงคำขอเข้าร่วมของ tutor post (pending เท่านั้น) ===
app.get('/api/tutor_posts/:id/requests', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid post id' });

    const status = (req.query.status || 'pending').toLowerCase();
    const whereStatus = ['pending', 'approved', 'rejected'].includes(status) ? 'AND j.status = ?' : '';
    const params = [postId];
    if (whereStatus) params.push(status);

    const [rows] = await pool.query(`
      SELECT
        j.tutor_post_id,
        j.user_id,
        j.status,
        j.requested_at,
        j.name,
        j.lastname
      FROM tutor_post_joins j
      WHERE j.tutor_post_id = ?
      ${whereStatus}
      ORDER BY j.requested_at DESC
    `, params);

    res.json(rows);
  } catch (e) {
    return sendDbError(res, e);
  }
});

// === อนุมัติ/ปฏิเสธ คำขอของ tutor post (REWRITE) ===
app.put('/api/tutor_posts/:id/requests/:userId', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.params.userId);
    // รับ action จากทั้ง body และ query
    const action = String((req.body?.action || req.query?.action || '')).toLowerCase();

    if (!Number.isFinite(postId) || !Number.isFinite(userId))
      return res.status(400).json({ message: 'invalid ids' });
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ message: 'invalid action' });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    console.error('PUT /api/tutor_posts/:id/requests/:userId params:', { postId, userId, action, newStatus });

    const [r] = await pool.query(
      `UPDATE tutor_post_joins
       SET status=?, decided_at = NOW(), joined_at = IF(?='approved', NOW(), joined_at)
       WHERE tutor_post_id=? AND user_id=?`,
      [newStatus, newStatus, postId, userId]
    );

    console.debug('UPDATE tutor_post_joins result:', r);

    if (!r.affectedRows) {
      // เพิ่ม log ข้อมูลเชิงสืบค้นเพิ่มเติม
      console.warn(`No rows updated for postId=${postId} userId=${userId}. Verifying existence...`);
      try {
        const [check] = await pool.query(
          'SELECT tutor_post_id, user_id, status FROM tutor_post_joins WHERE tutor_post_id = ? AND user_id = ?',
          [postId, userId]
        );
        console.debug('Existence check result:', check);
      } catch (ex) {
        console.error('Existence check error:', ex);
      }

      return res.status(404).json({ message: 'request not found' });
    }

    if (newStatus === 'approved') {
      // ... code สร้าง calendar ...
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?,?,?,?,?)',
        [userId, null, 'join_approved', `คำขอของคุณสำหรับโพสต์ติวเตอร์ #${postId} ได้รับการอนุมัติแล้ว`, postId]
      );
    }
    else {
      await deleteCalendarEventForUser(userId, postId);
    }

    // คืนค่า join_count ปัจจุบันและรายชื่อผู้เข้าร่วมที่อนุมัติแล้ว
    try {
      const [[cnt]] = await pool.query(
        `SELECT COUNT(*) AS c FROM tutor_post_joins WHERE tutor_post_id = ? AND status = 'approved'`,
        [postId]
      );
      const [joiners] = await pool.query(
        `SELECT user_id, name, lastname FROM tutor_post_joins WHERE tutor_post_id = ? AND status = 'approved' ORDER BY joined_at ASC`,
        [postId]
      );
      return res.json({ success: true, status: newStatus, join_count: Number(cnt.c || 0), joiners });
    } catch (e) {
      console.error('Error fetching joiners/count after update:', e);
      return res.json({ success: true, status: newStatus });
    }
  } catch (e) {
    return sendDbError(res, e);
  }
});

// ---------- Notifications (ฉบับอัปเกรด: ดึงรูป + ชื่อวิชา) ----------
app.get('/api/notifications/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const sql = `
      SELECT 
        n.notification_id,
        n.type,
        n.message,
        n.related_id,
        n.is_read,
        n.created_at,
        n.user_id,
        n.actor_id,
        -- ข้อมูลผู้กระทำ (Actor)
        au.name AS actor_firstname, 
        au.lastname AS actor_lastname,
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS actor_avatar,
        
        -- ข้อมูลวิชา (Subject) จากโพสต์ที่เกี่ยวข้อง
        CASE 
            WHEN n.type IN ('join_request', 'join_approved', 'join_rejected') THEN sp.subject
            WHEN n.type IN ('tutor_join_request') THEN tp.subject
            ELSE NULL 
        END AS post_subject

      FROM notifications n
      LEFT JOIN register au ON au.user_id = n.actor_id
      -- Join เพื่อเอารูปโปรไฟล์ (ลองหาทั้งจาก student และ tutor profile)
      LEFT JOIN student_profiles spro ON spro.user_id = n.actor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = n.actor_id
      
      -- Join เพื่อเอาชื่อวิชา (Subject)
      LEFT JOIN student_posts sp ON n.related_id = sp.student_post_id
      LEFT JOIN tutor_posts tp ON n.related_id = tp.tutor_post_id
      
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.notification_id DESC
    `;

    const [results] = await pool.execute(sql, [user_id]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

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

// ✅ อนุญาตสร้างแจ้งเตือนเอง พร้อม actor_id
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, actor_id = null, type, message, related_id = null } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
      [user_id, actor_id, type, message, related_id || null]
    );
    res.json({ notification_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});


// ---------- Student Profile ----------
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
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
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});
app.put('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      nickname, phone_number, address, grade_level, institution,
      faculty, major, about_me, profile_picture_url
    } = req.body;

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
    await pool.execute(sql, [
      userId, nickname ?? null, phone_number ?? null, address ?? null,
      grade_level ?? null, institution ?? null, faculty ?? null, major ?? null,
      about_me ?? null, profile_picture_url ?? null
    ]);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// ---------- Tutor Profile ----------
app.get('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
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
    if (rows.length === 0) return res.status(404).json({ message: 'Tutor not found' });

    const profile = rows[0];
    if (profile.education) profile.education = JSON.parse(profile.education);
    if (profile.teaching_experience) profile.teaching_experience = JSON.parse(profile.teaching_experience);
    res.json(profile);
  } catch (err) {
    console.error('Error fetching tutor profile:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});
app.put('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const body = req.body;

    const educationJson = body.education ? JSON.stringify(body.education) : null;
    const teachingExperienceJson = body.teaching_experience ? JSON.stringify(body.teaching_experience) : null;

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
      body.hourly_rate ?? null,
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

// ---------- Upload ----------
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
});

// ---------- Favorites ----------
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

      const [cntRows] = await conn.query(
        'SELECT COUNT(*) AS c FROM posts_favorites WHERE post_type=? AND post_id=?',
        [post_type, post_id]
      );
      const fav_count = Number(cntRows?.[0]?.c || 0);

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

app.get('/api/favorites/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

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

// ================== Calendar Helpers ==================
function parseDateFromPreferredDays(s) {
  if (!s) return null;
  s = String(s).trim();

  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y.padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) {
    const d = String(m[1]).padStart(2, '0');
    const mo = String(m[2]).padStart(2, '0');
    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;
    return `${y}-${mo}-${d}`;
  }

  const months = {
    'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
    'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
    'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
  };
  m = s.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (m) {
    const d = String(parseInt(m[1], 10)).padStart(2, '0');
    const monTxt = m[2];
    const mo = months[monTxt];
    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;
    if (mo) return `${y}-${String(mo).padStart(2, '0')}-${d}`;
  }
  return null;
}

function toSqlTimeMaybe(v) {
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  return null;
}

// ------ upsert / delete ------
async function upsertCalendarEvent({ user_id, post_id, title, subject, event_date, event_time, location }) {
  await pool.query(
    `INSERT INTO calendar_events (user_id, post_id, title, subject, event_date, event_time, location)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title=VALUES(title),
       subject=VALUES(subject),
       event_date=VALUES(event_date),
       event_time=VALUES(event_time),
       location=VALUES(location)`,
    [user_id, post_id, title, subject, event_date, event_time, location]
  );
}
async function deleteCalendarEventForUser(userId, postId) {
  await pool.query('DELETE FROM calendar_events WHERE user_id=? AND post_id=?', [userId, postId]);
}

// ------ สร้าง event ตอนอนุมัติ (Student post) ------
async function createCalendarEventsForStudentApproval(postId, joinerId) {
  const [[sp]] = await pool.query(
    `SELECT sp.*, r.name, r.lastname
     FROM student_posts sp
     LEFT JOIN register r ON r.user_id = sp.student_id
     WHERE sp.student_post_id = ?`,
    [postId]
  );
  if (!sp) return;

  const subjectText = sp.subject || 'เรียนพิเศษ';
  const titleText = `ติว: ${subjectText}`;
  const location = sp.location || null;
  const event_date = parseDateFromPreferredDays(sp.preferred_days) || new Date().toISOString().slice(0, 10);
  const event_time = toSqlTimeMaybe(sp.preferred_time);

  // owner + participant
  await upsertCalendarEvent({
    user_id: sp.student_id, post_id: postId,
    title: titleText, subject: subjectText, event_date, event_time, location
  });
  await upsertCalendarEvent({
    user_id: Number(joinerId), post_id: postId,
    title: titleText, subject: subjectText, event_date, event_time, location
  });
}

// ------ สร้าง event ตอนอนุมัติ (Tutor post) ------
async function createCalendarEventsForTutorApproval(postId, joinerId) {
  const [[tp]] = await pool.query(
    `SELECT tp.*, r.name, r.lastname
     FROM tutor_posts tp
     LEFT JOIN register r ON r.user_id = tp.tutor_id
     WHERE tp.tutor_post_id = ?`,
    [postId]
  );
  if (!tp) return;

  const subjectText = tp.subject || 'ติว';
  const titleText = `สอน: ${subjectText}`;
  const location = tp.location || null;
  const event_date = parseDateFromPreferredDays(tp.teaching_days) || new Date().toISOString().slice(0, 10);
  const event_time = toSqlTimeMaybe(tp.teaching_time);

  await upsertCalendarEvent({
    user_id: tp.tutor_id, post_id: postId,
    title: titleText, subject: subjectText, event_date, event_time, location
  });
  await upsertCalendarEvent({
    user_id: Number(joinerId), post_id: postId,
    title: titleText, subject: subjectText, event_date, event_time, location
  });
}

// --- API สำหรับดึงข้อมูลโพสต์ติวเตอร์เพื่อแสดงในหน้ารีวิว ---
app.get('/api/review-info/:tutorPostId', async (req, res) => {
  try {
    const { tutorPostId } = req.params;

    // JOIN 3 ตาราง: tutor_posts -> register (เอาชื่อ) -> tutor_profiles (เอารูป/ข้อมูลอื่นถ้าอยากได้)
    const [rows] = await pool.execute(`
      SELECT 
        tp.subject,
        r.name,
        r.lastname
      FROM tutor_posts tp
      JOIN register r ON tp.tutor_id = r.user_id
      WHERE tp.tutor_post_id = ?
    `, [tutorPostId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบโพสต์นี้' });
    }

    const info = rows[0];
    res.json({
      success: true,
      subject: info.subject,
      tutorName: `${info.name} ${info.lastname}`
    });

  } catch (err) {
    console.error('GET /api/review-info error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- API สำหรับบันทึกรีวิว (Mockup) ---
app.post('/api/reviews', async (req, res) => {
  try {
    const { tutor_post_id, student_id, rating, comment } = req.body;

    // 1. หา tutor_id จาก tutor_post_id ก่อน
    const [posts] = await pool.execute('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [tutor_post_id]);

    if (posts.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });
    const tutor_id = posts[0].tutor_id;

    // 2. บันทึกลงตาราง reviews
    const [result] = await pool.execute(
      `INSERT INTO reviews (booking_id, tutor_id, student_id, rating, comment, created_at) 
       VALUES (0, ?, ?, ?, ?, NOW())`,
      [tutor_id, student_id, rating, comment]
    );

    res.json({ success: true, message: 'บันทึกรีวิวสำเร็จ', reviewId: result.insertId });

  } catch (err) {
    console.error('POST /api/reviews error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/tutor-posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const [rows] = await pool.execute(
      `SELECT 
        tp.tutor_post_id, 
        tp.subject, 
        tp.tutor_id,
        r.name, 
        r.lastname 
       FROM tutor_posts tp
       LEFT JOIN register r ON tp.tutor_id = r.user_id 
       WHERE tp.tutor_post_id = ?`,
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบโพสต์นี้ในฐานข้อมูล' });
    }

    const post = rows[0];

    res.json({
      tutor_post_id: post.tutor_post_id,
      subject: post.subject || "ไม่ระบุวิชา", // กันค่า null
      owner_id: post.tutor_id,
      user: {
        // ถ้าหาชื่อไม่เจอ ให้แสดงค่า default
        first_name: post.name || "ไม่ทราบชื่อ",
        last_name: post.lastname || ""
      }
    });

  } catch (err) {
    console.error('GET /api/tutor-posts/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- ดึงรีวิวของติวเตอร์มาแสดงในหน้า TutorProfile.jsx ---
app.get('/api/tutors/:tutorId/reviews', async (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    if (!Number.isFinite(tutorId)) return res.status(400).json({ message: 'Invalid tutor ID' });

    const sql = `
      SELECT 
        rv.review_id,
        rv.rating,
        rv.comment,
        rv.created_at,
        -- ข้อมูลนักเรียนจากตาราง register
        r.name AS student_name,
        r.lastname AS student_lastname,
        -- รูปโปรไฟล์จากตาราง student_profiles (ถ้ามี)
        sp.profile_picture_url
      FROM reviews rv
      JOIN register r ON rv.student_id = r.user_id
      LEFT JOIN student_profiles sp ON rv.student_id = sp.user_id
      WHERE rv.tutor_id = ?
      ORDER BY rv.created_at DESC
    `;

    const [rows] = await pool.query(sql, [tutorId]);

    const reviews = rows.map(row => ({
      id: row.review_id,
      rating: Number(row.rating),
      comment: row.comment,
      createdAt: row.created_at,
      reviewer: {
        name: `${row.student_name} ${row.student_lastname || ''}`.trim(),
        avatar: row.profile_picture_url || '/default-avatar.png'
      }
    }));

    res.json(reviews);

  } catch (err) {
    console.error('GET /api/tutors/:tutorId/reviews error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ---------- Health ----------
app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));