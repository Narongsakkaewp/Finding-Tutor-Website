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

// ===== GET: ดึงฟีดนักเรียนทั้งหมด (รองรับกรองเฉพาะของฉัน) =====
app.get('/api/student_posts', async (req, res) => {
  try {
    const me    = Number(req.query.me) || 0; // ใช้เช็ค joined
    const mine  = String(req.query.mine || '').toLowerCase() === '1' || String(req.query.mine || '').toLowerCase() === 'true';
    const owner = mine ? me : Number(req.query.owner_id || 0); // ถ้า mine=1 ให้โชว์เฉพาะของตัวเอง

    // สร้าง WHERE แบบเลือกได้
    let whereSql = '';
    const params = [me]; // ลำดับ params ต้องเรียงตามตำแหน่ง ? ใน SQL (jme.user_id มาก่อน WHERE)
    if (owner) {
      whereSql = 'WHERE sp.student_id = ?';
      params.push(owner);
    }

    const [rows] = await pool.query(`
      SELECT
        sp.student_post_id, sp.student_id, sp.subject, sp.description,
        sp.preferred_days, TIME_FORMAT(sp.preferred_time, '%H:%i') AS preferred_time,
        sp.location, sp.group_size, sp.budget, sp.contact_info, sp.created_at,
        r.name, r.lastname,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE WHEN jme.user_id IS NULL THEN 0 ELSE 1 END AS joined
      FROM student_posts sp
      LEFT JOIN register r ON r.user_id = sp.student_id
      LEFT JOIN (
        SELECT student_post_id, COUNT(*) AS join_count
        FROM student_post_joins GROUP BY student_post_id
      ) jc ON jc.student_post_id = sp.student_post_id
      LEFT JOIN student_post_joins jme
        ON jme.student_post_id = sp.student_post_id AND jme.user_id = ?
      ${whereSql}
      ORDER BY sp.student_post_id DESC
    `, params);

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
      user: {
        first_name: r.name || '',
        last_name:  r.lastname || '',
        profile_image: '/default-avatar.png',
      },
    }));

    return res.json(posts);
  } catch (err) {
    console.error('FEED ERR', err);
    return res.status(500).json({ success:false, message: err?.sqlMessage || err?.message || 'Database error' });
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

// ผู้ใช้กด Join โพสต์
app.post('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me     = Number(req.body.user_id);
    if (!Number.isFinite(postId) || !Number.isFinite(me))
      return res.status(400).json({ success:false, message:'invalid postId or user_id' });

    // ตรวจโพสต์
    const [[post]] = await pool.query(
      'SELECT student_id, group_size FROM student_posts WHERE student_post_id = ?',
      [postId]
    );
    if (!post) return res.status(404).json({ success:false, message:'post not found' });

    // ห้ามเจ้าของโพสต์ join
    if (post.student_id === me)
      return res.status(400).json({ success:false, message:'คุณเป็นเจ้าของโพสต์นี้' });

    // เต็มหรือยัง
    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ?',
      [postId]
    );
    if (cnt.c >= post.group_size)
      return res.status(409).json({ success:false, message:'กลุ่มนี้เต็มแล้ว' });

    // ใส่ join (กันซ้ำด้วย UNIQUE/PRIMARY KEY)
    await pool.query(
      'INSERT IGNORE INTO student_post_joins (student_post_id, user_id) VALUES (?, ?)',
      [postId, me]
    );

    const [[cnt2]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ?',
      [postId]
    );

    // >>> ดึงรายชื่อผู้เข้าร่วมทั้งหมด (ชื่อ-สกุล)
    const joiners = await getJoiners(postId);

    return res.json({ success:true, joined:true, join_count: cnt2.c, joiners });
  } catch (err) {
    return sendDbError(res, err);
  }
});

// ผู้ใช้ยกเลิก Join
app.delete('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me     = Number(req.body?.user_id || req.query.user_id);
    if (!Number.isFinite(postId) || !Number.isFinite(me))
      return res.status(400).json({ success:false, message:'invalid postId or user_id' });

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

    return res.json({ success:true, joined:false, join_count: cnt.c, joiners });
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


// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));