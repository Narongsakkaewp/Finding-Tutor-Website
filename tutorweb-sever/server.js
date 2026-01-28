// tutorweb-server/server.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./service-account.json');

const SPREADSHEET_ID = '1djs9ACE03WeImxVwuz6VfhnJ0ev1R473VQKVLYt5ynM';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ----- Upload Deps -----
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ----- recommendation sets -----
const pool = require('./db'); // นำเข้าไฟล์การตั้งค่า DB
const recommendationController = require('./src/controllers/recommendationController'); // ✅ Import Recommendations
const scheduleController = require('./src/controllers/scheduleController');
const searchRoutes = require('./src/routes/searchRoutes');
const favoriteRoutes = require('./src/routes/favoriteRoutes');
const searchController = require('./src/controllers/searchController'); // Import searchController for history

// ----- Email Deps -----
const nodemailer = require('nodemailer');
const { initCron, checkAndSendNotifications } = require('./src/services/cronService');

// Initialize Scheduler
initCron();

// ตั้งค่า Email Sender
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 's6603052413159@email.kmutnb.ac.th',
    pass: 'mbtb ixlb oulm zlea'
  }
});

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
  'สเปน': ['spanish', 'esp', 'espanol'],
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
  'code': ['program', 'python', 'react', 'web', 'java', 'c++', 'html', 'css'],
  'เขียนโปรแกรม': ['code', 'program', 'python', 'java', 'c++'],
  'python': ['code', 'program', 'เขียนโปรแกรม', 'data science', 'ai'],
  'java': ['code', 'program', 'เขียนโปรแกรม', 'oop'],
  'react': ['web', 'frontend', 'code', 'program']
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

// ฟังก์ชันสำหรับบันทึกข้อมูล
async function saveToGoogleSheet(data) {
  try {
    // 1. ตั้งค่าการยืนยันตัวตน
    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // 2. โหลดเอกสาร
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // 3. เลือกแผ่นงานแรก (Sheet2)
    const sheet = doc.sheetsByIndex[1];

    // 4. เพิ่มแถวใหม่
    await sheet.addRow({
      Timestamp: new Date().toLocaleString('th-TH'),
      User: data.user_contact,
      Category: data.category,
      Topic: data.topic,
      Detail: data.detail
    });

    console.log("✅ บันทึกลง Google Sheet เรียบร้อยแล้ว!");
  } catch (err) {
    console.error("❌ Google Sheet Error:", err.message);
    // ไม่ throw error เพื่อให้หน้าเว็บทำงานต่อได้แม้ Sheet มีปัญหา
  }
}

// ---------- APIs ----------
app.get('/api/recommendations', recommendationController.getRecommendations);
app.get('/api/test-cron', async (req, res) => {
  await checkAndSendNotifications();
  res.json({ message: 'Cron job manual trigger executed' });
});

app.get('/api/debug/backfill-reviews', async (req, res) => {
  const { checkMissedReviewRequests } = require('./src/services/cronService');
  await checkMissedReviewRequests(7); // Check past 7 days
  res.json({ message: 'Backfill check for reviews triggered (past 7 days)' });
});
app.use('/api/search', searchRoutes);
app.get('/api/search/history', searchController.getMySearchHistory); // ดึงประวัติการค้นหาของฉัน
app.delete('/api/search/history/:id', searchController.deleteSearchHistory); // ลบประวัติการค้นหา
app.use('/api/favorites', favoriteRoutes);

// --- 🧠 Recommendation API ---
app.get('/api/recommendations/courses', recommendationController.getRecommendations);
app.get('/api/recommendations/tutor', recommendationController.getStudentRequestsForTutor);
app.get('/api/recommendations/friends', recommendationController.getStudyBuddyRecommendations);

// --- ⭐ Reviews API ---
// --- ⭐ Reviews API ---
app.post('/api/reviews', async (req, res) => {
  try {
    let {
      tutor_id, student_id, tutor_post_id, post_id, post_type,
      rating, rating_punctuality, rating_worth, rating_teaching,
      comment
    } = req.body;

    // Support tutor_post_id or post_id from frontend (normalize to post_id/tutor_id)
    const targetPostId = tutor_post_id || post_id;

    // 1. Try to resolve missing tutor_id OR missing post_type from tutor_posts
    if (targetPostId) {
      // Check Tutor Posts
      const [posts] = await pool.query('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [targetPostId]);
      if (posts.length > 0) {
        if (!tutor_id) tutor_id = posts[0].tutor_id;
        post_id = targetPostId;
        post_type = 'tutor_post';
      } else {
        // Check Student Posts (if not found in tutor_posts)
        const [sp] = await pool.query('SELECT student_id FROM student_posts WHERE student_post_id = ?', [targetPostId]);
        if (sp.length > 0) {
          post_id = targetPostId;
          post_type = 'student_post';
          // Note: For student posts, tutor_id must be provided by frontend as it's not the post owner
        }
      }
    }

    // Validate inputs
    if (!tutor_id || !student_id || !rating) {
      console.warn("❌ Missing fields:", { tutor_id, student_id, rating, body: req.body });
      return res.status(400).json({ success: false, message: 'Missing required fields (tutor_id or valid post_id)' });
    }

    // Insert Review with detailed ratings
    const [result] = await pool.query(
      `INSERT INTO reviews
        (tutor_id, student_id, post_id, post_type, rating, rating_punctuality, rating_worth, rating_teaching, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tutor_id, student_id, post_id || 0, post_type || 'unknown',
        rating,
        rating_punctuality || rating, // Fallback to overall if not provided
        rating_worth || rating,
        rating_teaching || rating,
        comment || ''
      ]
    );

    // Notify Tutor
    // "นักเรียนคนนี้ได้รีวิวให้แล้ว"
    // Fetch student name for better message
    const [[student]] = await pool.query('SELECT name, lastname FROM register WHERE user_id=?', [student_id]);
    const studentName = student ? `${student.name} ${student.lastname}`.trim() : 'นักเรียน';

    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
       VALUES (?, ?, 'review_received', ?, ?)`,
      [tutor_id, student_id, `นักเรียน ${studentName} ได้รีวิวการสอนของคุณแล้ว`, result.insertId]
    );

    res.json({ success: true, message: 'Review submitted successfully', reviewId: result.insertId });

  } catch (err) {
    console.error('POST /api/reviews error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});


// --- 📅 Schedule API (New) ---
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
      user: {
        ...user,
        role: user.role || mapped, // Use DB role (admin) if exists, else fallback to type
        userType: mapped
      },
      userType: mapped,
      role: user.role || mapped // Send explicit role key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// ✅ API: Get Single Student Post
app.get('/api/student-posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const [rows] = await pool.query(`
      SELECT
        sp.student_post_id, sp.student_id, sp.subject, sp.description,
        sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, sp.budget, sp.contact_info,
        sp.grade_level, sp.created_at,
        r.name, r.lastname, r.email, r.type,
        spro.profile_picture_url, spro.phone,
        (SELECT COUNT(*) FROM student_post_joins WHERE student_post_id = sp.student_post_id AND status = 'approved') AS join_count
      FROM student_posts sp
      LEFT JOIN register r ON r.user_id = sp.student_id
      LEFT JOIN student_profiles spro ON spro.user_id = sp.student_id
      WHERE sp.student_post_id = ?
    `, [postId]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = rows[0];

    // Normalize response for MyPostDetails
    const result = {
      id: post.student_post_id,
      owner_id: post.student_id,
      subject: post.subject,
      description: post.description,
      location: post.location,
      group_size: post.group_size,
      budget: post.budget,
      preferred_days: post.preferred_days,
      preferred_time: post.preferred_time,
      contact_info: post.contact_info,
      createdAt: post.created_at,
      join_count: Number(post.join_count || 0),
      user: {
        first_name: post.name,
        last_name: post.lastname,
        profile_image: post.profile_picture_url || '/default-avatar.png'
      }
    };

    res.json(result);
  } catch (err) {
    console.error("Get Single Student Post Error:", err);
    res.status(500).json({ message: 'Server Error' });
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
        WHERE sp.is_active = 1 AND (${whereConditions})
        ORDER BY sp.student_post_id DESC
        LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    );

    // นับจำนวนทั้งหมด (Count)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM student_posts sp WHERE sp.is_active = 1 AND (${whereConditions})`,
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
          r.user_id, r.name, r.lastname, r.email,
          tp.nickname,
          tp.can_teach_subjects,
          tp.profile_picture_url,
          tp.address,
          tp.hourly_rate,
          tp.about_me,
          tp.phone,
          tp.education,
          tp.teaching_experience
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

    const items = rows.map(r => {
      const contactParts = [];
      if (r.phone) contactParts.push(`Tel: ${r.phone}`);
      if (r.email) contactParts.push(`Email: ${r.email}`);

      return {
        id: `t-${r.user_id}`,
        dbTutorId: r.user_id,
        name: `${r.name || ''} ${r.lastname || ''}`.trim(),
        nickname: r.nickname,
        subject: r.can_teach_subjects || 'ไม่ระบุ',
        image: r.profile_picture_url || '/default-avatar.png',
        city: r.address,
        price: Number(r.hourly_rate || 0),
        about_me: r.about_me || '',
        contact_info: contactParts.join('\n') || "ไม่ระบุข้อมูลติดต่อ",
        phone: r.phone,
        email: r.email,
        education: r.education,
        teaching_experience: r.teaching_experience,
        rating: 0,
        reviews: 0,
      };
    });

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
    const subject = (req.query.subject || req.query.search || '').trim();
    const me = Number(req.query.me) || 0;

    const where = [];
    const params = [];

    // --- เพิ่ม Logic ค้นหา (Search) ---
    if (Number.isInteger(tutorId)) {
      where.push('tp.tutor_id = ?');
      params.push(tutorId);
    }

    // ✅ Add Soft Delete Filter
    where.push('tp.is_active = 1');

    // ถ้ามีการค้นหาด้วย subject (รองรับ Smart Search)
    let orderBy = 'ORDER BY tp.created_at DESC, tp.tutor_post_id DESC';

    if (subject) {
      const keywords = expandSearchTerm(subject);
      const conditions = keywords.map(() =>
        `(tp.subject LIKE ? OR tp.description LIKE ?)`
      ).join(' OR ');
      where.push(`(${conditions})`);

      keywords.forEach(kw => {
        params.push(`%${kw}%`, `%${kw}%`);
      });

      // ✅ Smart Search: ให้คะแนนความตรง (Relevance Score)
      // 1. ตรงกับ Subject (คำที่พิมพ์) -> 100 คะแนน
      // 2. ตรงกับ Subject (คำขยาย) -> 50 คะแนน
      // 3. ตรงกับ Description -> 10 คะแนน
      // เราจะใช้ Logic ง่ายๆ: ถ้าเจอใน Subject ให้ขึ้นก่อน

      // หมายเหตุ: การทำ CASE WHEN ซ้อนกันหลายชั้นใน SQL string อาจจะยุ่งยากเรื่อง params
      // ดังนั้นเราจะ prioritize ง่ายๆ: 
      // ORDER BY (CASE WHEN tp.subject LIKE %subject% THEN 1 ELSE 2 END), created_at DESC

      // เราต้อง push params สำหรับ order by เพิ่ม
      // เพื่อความง่ายและไม่กระทบ params array เดิมที่ push ไปแล้วสำหรับ where
      // เราจะใช้วิธีเรียงลำดับแบบ manual ใน SQL โดยการเช็คจากคำค้นหา "ตัวแรก" (คำหลัก)
      const mainKeyword = keywords[0]; // คำที่ User พิมพ์ (หรือคำแรกที่ขยาย)
      orderBy = `ORDER BY 
        (CASE WHEN tp.subject LIKE '%${mainKeyword}%' THEN 1 ELSE 2 END) ASC, 
        tp.created_at DESC`;
      // *หมายเหตุ: ตรงนี้ใช้ String interpolation (${mainKeyword}) เฉพาะอันนี้เพื่อความง่ายในการจัดลำดับ 
      // โดยไม่ต้องรื้อ params array ทั้งหมด (แต่ต้องระวัง SQL Injection หาก subject ไม่ได้ถูก sanitize)
      // แต่ในระบบนี้ subject มาจาก req.query และ keywords มาจาก expandSearchTerm ซึ่งปลอดภัยระดับนึง
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT
        tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description,
        tp.target_student_level,
        tp.teaching_days, tp.teaching_time, tp.location, tp.group_size, tp.price, tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name, r.lastname, r.email, r.type,
        tpro.profile_picture_url, tpro.nickname, tpro.about_me, tpro.education, tpro.teaching_experience, tpro.phone,
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
        WHERE status='approved'
        GROUP BY tutor_post_id
      ) jc ON jc.tutor_post_id = tp.tutor_post_id
      LEFT JOIN tutor_post_joins jme
        ON jme.tutor_post_id = tp.tutor_post_id AND jme.user_id = ? AND jme.status='approved'
      LEFT JOIN tutor_post_joins jme_pending
        ON jme_pending.tutor_post_id = tp.tutor_post_id AND jme_pending.user_id = ? AND jme_pending.status='pending'
      ${whereSql}
      ${orderBy}
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
          name: `${r.name || ''} ${r.lastname || ''}`.trim() || `ติวเตอร์ #${r.tutor_id}`,
          avatarUrl: r.profile_picture_url || ''
        },
        user: {
          id: r.tutor_id,
          first_name: r.name || '',
          last_name: r.lastname || '',
          profile_image: r.profile_picture_url || '',
          email: r.email || '',
          phone: r.phone || '',
          role: r.type || 'tutor'
        },
        // Profile Data added to top level for convenience
        nickname: r.nickname,
        about_me: r.about_me,
        education: r.education,
        teaching_experience: r.teaching_experience,
        phone: r.phone,
        email: r.email,

        meta: {
          target_student_level: r.target_student_level || 'ไม่ระบุ',
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
       WHERE tutor_id = ? AND is_active = 1
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
        // ✅ สำหรับโชว์ "ผู้เข้าร่วม: x/y"
        group_size: Number(r.group_size || 1),
        authorId: {
          id: r.tutor_id,
          name: `${r.name || ''}${r.lastname ? ' ' + r.lastname : ''}`.trim() || `ติวเตอร์ #${r.tutor_id}`,
          avatarUrl: r.profile_picture_url || ''
        },
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
    //console.error('GET /api/tutor-posts/:id error', e);
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
    // ✅ Add Soft Delete Filter
    let searchClause = 'WHERE sp.is_active = 1';
    // params: [join_me, pending_me, fav_me, offer_me (approved), offer_me (pending)]
    const queryParams = [me, me, me, me, me];

    // Filter by student_id (owner)
    const ownerId = Number(req.query.student_id);
    if (ownerId > 0) {
      searchClause += ` AND sp.student_id = ?`;
      queryParams.push(ownerId);
    }

    if (search) {
      // ใช้ฟังก์ชัน expandSearchTerm ที่มีอยู่แล้วเพื่อขยายคำค้น
      const keywords = expandSearchTerm(search);

      // สร้างเงื่อนไข OR: ค้นหาใน subject หรือ description
      const conditions = keywords.map(() =>
        `(sp.subject LIKE ? OR sp.description LIKE ?)`
      ).join(' OR ');

      searchClause += ` AND (${conditions})`;

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
        sp.grade_level,  /* ✅ เพิ่ม: ดึงระดับชั้นออกมาด้วย */
        r.name, r.lastname, r.email, r.type,
        spro.profile_picture_url, spro.phone,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE WHEN (jme.user_id IS NOT NULL OR ome.tutor_id IS NOT NULL) THEN 1 ELSE 0 END AS joined,
        CASE WHEN (jme_pending.user_id IS NOT NULL OR ome_pending.tutor_id IS NOT NULL) THEN 1 ELSE 0 END AS pending_me,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
        CASE WHEN has_tutor.cnt > 0 THEN 1 ELSE 0 END AS has_approved_tutor
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
      
      -- [FIX] Join offers to check status for Tutors
      LEFT JOIN student_post_offers ome 
        ON ome.student_post_id = sp.student_post_id AND ome.tutor_id = ? AND ome.status='approved'
      LEFT JOIN student_post_offers ome_pending
        ON ome_pending.student_post_id = sp.student_post_id AND ome_pending.tutor_id = ? AND ome_pending.status='pending'
      
      -- [NEW] Check if ANY tutor is approved
      LEFT JOIN (
        SELECT student_post_id, COUNT(*) as cnt
        FROM student_post_offers
        WHERE status='approved'
        GROUP BY student_post_id
      ) has_tutor ON has_tutor.student_post_id = sp.student_post_id
      
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
      has_tutor: !!r.has_approved_tutor, // ✅ Send status to frontend
      user: {
        first_name: r.name || '',
        last_name: r.lastname || '',
        profile_image: r.profile_picture_url || '/default-avatar.png',
        email: r.email || '',
        phone: r.phone || '',
        id: r.student_id,
        role: r.type || 'student'
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

    // validate required used in frontend
    if (!user_id || !subject) return res.status(400).json({ message: 'Missing required fields' });

    const [resDb] = await pool.query(`
      INSERT INTO student_posts 
      (student_id, subject, description, preferred_days, preferred_time, location, group_size, budget, contact_info, grade_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [user_id, subject, description, preferred_days, preferred_time, location, group_size, budget, contact_info, grade_level]);

    res.json({ success: true, id: resDb.insertId });
  } catch (e) {
    console.error('POST /api/student_posts error', e);
    return sendDbError(res, e);
  }
});

// ===== POST: สร้างโพสต์ติวเตอร์ =====
app.post('/api/tutor-posts', upload.none(), async (req, res) => {
  console.log('--- POST /api/tutor-posts --- content-type:', req.headers['content-type'], 'body:', req.body);

  try {
    const b = req.body || {};

    const rawGroup =
      b.group_size ?? b.groupSize ?? b.capacity ?? b.max_participants ?? b.maxStudents;

    const parsedGroup = parseInt(rawGroup, 10);
    const groupSize = Number.isFinite(parsedGroup) && parsedGroup > 0 ? parsedGroup : 1;

    const payload = {
      tutor_id: Number(b.tutor_id ?? b.user_id),
      subject: (b.subject || "").trim(),
      description: b.description ?? b.details ?? null,
      target_student_level: b.target_student_level ?? b.level ?? null,
      teaching_days: b.teaching_days ?? b.days ?? null,
      teaching_time: b.teaching_time ?? b.time ?? null,
      location: b.location ?? b.place ?? null,
      group_size: groupSize,
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
    hasCapacity: true,
    capacityCol: 'group_size',
    notifyType: 'tutor_join_request',
    notifyMessage: id => `มีคำขอเข้าร่วมโพสต์ติวเตอร์ #${id}`,
    countApprovedOnly: true,
  },
};

// ---------- JOIN/UNJOIN helper ใช้ซ้ำ ----------
async function doJoinUnified(type, postId, me) {
  const cfg = JOIN_CONFIG[type];
  if (!cfg) throw new Error('invalid post type');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ✅ lock post row กัน race
    const [[post]] = await conn.query(
      `SELECT ${cfg.ownerCol} AS owner_id${cfg.hasCapacity ? `, ${cfg.capacityCol} AS capacity` : ''} 
       FROM ${cfg.postsTable} 
       WHERE ${cfg.postIdCol} = ?
       FOR UPDATE`,
      [postId]
    );

    if (!post) {
      await conn.rollback();
      return { http: 404, body: { success: false, message: 'post not found' } };
    }
    if (Number(post.owner_id) === Number(me)) {
      await conn.rollback();
      return { http: 400, body: { success: false, message: 'คุณเป็นเจ้าของโพสต์นี้' } };
    }

    // ✅ เช็คเต็ม (approved เท่านั้น)
    if (cfg.hasCapacity) {
      const capacity = Number(post.capacity || 0);

      if (capacity > 0) {
        const [[cnt]] = await conn.query(
          `SELECT COUNT(*) AS c 
           FROM ${cfg.joinsTable} 
           WHERE ${cfg.joinPostIdCol} = ? AND status='approved'
           FOR UPDATE`,
          [postId]
        );

        if (Number(cnt.c || 0) >= capacity) {
          await conn.rollback();
          return {
            http: 409,
            body: { success: false, message: 'กลุ่มนี้เต็มแล้ว', full: true, join_count: Number(cnt.c || 0), group_size: capacity }
          };
        }
      }
    }

    // ✅ insert/update เป็น pending (เหมือนเดิม แต่ใช้ conn)
    if (cfg.joinsTable === 'tutor_post_joins') {
      await conn.query(
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
    } else {
      // student_post_joins
      await conn.query(
        `INSERT INTO student_post_joins
          (student_post_id, user_id, status, requested_at, name, lastname)
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
    }

    // นับ approved เพื่อส่งกลับ
    let countSql = `SELECT COUNT(*) AS c FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ?`;
    if (cfg.countApprovedOnly) countSql += ` AND status='approved'`;
    const [[cntRow]] = await conn.query(countSql, [postId]);

    // เตรียมข้อความแจ้งเตือน
    let notifyMessage = cfg.notifyMessage(postId);
    if (cfg.joinsTable === 'tutor_post_joins') {
      const [[actorRow]] = await conn.query('SELECT name, lastname FROM register WHERE user_id = ?', [me]);
      const [[pRow]] = await conn.query('SELECT subject FROM tutor_posts WHERE tutor_post_id = ?', [postId]);
      const subject = pRow?.subject || '';
      if (actorRow) {
        notifyMessage = `มีคำขอเข้าร่วมจาก ${actorRow.name || ''}${actorRow.lastname ? ' ' + actorRow.lastname : ''} (โพสต์ติวเตอร์ #${postId}${subject ? `: ${subject}` : ''})`;
      }
    }

    await conn.query(
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
      [post.owner_id, me, cfg.notifyType, notifyMessage, postId]
    );

    await conn.commit();

    return {
      http: 200,
      body: { success: true, joined: true, pending_me: true, join_count: Number(cntRow.c || 0) }
    };

  } catch (e) {
    try { await conn.rollback(); } catch { }
    throw e;
  } finally {
    conn.release();
  }
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


// ✅ API ลบโพสต์นักเรียน
// ✅ API ลบโพสต์นักเรียน (Soft Delete + Ownership Check)
app.delete('/api/student_posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.body.user_id || req.query.user_id; // Support both

    if (!userId) return res.status(400).json({ message: 'Missing user_id' });

    // 1. Check Ownership
    const [rows] = await pool.query('SELECT student_id FROM student_posts WHERE student_post_id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    if (Number(rows[0].student_id) !== Number(userId)) return res.status(403).json({ message: 'Forbidden' });

    // 2. Soft Delete
    await pool.query('UPDATE student_posts SET is_active = 0 WHERE student_post_id = ?', [postId]);

    res.json({ success: true, message: 'Deleted successfully (soft)' });
  } catch (err) {
    console.error('DELETE /api/student_posts/:id error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ✅ API ลบโพสต์ติวเตอร์
// ✅ API ลบโพสต์ติวเตอร์ (Soft Delete + Ownership Check)
app.delete('/api/tutor-posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.body.user_id || req.query.user_id;

    if (!userId) return res.status(400).json({ message: 'Missing user_id' });

    // 1. Check Ownership
    const [rows] = await pool.query('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    if (Number(rows[0].tutor_id) !== Number(userId)) return res.status(403).json({ message: 'Forbidden' });

    // 2. Soft Delete
    await pool.query('UPDATE tutor_posts SET is_active = 0 WHERE tutor_post_id = ?', [postId]);

    res.json({ success: true, message: 'Deleted successfully (soft)' });
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

    // Query 1: นักเรียน (Joins)
    const sqlStudent = `
      SELECT 
        j.student_post_id, j.user_id, j.status, j.requested_at,
        j.name, j.lastname, r.email,
        'student' AS request_type
      FROM student_post_joins j
      LEFT JOIN register r ON r.user_id = j.user_id
      WHERE j.student_post_id = ? ${useFilter ? 'AND j.status = ?' : ''}
    `;

    // Query 2: ติวเตอร์ (Offers)
    const sqlTutor = `
      SELECT 
        o.student_post_id, o.tutor_id AS user_id, o.status, o.requested_at,
        o.name, o.lastname, r.email,
        'tutor' AS request_type
      FROM student_post_offers o
      LEFT JOIN register r ON r.user_id = o.tutor_id
      WHERE o.student_post_id = ? ${useFilter ? 'AND o.status = ?' : ''}
    `;

    const params = useFilter ? [postId, status] : [postId];

    const [rowsS] = await pool.query(sqlStudent, params);
    const [rowsT] = await pool.query(sqlTutor, params);

    // รวมกันแล้ว sort ตามเวลา
    const all = [...rowsS, ...rowsT].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

    res.json(all);
  } catch (e) {
    console.error('GET /api/student_posts/:id/requests error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// >>> อนุมัติ/ปฏิเสธคำขอ ของโพสต์นักเรียน (REWRITE)
app.put('/api/student_posts/:id/requests/:userId', async (req, res) => {
  const postId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const action = String(req.body?.action || '').toLowerCase();

  if (!Number.isFinite(postId) || !Number.isFinite(targetUserId)) {
    return res.status(400).json({ message: 'invalid ids' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ✅ ล็อกแถวโพสต์เพื่อกัน race + ดึง group_size มาด้วย
      const [[sp]] = await conn.query(`
        SELECT
          sp.student_id AS owner_id,
          sp.subject,
          sp.group_size,
          r.name AS owner_name,
          r.lastname AS owner_lastname
        FROM student_posts sp
        JOIN register r ON r.user_id = sp.student_id
        WHERE sp.student_post_id = ?
        FOR UPDATE
      `, [postId]);

      if (!sp) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'post not found' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // ✅ ถ้าเป็น approve: เช็คจำนวนที่อนุมัติแล้ว เทียบกับ group_size ก่อน
      const capacity = Number(sp.group_size ?? 0);

      if (newStatus === 'approved' && capacity > 0) {
        // ล็อกแถว join ที่อนุมัติแล้ว (กันชน)
        const [[cntRow]] = await conn.query(`
          SELECT COUNT(*) AS c
          FROM student_post_joins
          WHERE student_post_id = ? AND status = 'approved'
          FOR UPDATE
        `, [postId]);

        const approvedCount = Number(cntRow?.c ?? 0);

        if (approvedCount >= capacity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({
            success: false,
            message: 'เต็มแล้ว ไม่สามารถอนุมัติเพิ่มได้',
            join_count: approvedCount,
            group_size: capacity
          });
        }
      }

      // ✅ อัปเดตเฉพาะรายการที่ยัง pending เท่านั้น (กันกดซ้ำแล้ว count เพี้ยน)
      const [attemptJoin] = await conn.query(
        `UPDATE student_post_joins
         SET status = ?, decided_at = NOW(), joined_at = IF(?='approved', NOW(), joined_at)
         WHERE student_post_id = ? AND user_id = ? AND status = 'pending'`,
        [newStatus, newStatus, postId, targetUserId]
      );

      let isTutorTable = false;

      if (attemptJoin.affectedRows === 0) {
        const [attemptOffer] = await conn.query(
          `UPDATE student_post_offers
           SET status = ?, decided_at = NOW()
           WHERE student_post_id = ? AND tutor_id = ? AND status = 'pending'`,
          [newStatus, postId, targetUserId]
        );

        if (attemptOffer.affectedRows > 0) {
          isTutorTable = true;
        } else {
          await conn.rollback();
          conn.release();
          return res.status(404).json({ message: 'request not found (or not pending)' });
        }
      }

      // ✅ commit ก่อน แล้วค่อยทำงานหนัก (calendar/notification) ลดโอกาส lock นาน
      await conn.commit();
      conn.release();

      // ------- หลัง commit: notify/calendar -------
      if (newStatus === 'approved') {
        if (!isTutorTable) {
          await createCalendarEventsForStudentApproval(postId, targetUserId);
          await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
             VALUES (?, ?, ?, ?, ?)`,
            [targetUserId, sp.owner_id, 'join_approved', `คำขอของคุณสำหรับโพสต์ #${postId} ได้รับการอนุมัติแล้ว`, postId]
          );
        } else {
          await createCalendarEventsForStudentApproval(postId, targetUserId);

          const studentName = `${sp.owner_name} ${sp.owner_lastname}`.trim();
          await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
             VALUES (?, ?, ?, ?, ?)`,
            [targetUserId, sp.owner_id, 'offer_accepted', `${studentName} ยอมรับเสนอสอนวิชา "${sp.subject}" ของคุณแล้ว`, postId]
          );

          // Auto-Reject offers อื่น
          await pool.query(`
            UPDATE student_post_offers
            SET status = 'rejected', decided_at = NOW()
            WHERE student_post_id = ? AND status = 'pending' AND tutor_id != ?
          `, [postId, targetUserId]);
        }
      } else {
        await deleteCalendarEventForUser(targetUserId, postId);
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
           VALUES (?, ?, ?, ?, ?)`,
          [targetUserId, sp.owner_id, isTutorTable ? 'offer_rejected' : 'join_rejected', `คำขอ/ข้อเสนอของคุณสำหรับโพสต์ #${postId} ถูกปฏิเสธ`, postId]
        );
      }

      // ✅ ส่ง join_count กลับแบบล่าสุด
      const [[cnt]] = await pool.query(
        `SELECT COUNT(*) AS c
         FROM student_post_joins
         WHERE student_post_id = ? AND status = 'approved'`,
        [postId]
      );

      return res.json({
        success: true,
        status: newStatus,
        join_count: Number(cnt.c || 0),
        group_size: Number(sp.group_size || 0)
      });

    } catch (e) {
      try { await conn.rollback(); } catch { }
      conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
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

    // 2) ดึงโพสต์หาติวเตอร์ (student_posts) - ที่ตนเองสร้าง (Owner)
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
        title: `โพสต์ของคุณ: ${p.subject || 'เรียนพิเศษ'}`,
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'student_post_owner',
      };
    });

    // 3) ดึงโพสต์สอนพิเศษ (tutor_posts) - ที่ตนเองสร้าง (Owner)
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
        title: `โพสต์ของคุณ (สอน): ${p.subject || 'วิชาทั่วไป'}`,
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_post_owner',
      };
    });

    // 3.5) [NEW] ดึงโพสต์ที่ติวเตอร์ไป "เสนอสอน" (Offers)
    // ถือว่าเป็น Event ของ Tutor ด้วย (ทั้ง pending และ approved หรือแค่ approved?)
    // ถ้า Approved แล้ว = มีนัดแน่ๆ
    // ถ้า Pending = อาจจะแค่อยากดู deadline? ให้แสดงเฉพาะ Approved ก่อนตาม logic เดิมของ join
    const [rowsOffers] = await pool.query(
      `SELECT sp.student_post_id, sp.student_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location, sp.created_at,
              r.name, r.lastname, o.status
       FROM student_post_offers o
       JOIN student_posts sp ON o.student_post_id = sp.student_post_id
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE o.tutor_id = ? AND o.status = 'approved'`,
      [userId]
    );

    const offerEvents = rowsOffers.map(p => {
      const event_date = parseDateFromPreferredDays(p.preferred_days);
      const event_time = toSqlTimeMaybe(p.preferred_time);
      const studentName = `${p.name || ''} ${p.lastname || ''}`.trim();
      return {
        event_id: `offer-${p.student_post_id}`,
        user_id: userId,
        post_id: p.student_post_id,
        title: `สอนน้อง: ${p.subject || 'เรียนพิเศษ'} (${studentName})`,
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_offer_accepted',
        color: '#16a34a' // Green
      };
    });

    // 4) [NEW] ดึงโพสต์ที่ "ขอเข้าร่วมสำเร็จ" (Joined Student Posts)
    const [rowsJoinedStudent] = await pool.query(
      `SELECT sp.student_post_id, sp.student_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location, sp.created_at,
              r.name, r.lastname
       FROM student_post_joins j
       JOIN student_posts sp ON j.student_post_id = sp.student_post_id
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE j.user_id = ? AND j.status = 'approved'`,
      [userId]
    );

    const joinedStudentEvents = rowsJoinedStudent.map(p => {
      const event_date = parseDateFromPreferredDays(p.preferred_days);
      const event_time = toSqlTimeMaybe(p.preferred_time);
      // Construct title to indicate who we are learning with
      const ownerName = `${p.name || ''} ${p.lastname || ''}`.trim();
      return {
        event_id: `join-sp-${p.student_post_id}`,
        user_id: userId, // me
        post_id: p.student_post_id,
        title: `นัดติว (เข้าร่วม): ${p.subject || 'เรียนพิเศษ'}`,
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'student_post_joined',
      };
    });

    // 5) [NEW] ดึงโพสต์ที่ "ขอเรียนสำเร็จ" (Joined Tutor Posts)
    const [rowsJoinedTutor] = await pool.query(
      `SELECT tp.tutor_post_id, tp.tutor_id, tp.subject, tp.teaching_days, tp.teaching_time, tp.location, tp.created_at,
              r.name, r.lastname
       FROM tutor_post_joins j
       JOIN tutor_posts tp ON j.tutor_post_id = tp.tutor_post_id
       LEFT JOIN register r ON r.user_id = tp.tutor_id
       WHERE j.user_id = ? AND j.status = 'approved'`,
      [userId]
    );

    const joinedTutorEvents = rowsJoinedTutor.map(p => {
      const event_date = parseDateFromPreferredDays(p.teaching_days);
      const event_time = toSqlTimeMaybe(p.teaching_time);
      const ownerName = `${p.name || ''} ${p.lastname || ''}`.trim();
      return {
        event_id: `join-tp-${p.tutor_post_id}`,
        user_id: userId,
        post_id: p.tutor_post_id,
        title: `เรียนกับติวเตอร์: ${p.subject || 'วิชาทั่วไป'}`,
        subject: p.subject || null,
        event_date,
        event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_post_joined',
        color: '#ea580c' // Orange
      };
    });

    // รวมทั้งหมด
    // Note: Deduplicate might be needed if calendar_events already has it, but showing both is safer than missing it.
    // UI will render them.
    const allEvents = [
      ...calItems,
      ...studentPostsAsEvents,
      ...tutorPostsAsEvents,
      ...joinedStudentEvents,
      ...joinedTutorEvents,
      ...offerEvents
    ];

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
  const postId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const action = String((req.body?.action || req.query?.action || '')).toLowerCase();

  if (!Number.isFinite(postId) || !Number.isFinite(userId)) {
    return res.status(400).json({ message: 'invalid ids' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'invalid action' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  let capacity = 0;
  let joinCountAfter = 0;
  let tutorId = null;

  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ✅ ล็อกแถวโพสต์ + เอา group_size มาเช็ค
      const [[tp]] = await conn.query(
        `SELECT tutor_post_id, group_size, tutor_id
         FROM tutor_posts
         WHERE tutor_post_id = ?
         FOR UPDATE`,
        [postId]
      );

      if (tp) tutorId = tp.tutor_id;

      if (!tp) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'post not found' });
      }

      capacity = Number(tp.group_size ?? 0);

      // ✅ ถ้า approve ให้เช็คจำนวน approved ก่อน
      if (newStatus === 'approved' && capacity > 0) {
        const [[cntRow]] = await conn.query(
          `SELECT COUNT(*) AS c
           FROM tutor_post_joins
           WHERE tutor_post_id = ? AND status = 'approved'
           FOR UPDATE`,
          [postId]
        );

        const approvedCount = Number(cntRow?.c ?? 0);

        if (approvedCount >= capacity) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({
            success: false,
            message: 'เต็มแล้ว ไม่สามารถอนุมัติเพิ่มได้',
            join_count: approvedCount,
            group_size: capacity,
          });
        }
      }

      // ✅ อัปเดตเฉพาะ pending กันกดซ้ำ
      const [r] = await conn.query(
        `UPDATE tutor_post_joins
         SET status = ?, decided_at = NOW(),
             joined_at = IF(?='approved', NOW(), joined_at)
         WHERE tutor_post_id = ? AND user_id = ? AND status = 'pending'`,
        [newStatus, newStatus, postId, userId]
      );

      if (!r.affectedRows) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'request not found (or not pending)' });
      }

      // ✅ นับใหม่ (ยังอยู่ใน transaction)
      const [[cnt2]] = await conn.query(
        `SELECT COUNT(*) AS c
         FROM tutor_post_joins
         WHERE tutor_post_id = ? AND status = 'approved'`,
        [postId]
      );
      joinCountAfter = Number(cnt2?.c ?? 0);

      await conn.commit();
      conn.release();
    } catch (e) {
      try { await conn.rollback(); } catch { }
      conn.release();
      throw e;
    }

    // ------- หลัง commit ค่อยทำงานหนัก -------
    if (newStatus === 'approved') {
      await createCalendarEventsForTutorApproval(postId, userId);
      console.log(`🔔 Sending Join Approved Notification: User=${userId}, Actor=${tutorId}, Post=${postId}`);
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id)
           VALUES (?,?,?,?,?)`,
          [userId, tutorId, 'join_approved', `คำขอเรียนกับติวเตอร์ (โพสต์ #${postId}) ได้รับการอนุมัติแล้ว`, postId]
        );
        console.log("✅ Notification inserted successfully");
      } catch (notifErr) {
        console.error("❌ Notification Insert Error:", notifErr);
      }
    } else {
      await deleteCalendarEventForUser(userId, postId);
    }

    // ส่งรายชื่อผู้เข้าร่วม (approved) กลับไปด้วย
    const [joiners] = await pool.query(
      `SELECT user_id, name, lastname, joined_at
       FROM tutor_post_joins
       WHERE tutor_post_id = ? AND status = 'approved'
       ORDER BY joined_at ASC`,
      [postId]
    );

    return res.json({
      success: true,
      status: newStatus,
      join_count: joinCountAfter,
      group_size: capacity,
      joiners,
    });

  } catch (e) {
    return sendDbError(res, e);
  }
});

// ---------- Notifications (ฉบับอัปเกรด: ดึงรูป + ชื่อวิชา) ----------
// --- Notifications API ---

// NEW: Real-time Schedule Alerts (Direct Pull)
app.get('/api/schedule-alerts/:userId', async (req, res) => {
  req.db = await pool.getConnection(); // Helper to pass connection
  try {
    await scheduleController.getScheduleAlerts(req, res);
  } finally {
    req.db.release();
  }
});

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
            WHEN n.type IN ('join_request', 'join_approved', 'join_rejected', 'offer', 'offer_accepted', 'review_request', 'system_alert') THEN COALESCE(sp.subject, tp.subject)
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

// ==========================================
// 1. GET STUDENT PROFILE
// ==========================================
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sql = `
      SELECT
        r.name, r.lastname, r.email, r.type,
        sp.*, r.created_at 
      FROM register r
      LEFT JOIN student_profiles sp ON r.user_id = sp.user_id
      WHERE r.user_id = ?
    `;
    const [rows] = await pool.execute(sql, [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const data = rows[0];
    res.json({
      ...data,
      first_name: data.name,
      last_name: data.lastname,
      role: 'student'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==========================================
// 4. UPDATE STUDENT PROFILE (ฉบับแก้ชื่อตัวแปรให้ตรง Frontend)
// ==========================================
app.put('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const body = req.body;

    console.log("📝 Update Student Payload:", body);

    // 1. อัปเดตตาราง register
    if (body.name || body.lastname || body.first_name || body.last_name) {
      await pool.execute('UPDATE register SET name=?, lastname=? WHERE user_id=?',
        [
          body.name || body.first_name,
          body.lastname || body.last_name,
          userId
        ]
      );
    }

    const v = (val) => (val === undefined || val === 'null' || val === '') ? null : val;

    const sql = `
      INSERT INTO student_profiles (
        user_id, nickname, phone, address, 
        grade_level, institution, faculty, major, 
        about, profile_picture_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname=VALUES(nickname), 
        phone=VALUES(phone), 
        address=VALUES(address),
        grade_level=VALUES(grade_level), 
        institution=VALUES(institution),
        faculty=VALUES(faculty), 
        major=VALUES(major), 
        about=VALUES(about),
        profile_picture_url=VALUES(profile_picture_url)
    `;

    // 🔥 จุดที่แก้: เพิ่มตัวดักจับ phone_number และ about_me
    await pool.execute(sql, [
      userId,
      v(body.nickname),
      v(body.phone || body.phone_number || body.phoneNumber || body.tel), // ✅ เพิ่ม body.phone_number
      v(body.address || body.location),
      v(body.grade_level),
      v(body.institution),
      v(body.faculty),
      v(body.major),
      v(body.about || body.about_me || body.bio), // ✅ เพิ่ม body.about_me
      v(body.profile_picture_url || body.profile_image)
    ]);

    console.log("✅ Update Student Success!");
    res.json({ message: 'Student profile updated successfully' });

  } catch (err) {
    console.error('❌ Update Student Error:', err);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
});

// ==========================================
// 2. GET TUTOR PROFILE (Fixed SQL & Logic)
// ==========================================
app.get('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sql = `
      SELECT
        r.name, r.lastname, r.email, r.type,
        tp.*, r.created_at 
      FROM register r
      LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
      WHERE r.user_id = ?
    `;
    const [rows] = await pool.execute(sql, [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Tutor not found' });

    const profile = rows[0];

    try {
      if (typeof profile.education === 'string') profile.education = JSON.parse(profile.education);
      if (typeof profile.teaching_experience === 'string') profile.teaching_experience = JSON.parse(profile.teaching_experience);
    } catch (e) { }

    const [rRows] = await pool.execute(`
        SELECT r.rating, r.comment, r.created_at, reg.name, reg.lastname, sp.profile_picture_url
        FROM reviews r
        LEFT JOIN register reg ON r.student_id = reg.user_id
        LEFT JOIN student_profiles sp ON r.student_id = sp.user_id
        WHERE r.tutor_id = ? ORDER BY r.created_at DESC
    `, [userId]);

    const reviews = rRows.map(r => ({
      rating: Number(r.rating),
      comment: r.comment,
      reviewer: { name: `${r.name} ${r.lastname}`, avatar: r.profile_picture_url }
    }));

    let avgRating = "0.0";
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      avgRating = (sum / reviews.length).toFixed(1);
    }

    res.json({
      ...profile,
      first_name: profile.name,
      last_name: profile.lastname,
      role: 'tutor',
      reviews: reviews,
      rating: avgRating
    });

  } catch (err) {
    console.error('Error fetching tutor profile:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==========================================
// 3. UPDATE TUTOR PROFILE (Fixed Array Bug)
// ==========================================
app.put('/api/tutor-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const body = req.body;

    console.log("📝 Update Tutor Payload:", body);

    if (body.name || body.lastname || body.first_name || body.last_name) {
      await pool.execute('UPDATE register SET name=?, lastname=? WHERE user_id=?',
        [body.name || body.first_name, body.lastname || body.last_name, userId]
      );
    }

    const v = (val) => (val === undefined || val === 'null' || val === '') ? null : val;

    const jsonVal = (val) => {
      if (!val) return null;
      return typeof val === 'string' ? val : JSON.stringify(val);
    };

    const arrVal = (val) => {
      if (!val) return null;
      if (Array.isArray(val)) return val.join(', ');
      return String(val);
    };

    const sql = `
      INSERT INTO tutor_profiles (
        user_id, nickname, phone, address, about_me, 
        education, teaching_experience, 
        can_teach_subjects, can_teach_grades, 
        hourly_rate, profile_picture_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname=VALUES(nickname), 
        phone=VALUES(phone), 
        address=VALUES(address), 
        about_me=VALUES(about_me),
        education=VALUES(education), 
        teaching_experience=VALUES(teaching_experience),
        can_teach_subjects=VALUES(can_teach_subjects), 
        can_teach_grades=VALUES(can_teach_grades),
        hourly_rate=VALUES(hourly_rate),
        profile_picture_url=VALUES(profile_picture_url)
    `;

    await pool.execute(sql, [
      userId,
      v(body.nickname),
      v(body.phone || body.phone_number),
      v(body.address || body.location),
      v(body.about_me || body.bio || body.about),
      jsonVal(body.education),
      jsonVal(body.teaching_experience),
      arrVal(body.can_teach_subjects || body.subjects),
      arrVal(body.can_teach_grades || body.grades),
      v(body.hourly_rate || body.price),
      v(body.profile_picture_url || body.profile_image)
    ]);

    res.json({ message: 'Tutor profile updated successfully' });

  } catch (err) {
    console.error('❌ Error updating tutor profile:', err);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
});


// ---------- Upload ----------
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
});

// ================== Calendar Helpers ==================
function parseDateFromPreferredDays(s) {
  if (!s) return null;

  // 🔥 1. เช็คก่อนเลยว่าเป็น Date Object หรือไม่ (แก้ปัญหา Database ส่ง Object มา)
  if (s instanceof Date) {
    // แปลง Date Object ให้เป็น String 'YYYY-MM-DD'
    return s.toISOString().slice(0, 10);
  }

  // ถ้าเป็น String ให้ทำเหมือนเดิม
  s = String(s).trim();

  // แบบ YYYY-MM-DD
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1].padStart(4, '0')}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;

  // แบบ DD/MM/YYYY
  m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  // แบบภาษาไทย (เผื่อหลุดมาเป็น String)
  m = s.match(/(\d{1,2})\s+([^\s]+)\.?\s+(\d{4})/); // เพิ่มรองรับจุดทศนิยม
  if (m) {
    const months = {
      'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
      'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
      'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
      'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
    };
    const d = String(parseInt(m[1], 10)).padStart(2, '0');
    let monTxt = m[2];
    // ลองหาใน map (ตัดจุดออกถ้ามี)
    let mo = months[monTxt] || months[monTxt + '.'] || months[monTxt.replace('.', '')];

    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;

    if (mo) return `${y}-${mo}-${d}`;
  }

  return null;
}

// 2. ฟังก์ชันแปลงเวลา
function toSqlTimeMaybe(v) {
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  return null;
}

// 3. ฟังก์ชัน Upsert (บันทึก/แก้ไข)
async function upsertCalendarEvent({ user_id, post_id, title, subject, event_date, event_time, location }) {
  // Debug: ให้ดูใน Terminal ว่าพยายามบันทึกอะไร
  console.log(`Creating Event for User ${user_id}: Date=${event_date}, Time=${event_time}`);

  await pool.query(
    `INSERT INTO calendar_events (user_id, post_id, title, subject, event_date, event_time, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
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

// ✅ 4. สร้างปฏิทินให้ "นักเรียน" (เมื่ออนุมัติ)
async function createCalendarEventsForStudentApproval(postId, joinerId) {
  try {
    console.log(`📅 createCalendarEventsForStudentApproval: PostId=${postId}, JoinerId=${joinerId}`);

    const [[sp]] = await pool.query(
      `SELECT sp.*, r.name, r.lastname FROM student_posts sp 
       LEFT JOIN register r ON r.user_id = sp.student_id WHERE sp.student_post_id = ?`,
      [postId]
    );
    if (!sp) return console.log("❌ Post not found for calendar");

    const subjectText = sp.subject || 'เรียนพิเศษ';
    const titleText = `นัดติว: ${subjectText}`;
    const location = sp.location || 'ไม่ระบุสถานที่';

    // แปลงวันที่
    let event_date = parseDateFromPreferredDays(sp.preferred_days);
    if (!event_date) {
      console.log("⚠️ Date parse failed, using tomorrow as default");
      const d = new Date(); d.setDate(d.getDate() + 1);
      event_date = d.toISOString().slice(0, 10);
    }
    const event_time = toSqlTimeMaybe(sp.preferred_time) || '09:00:00';

    // สร้างให้เจ้าของโพสต์ (Owner)
    try {
      if (sp.student_id) {
        await upsertCalendarEvent({
          user_id: sp.student_id,
          post_id: postId,
          title: titleText,
          subject: subjectText,
          event_date,
          event_time,
          location
        });
        console.log(`✅ Calendar event created for Owner (User ${sp.student_id})`);
      } else {
        console.warn("⚠️ Owner ID missing, skipping owner event.");
      }
    } catch (err) {
      console.error(`❌ Failed to create calendar for Owner (User ${sp.student_id}):`, err.message);
    }

    // สร้างให้คนขอเข้าร่วม (Joiner)
    try {
      if (joinerId) {
        await upsertCalendarEvent({
          user_id: Number(joinerId),
          post_id: postId,
          title: titleText,
          subject: subjectText,
          event_date,
          event_time,
          location
        });
        console.log(`✅ Calendar event created for Joiner (User ${joinerId})`);
      } else {
        console.warn("⚠️ Joiner ID missing, skipping joiner event.");
      }
    } catch (err) {
      console.error(`❌ Failed to create calendar for Joiner (User ${joinerId}):`, err.message);
    }

  } catch (e) {
    console.error("Error in createCalendarEventsForStudentApproval root:", e);
  }
}

// ✅ 5. สร้างปฏิทินให้ "ติวเตอร์" (เมื่ออนุมัติ)
async function createCalendarEventsForTutorApproval(postId, joinerId) {
  try {
    console.log(`📅 createCalendarEventsForTutorApproval: PostId=${postId}, JoinerId=${joinerId}`);

    const [[tp]] = await pool.query(
      `SELECT tp.*, r.name, r.lastname FROM tutor_posts tp 
       LEFT JOIN register r ON r.user_id = tp.tutor_id WHERE tp.tutor_post_id = ?`,
      [postId]
    );
    if (!tp) return console.log("❌ Tutor Post not found for calendar");

    const subjectText = tp.subject || 'เรียนพิเศษ';
    const titleText = `เรียนกับติวเตอร์: ${tp.name} (${subjectText})`;
    const location = tp.location || 'ไม่ระบุสถานที่';

    // แปลงวันที่
    let event_date = parseDateFromPreferredDays(tp.teaching_days);
    if (!event_date) {
      console.log("⚠️ Date parse failed, using tomorrow as default");
      const d = new Date(); d.setDate(d.getDate() + 1);
      event_date = d.toISOString().slice(0, 10);
    }
    const event_time = toSqlTimeMaybe(tp.teaching_time) || '09:00:00';

    // สร้างให้ติวเตอร์ (Owner)
    try {
      if (tp.tutor_id) {
        await upsertCalendarEvent({
          user_id: tp.tutor_id,
          post_id: postId,
          title: `สอน: ${subjectText}`,
          subject: subjectText,
          event_date,
          event_time,
          location
        });
        console.log(`✅ Calendar event created for Tutor (User ${tp.tutor_id})`);
      }
    } catch (err) {
      console.error(`❌ Failed to create calendar for Tutor (User ${tp.tutor_id}):`, err.message);
    }

    // สร้างให้คนขอเข้าร่วม (Joiner/Student)
    try {
      if (joinerId) {
        await upsertCalendarEvent({
          user_id: Number(joinerId),
          post_id: postId,
          title: titleText,
          subject: subjectText,
          event_date,
          event_time,
          location
        });
        console.log(`✅ Calendar event created for Student/Joiner (User ${joinerId})`);
      }
    } catch (err) {
      console.error(`❌ Failed to create calendar for Student/Joiner (User ${joinerId}):`, err.message);
    }

  } catch (e) {
    console.error("Error in createCalendarEventsForTutorApproval root:", e);
  }
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
// --- Deleted DUPLICATE POST /api/reviews (merged to top) ---

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
        rv.rating_punctuality,
        rv.rating_worth,
        rv.rating_teaching,
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
      rating_punctuality: Number(row.rating_punctuality || row.rating), // Fallback to overall if null
      rating_worth: Number(row.rating_worth || row.rating),
      rating_teaching: Number(row.rating_teaching || row.rating),
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

const getEmailTemplate = (otpCode) => {
  const LOGO_URL = "https://img2.pic.in.th/FindingTutor_Logo.png";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .email-container { max-width: 500px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; text-align: center; }
        .header img { height: 50px; width: auto; margin-bottom: 15px; border-radius: 8px; background-color: white; padding: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); } 
        .content { padding: 40px 30px; text-align: center; color: #374151; }
        .otp-box { background-color: #f9fafb; border: 2px dashed #c7d2fe; border-radius: 12px; padding: 15px; margin: 25px 0; display: inline-block; min-width: 200px; }
        .otp-text { font-size: 32px; font-weight: 800; color: #4f46e5; letter-spacing: 6px; font-family: monospace; margin: 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <img src="${LOGO_URL}" alt="Logo" />
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Finding Tutor Web</h1>
        </div>
        <div class="content">
          <h2 style="margin-top: 0; color: #1f2937;">ยืนยันตัวตนของคุณ</h2>
          <p style="color: #6b7280;">ใช้รหัส OTP ด้านล่างเพื่อดำเนินการสมัครสมาชิกให้เสร็จสมบูรณ์</p>
          <div class="otp-box">
            <p class="otp-text">${otpCode}</p>
          </div>
          <p style="color: #ef4444; font-size: 13px; margin-top: 15px;">⚠️ รหัสนี้จะหมดอายุภายใน 5 นาที</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Finding Tutor Web Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// API ส่ง OTP
app.post('/api/auth/request-otp', async (req, res) => {
  console.log("📨 Received OTP Request:", req.body.email);
  const { email, type } = req.body;

  try {
    if (type === 'register') {
      const [existing] = await pool.query('SELECT 1 FROM register WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 1. บันทึก DB
    await pool.query('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)', [email, otpCode, expiresAt]);
    console.log("✅ OTP Saved to DB");

    // 2. เตรียมส่งเมล (ใช้รูปจาก URL เพื่อความเบา แต่ยังสวย)
    const mailOptions = {
      from: '"Finding TutorWeb" <findingtoturwebteam@gmail.com>',
      to: email,
      subject: '🔐 รหัสยืนยันตัวตน (OTP) - Tutor Web',
      html: getEmailTemplate(otpCode), // ใช้ฟังก์ชัน HTML ตัวล่าสุดของคุณ
      // attachments: [] <-- ไม่ต้องใส่ attachments แล้ว
    };

    // 3. ✅ ใส่ await กลับมา (เพื่อให้หน่วงรอจนกว่า Gmail จะบอกว่า "ส่งแล้วนะ")
    // ตรงนี้จะใช้เวลาประมาณ 1-2 วินาที ซึ่งเป็นความหน่วงที่กำลังดีครับ
    console.log("⏳ กำลังเชื่อมต่อ Gmail...");
    await transporter.sendMail(mailOptions);
    console.log("🚀 ส่งเมลสำเร็จ!");

    // 4. แจ้งหน้าเว็บ
    res.json({ success: true, message: 'ส่งรหัส OTP เรียบร้อยแล้ว' });

  } catch (err) {
    console.error("❌ OTP Error:", err);
    res.status(500).json({ success: false, message: 'ไม่สามารถส่งอีเมลได้: ' + err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, lastname, email, password, type, otp } = req.body; // รับ otp มาด้วย

  // 1. ตรวจสอบ OTP
  const [otpRows] = await pool.query(
    'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
    [email, otp]
  );

  if (otpRows.length === 0) {
    return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' });
  }

  // 2. ถ้า OTP ถูกต้อง -> ลบ OTP เก่าทิ้ง (Optional แต่ควรทำ)
  await pool.query('DELETE FROM otp_codes WHERE email = ?', [email]);

  // 3. ทำการสมัครสมาชิก (Logic เดิมของคุณ) ...
  // ... (INSERT INTO register ...)

  // (Copy โค้ดเดิมส่วน Insert มาใส่ตรงนี้)
});

// 1. API แก้ไขข้อมูลส่วนตัว (User Info)
app.put('/api/user/:id', async (req, res) => {
  try {
    const { name, lastname, email } = req.body;
    const userId = req.params.id;

    // เช็คว่าอีเมลซ้ำกับคนอื่นไหม (ถ้ามีการเปลี่ยนอีเมล)
    const [existing] = await pool.query('SELECT user_id FROM register WHERE email = ? AND user_id != ?', [email, userId]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'อีเมลนี้มีผู้ใช้งานแล้ว' });
    }

    await pool.query(
      'UPDATE register SET name = ?, lastname = ?, email = ? WHERE user_id = ?',
      [name, lastname, email, userId]
    );

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// 2. API เปลี่ยนรหัสผ่าน (Change Password)
app.post('/api/user/change-password', async (req, res) => {
  try {
    const { user_id, oldPassword, newPassword } = req.body;

    // 1. ตรวจสอบรหัสผ่านเดิม
    const [rows] = await pool.query('SELECT password FROM register WHERE user_id = ?', [user_id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    if (rows[0].password !== oldPassword) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }

    // 2. อัปเดตรหัสผ่านใหม่
    await pool.query('UPDATE register SET password = ? WHERE user_id = ?', [newPassword, user_id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// 3. API ลบบัญชี (Delete Account - Clean Delete)
app.delete('/api/user/:id', async (req, res) => {
  const userId = req.params.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    console.log(`🗑️ Deleting user: ${userId}...`);

    // --- 1. ไล่ลบข้อมูลในตารางลูกก่อน (Child Tables) ---
    // (ถ้าไม่ลบพวกนี้ก่อน Database จะ Error เพราะติด Foreign Key)

    // 1.1 ลบข้อมูลส่วนตัว
    await conn.query('DELETE FROM student_profiles WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM tutor_profiles WHERE user_id = ?', [userId]);

    // 1.2 ลบประวัติและการใช้งานต่างๆ
    await conn.query('DELETE FROM search_history WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM calendar_events WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM notifications WHERE user_id = ? OR actor_id = ?', [userId, userId]);

    // 1.3 ลบข้อมูลการเข้าร่วมกลุ่ม (Joins)
    await conn.query('DELETE FROM student_post_joins WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM tutor_post_joins WHERE user_id = ?', [userId]);

    // 1.4 ลบโพสต์ที่เจ้าตัวเป็นคนสร้าง
    await conn.query('DELETE FROM student_posts WHERE student_id = ?', [userId]);
    await conn.query('DELETE FROM tutor_posts WHERE tutor_id = ?', [userId]);

    // 1.5 ลบ Favorites และ Reviews (ถ้ามีตารางพวกนี้)
    try {
      await conn.query('DELETE FROM posts_favorites WHERE user_id = ?', [userId]);
      await conn.query('DELETE FROM reviews WHERE student_id = ? OR tutor_id = ?', [userId, userId]);
    } catch (e) {
      // เผื่อยังไม่ได้สร้างตารางพวกนี้ จะได้ไม่ Error
      console.warn("Skipping table cleanup (might not exist yet).");
    }

    // --- 2. ลบ User ตัวจริง (Parent Table) ---
    const [result] = await conn.query('DELETE FROM register WHERE user_id = ?', [userId]);

    if (result.affectedRows === 0) {
      throw new Error('User not found or already deleted');
    }

    await conn.commit();
    console.log(`✅ User ${userId} deleted successfully.`);
    res.json({ success: true, message: 'Account deleted' });

  } catch (err) {
    await conn.rollback();
    console.error("❌ Delete Error:", err.sqlMessage || err.message);

    res.status(500).json({
      success: false,
      message: 'ลบบัญชีไม่สำเร็จ: ' + (err.sqlMessage || 'Database constraint error')
    });
  } finally {
    conn.release();
  }
});

// API สำหรับลบบัญชี (พร้อมเก็บ Feedback)
app.post('/api/delete-account', async (req, res) => {
  const { userId, userName, userType, reason, detail } = req.body;

  try {
    // --- 1. ส่วนบันทึกลง Google Sheet (แผ่นที่ 1) ---
    try {
      const serviceAccountAuth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];

      await sheet.addRow({
        Timestamp: new Date().toLocaleString('th-TH'),
        UserID: userId,
        Name: userName || 'Unknown',
        Role: userType || 'Unknown',
        Reason: reason,
        Detail: detail
      });
      console.log("✅ Saved delete reason to Google Sheet");
    } catch (sheetErr) {
      console.error("⚠️ Sheet Error (ข้ามการบันทึก):", sheetErr.message);
    }

    // --- 2. ส่วนลบข้อมูลจริงใน Database ---
    await pool.query('DELETE FROM register WHERE user_id = ?', [userId]);

    console.log(`🗑️ Deleted User: ${userId} (${userName})`);
    res.json({ success: true, message: 'Account deleted' });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/report-issue', async (req, res) => {
  const { category, topic, detail, user_contact } = req.body;

  // เรียกใช้ฟังก์ชันบันทึกลง Sheet (แบบไม่ต้องรอ)
  saveToGoogleSheet({ category, topic, detail, user_contact });

  res.json({ success: true, message: 'ได้รับเรื่องร้องเรียนแล้ว' });
});

app.post('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me = Number(req.body.user_id);

    if (!Number.isFinite(postId) || !Number.isFinite(me)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    // 1. ดึงข้อมูลโพสต์
    const [[post]] = await pool.query(
      'SELECT student_id, group_size, subject FROM student_posts WHERE student_post_id = ?',
      [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'ไม่พบโพสต์นี้' });

    if (post.student_id === me) {
      return res.status(400).json({ success: false, message: 'คุณเป็นเจ้าของโพสต์นี้' });
    }

    // 2. ตรวจสอบว่าคนกดเป็นติวเตอร์ไหม
    const [[user]] = await pool.query('SELECT type FROM register WHERE user_id = ?', [me]);
    if (!user) return res.status(404).json({ success: false, message: 'ไม่พบ User นี้' });

    const isTutor = (user.type || '').toLowerCase() === 'tutor' || (user.type || '').toLowerCase() === 'teacher';

    // 3. ถ้าเป็นนักเรียน -> เช็คคนเต็ม (ติวเตอร์ไม่ต้องเช็ค)
    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status="approved"',
      [postId]
    );
    if (!isTutor && (cnt.c >= post.group_size)) {
      return res.status(409).json({ success: false, message: 'กลุ่มนี้เต็มแล้ว' });
    }

    // 4. บันทึกลง Database (แยก Table ตามประเภท User)
    if (isTutor) {
      // --- TUTOR: ลงใน student_post_offers ---
      await pool.query(
        `INSERT INTO student_post_offers (student_post_id, tutor_id, status, requested_at, name, lastname)
          SELECT ?, ?, 'pending', NOW(), r.name, r.lastname
          FROM register r WHERE r.user_id = ?
          ON DUPLICATE KEY UPDATE
            status = IF(status = 'approved', status, 'pending'),
            requested_at = NOW()
         `,
        [postId, me, me]
      );

      // แจ้งเตือน: type = 'offer'
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
        [post.student_id, me, 'offer', `มีติวเตอร์ยื่นข้อเสนอสอน สำหรับโพสต์ "${post.subject || 'เรียนพิเศษ'}"`, postId]
      );

    } else {
      // --- STUDENT: ลงใน student_post_joins ---
      await pool.query(
        `INSERT INTO student_post_joins (student_post_id, user_id, status, requested_at, name, lastname)
          SELECT ?, ?, 'pending', NOW(), r.name, r.lastname
          FROM register r WHERE r.user_id = ?
          ON DUPLICATE KEY UPDATE
            status = IF(status = 'approved', status, 'pending'),
            requested_at = NOW()
         `,
        [postId, me, me]
      );

      // แจ้งเตือน: type = 'join_request'
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id) VALUES (?, ?, ?, ?, ?)',
        [post.student_id, me, 'join_request', `มีคำขอเข้าร่วมโพสต์ "${post.subject || 'เรียนพิเศษ'}"`, postId]
      );
    }

    // 6. ส่งค่ากลับ
    return res.json({
      success: true,
      joined: false,
      pending_me: true,
      join_count: Number(cnt.c || 0)
    });

  } catch (err) {
    console.error("❌ JOIN ERROR:", err);
    return res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
  }
});

// ✅ API: ยกเลิกคำขอ / เลิกเข้าร่วม (สำหรับ student_posts)
app.delete('/api/student_posts/:id/join', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const me = Number(req.query.user_id || req.body?.user_id); // รับค่าให้ครบ

    if (!Number.isFinite(postId) || !Number.isFinite(me)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs' });
    }

    const conn = await pool.getConnection();
    try {
      // 1. ลบออกจากตาราง Joins (สำหรับนักเรียน) และ Offers (สำหรับติวเตอร์)
      console.log(`🗑️ Unjoining: Post=${postId}, User=${me}`);

      const [resJoin] = await conn.query(
        'DELETE FROM student_post_joins WHERE student_post_id = ? AND user_id = ?',
        [postId, me]
      );

      const [resOffer] = await conn.query(
        'DELETE FROM student_post_offers WHERE student_post_id = ? AND tutor_id = ?',
        [postId, me]
      );

      console.log("✅ Delete Result (Joins):", resJoin);
      console.log("✅ Delete Result (Offers):", resOffer);

      // 2. ลบออกจากปฏิทินด้วย (ถ้ามี)
      await conn.query(
        'DELETE FROM calendar_events WHERE post_id = ? AND user_id = ?',
        [postId, me]
      );

      // 3. ส่งข้อมูลจำนวนคนล่าสุดกลับไป
      const [[cnt]] = await conn.query(
        'SELECT COUNT(*) AS c FROM student_post_joins WHERE student_post_id = ? AND status="approved"',
        [postId]
      );

      conn.release();
      return res.json({
        success: true,
        message: 'Unjoined successfully',
        join_count: Number(cnt?.c || 0)
      });

    } catch (dbErr) {
      conn.release();
      throw dbErr;
    }

  } catch (err) {
    console.error("❌ UNJOIN ERROR:", err);
    return res.status(500).json({ success: false, message: 'Server error during unjoin' });
  }
});

// ✅ API: ลบประวัติการค้นหา "ทีละรายการ" (Delete Single History Item)
// ✅ API: ลบประวัติการค้นหา "ตามคำค้นหา" (Delete History by Keyword)
app.delete('/api/search/history', async (req, res) => {
  try {
    const { user_id, keyword } = req.query;

    if (!user_id && !keyword) {
      // ถ้าไม่ส่งอะไรมาเลย = ลบทั้งหมด (Clear All)
      if (req.query.user_id) {
        await pool.query('DELETE FROM search_history WHERE user_id = ?', [req.query.user_id]);
        return res.json({ success: true, message: 'Cleared all history' });
      }
      return res.status(400).json({ message: 'Missing parameters' });
    }

    if (keyword) {
      // ลบเฉพาะคำที่ระบุ (Delete specific keyword)
      const [result] = await pool.query(
        'DELETE FROM search_history WHERE user_id = ? AND keyword = ?',
        [user_id, keyword]
      );
      return res.json({ success: true, message: `Deleted keyword "${keyword}"` });
    }

  } catch (err) {
    console.error('Delete History Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ API: แนะนำคอร์สเรียน (Based on Search History)
app.get('/api/recommendations/courses', async (req, res) => {
  try {
    const userId = Number(req.query.user_id) || 0;

    // 1. ดึงคำค้นหาล่าสุด 3 รายการของผู้ใช้
    const [history] = await pool.query(
      'SELECT DISTINCT keyword FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
      [userId]
    );

    let rows = [];

    // 2. ถ้ามีประวัติค้นหา -> หาโพสต์ที่ตรงกับ Keyword
    if (history.length > 0) {
      const keywords = history.map(h => h.keyword);

      // สร้าง Query แบบ Dynamic OR (subject LIKE %k1% OR subject LIKE %k2% ...)
      const likeConditions = keywords.map(() => 'tp.subject LIKE ? OR tp.description LIKE ?').join(' OR ');
      const params = [];
      keywords.forEach(k => params.push(`%${k}%`, `%${k}%`));

      // เพิ่ม user_id เข้าไปใน params สำหรับเช็ค Favorites/Joins
      const sqlParams = [userId, userId, userId, ...params];

      const [results] = await pool.query(`
        SELECT 
          tp.*, 
          r.name, r.lastname, tpro.profile_picture_url,
          COALESCE(fvc.c,0) AS fav_count,
          CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
        FROM tutor_posts tp
        LEFT JOIN register r ON r.user_id = tp.tutor_id
        LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
        LEFT JOIN (SELECT post_id, COUNT(*) as c FROM posts_favorites WHERE post_type='tutor' GROUP BY post_id) fvc ON fvc.post_id = tp.tutor_post_id
        LEFT JOIN posts_favorites fme ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
        LEFT JOIN tutor_post_joins jme ON jme.tutor_post_id = tp.tutor_post_id AND jme.user_id = ? AND jme.status='approved'
        LEFT JOIN tutor_post_joins jme_pending ON jme_pending.tutor_post_id = tp.tutor_post_id AND jme_pending.user_id = ? AND jme_pending.status='pending'
        WHERE ${likeConditions}
        ORDER BY tp.created_at DESC LIMIT 6
      `, sqlParams);

      rows = results;
    }

    // 3. ถ้าไม่มีประวัติค้นหา หรือค้นแล้วไม่เจอ -> เอาโพสต์ล่าสุดมาแสดง (Fallback)
    if (rows.length === 0) {
      const [latest] = await pool.query(`
        SELECT 
          tp.*, 
          r.name, r.lastname, tpro.profile_picture_url,
          COALESCE(fvc.c,0) AS fav_count,
          CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
        FROM tutor_posts tp
        LEFT JOIN register r ON r.user_id = tp.tutor_id
        LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
        LEFT JOIN (SELECT post_id, COUNT(*) as c FROM posts_favorites WHERE post_type='tutor' GROUP BY post_id) fvc ON fvc.post_id = tp.tutor_post_id
        LEFT JOIN posts_favorites fme ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
        ORDER BY tp.created_at DESC LIMIT 6
      `, [userId]);
      rows = latest;
    }

    // Map ข้อมูลส่งกลับ
    const items = rows.map(r => ({
      _id: r.tutor_post_id,
      subject: r.subject,
      content: r.description,
      createdAt: r.created_at,
      authorId: {
        id: r.tutor_id,
        name: `${r.name || ''} ${r.lastname || ''}`.trim(),
        avatarUrl: r.profile_picture_url || ''
      },
      meta: {
        target_student_level: r.target_student_level || 'ไม่ระบุ',
        teaching_days: r.teaching_days,
        teaching_time: r.teaching_time,
        location: r.location,
        price: Number(r.price || 0),
        contact_info: r.contact_info
      },
      fav_count: Number(r.fav_count || 0),
      favorited: !!r.favorited
    }));

    res.json(items);

  } catch (err) {
    console.error('Recommended Courses API Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Health ----------
app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));


// --- [NEW] Get User Profile (Unified) ---
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const [rows] = await pool.execute('SELECT * FROM register WHERE user_id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const user = rows[0];
    const userType = (user.type || '').toLowerCase();

    // Remove password
    delete user.password;

    let profileData = {};
    if (userType === 'tutor' || userType === 'teacher') {
      const [tRows] = await pool.execute('SELECT * FROM tutor_profiles WHERE user_id = ?', [userId]);
      if (tRows.length) profileData = tRows[0];
    } else {
      // Assume student 
      // Check if student_profiles table exists or use what we have.
      // Based on `spro` join in `student_posts` API, `student_profiles` has `user_id` and `profile_picture_url`.
      // Let's safe query.
      try {
        const [sRows] = await pool.execute('SELECT * FROM student_profiles WHERE user_id = ?', [userId]);
        if (sRows.length) profileData = sRows[0];
      } catch (err) {
        console.warn("Student profiles table access error (might not exist yet):", err.message);
      }
    }

    // Merge logic
    const responseData = {
      ...user,
      ...profileData, // profile data overrides register data if conflicts (e.g. phone)
      user_id: user.user_id,
      first_name: user.name,
      last_name: user.lastname,
      role: userType,
      userType: userType,
      // map profile fields
      profile_image: profileData.profile_picture_url || user.profile_picture_url || '/default-avatar.png',
      phone: profileData.phone || user.phone || '',
      bio: profileData.about_me || profileData.bio || '',
      created_at: user.created_at || new Date().toISOString()
    };

    res.json(responseData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- [NEW] Get Tutor Reviews ---
app.get('/api/tutors/:id/reviews', async (req, res) => {
  try {
    const tutorId = req.params.id;
    // Check if `reviews` table exists or named `tutor_reviews`?
    // Let's assume `reviews` table based on standard naming or `tutor_reviews`.
    // SearchController might have search history, RecommendationController might have logic.
    // Let's try `reviews` table first.
    // If fail, we return empty array.

    // Actually, let's check correct table name if possible.
    // I saw `posts_favorites` and `tutor_post_joins`.
    // I did NOT see strict review table in the snippets.
    // But `TutorProfile` component likely uses it?
    // The user rejected the modal because they wanted a page.
    // I will assume `reviews` table exists with `tutor_id`.

    /* 
       Table Schema Guess:
       reviews (
         id, tutor_id, reviewer_id, rating, comment, created_at
       )
    */

    const [rows] = await pool.execute(`
            SELECT r.*, reg.name, reg.lastname, reg.type
            FROM reviews r
            LEFT JOIN register reg ON reg.user_id = r.reviewer_id
            WHERE r.tutor_id = ?
            ORDER BY r.created_at DESC
        `, [tutorId]);

    const items = rows.map(row => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      reviewer: {
        id: row.reviewer_id,
        name: `${row.name} ${row.lastname}`.trim(),
        avatar: '/default-avatar.png' // join profile if needed
      }
    }));

    res.json(items);
  } catch (err) {
    // If table doesn't exist, return empty
    console.warn("Reviews fetch error (might be missing table):", err.message);
    res.json([]);
  }
});

// ✅ API: Create Review
app.post('/api/reviews', async (req, res) => {
  try {
    const {
      tutor_post_id, // Frontend passes postId as tutor_post_id (even if student post)
      tutor_id,
      student_id,
      rating,
      rating_punctuality,
      rating_worth,
      rating_teaching,
      comment
    } = req.body;

    if (!tutor_id || !student_id || !rating) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Convert to number
    const inputPostId = Number(tutor_post_id || 0);
    const sId = Number(student_id);
    const tId = Number(tutor_id);

    let finalPostType = 'unknown';

    // 1. Try to detect if it's a Tutor Post or Student Post
    // Check if it's a Tutor Post (Student joined it)
    const [tutorPostJoin] = await pool.query(
      `SELECT tutor_post_id FROM tutor_post_joins WHERE tutor_post_id = ? AND user_id = ? AND status='approved'`,
      [inputPostId, sId]
    );

    if (tutorPostJoin.length > 0) {
      finalPostType = 'tutor_post';
    } else {
      // Check if it's a Student Post (Student owns it, Tutor offered)
      // Or Student joined another Student's post (Buddy)

      // Case A: Student is Owner
      const [studentPostOwner] = await pool.query(
        `SELECT student_post_id FROM student_posts WHERE student_post_id = ? AND student_id = ?`,
        [inputPostId, sId]
      );
      if (studentPostOwner.length > 0) {
        finalPostType = 'student_post';
      } else {
        // Case B: Student is Buddy (Joiner)
        const [studentPostJoin] = await pool.query(
          `SELECT student_post_id FROM student_post_joins WHERE student_post_id = ? AND user_id = ? AND status='approved'`,
          [inputPostId, sId]
        );
        if (studentPostJoin.length > 0) {
          finalPostType = 'student_post';
        }
      }
    }

    if (finalPostType === 'unknown') {
      // If ambiguous, check if ID exists in tutor_posts at all
      const [tp] = await pool.query('SELECT tutor_post_id FROM tutor_posts WHERE tutor_post_id = ?', [inputPostId]);
      if (tp.length > 0) finalPostType = 'tutor_post';
      else finalPostType = 'student_post'; // Assumption / Fallback
    }

    // 2. Check if already reviewed
    const [existing] = await pool.query(
      `SELECT review_id FROM reviews WHERE student_id = ? AND post_id = ? AND post_type = ?`,
      [sId, inputPostId, finalPostType]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Reviewed already' }); // Idempotent success
    }

    // 3. Insert Review
    await pool.query(
      `INSERT INTO reviews 
       (tutor_id, student_id, rating, comment, created_at, post_id, post_type, rating_punctuality, rating_worth, rating_teaching)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [tId, sId, rating, comment || '', inputPostId, finalPostType, rating_punctuality || 5, rating_worth || 5, rating_teaching || 5]
    );

    // 4. Notify Tutor
    // Get student name for message
    const [student] = await pool.query('SELECT name, lastname FROM register WHERE user_id = ?', [sId]);
    const sName = student[0] ? `${student[0].name} ${student[0].lastname}` : 'นักเรียน';

    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, message, related_id, created_at)
       VALUES (?, ?, 'review_received', ?, ?, NOW())`,
      [tId, sId, `ได้รับรีวิวใหม่จาก ${sName}`, inputPostId]
    );

    res.json({ success: true, message: 'Review submitted successfully' });

  } catch (err) {
    console.error("❌ Submit Review Error:", err);
    res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
  }
});

// ✅ API: Edit Student Post
app.put('/api/student_posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const {
      subject, description, preferred_days, preferred_time,
      grade_level, location, group_size, budget, contact_info
    } = req.body;

    // Validate ownership? We assume frontend checks or we can check here.
    // For now simple update.

    await pool.query(
      `UPDATE student_posts SET 
        subject=?, description=?, preferred_days=?, preferred_time=?, 
        grade_level=?, location=?, group_size=?, budget=?, contact_info=?
       WHERE student_post_id=?`,
      [
        subject, description, preferred_days, preferred_time,
        grade_level, location, group_size, budget, contact_info,
        postId
      ]
    );

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error("Update Student Post Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ✅ API: Edit Tutor Post
app.put('/api/tutor-posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const {
      subject, description, teaching_days, teaching_time,
      target_student_level, location, price, group_size, contact_info
    } = req.body;

    await pool.query(
      `UPDATE tutor_posts SET 
        subject=?, description=?, teaching_days=?, teaching_time=?, 
        target_student_level=?, location=?, price=?, group_size=?, contact_info=?
       WHERE tutor_post_id=?`,
      [
        subject, description, teaching_days, teaching_time,
        target_student_level, location, price, group_size, contact_info,
        postId
      ]
    );

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error("Update Tutor Post Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ✅ API: Submit Report
app.post('/api/reports', async (req, res) => {
  try {
    const { reporter_id, post_id, post_type, reason } = req.body;
    await pool.query(
      `INSERT INTO reports (reporter_id, post_id, post_type, reason, created_at) VALUES (?, ?, ?, ?, NOW())`,
      [reporter_id, post_id, post_type, reason]
    );
    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (err) {
    console.error("Report Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ✅ API: Admin - Get All Reports
app.get('/api/admin/reports', async (req, res) => {
  try {
    const { user_id } = req.query; // Security check
    const [u] = await pool.query('SELECT role FROM register WHERE user_id = ?', [user_id]);
    if (!u.length || u[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const [rows] = await pool.query(`
      SELECT 
        r.report_id, r.reporter_id, r.post_id, r.reason, r.status, r.created_at,
        u.name as reporter_name, u.lastname as reporter_lastname,
        
        /* ✅ Smart Type Detection: Priority to existing type, fallback to auto-detect */
        CASE 
           WHEN r.post_type IN ('student_post', 'student') THEN 'student'
           WHEN r.post_type IN ('tutor_post', 'tutor') THEN 'tutor'
           WHEN sp.student_post_id IS NOT NULL THEN 'student'
           WHEN tp.tutor_post_id IS NOT NULL THEN 'tutor'
           ELSE r.post_type
        END as post_type,

        CASE 
          WHEN r.post_type IN ('student_post', 'student') THEN COALESCE(sp.subject, 'โพสต์ถูกลบไปแล้ว')
          WHEN r.post_type IN ('tutor_post', 'tutor') THEN COALESCE(tp.subject, 'โพสต์ถูกลบไปแล้ว')
          WHEN sp.student_post_id IS NOT NULL THEN CONCAT('(กู้คืนอัตโนมัติ) ', sp.subject)
          WHEN tp.tutor_post_id IS NOT NULL THEN CONCAT('(กู้คืนอัตโนมัติ) ', tp.subject)
          ELSE CONCAT('ไม่พบข้อมูลโพสต์ (Type: ', COALESCE(r.post_type, 'ว่าง'), ')')
        END as post_title,
        
        CASE 
          WHEN r.post_type IN ('student_post', 'student') THEN COALESCE(sp.description, '-')
          WHEN r.post_type IN ('tutor_post', 'tutor') THEN COALESCE(tp.description, '-')
          WHEN sp.student_post_id IS NOT NULL THEN sp.description
          WHEN tp.tutor_post_id IS NOT NULL THEN tp.description
          ELSE '' 
        END as post_content

      FROM reports r
      LEFT JOIN register u ON r.reporter_id = u.user_id
      -- ✅ Unconditional Join to find post even if type is wrong
      LEFT JOIN student_posts sp ON r.post_id = sp.student_post_id 
      LEFT JOIN tutor_posts tp ON r.post_id = tp.tutor_post_id
      ORDER BY r.created_at DESC
    `);
    console.log("Admin Reports Data (Smart Fix):", rows);
    res.json(rows);
  } catch (err) {
    console.error("Admin Reports Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ✅ API: Admin - Update Report Status
app.patch('/api/admin/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const reportId = req.params.id;
    console.log(`[Admin] Updating report ${reportId} to status: ${status}`);

    // 1. Get reporter ID before update
    const [rows] = await pool.query('SELECT reporter_id, post_id FROM reports WHERE report_id = ?', [reportId]);
    console.log(`[Admin] Fetch report result:`, rows);

    // 2. Update status
    await pool.query('UPDATE reports SET status = ? WHERE report_id = ?', [status, reportId]);

    // 3. Notify Reporter (If status is resolved or ignored/cancelled)
    if (rows.length > 0 && (status === 'resolved' || status === 'ignored')) {
      const reporterId = rows[0].reporter_id;
      console.log(`[Admin] Notifying reporter ${reporterId}`);

      const msg = status === 'resolved'
        ? "ขอบคุณสำหรับการรายงานของคุณ ทางเราได้ตรวจสอบและดำเนินการเรียบร้อยแล้วครับ"
        : "ขอบคุณสำหรับการรายงานของคุณ ทางเราตรวจสอบแล้วไม่พบการกระทำผิดกฎ จึงขอยกเลิกการรายงานครับ";

      await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read, actor_id) 
          VALUES (?, 'system_alert', ?, ?, NOW(), 0, NULL)`,
        [reporterId, msg, rows[0].post_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update Report Status Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ✅ API: Admin - Delete Post (and resolve reports)
app.delete('/api/admin/posts', async (req, res) => {
  try {
    const id = req.body.id || req.body.post_id;
    const type = req.body.type || req.body.post_type; // 'student' or 'tutor'

    if (!id || !type) {
      return res.status(400).json({ success: false, message: 'Missing id or type' });
    }

    console.log(`[Admin] Deleting post ${id} (${type})`);

    // 1. Get all reporters for this post to notify them
    // Note: Matches logic in reports (post_type might be 'student_post' or 'student')
    // Also handle cases where post_type might be empty or null due to frontend bugs
    const [reporters] = await pool.query(
      `SELECT DISTINCT reporter_id FROM reports
         WHERE post_id = ? AND (post_type = ? OR post_type = ? OR post_type = '' OR post_type IS NULL)`,
      [id, type, type + '_post']
    );
    console.log(`[Admin] Found reporters to notify:`, reporters);

    // 2. Soft Delete Post (Set is_active = 0) to avoid FK constraints
    if (type === 'student' || type === 'student_post') {
      await pool.query('UPDATE student_posts SET is_active = 0 WHERE student_post_id = ?', [id]);
    } else {
      await pool.query('UPDATE tutor_posts SET is_active = 0 WHERE tutor_post_id = ?', [id]);
    }

    // 3. Mark reports as resolved
    await pool.query(
      `UPDATE reports SET status = 'resolved'
         WHERE post_id = ? AND (post_type = ? OR post_type = ? OR post_type = '' OR post_type IS NULL)`,
      [id, type, type + '_post']
    );

    // 4. Notify Reporters
    for (const r of reporters) {
      console.log(`[Admin] Sending notification to reporter ${r.reporter_id}`);
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read, actor_id)
             VALUES (?, 'system_alert', ?, ?, NOW(), 0, NULL)`,
        [r.reporter_id, "ขอบคุณสำหรับการรายงานของคุณ โพสต์ดังกล่าวได้ถูกลบออกจากระบบแล้วครับ", id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Admin Delete Post Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));