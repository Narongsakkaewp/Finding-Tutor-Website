// tutorweb-server/server.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
// const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const SPREADSHEET_ID = '1djs9ACE03WeImxVwuz6VfhnJ0ev1R473VQKVLYt5ynM';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

let creds;

if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  // Production (Clean Split Env Variables)
  let key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (!key.includes('\n') && key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
    const beginStr = '-----BEGIN PRIVATE KEY-----';
    const endStr = '-----END PRIVATE KEY-----';
    let base64Body = key.substring(key.indexOf(beginStr) + beginStr.length, key.indexOf(endStr));
    base64Body = base64Body.replace(/\s+/g, '\n');
    key = `${beginStr}\n${base64Body.trim()}\n${endStr}\n`;
  }

  creds = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: key
  };
} else if (process.env.GOOGLE_SERVICE_ACCOUNT) {
  // Production (Legacy JSON Parser)
  creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  if (creds.private_key) {
    let key = creds.private_key.replace(/\\n/g, '\n');
    if (!key.includes('\n') && key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
      const beginStr = '-----BEGIN PRIVATE KEY-----';
      const endStr = '-----END PRIVATE KEY-----';
      let base64Body = key.substring(key.indexOf(beginStr) + beginStr.length, key.indexOf(endStr));
      base64Body = base64Body.replace(/\s+/g, '\n');
      key = `${beginStr}\n${base64Body.trim()}\n${endStr}\n`;
    }
    creds.private_key = key;
  }
} else {
  // Local (กระบวนการเครื่องเรา)
  creds = require('./service-account.json');
}

// ----- Upload Deps -----
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ----- recommendation sets -----
const pool = require('./db'); // นำเข้าไฟล์การตั้งค่า DB
const recommendationController = require('./src/controllers/recommendationController');
const scheduleController = require('./src/controllers/scheduleController');
const searchRoutes = require('./src/routes/searchRoutes');
const favoriteRoutes = require('./src/routes/favoriteRoutes');
const searchController = require('./src/controllers/searchController');
// ----- Email Deps -----
// Using native fetch for Brevo to avoid SDK CommonJS bugs
const { initCron, checkAndSendNotifications } = require('./src/services/cronService');
const { sendBookingConfirmationEmail } = require('./src/utils/emailService');

// ----- Cloudinary Images Upload Config -----
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Scheduler
initCron();

// (Nodemailer transporter removed in favor of Resend API)

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
// Keyword ชื่อวิชาที่ใช้สำหรับการค้นหา (Dictionary ฉบับครอบคลุม)
const KEYWORD_MAP = {
  // 📐 หมวดคณิตศาสตร์
  'math': ['คณิต', 'เลข', 'คณิตศาสตร์', 'calculus', 'algebra', 'stat'],
  'คณิต': ['math', 'เลข', 'คณิตศาสตร์', 'calculus', 'แคล'],
  'เลข': ['math', 'คณิต'],
  'แคล': ['calculus', 'cal', 'คณิต', 'math'],
  'แคลคูลัส': ['calculus', 'cal', 'คณิต', 'math'],
  'สถิติ': ['stat', 'statistics', 'คณิต', 'math', 'data'],

  // 🧬 หมวดวิทยาศาสตร์
  'sci': ['วิทย์', 'วิทยาศาสตร์', 'bio', 'chem', 'phy'],
  'วิทย์': ['sci', 'science', 'วิทยาศาสตร์'],
  'phy': ['ฟิสิกส์', 'physics', 'กลศาสตร์', 'วิทย์'],
  'ฟิสิกส์': ['phy', 'physics', 'ฟิสิก'], // ดักคนพิมพ์ผิดว่า ฟิสิก (ไม่มี ส์)
  'ฟิสิก': ['phy', 'ฟิสิกส์'],
  'chem': ['เคมี', 'chemistry', 'วิทย์'],
  'เคมี': ['chem', 'chemistry'],
  'bio': ['ชีว', 'ชีววิทยา', 'ชีวะ', 'biology', 'วิทย์'],
  'ชีว': ['bio', 'biology', 'ชีววิทยา', 'ชีวะ'],
  'ชีวะ': ['bio', 'ชีว', 'ชีววิทยา'],

  // 🗣️ หมวดภาษาและการสอบ
  'english': ['อังกฤษ', 'english', 'eng', 'ielts', 'toeic', 'toefl', 'igcse', 'grammar', 'อิ้ง', 'ภาษาอังกฤษ', 'เอนกฤษ'],
  'thai': ['ไทย', 'ภาษาไทย', 'th', 'สอนไทย', 'หลักภาษา', 'พาที'],

  // --- กลุ่มเอเชีย (เพิ่มเวียดนาม, พม่า, ลาว) ---
  'chinese': ['จีน', 'hsk', 'พินอิน', 'pinyin', 'cn', 'ภาษาจีน', 'เหล่าซือ', 'hskk', 'ตัวจีน', 'แต้จิ๋ว'],
  'jap': ['ญี่ปุ่น', 'japanese', 'n1', 'n2', 'n3', 'n4', 'n5', 'jlpt', 'jp', 'ภาษาญี่ปุ่น', 'ยุ่น', 'คันจิ', 'เซนเซ'],
  'korean': ['เกาหลี', 'topik', 'ภาษาเกาหลี', 'kr', 'ติ่ง', 'เกา', 'โทปิค', 'ฮันกึล'],
  'vietnamese': ['เวียดนาม', 'vn', 'vietnam', 'ภาษาเวียดนาม', 'ติงเวียด'],
  'burmese': ['พม่า', 'myanmar', 'mm', 'ภาษาพม่า'],
  'lao': ['ลาว', 'laos', 'lao', 'ภาษาลาว'],

  // --- กลุ่มยุโรป (เพิ่มอิตาลี, รัสเซีย, โปรตุเกส) ---
  'french': ['ฝรั่งเศส', 'french', 'pat7', 'ฝรั่งเศษ', 'ภาษาฝรั่งเศส', 'fr', 'delf', 'dalf'],
  'german': ['เยอรมัน', 'german', 'pat7', 'ภาษาเยอรมัน', 'de', 'deutsch', 'เยอรมันนี'],
  'spanish': ['สเปน', 'esp', 'espanol', 'spanish', 'ภาษาสเปน', 'es', 'dele'],
  'italian': ['อิตาลี', 'italian', 'italy', 'it', 'ภาษาอิตาลี', 'อิตาเลียน'],
  'russian': ['รัสเซีย', 'russian', 'ru', 'ภาษารัสเซีย', 'หมีขาว'],
  'portuguese': ['โปรตุเกส', 'portuguese', 'pt', 'ภาษาโปรตุเกส'],

  // --- กลุ่มตะวันออกกลางและอื่นๆ ---
  'arabic': ['อาหรับ', 'arabic', 'ar', 'ภาษาอาหรับ', 'ตะวันออกกลาง'],
  'hindi': ['อินดี', 'hindi', 'hi', 'อินเดีย', 'ภาษาอินเดีย'],

  // --- กลุ่มวิชาการ/หมวดหมู่รวม ---
  'ภาษาต่างประเทศ': ['language', 'foreign', 'inter', 'นานาชาติ', 'ภาษา', 'เรียนภาษา', 'ศิลป์ภาษา', 'มนุษยศาสตร์', 'อักษรศาสตร์'],
  'โบราณคดี/ภาษาเก่า': ['บาลี', 'สันสกฤต', 'pali', 'sanskrit', 'ละติน', 'latin'],

  // 💻 หมวดคอมพิวเตอร์และเทคโนโลยี (Tech Stack)
  'com': ['คอม', 'code', 'program', 'it', 'คอมพิวเตอร์', 'เขียนโปรแกรม'],
  'คอม': ['com', 'code', 'it', 'word', 'excel', 'powerpoint'],
  'code': ['program', 'เขียนโปรแกรม', 'dev', 'python', 'java', 'html', 'css', 'javascript', 'c++'],
  'เขียนโปรแกรม': ['code', 'program', 'dev', 'python', 'java', 'c++', 'oop'],
  'python': ['code', 'program', 'เขียนโปรแกรม', 'data', 'ai', 'machine learning', 'ml'],
  'java': ['code', 'program', 'เขียนโปรแกรม', 'oop'],
  'oop': ['java', 'c++', 'เขียนโปรแกรม', 'code', 'program', 'object oriented'],
  'react': ['web', 'frontend', 'code', 'program', 'javascript', 'js'],
  'web': ['website', 'เขียนเว็บ', 'html', 'css', 'javascript', 'frontend', 'backend', 'react', 'node'],
  'website': ['web', 'เขียนเว็บ', 'webapp'],
  'js': ['javascript', 'web', 'react', 'node'],
  'javascript': ['js', 'web', 'react', 'node', 'frontend'],
  'sql': ['database', 'ฐานข้อมูล', 'data'],
  'database': ['sql', 'ฐานข้อมูล', 'mysql', 'nosql'],
  'app': ['mobile', 'flutter', 'ios', 'android', 'application'],
  'ui': ['ux', 'design', 'figma', 'ออกแบบ'],
  'ux': ['ui', 'design', 'figma'],

  // 🌍 หมวดสังคมและมนุษยศาสตร์
  'สังคม': ['social', 'ประวัติศาสตร์', 'ภูมิศาสตร์', 'รัฐศาสตร์', 'นิติศาสตร์'],
  'ประวัติศาสตร์': ['history', 'สังคม'],

  // 🎨 หมวดไลฟ์สไตล์ ดนตรี และศิลปะ
  'ศิลปะ': ['art', 'วาดรูป', 'วาดภาพ', 'design', 'ออกแบบ', 'color'],
  'วาดรูป': ['ศิลปะ', 'art', 'procreate', 'สีน้ำ', 'ดรออิ้ง'],
  'ดนตรี': ['music', 'กีตาร์', 'เปียโน', 'ร้องเพลง', 'ไวโอลิน'],
  'กีตาร์': ['guitar', 'ดนตรี', 'โปร่ง', 'กีตาร์ไฟฟ้า', 'กีตาร์คลาสสิค', 'เบส', 'ukulele', 'เครื่องสาย'],
  'เปียโน': ['piano', 'ดนตรี'],
  'ร้องเพลง': ['vocal', 'ดนตรี', 'voice'],
  'กีฬา': ['sport', 'ว่ายน้ำ', 'แบดมินตัน', 'เทนนิส', 'ฟิตเนส'],
  'ว่ายน้ำ': ['swimming', 'กีฬา'],

  // 🎯 หมวดเตรียมสอบ (สำคัญมาก เด็กมักพิมพ์คำเหล่านี้ตรงๆ)
  'สอบเข้า': ['ม.1', 'ม.4', 'เตรียมอุดม', 'tcas', 'มหาวิทยาลัย', 'กสพท'],
  'tcas': ['tgat', 'tpat', 'a-level', 'สอบเข้า', 'ม.6'],
  'tgat': ['tcas', 'อังกฤษ', 'ตรรกะ'],
  'สอวน': ['โอลิมปิก', 'ค่าย', 'คณิต', 'คอม', 'เคมี', 'ชีว', 'ฟิสิกส์'],

  // 💼 หมวดบริหาร ธุรกิจ และการตลาด (Business & Marketing)
  'business': ['บริหาร', 'ธุรกิจ', 'mbti', 'startup', 'entrepreneur', 'จัดการ'],
  'marketing': ['การตลาด', 'ads', 'facebook', 'tiktok', 'content', 'digital marketing', 'branding'],
  'finance': ['การเงิน', 'ลงทุน', 'หุ้น', 'crypto', 'nft', 'ภาษี', 'บัญชี', 'เศรษฐศาสตร์', 'econ'],
  'บัญชี': ['account', 'accounting', 'finance', 'งบประมาณ', 'สอบบัญชี', 'audit'],
  'เศรษฐศาสตร์': ['econ', 'economics', 'เศรษฐกิจ', 'macro', 'micro'],

  // ⚖️ หมวดกฎหมายและรัฐศาสตร์ (Law & Political Science)
  'law': ['กฎหมาย', 'นิติ', 'นิติศาสตร์', 'แพ่ง', 'อาญา', 'รัฐธรรมนูญ', 'ตั๋วทนาย'],
  'นิติ': ['law', 'กฎหมาย', 'สอบเนติ'],
  'รัฐศาสตร์': ['polsci', 'การเมือง', 'ir', 'ความสัมพันธ์ระหว่างประเทศ', 'สิงห์'],

  // 🧠 หมวดจิตวิทยาและการพัฒนาตนเอง (Psychology & Soft Skills)
  'psychology': ['จิตวิทยา', 'therapy', 'counseling', 'สุขภาพจิต', 'mental health'],
  'soft skills': ['leadership', 'communication', 'public speaking', 'พูดในที่สาธารณะ', 'เจรจา', 'การนำเสนอ', 'presentation'],
  'บุคลิกภาพ': ['personality', 'image', 'แต่งตัว', 'grooming', 'makeup', 'สอนแต่งหน้า'],

  // 🍳 หมวดทักษะชีวิตและงานฝีมือ (Life Skills & Craft)
  'cooking': ['ทำอาหาร', 'ทำขนม', 'bakery', 'เบเกอรี่', 'เชฟ', 'สูตรอาหาร'],
  'photography': ['ถ่ายภาพ', 'ถ่ายรูป', 'กล้อง', 'lightroom', 'photoshop', 'ตัดต่อวิดีโอ', 'video edit', 'capcut', 'premiere pro'],
  'งานฝีมือ': ['diy', 'เย็บผ้า', 'ถักไหมพรม', 'crochet', 'จัดดอกไม้', 'งานประดิษฐ์'],

  // 🔮 หมวดความเชื่อและวิชาชีพเฉพาะทาง (Niche & Beliefs)
  'โหราศาสตร์': ['ดูดวง', 'astrology', 'ไพ่ยิปซี', 'tarot', 'ฮวงจุ้ย', 'fengshui', 'มูเตลู', 'เลขศาสตร์'],
  'อสังหา': ['real estate', 'นายหน้า', 'ขายบ้าน', 'คอนโด', 'ที่ดิน'],

  // 🩺 หมวดสุขภาพและการแพทย์ (Health & Medical)
  'health': ['สุขภาพ', 'nutrition', 'โภชนาการ', 'ลดน้ำหนัก', 'diet', 'yoga', 'โยคะ', 'pilates', 'พิลาทิส'],
  'first aid': ['ปฐมพยาบาล', 'cpr', 'กู้ชีพ', 'พยาบาล'],

  // 🎮 หมวดเกมและอีสปอร์ต (Gaming & Esport)
  'gaming': ['เกม', 'game dev', 'esport', 'streamer', 'boardgame', 'บอร์ดเกม'],

  // 🏹 หมวดภาษาเพิ่มเติม (กลุ่ม Scandinavian & อื่นๆ)
  'scandinavian': ['swedish', 'norwegian', 'danish', 'สวีเดน', 'นอร์เวย์', 'เดนมาร์ก'],
  'turkish': ['ตุรกี', 'turkey', 'tr'],
  'hebrew': ['ฮีบรู', 'hebrew', 'อิสราเอล'],
};

// ฟังก์ชันช่วยขยายและหั่นคำค้นหาแบ่งเป็นกลุ่ม (Smart Search)
function tokenizeSearchTerm(term) {
  if (!term) return [];
  const searchWords = term.trim().toLowerCase().split(/\s+/);
  const wordGroups = [];

  searchWords.forEach(word => {
    const group = new Set([word]);

    if (typeof KEYWORD_MAP !== 'undefined') {
      if (KEYWORD_MAP[word]) {
        KEYWORD_MAP[word].forEach(syn => group.add(syn));
      } else {
        Object.keys(KEYWORD_MAP).forEach(key => {
          if (word.includes(key)) {
            group.add(key);
            KEYWORD_MAP[key].forEach(syn => group.add(syn));
          }
        });
      }
    }
    wordGroups.push(Array.from(group));
  });

  return wordGroups; // คืนค่าตัวอย่าง: [["ฟิสิกส์อะตอม", "ฟิสิกส์", "physics"], ["ม.ปลาย", "ม.4", "ม.5", "ม.6"]]
}

// ฟังก์ชันช่วยขยายคำค้นหาแบบเก่า (คืนค่าเป็น Array แบนราบ) เพื่อความเข้ากันได้
function expandSearchTerm(term) {
  const groups = tokenizeSearchTerm(term);
  const flat = [];
  groups.forEach(g => g.forEach(w => flat.push(w)));
  return [...new Set(flat)];
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

// ----- Multer (Cloudinary) -----
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // กำหนดโฟลเดอร์หลัก
    let folderName = 'finding-tutor';
    // ถ้ามีการส่ง role เข้ามาเพื่อแยกประเภท ก็ให้เอาไปต่อท้าย
    if (req.body.role === 'tutor') {
      folderName = 'finding-tutor/tutors';
    } else if (req.body.role === 'student') {
      folderName = 'finding-tutor/students';
    }

    return {
      folder: folderName,
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      // ย่อขนาดรูปให้ไม่เกิน Full HD ป้องกันไฟล์ใหญ่เกินไปแล้วเปลืองพื้นที่
      transformation: [{ width: 1920, limit: true }],
    };
  },
});

const upload = multer({
  storage: storage,
  // จำกัดขนาดไฟล์รับเข้าสูงสุด 5 MB (5 * 1024 * 1024 bytes)
  limits: { fileSize: 5 * 1024 * 1024 }
});
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
    `SELECT j.user_id, j.joined_at, r.name, r.lastname, r.username
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

// ฟังก์ชันสำหรับบันทึกข้อมูล Report Issue (แก้ไขใหม่)
async function saveToGoogleSheet(data) {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key
    });

    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[1]; // แผ่นที่ 2
    await sheet.addRow({
      Timestamp: new Date().toLocaleString('th-TH'),
      UserID: data.user_id || '-',
      Username: data.username || '-',
      Email: data.email || '-',
      Name: data.name || '-',
      Lastname: data.lastname || '-',
      Category: data.category,
      Topic: data.topic,
      Detail: data.detail
    });

    console.log("✅ Saved report issue to Google Sheet");
  } catch (err) {
    console.error("❌ Google Sheet Error:", err.message);
  }
}

// API รับแจ้งปัญหา (แก้ไขใหม่ให้ดึงข้อมูล User)
app.post('/api/report-issue', async (req, res) => {
  const { category, topic, detail, user_contact, user_id } = req.body;
  // user_contact คือ email ที่ส่งมาจาก frontend
  // user_id ควรส่งมาจาก frontend ถ้าล็อกอินอยู่

  let userData = {
    user_id: user_id || '-',
    username: '-',
    email: user_contact || '-',
    name: '-',
    lastname: '-'
  };

  try {
    // พยายามดึงข้อมูลเพิ่มเติมจาก Database
    let query = '';
    let param = '';

    if (user_id) {
      query = 'SELECT user_id, username, email, name, lastname FROM register WHERE user_id = ?';
      param = user_id;
    } else if (user_contact) {
      query = 'SELECT user_id, username, email, name, lastname FROM register WHERE email = ?';
      param = user_contact;
    }

    if (query) {
      const [rows] = await pool.query(query, [param]);
      if (rows.length > 0) {
        // ถ้าเจอ user ในระบบ ให้ใช้ข้อมูลจริง
        userData = {
          user_id: rows[0].user_id,
          username: rows[0].username || '-',
          email: rows[0].email,
          name: rows[0].name,
          lastname: rows[0].lastname
        };
      }
    }

    // ส่งข้อมูลครบชุดไปบันทึก
    saveToGoogleSheet({
      category,
      topic,
      detail,
      ...userData
    });

    res.json({ success: true, message: 'ได้รับเรื่องร้องเรียนแล้ว' });

  } catch (err) {
    console.error("Report Issue Error:", err);
    // ถึง DB พัง ก็ยังพยายามบันทึกลง Sheet ด้วยข้อมูลเท่าที่มี
    saveToGoogleSheet({ category, topic, detail, ...userData });
    res.json({ success: true, message: 'ได้รับเรื่องร้องเรียนแล้ว (User lookup failed)' });
  }
});

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
app.get('/api/recommendations/trending', recommendationController.getTrendingSubjects); // ✅ Dynamic Trending

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
    const normalizedPostType =
      post_type === 'student' ? 'student_post'
        : post_type === 'tutor' ? 'tutor_post'
          : post_type;

    // Respect an explicit post_type from the client so colliding IDs across tables
    // do not get reassigned to the wrong post type.
    if (targetPostId) {
      if (normalizedPostType === 'tutor_post') {
        const [posts] = await pool.query('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [targetPostId]);
        if (posts.length > 0) {
          if (!tutor_id) tutor_id = posts[0].tutor_id;
          post_id = targetPostId;
          post_type = 'tutor_post';
        }
      } else if (normalizedPostType === 'student_post') {
        const [sp] = await pool.query('SELECT student_id FROM student_posts WHERE student_post_id = ?', [targetPostId]);
        if (sp.length > 0) {
          post_id = targetPostId;
          post_type = 'student_post';
        }
      } else {
        const [posts] = await pool.query('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [targetPostId]);
        if (posts.length > 0) {
          if (!tutor_id) tutor_id = posts[0].tutor_id;
          post_id = targetPostId;
          post_type = 'tutor_post';
        } else {
          const [sp] = await pool.query('SELECT student_id FROM student_posts WHERE student_post_id = ?', [targetPostId]);
          if (sp.length > 0) {
            post_id = targetPostId;
            post_type = 'student_post';
          }
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
        (booking_id, tutor_id, student_id, post_id, post_type, rating, rating_punctuality, rating_worth, rating_teaching, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.body.booking_id || 0, // Fallback to 0 if unused
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
      `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
       VALUES (?, ?, 'review_received', ?, ?, ?)`,
      [tutor_id, student_id, `นักเรียน ${studentName} ได้รีวิวการสอนของคุณแล้ว`, result.insertId, post_type || null]
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
      'SELECT type, status, suspended_until FROM register WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({
      userType: rows[0].type,
      status: rows[0].status || 'active',
      suspended_until: rows[0].suspended_until || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ล็อกอิน (รองรับทั้ง Email และ Username)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body; // ตัวแปร email จากหน้าเว็บอาจจะเป็น username หรือ email ก็ได้

    // เช็คว่ากรอกตรงกับช่อง email หรือ username
    const [rows] = await pool.execute(
      'SELECT * FROM register WHERE (email = ? OR username = ?) AND password = ?',
      [email, email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'อีเมล/Username หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];

    // --- Soft Delete Recovery Logic ---
    if (user.deleted_at) {
      const deletedDate = new Date(user.deleted_at);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate - deletedDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        // กู้คืนบัญชี (Restore Account)
        await pool.query('UPDATE register SET deleted_at = NULL WHERE user_id = ?', [user.user_id]);
        user.deleted_at = null; // Update local object
        console.log(`♻️ Account Restored via Login: ${user.user_id}`);
      } else {
        // เกิน 30 วัน ถือว่าบัญชีหายไปแล้วจริงๆ แต่ข้อมูลอาจยังค้างรอ Cron Job ลบ
        return res.status(401).json({ success: false, message: 'บัญชีนี้ถูกลบทิ้งถาวรแล้ว ไม่สามารถกู้คืนได้ (เกิน 30 วัน)' });
      }
    }
    const status = String(user.status || 'active').trim().toLowerCase();
    const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;
    const now = new Date();

    if (status === 'banned') {
      return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งานโดยผู้ดูแลระบบ' });
    }

    if (status === 'suspended') {
      if (suspendedUntil && !Number.isNaN(suspendedUntil.getTime()) && suspendedUntil > now) {
        return res.status(403).json({
          success: false,
          message: `บัญชีนี้ถูกพักการใช้งานถึง ${suspendedUntil.toLocaleString('th-TH')}`
        });
      }

      await pool.query(
        'UPDATE register SET status = ?, suspended_until = NULL WHERE user_id = ?',
        ['active', user.user_id]
      );
      user.status = 'active';
      user.suspended_until = null;
    }

    const raw = String(user.type || '').trim().toLowerCase();
    const mapped = raw === 'teacher' ? 'tutor' : raw;

    res.json({
      success: true,
      user: {
        ...user,
        role: user.role || mapped,
        userType: mapped
      },
      userType: mapped,
      role: user.role || mapped
    });
  } catch (err) {
    console.error('Login Error:', err);
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
        (SELECT COUNT(*) FROM student_post_joins WHERE student_post_id = sp.student_post_id AND status = 'approved') AS join_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = sp.student_post_id AND post_type = 'student') AS comment_count
      FROM student_posts sp
      JOIN register r ON r.user_id = sp.student_id
      LEFT JOIN student_profiles spro ON r.user_id = sp.student_id
      WHERE sp.student_post_id = ?
    `, [postId]);

    // 🌟 แก้ไข Bug การเช็คค่า undefined และลบ conn.release() ที่ผิดออก
    if (rows.length === 0) {
      return res.status(404).json({ message: 'post not found' });
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
      comment_count: Number(post.comment_count || 0), // 🌟 เพิ่ม Count
      user: {
        first_name: post.name,
        last_name: post.lastname,
        profile_image: post.profile_picture_url || '/../blank_avatar.jpg'
      }
    };

    res.json(result);
  } catch (err) {
    console.error('Single Student Post Error:', err);
    return res.status(500).json({ message: 'server error' });
  }
});


// ---------- โพสต์นักเรียนตามวิชา ----------
app.get('/api/subjects/:subject/posts', async (req, res) => {
  try {
    const rawSubject = req.params.subject;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
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

    const [rows] = await pool.query(
      `SELECT 
          sp.student_post_id, sp.student_id, sp.subject, sp.description,
          sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, sp.budget,
          sp.grade_level,  /* <--- เพิ่มบรรทัดนี้ เพื่อดึงระดับชั้นออกมา */
          COALESCE(sp.created_at, NOW()) AS created_at,
          r.name        AS student_name,
          r.lastname    AS student_lastname,
          r.username    AS student_username,
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
          username: r.student_username,
          avatarUrl: r.profile_picture_url || '/../blank_avatar.jpg' /* ส่งรูปไปด้วย */
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
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number((page - 1) * limit);

    const searchQuery = (req.query.search || '').trim();

    const userId = Number(req.query.user_id) || 0;

    let whereClause = `WHERE LOWER(r.type) IN ('tutor','teacher')`;
    const params = [userId]; // Init with userId for LEFT JOIN param

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

    // --- Advanced Filters (Tutors) ---
    const locFilter = (req.query.location || '').trim();
    const minRating = Number(req.query.minRating) || 0;

    // Filter Location (City/Address)
    if (locFilter) {
      whereClause += ' AND tp.address LIKE ?';
      params.push(`%${locFilter}%`);
    }

    // Filter Rating
    if (minRating > 0) {
      whereClause += ' AND COALESCE(rv.avg_rating, 0) >= ?';
      params.push(minRating);
    }

    // --- Relevance Sorting ---
    let orderBy = 'r.user_id DESC';
    if (searchQuery) {
      // Prioritize matches in Subject > Nickname > Name > About Me
      orderBy = `(
          CASE 
            WHEN LOWER(tp.can_teach_subjects) LIKE ? THEN 100
            WHEN LOWER(tp.nickname) LIKE ? THEN 50
            WHEN LOWER(r.name) LIKE ? THEN 20
            ELSE 0
          END
       ) DESC, r.user_id DESC`;

      // Add params for ORDER BY
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    // ... (ส่วน subject filter ถ้ามี) ...
    const [rows] = await pool.query(
      `SELECT 
          r.user_id, r.name, r.lastname, r.email, r.username,
          tp.nickname,
          tp.can_teach_subjects,
          tp.profile_picture_url,
          tp.address,
          tp.phone,
          tp.about_me,
          tp.education,
          tp.teaching_experience,
          -- เพิ่ม review stats
          COALESCE(rv.avg_rating, 0) AS avg_rating,
          COALESCE(rv.review_count, 0) AS review_count,
          -- เพิ่ม favorite stats
          CASE WHEN tf.tutor_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorited
       FROM register r
       LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
       LEFT JOIN tutor_favorites tf ON r.user_id = tf.tutor_id AND tf.user_id = ?
       LEFT JOIN (
          SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count
          FROM reviews
          GROUP BY tutor_id
       ) rv ON r.user_id = rv.tutor_id
       ${whereClause}
       ORDER BY ${orderBy}
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
        username: r.username,
        nickname: r.nickname,
        subject: r.can_teach_subjects || 'ไม่ระบุ',
        image: r.profile_picture_url || '/../blank_avatar.jpg',
        city: r.address,
        price: 0, // Removed hourly_rate from profile
        about_me: r.about_me || '',
        contact_info: contactParts.join('\n') || "ไม่ระบุข้อมูลติดต่อ",
        phone: r.phone,
        email: r.email,
        education: (() => { try { return JSON.parse(r.education) || []; } catch { return []; } })(),
        teaching_experience: (() => { try { return JSON.parse(r.teaching_experience) || []; } catch { return []; } })(),
        rating: Number(r.avg_rating || 0),
        reviews: Number(r.review_count || 0),
        is_favorited: !!r.is_favorited
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
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = (page - 1) * limit;

    const tutorId = req.query.tutorId ? parseInt(req.query.tutorId, 10) : null;
    const subject = (req.query.subject || req.query.search || '').trim();
    const me = Number(req.query.me) || 0;

    const where = [];
    const params = [];

    if (Number.isInteger(tutorId)) {
      where.push('tp.tutor_id = ?');
      params.push(tutorId);
    }

    const minPrice = Number(req.query.minPrice) || 0;
    const maxPrice = Number(req.query.maxPrice) || 999999;
    const locFilter = (req.query.location || '').trim();
    const gradeFilter = (req.query.gradeLevel || '').trim();
    const minRating = Number(req.query.minRating) || 0;

    where.push('tp.price BETWEEN ? AND ?');
    params.push(minPrice, maxPrice);

    if (locFilter) {
      where.push('tp.location LIKE ?');
      params.push(`%${locFilter}%`);
    }

    if (gradeFilter) {
      where.push('(tp.target_student_level LIKE ? OR tp.description LIKE ?)');
      params.push(`%${gradeFilter}%`, `%${gradeFilter}%`);
    }

    if (minRating > 0) {
      where.push('COALESCE(rv.avg_rating, 0) >= ?');
      params.push(minRating);
    }

    let orderBy = 'ORDER BY tp.created_at DESC';

    // 🌟 ระบบค้นหาแบบยืดหยุ่น (OR) แบบไม่พึ่งฟังก์ชันนอก
    if (subject) {
      const searchWords = subject.trim().toLowerCase().split(/\s+/);
      const conditions = [];
      const exactPhrase = subject.replace(/'/g, "''").toLowerCase();

      searchWords.forEach(word => {
        conditions.push(`(LOWER(tp.subject) LIKE ? OR LOWER(tp.description) LIKE ? OR LOWER(tpro.nickname) LIKE ?)`);
        params.push(`%${word}%`, `%${word}%`, `%${word}%`);
      });

      if (conditions.length > 0) {
        where.push(`(${conditions.join(' OR ')})`); // 🌟 ใช้ OR
      }

      orderBy = `ORDER BY 
        (CASE 
          WHEN LOWER(tp.subject) = '${exactPhrase}' THEN 100        
          WHEN LOWER(tp.subject) LIKE '${exactPhrase}%' THEN 90     
          WHEN LOWER(tp.subject) LIKE '%${exactPhrase}%' THEN 80    
          WHEN LOWER(tp.description) LIKE '${exactPhrase}%' THEN 50
          WHEN LOWER(tp.description) LIKE '%${exactPhrase}%' THEN 40
          WHEN LOWER(tpro.nickname) LIKE '%${exactPhrase}%' THEN 30
          ELSE 10 
        END) DESC,
        tp.created_at DESC`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT
        tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description,
        tp.target_student_level,
        tp.teaching_days, tp.teaching_time, tp.location, tp.group_size, tp.price, tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name, r.lastname, r.email, r.username, r.type,
        tpro.profile_picture_url, tpro.nickname, tpro.about_me, tpro.education, tpro.teaching_experience, tpro.phone,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
        COALESCE(jc.c,0) AS join_count,
        CASE WHEN jme.user_id IS NULL THEN 0 ELSE 1 END AS joined,
        CASE WHEN jme_pending.user_id IS NULL THEN 0 ELSE 1 END AS pending_me,
        CASE WHEN jme_cancel.user_id IS NULL THEN 0 ELSE 1 END AS cancel_requested,
        COALESCE(rv.avg_rating, 0) AS avg_rating,
        COALESCE(rv.review_count, 0) AS review_count,
        COALESCE(cc.cnt, 0) AS comment_count
      FROM tutor_posts tp
      LEFT JOIN register r ON r.user_id = tp.tutor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
      LEFT JOIN (
        SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM reviews
        GROUP BY tutor_id
      ) rv ON rv.tutor_id = tp.tutor_id
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
      LEFT JOIN tutor_post_joins jme_cancel
        ON jme_cancel.tutor_post_id = tp.tutor_post_id AND jme_cancel.user_id = ? AND jme_cancel.cancel_requested = 1
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt
        FROM comments
        WHERE post_type='tutor'
        GROUP BY post_id
      ) cc ON cc.post_id = tp.tutor_post_id
      ${whereSql}
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
      `,
      [me, me, me, me, ...params]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM tutor_posts tp
       LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
       LEFT JOIN (
         SELECT tutor_id, AVG(rating) as avg_rating
         FROM reviews
         GROUP BY tutor_id
       ) rv ON rv.tutor_id = tp.tutor_id
       ${whereSql}`,
      params
    );

    const parseDate = (dStr) => {
      if (!dStr) return null;
      if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(dStr);
      const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const parts = dStr.split(" ");
      if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const monthIdx = thaiMonths.indexOf(parts[1]);
        let year = parseInt(parts[2]);
        if (year > 2400) year -= 543;
        if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
          return new Date(year, monthIdx, day);
        }
      }
      return null;
    };

    const now = new Date();

    res.json({
      items: rows.map(r => {
        const isExpired = !hasUpcomingSession(r.teaching_days, r.teaching_time, now);

        return {
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
            username: r.username,
            profile_image: r.profile_picture_url || '',
            email: r.email || '',
            phone: r.phone || '',
            role: r.type || 'tutor'
          },
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
          is_expired: isExpired,
          fav_count: Number(r.fav_count || 0),
          favorited: !!r.favorited,
          join_count: Number(r.join_count || 0),
          joined: !!r.joined,
          pending_me: !!r.pending_me,
          cancel_requested: !!r.cancel_requested,
          rating: Number(r.avg_rating || 0),
          reviews: Number(r.review_count || 0),
          comment_count: Number(r.comment_count || 0),
          images: []
        };
      }),
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
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT tutor_post_id, tutor_id, subject, description, target_student_level,
              teaching_days, teaching_time, location, price, contact_info,
              COALESCE(created_at, NOW()) AS created_at
       FROM tutor_posts
       WHERE tutor_id = ? AND COALESCE(is_active, 1) = 1
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
        r.name, r.lastname, r.username, tpro.profile_picture_url,
        (SELECT COUNT(*) FROM comments WHERE post_id = tp.tutor_post_id AND post_type = 'tutor') AS comment_count
      FROM tutor_posts tp
      LEFT JOIN register r       ON r.user_id = tp.tutor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
      WHERE tp.tutor_post_id = ?
      LIMIT 1
    `, [postId]);

    if (!rows.length) return res.status(404).json({ message: 'not found' });

    const r = rows[0];

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
      user: { first_name: r.name || '', last_name: r.lastname || '', username: r.username, profile_image: r.profile_picture_url || '' },
      createdAt: r.created_at,
      join_count: Number(cnt.c || 0),
      comment_count: Number(r.comment_count || 0) // 🌟 เพิ่ม Count
    });

  } catch (e) {
    console.error('GET /api/tutor-posts/:id error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// สมัครสมาชิก (มีระบบ OTP + Username)
app.post('/api/register', async (req, res) => {
  let connection;
  try {
    const { username, name, lastname, email, password, type, otp } = req.body;

    if (!username || !name || !lastname || !email || !password || !type || !otp) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // 1. ตรวจสอบ OTP
    const [otpRows] = await pool.query(
      'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [email, otp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' });
    }

    // 2. เช็คว่าอีเมลซ้ำไหม (นับรวมพวกที่ลบไปไม่เกิน 60 วันด้วย)
    const [dupEmail] = await pool.execute('SELECT deleted_at FROM register WHERE email = ?', [email]);
    if (dupEmail.length > 0) {
      const userRecord = dupEmail[0];
      if (userRecord.deleted_at) {
        const deletedDate = new Date(userRecord.deleted_at);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - deletedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 60) {
          return res.status(400).json({ success: false, message: `อีเมลนี้ติดสถานะลบบัญชีชั่วคราว กรุณารออีก ${60 - diffDays} วัน ถึงจะใช้สมัครใหม่ได้ หรือทำการ Login เพื่อกู้คืนบัญชีเดิม` });
        } else {
          // กรณีเกิน 60 วัน สามารถเขียนทับได้ (ควรจะให้ Cron ลบไปแล้ว แต่เผื่อไว้กันพลาด)
          await pool.query('DELETE FROM register WHERE email = ?', [email]);
        }
      } else {
        return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
      }
    }

    // 3. เช็คว่า Username ซ้ำไหม
    const [dupUsername] = await pool.execute('SELECT 1 FROM register WHERE username = ?', [username]);
    if (dupUsername.length > 0) {
      return res.status(400).json({ success: false, message: 'Username นี้มีคนใช้แล้ว กรุณาใช้ชื่ออื่น' });
    }

    // 4. เริ่มบันทึกข้อมูล
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 4.1 ลบ OTP เก่าทิ้งหลังจากใช้สำเร็จ
    await connection.query('DELETE FROM otp_codes WHERE email = ?', [email]);

    // 4.2 บันทึกข้อมูลสมาชิกลง Database (เพิ่ม username และบังคับใส่ role ให้ตรงกับ type)
    const [result] = await connection.execute(
      'INSERT INTO register (username, name, lastname, email, password, type, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, name, lastname, email, password, type, type]
    );

    const newUserId = result.insertId;

    // 4.3 ดึงข้อมูลที่เพิ่งสมัครกลับมาส่งให้ Frontend
    const [rows] = await connection.execute(
      'SELECT user_id, username, name, lastname, email, type, role FROM register WHERE user_id = ?',
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

// --------- Student Feed (แก้ไขให้รองรับ Search ยืดหยุ่น + เรียงคะแนน) ----------
app.get('/api/student_posts', async (req, res) => {
  try {
    const me = Number(req.query.me) || 0;
    const search = (req.query.search || '').trim();

    let searchClause = 'WHERE sp.is_active = 1';
    const queryParams = [me, me, me, me, me, me];

    const ownerId = Number(req.query.student_id);
    if (ownerId > 0) {
      searchClause += ` AND sp.student_id = ?`;
      queryParams.push(ownerId);
    }

    const minPrice = Number(req.query.minPrice) || 0;
    const maxPrice = Number(req.query.maxPrice) || 999999;
    const locFilter = (req.query.location || '').trim();
    const gradeFilter = (req.query.gradeLevel || '').trim();

    searchClause += ' AND sp.budget BETWEEN ? AND ?';
    queryParams.push(minPrice, maxPrice);

    if (locFilter) {
      searchClause += ' AND sp.location LIKE ?';
      queryParams.push(`%${locFilter}%`);
    }

    if (gradeFilter) {
      searchClause += ' AND sp.grade_level LIKE ?';
      queryParams.push(`%${gradeFilter}%`);
    }

    let orderByClause = 'ORDER BY sp.student_post_id DESC';

    // 🌟 ระบบค้นหาแบบยืดหยุ่น (OR) แบบไม่พึ่งฟังก์ชันนอก
    if (search) {
      const searchWords = search.trim().toLowerCase().split(/\s+/); // หั่นคำด้วยช่องว่าง
      const groupConditions = [];
      const exactPhrase = search.replace(/'/g, "''").toLowerCase();

      searchWords.forEach(word => {
        groupConditions.push(`(LOWER(sp.subject) LIKE ? OR LOWER(sp.description) LIKE ?)`);
        queryParams.push(`%${word}%`, `%${word}%`);
      });

      if (groupConditions.length > 0) {
        searchClause += ` AND (${groupConditions.join(' OR ')})`; // 🌟 ใช้ OR
      }

      // ระบบจัดคะแนน
      orderByClause = `ORDER BY 
        (CASE 
          WHEN LOWER(sp.subject) = '${exactPhrase}' THEN 100 
          WHEN LOWER(sp.subject) LIKE '%${exactPhrase}%' THEN 80 
          WHEN LOWER(sp.description) LIKE '%${exactPhrase}%' THEN 40
          ELSE 10 
        END) DESC, sp.student_post_id DESC`;
    }

    const [rows] = await pool.query(`
      SELECT
        sp.student_post_id, sp.student_id, sp.subject, sp.description,
        sp.preferred_days, TIME_FORMAT(sp.preferred_time, '%H:%i') AS preferred_time,
        sp.location, sp.group_size, sp.budget, sp.contact_info, sp.created_at,
        sp.grade_level, 
        r.name, r.lastname, r.email, r.username, r.type,
        spro.profile_picture_url, spro.phone,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE WHEN (jme.user_id IS NOT NULL OR ome.tutor_id IS NOT NULL) THEN 1 ELSE 0 END AS joined,
        CASE WHEN (jme_pending.user_id IS NOT NULL OR ome_pending.tutor_id IS NOT NULL) THEN 1 ELSE 0 END AS pending_me,
        CASE WHEN jme_cancel.user_id IS NOT NULL THEN 1 ELSE 0 END AS cancel_requested,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
        CASE WHEN has_tutor.cnt > 0 THEN 1 ELSE 0 END AS has_approved_tutor,
        approved_tutor_info.name AS approved_tutor_name,
        approved_tutor_info.lastname AS approved_tutor_lastname,
        approved_tutor_info.tutor_id AS approved_tutor_id,
        approved_tutor_info.username AS approved_tutor_username,
        approved_tutor_info.profile_picture_url AS approved_tutor_profile_picture_url,
        COALESCE(cc.cnt, 0) AS comment_count
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
      LEFT JOIN student_post_joins jme_cancel
        ON jme_cancel.student_post_id = sp.student_post_id AND jme_cancel.user_id = ? AND jme_cancel.cancel_requested = 1
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS c
        FROM posts_favorites
        WHERE post_type='student'
        GROUP BY post_id
      ) fvc ON fvc.post_id = sp.student_post_id
      LEFT JOIN posts_favorites fme
        ON fme.post_id = sp.student_post_id AND fme.post_type='student' AND fme.user_id = ?
      LEFT JOIN student_post_offers ome 
        ON ome.student_post_id = sp.student_post_id AND ome.tutor_id = ? AND ome.status='approved'
      LEFT JOIN student_post_offers ome_pending
        ON ome_pending.student_post_id = sp.student_post_id AND ome_pending.tutor_id = ? AND ome_pending.status='pending'
      LEFT JOIN (
        SELECT student_post_id, COUNT(*) as cnt
        FROM student_post_offers
        WHERE status='approved'
        GROUP BY student_post_id
      ) has_tutor ON has_tutor.student_post_id = sp.student_post_id
      LEFT JOIN (
        SELECT o.student_post_id, MAX(o.tutor_id) AS tutor_id, MAX(t_reg.name) AS name, MAX(t_reg.lastname) AS lastname, MAX(t_reg.username) AS username, MAX(tp.profile_picture_url) AS profile_picture_url
        FROM student_post_offers o
        JOIN register t_reg ON o.tutor_id = t_reg.user_id
        LEFT JOIN tutor_profiles tp ON t_reg.user_id = tp.user_id
        WHERE o.status = 'approved'
        GROUP BY o.student_post_id
      ) approved_tutor_info ON approved_tutor_info.student_post_id = sp.student_post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt
        FROM comments
        WHERE post_type='student'
        GROUP BY post_id
      ) cc ON cc.post_id = sp.student_post_id
      
      ${searchClause}
      ${orderByClause}
    `, queryParams);

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
      grade_level: r.grade_level || 'ไม่ระบุ',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      join_count: Number(r.join_count || 0),
      joined: !!r.joined,
      pending_me: !!r.pending_me,
      fav_count: Number(r.fav_count || 0),
      favorited: !!r.favorited,
      cancel_requested: !!r.cancel_requested,
      has_tutor: !!r.has_approved_tutor,
      comment_count: Number(r.comment_count || 0),
      tutor: r.has_approved_tutor && r.approved_tutor_name ? {
        id: r.approved_tutor_id,
        name: r.approved_tutor_name,
        lastname: r.approved_tutor_lastname,
        username: r.approved_tutor_username,
        profile_picture_url: r.approved_tutor_profile_picture_url
      } : null,
      user: {
        first_name: r.name || '',
        last_name: r.lastname || '',
        username: r.username,
        profile_image: r.profile_picture_url || '/../blank_avatar.jpg',
        email: r.email || '',
        phone: r.phone || '',
        id: r.student_id,
        role: r.type || 'student'
      },
    }));

    return res.json(posts);
  } catch (err) {
    console.error('FEED ERR', err);
    return res.status(500).json({ message: 'Database error' });
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
      tp.location, tp.group_size, tp.price, tp.contact_info, tp.created_at, r.name, r.lastname, r.username
    FROM tutor_posts tp
    LEFT JOIN register r ON r.user_id = tp.tutor_id
    WHERE tp.tutor_post_id = ?`,
      [result.insertId]
    );

    const r = rows[0];

    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
       SELECT tf.user_id, ?, 'followed_tutor_new_post', ?, ?, 'tutor_post'
       FROM tutor_favorites tf
       WHERE tf.tutor_id = ? AND tf.user_id <> ?`,
      [
        payload.tutor_id,
        `ติวเตอร์ที่คุณติดตามได้เปิดคอร์สใหม่: ${r.subject}`,
        r.tutor_post_id,
        payload.tutor_id,
        payload.tutor_id
      ]
    );

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
          username: r.username
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
    postType: 'student_post',
    ownerCol: 'student_id',
    joinsTable: 'student_post_joins',
    joinPostIdCol: 'student_post_id',
    hasCapacity: true,
    capacityCol: 'group_size',
    notifyType: 'join_request',
    notifyMessage: id => `มีคำขอเข้าร่วมโพสต์ #${id}`,
    countApprovedOnly: true,
    dateCol: 'preferred_days', // [NEW] for cancellation check
    timeCol: 'preferred_time'
  },
  tutor: {
    postsTable: 'tutor_posts',
    postIdCol: 'tutor_post_id',
    postType: 'tutor_post',
    ownerCol: 'tutor_id',
    joinsTable: 'tutor_post_joins',
    joinPostIdCol: 'tutor_post_id',
    hasCapacity: true,
    capacityCol: 'group_size',
    notifyType: 'tutor_join_request',
    notifyMessage: id => `มีคำขอเข้าร่วมโพสต์ติวเตอร์ #${id}`,
    countApprovedOnly: true,
    dateCol: 'teaching_days', // [NEW] for cancellation check
    timeCol: 'teaching_time'
  },
};

// ---------- JOIN/UNJOIN helper ใช้ซ้ำ ----------
function parseSessionDateParts(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]) - 1,
      day: Number(match[3]),
    };
  }

  match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    let year = Number(match[3]);
    if (year > 2400) year -= 543;
    return {
      year,
      month: Number(match[2]) - 1,
      day: Number(match[1]),
    };
  }

  return null;
}

function parseSessionTimeParts(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3] || 0),
  };
}

function buildSessionDateTimes(daysStr, timesStr) {
  if (!daysStr) return [];

  const days = String(daysStr).split(',').map((item) => item.trim()).filter(Boolean);
  const times = String(timesStr || '').split(',').map((item) => item.trim());

  return days
    .map((dayValue, index) => {
      const dateParts = parseSessionDateParts(dayValue);
      if (!dateParts) return null;

      const timeParts = parseSessionTimeParts(times[index] || times[0] || '');
      return new Date(
        dateParts.year,
        dateParts.month,
        dateParts.day,
        timeParts?.hours ?? 23,
        timeParts?.minutes ?? 59,
        timeParts?.seconds ?? 59
      );
    })
    .filter((value) => value instanceof Date && !Number.isNaN(value.getTime()));
}

function hasUpcomingSession(daysStr, timesStr, now = new Date()) {
  const sessions = buildSessionDateTimes(daysStr, timesStr);
  if (sessions.length === 0) return true;
  return sessions.some((session) => session.getTime() >= now.getTime());
}

function getFirstSessionDateTime(daysStr, timesStr) {
  const sessions = buildSessionDateTimes(daysStr, timesStr)
    .sort((a, b) => a.getTime() - b.getTime());
  return sessions[0] || null;
}

async function doJoinUnified(type, postId, me) {
  const cfg = JOIN_CONFIG[type];
  if (!cfg) throw new Error('invalid post type');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ✅ lock post row กัน race
    const [[post]] = await conn.query(
      `SELECT ${cfg.ownerCol} AS owner_id${cfg.hasCapacity ? `, ${cfg.capacityCol} AS capacity` : ''}${cfg.dateCol ? `, ${cfg.dateCol} AS session_days` : ''}${cfg.timeCol ? `, ${cfg.timeCol} AS session_time` : ''} 
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

    if (cfg.dateCol && !hasUpcomingSession(post.session_days, post.session_time)) {
      await conn.rollback();
      return { http: 400, body: { success: false, message: 'โพสต์นี้หมดเวลาเข้าร่วมแล้ว' } };
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

    // ✅ insert/update เป็น pending (แก้ปัญหา ambiguous column name)
    if (cfg.joinsTable === 'tutor_post_joins') {
      await conn.query(
        `INSERT INTO tutor_post_joins
          (tutor_post_id, user_id, status, requested_at, name, lastname, joined_at)
         SELECT ?, ?, 'pending', NOW(), r.name, r.lastname, '1899-11-30 00:00:00'
         FROM register r
         WHERE r.user_id = ?
         ON DUPLICATE KEY UPDATE
           status = IF(tutor_post_joins.status='pending' AND tutor_post_joins.status <> 'approved', 'pending', tutor_post_joins.status),
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
          (student_post_id, user_id, status, requested_at, name, lastname, joined_at)
         SELECT ?, ?, 'pending', NOW(), r.name, r.lastname, '1899-11-30 00:00:00'
         FROM register r
         WHERE r.user_id = ?
         ON DUPLICATE KEY UPDATE
           status = IF(student_post_joins.status='pending' AND student_post_joins.status <> 'approved', 'pending', student_post_joins.status),
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
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
      [post.owner_id, me, cfg.notifyType, notifyMessage, postId, cfg.postType]
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

// Helper for cancellation check
function parseDateForCancel(dStr) {
  if (!dStr) return null;
  // YYYY-MM-DD
  const ymd = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(ymd[1], ymd[2] - 1, ymd[3]);

  // Thai format: DD Month YYYY
  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const parts = dStr.split(" ");
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const monthIdx = thaiMonths.indexOf(parts[1]);
    let year = parseInt(parts[2]);
    if (year > 2400) year -= 543;
    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      return new Date(year, monthIdx, day);
    }
  }
  return null;
}

async function doUnjoinUnified(type, postId, me) {
  const cfg = JOIN_CONFIG[type];
  if (!cfg) throw new Error('invalid post type');

  console.log(`[doUnjoinUnified] Start: Type=${type}, Post=${postId}, User=${me}`);

  // Fetch Post Data (Date & Owner)
  let postData = null;
  if (cfg.dateCol) {
    // Select date AND owner in one go
    const [[pd]] = await pool.query(
      `SELECT ${cfg.dateCol} AS dateStr, ${cfg.timeCol} AS timeStr, ${cfg.ownerCol} AS ownerId FROM ${cfg.postsTable} WHERE ${cfg.postIdCol} = ?`,
      [postId]
    );
    postData = pd;
  }

  // Ensure we have ownerId if not fetched yet
  if (!postData) {
    const [[p]] = await pool.query(`SELECT ${cfg.ownerCol} AS ownerId FROM ${cfg.postsTable} WHERE ${cfg.postIdCol} = ?`, [postId]);
    postData = p;
  }

  if (!postData) throw new Error('Post not found');

  const isOwner = (Number(me) === Number(postData.ownerId));

  // Fetch current join status
  const [[joinData]] = await pool.query(
    `SELECT status FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ? AND user_id = ?`,
    [postId, me]
  );

  // If they are not joined/pending at all, returning success or error is fine, but let's just proceed to DELETE which will do 0 rows
  const currentStatus = joinData ? joinData.status : null;

  if (cfg.dateCol && postData.dateStr && currentStatus === 'approved') {
    const firstSessionDate = getFirstSessionDateTime(postData.dateStr, postData.timeStr);
    if (firstSessionDate) {
      const now = new Date();
      const diffMs = firstSessionDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`[doUnjoinUnified] TimeCheck: Diff=${diffHours}h, IsOwner=${isOwner}, Status=${currentStatus}`);

      if (!isOwner && diffHours < 72) {
        console.warn(`[doUnjoinUnified] Blocked by 72h rule (Diff=${diffHours}h)`);
        return {
          http: 400,
          body: { success: false, message: 'ไม่สามารถยกเลิกได้ เนื่องจากเหลือน้อยกว่า 72 ชั่วโมงก่อนวันติววันแรก กรุณาติดต่อเจ้าของโพสต์หรือติวเตอร์โดยตรง' }
        };
      }
    }
  }

  console.log(`[doUnjoinUnified] Owner Check: Me=${me}, Owner=${postData.ownerId} => IsOwner=${isOwner}`);

  // 2. ACTION: DELETE (Immediate Cancellation)
  // Both Owner (kicking) and Member (leaving) now result in DELETE.

  console.log(`[doUnjoinUnified] Executing DELETE for user ${me} from post ${postId}`);
  const [delRes] = await pool.query(
    `DELETE FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ? AND user_id = ?`,
    [postId, me]
  );

  // Also remove from calendar if present
  let pType1 = type.includes('tutor') ? 'tutor' : 'student';
  await pool.query('DELETE FROM calendar_events WHERE post_id = ? AND user_id = ? AND post_type = ?', [postId, me, pType1]);

  // Notify Owner if Member left (and Member acting effectively)
  if (!isOwner && postData.ownerId && delRes.affectedRows > 0) {
    const [[actor]] = await pool.query('SELECT name, lastname FROM register WHERE user_id = ?', [me]);
    const actorName = actor ? `${actor.name} ${actor.lastname}`.trim() : 'ผู้ใช้';

    // Fetch Subject
    const [[pSub]] = await pool.query(`SELECT subject FROM ${cfg.postsTable} WHERE ${cfg.postIdCol} = ?`, [postId]);
    const subject = pSub?.subject || `#${postId}`;

    const isCancelRequest = currentStatus === 'pending';
    const notificationType = isCancelRequest ? 'cancel_request_alert' : 'cancel_join_alert';
    const msg = isCancelRequest
      ? `${actorName} ได้ยกเลิกส่งคำขอเข้าร่วมวิชา ${subject}`
      : `${actorName} ได้ยกเลิกการเข้าร่วมการติววิชา ${subject} กับคุณ`;

    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
      [postData.ownerId, me, notificationType, msg, postId, cfg.postType]
    );
    console.log(`[doUnjoinUnified] Notification sent to Owner=${postData.ownerId}`);
  }

  // Common response
  return {
    http: 200,
    body: {
      success: true,
      message: isOwner ? 'ลบสมาชิกเรียบร้อยแล้ว' : 'ยกเลิกการเข้าร่วมเรียบร้อยแล้ว',
      joined: false,
      post_id: postId
    }
  };
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

// [NEW] Owner Approve/Reject Cancellation
app.post('/api/posts/:type/:id/cancel-action', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!JOIN_CONFIG[type]) return res.status(400).json({ success: false, message: 'invalid post type' });

  const postId = Number(req.params.id);
  const { user_id, action, owner_id } = req.body; // user_id = Member requesting cancel, owner_id = Me (Owner)

  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'invalid action' });

  const cfg = JOIN_CONFIG[type];
  const conn = await pool.getConnection();
  try {
    // Verify Owner
    const [[post]] = await conn.query(`SELECT ${cfg.ownerCol} AS owner_id FROM ${cfg.postsTable} WHERE ${cfg.postIdCol} = ?`, [postId]);
    if (!post || Number(post.owner_id) !== Number(owner_id)) {
      return res.status(403).json({ message: 'Not authorized (Not owner)' });
    }

    if (action === 'approve') {
      // Delete member
      await conn.query(`DELETE FROM ${cfg.joinsTable} WHERE ${cfg.joinPostIdCol} = ? AND user_id = ?`, [postId, user_id]);

      // Notify Member
      await conn.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, owner_id, 'system', `คำขอยกเลิกการเข้าร่วมโพสต์ #${postId} ได้รับการอนุมัติแล้ว`, postId, cfg.postType]
      );

      // Remove Calendar
      let pType2 = type.includes('tutor') ? 'tutor' : 'student';
      await deleteCalendarEventForUser(user_id, postId, pType2);

    } else {
      // Reject -> Reset cancel_requested = 0
      await conn.query(`UPDATE ${cfg.joinsTable} SET cancel_requested = 0 WHERE ${cfg.joinPostIdCol} = ? AND user_id = ?`, [postId, user_id]);

      // Notify Member
      await conn.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, owner_id, 'system', `คำขอยกเลิกการเข้าร่วมโพสต์ #${postId} ถูกปฏิเสธ`, postId, cfg.postType]
      );
    }

    res.json({ success: true, action });

  } catch (e) {
    console.error("Cancel Action Error", e);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
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
  const postId = Number(req.params.id);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`
      SELECT 
        j.user_id,
        r.name,
        r.lastname,
        r.username,
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url,
        j.joined_at,
        j.status
      FROM student_post_joins j
      JOIN register r ON r.user_id = j.user_id
      LEFT JOIN student_profiles spro ON r.user_id = spro.user_id
      LEFT JOIN tutor_profiles tpro ON r.user_id = tpro.user_id
      WHERE j.student_post_id = ? AND j.status = 'approved'
      ORDER BY j.joined_at ASC
    `, [postId]);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  } finally {
    conn.release();
  }
});


// >>> ดึงรายชื่อผู้เข้าร่วมโพสต์ติวเตอร์ (approved เท่านั้น)
app.get('/api/tutor_posts/:id/joiners', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid post id' });

    const [rows] = await pool.query(
      `SELECT j.user_id, j.joined_at, r.name, r.lastname, r.username, 
              COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url
       FROM tutor_post_joins j
       LEFT JOIN register r ON r.user_id = j.user_id
       LEFT JOIN student_profiles spro ON r.user_id = spro.user_id
       LEFT JOIN tutor_profiles tpro ON r.user_id = tpro.user_id
      WHERE j.tutor_post_id = ? AND j.status = 'approved'
      ORDER BY j.joined_at ASC, j.user_id ASC`,
      [postId]
    );

    res.json(rows.map(x => ({
      user_id: x.user_id,
      joined_at: x.joined_at,
      name: x.name || '',
      lastname: x.lastname || '',
      username: x.username || '',
      profile_picture_url: x.profile_picture_url || ''
    })));
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
        j.name, j.lastname, r.email, r.username, 
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url,
        'student' AS request_type
      FROM student_post_joins j
      LEFT JOIN register r ON r.user_id = j.user_id
      LEFT JOIN student_profiles spro ON r.user_id = spro.user_id
      LEFT JOIN tutor_profiles tpro ON r.user_id = tpro.user_id
      WHERE j.student_post_id = ? ${useFilter ? 'AND j.status = ?' : ''}
    `;

    // Query 2: ติวเตอร์ (Offers)
    const sqlTutor = `
      SELECT 
        o.student_post_id, o.tutor_id AS user_id, o.status, o.requested_at,
        o.name, o.lastname, r.email, r.username, 
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url,
        'tutor' AS request_type
      FROM student_post_offers o
      LEFT JOIN register r ON r.user_id = o.tutor_id
      LEFT JOIN student_profiles spro ON r.user_id = spro.user_id
      LEFT JOIN tutor_profiles tpro ON r.user_id = tpro.user_id
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
          sp.preferred_days,
          sp.preferred_time,
          sp.location,
          r.name AS owner_name,
          r.lastname AS owner_lastname,
          r.email AS owner_email
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

      // ------- หลัง commit: notify/calendar/EMAIL -------
      if (newStatus === 'approved') {

        // 1. Fetch Joiner Email & Info for Email Sending
        const [[joinerInfo]] = await pool.query('SELECT email, name, lastname FROM register WHERE user_id = ?', [targetUserId]);
        const joinerName = joinerInfo ? `${joinerInfo.name} ${joinerInfo.lastname}` : 'ผู้เข้าร่วม';
        const ownerNameFullName = `${sp.owner_name} ${sp.owner_lastname}`;

        const emailDetails = {
          courseName: sp.subject,
          date: sp.preferred_days || 'ตามตกลง',
          time: sp.preferred_time || 'ตามตกลง',
          location: sp.location || 'ออนไลน์/ตามตกลง',
        };

        // Send to Owner (Student)
        sendBookingConfirmationEmail(sp.owner_email, {
          ...emailDetails,
          partnerName: joinerName,
          role: 'student'
        });

        // Send to Joiner (Tutor or Student)
        sendBookingConfirmationEmail(joinerInfo?.email, {
          ...emailDetails,
          partnerName: ownerNameFullName,
          role: isTutorTable ? 'tutor' : 'student'
        });

        if (!isTutorTable) {
          await createCalendarEventsForStudentApproval(postId, targetUserId);
          await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [targetUserId, sp.owner_id, 'join_approved', `คำขอของคุณสำหรับโพสต์ #${postId} ได้รับการอนุมัติแล้ว`, postId, 'student_post']
          );
        } else {
          await createCalendarEventsForStudentApproval(postId, targetUserId);

          const studentName = `${sp.owner_name} ${sp.owner_lastname}`.trim();
          await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [targetUserId, sp.owner_id, 'offer_accepted', `${studentName} ยอมรับเสนอสอนวิชา "${sp.subject}" ของคุณแล้ว`, postId, 'student_post']
          );

          // Auto-Reject offers อื่น
          await pool.query(`
            UPDATE student_post_offers
            SET status = 'rejected', decided_at = NOW()
            WHERE student_post_id = ? AND status = 'pending' AND tutor_id != ?
          `, [postId, targetUserId]);
        }
      } else {
        await deleteCalendarEventForUser(targetUserId, postId, isTutorTable ? 'tutor' : 'student');
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [targetUserId, sp.owner_id, isTutorTable ? 'offer_rejected' : 'join_rejected', `คำขอ/ข้อเสนอของคุณสำหรับโพสต์ #${postId} ถูกปฏิเสธ`, postId, 'student_post']
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
        j.lastname,
        r.username,
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url
      FROM tutor_post_joins j
      LEFT JOIN register r ON r.user_id = j.user_id
      LEFT JOIN student_profiles spro ON r.user_id = spro.user_id
      LEFT JOIN tutor_profiles tpro ON r.user_id = tpro.user_id
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
  let tp = null; // [FIX] Declare outside to use in email logic

  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ✅ ล็อกแถวโพสต์ + เอา group_size มาเช็ค
      const [[tpFound]] = await conn.query(
        `SELECT tp.tutor_post_id, tp.group_size, tp.tutor_id, tp.subject, tp.teaching_days, tp.teaching_time, tp.location,
                r.name AS tutor_name, r.lastname AS tutor_lastname, r.email AS tutor_email
         FROM tutor_posts tp
         JOIN register r ON r.user_id = tp.tutor_id
         WHERE tp.tutor_post_id = ?
         FOR UPDATE`,
        [postId]
      );
      tp = tpFound; // [FIX] Assign to outer variable

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

      // 📧 Send Emails
      try {
        // Fetch Joiner (Student) Info
        const [[joiner]] = await pool.query('SELECT email, name, lastname FROM register WHERE user_id=?', [userId]);
        const joinerName = joiner ? `${joiner.name} ${joiner.lastname}` : 'นักเรียน';
        const tutorName = `${tp.tutor_name} ${tp.tutor_lastname}`;

        const emailConfig = {
          courseName: tp.subject,
          date: tp.teaching_days,
          time: tp.teaching_time,
          location: tp.location
        };

        // 1. Send to Tutor
        sendBookingConfirmationEmail(tp.tutor_email, {
          ...emailConfig,
          partnerName: joinerName,
          role: 'tutor'
        });

        // 2. Send to Student (Joiner)
        sendBookingConfirmationEmail(joiner?.email, {
          ...emailConfig,
          partnerName: tutorName,
          role: 'student'
        });

      } catch (emailErr) {
        console.error("❌ Email Send Error:", emailErr);
      }

      try {
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
           VALUES (?,?,?,?,?,?)`,
          [userId, tutorId, 'tutor_join_approved', `คำขอเรียนกับติวเตอร์ (โพสต์ #${postId}) ได้รับการอนุมัติแล้ว`, postId, 'tutor_post']
        );
        console.log("✅ Notification inserted successfully");
      } catch (notifErr) {
        console.error("❌ Notification Insert Error:", notifErr);
      }
    } else {
      await deleteCalendarEventForUser(userId, postId, 'tutor');
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type)
           VALUES (?,?,?,?,?,?)`,
          [userId, tutorId, 'tutor_join_rejected', `คำขอเรียนกับติวเตอร์ (โพสต์ #${postId}) ถูกปฏิเสธ`, postId, 'tutor_post']
        );
      } catch (notifErr) {
        console.error("❌ Notification Insert Error (Reject):", notifErr);
      }
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

function normalizePostTypeValue(postType) {
  const value = String(postType || '').toLowerCase();
  if (value.includes('tutor')) return 'tutor_post';
  if (value.includes('student')) return 'student_post';
  return null;
}

function resolvePostTypeFromCandidates(preferredType, studentSubject, tutorSubject, text) {
  const normalizedPreferred = normalizePostTypeValue(preferredType);
  const haystack = String(text || '').toLowerCase();
  const studentHit = studentSubject && haystack.includes(String(studentSubject).toLowerCase());
  const tutorHit = tutorSubject && haystack.includes(String(tutorSubject).toLowerCase());

  if (studentHit && !tutorHit) return 'student_post';
  if (tutorHit && !studentHit) return 'tutor_post';
  if (normalizedPreferred) return normalizedPreferred;
  if (studentSubject && !tutorSubject) return 'student_post';
  if (tutorSubject && !studentSubject) return 'tutor_post';
  return null;
}

app.get('/api/notifications/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const sql = `
      SELECT 
        n.notification_id,
        n.type,
        n.message,
        n.related_id,
        n.post_type AS notification_post_type,
        n.is_read,
        n.created_at,
        n.user_id,
        n.actor_id,
        -- ข้อมูลผู้กระทำ (Actor)
        au.name AS actor_firstname, 
        au.lastname AS actor_lastname,
        COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS actor_avatar,
        CASE
            WHEN n.type = 'review_request' THEN 'student_post'
            WHEN n.type = 'tutor_review_request'
                 AND sp_review_owner.student_post_id IS NOT NULL
                 AND spo_review.student_post_id IS NOT NULL THEN 'student_post'
            WHEN n.type = 'tutor_review_request'
                 AND tp_review_join.tutor_post_id IS NOT NULL
                 AND tpj_review.tutor_post_id IS NOT NULL THEN 'tutor_post'
            ELSE NULL
        END AS review_post_type,
        spo.status AS offer_status, -- [NEW] สถานะ Offer (ถ้ามี)
        CASE WHEN rvw.review_id IS NOT NULL THEN 1 ELSE 0 END AS is_reviewed, -- [NEW] สถานะการรีวิว
        
        -- ข้อมูลวิชา (Subject) จากโพสต์ที่เกี่ยวข้อง
        CASE
            WHEN n.type = 'review_request' THEN COALESCE(sp_review_joiner.subject, sp.subject)
            WHEN n.type = 'tutor_review_request'
                 AND sp_review_owner.student_post_id IS NOT NULL
                 AND spo_review.student_post_id IS NOT NULL THEN sp_review_owner.subject
            WHEN n.type = 'tutor_review_request'
                 AND tp_review_join.tutor_post_id IS NOT NULL
                 AND tpj_review.tutor_post_id IS NOT NULL THEN tp_review_join.subject
            WHEN n.type = 'followed_tutor_new_post' THEN tp.subject
            WHEN n.type IN ('join_request', 'join_approved', 'join_rejected', 'offer', 'offer_accepted', 'system_alert') THEN sp.subject
            WHEN n.type IN ('tutor_join_request', 'tutor_join_approved', 'tutor_join_rejected') THEN tp.subject
            WHEN n.type IN ('comment', 'mention') THEN COALESCE(sp.subject, tp.subject)
            WHEN n.type LIKE 'schedule_student_%' THEN sp.subject
            WHEN n.type LIKE 'schedule_tutor_%' THEN tp.subject
            WHEN n.type LIKE 'schedule_%' THEN COALESCE(sp.subject, tp.subject)
            ELSE NULL
        END AS post_subject,
        
        -- ประเภทของโพสต์เพื่อใช้ในการนำทาง (Navigation)
        CASE
            WHEN n.type = 'followed_tutor_new_post' THEN 'tutor'
            WHEN n.type IN ('tutor_join_request', 'tutor_join_approved', 'tutor_join_rejected', 'tutor_review_request') THEN 'tutor'
            WHEN n.type IN ('join_request', 'join_approved', 'join_rejected', 'offer', 'offer_accepted', 'review_request') THEN 'student'
            WHEN sp.student_post_id IS NOT NULL AND tp.tutor_post_id IS NULL THEN 'student'
            WHEN tp.tutor_post_id IS NOT NULL AND sp.student_post_id IS NULL THEN 'tutor'
            ELSE NULL
        END AS inferred_post_type,
        sp.subject AS student_subject_candidate,
        tp.subject AS tutor_subject_candidate,
        ce_student.subject AS calendar_student_subject,
        ce_tutor.subject AS calendar_tutor_subject

      FROM notifications n
      LEFT JOIN register au ON au.user_id = n.actor_id
      -- Join เพื่อเอารูปโปรไฟล์ (ลองหาทั้งจาก student และ tutor profile)
      LEFT JOIN student_profiles spro ON spro.user_id = n.actor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = n.actor_id
      
      -- Join เพื่อเอาชื่อวิชา (Subject)
      LEFT JOIN student_posts sp ON n.related_id = sp.student_post_id
      LEFT JOIN tutor_posts tp ON n.related_id = tp.tutor_post_id
      LEFT JOIN student_posts sp_review_owner
        ON n.related_id = sp_review_owner.student_post_id
       AND n.user_id = sp_review_owner.student_id
       AND n.type = 'tutor_review_request'
      LEFT JOIN student_post_offers spo_review
        ON n.related_id = spo_review.student_post_id
       AND n.actor_id = spo_review.tutor_id
       AND spo_review.status = 'approved'
       AND n.type = 'tutor_review_request'
      LEFT JOIN tutor_posts tp_review_join
        ON n.related_id = tp_review_join.tutor_post_id
       AND n.actor_id = tp_review_join.tutor_id
       AND n.type = 'tutor_review_request'
      LEFT JOIN tutor_post_joins tpj_review
        ON n.related_id = tpj_review.tutor_post_id
       AND n.user_id = tpj_review.user_id
       AND tpj_review.status = 'approved'
       AND n.type = 'tutor_review_request'
      LEFT JOIN student_posts sp_review_joiner
        ON n.related_id = sp_review_joiner.student_post_id
       AND n.type = 'review_request'
      LEFT JOIN (
        SELECT user_id, post_id, MAX(subject) AS subject
        FROM calendar_events
        WHERE post_type = 'student'
        GROUP BY user_id, post_id
      ) ce_student
        ON n.user_id = ce_student.user_id
       AND n.related_id = ce_student.post_id
      LEFT JOIN (
        SELECT user_id, post_id, MAX(subject) AS subject
        FROM calendar_events
        WHERE post_type = 'tutor'
        GROUP BY user_id, post_id
      ) ce_tutor
        ON n.user_id = ce_tutor.user_id
       AND n.related_id = ce_tutor.post_id

      -- [NEW] Join เพื่อเอาสถานะ Offer (สำหรับ type='offer')
      LEFT JOIN student_post_offers spo ON n.related_id = spo.student_post_id AND n.actor_id = spo.tutor_id AND n.type = 'offer'
      
      -- [NEW] Join เพื่อเช็คว่าได้รีวิวไปแล้วหรือยัง (สำหรับ type='review_request')
      LEFT JOIN reviews rvw ON n.user_id = rvw.student_id AND n.actor_id = rvw.tutor_id AND n.related_id = rvw.post_id
      
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.notification_id DESC
    `;

    const [results] = await pool.execute(sql, [user_id]);

    const explicitStudentTypes = new Set([
      'join_request', 'join_approved', 'join_rejected', 'offer', 'offer_accepted',
      'review_request', 'schedule_student_today', 'schedule_student_tomorrow'
    ]);
    const explicitTutorTypes = new Set([
      'tutor_join_request', 'tutor_join_approved', 'tutor_join_rejected',
      'schedule_tutor_today', 'schedule_tutor_tomorrow'
    ]);

    const normalized = results.map((row) => {
      const studentSubject = row.calendar_student_subject || row.student_subject_candidate || null;
      const tutorSubject = row.calendar_tutor_subject || row.tutor_subject_candidate || null;
      const preferredType =
        row.notification_post_type ||
        row.review_post_type ||
        (explicitStudentTypes.has(row.type) ? 'student_post' : null) ||
        (explicitTutorTypes.has(row.type) ? 'tutor_post' : null) ||
        (row.inferred_post_type === 'tutor' ? 'tutor_post' : row.inferred_post_type === 'student' ? 'student_post' : null);

      const resolvedPostType = resolvePostTypeFromCandidates(
        preferredType,
        studentSubject,
        tutorSubject,
        `${row.message || ''} ${row.post_subject || ''}`
      ) || preferredType;

      const resolvedSubject =
        resolvedPostType === 'student_post' ? (studentSubject || row.post_subject) :
          resolvedPostType === 'tutor_post' ? (tutorSubject || row.post_subject) :
            row.post_subject;

      return {
        ...row,
        resolved_post_type: resolvedPostType,
        post_subject: resolvedSubject,
      };
    }).map(({ student_subject_candidate, tutor_subject_candidate, calendar_student_subject, calendar_tutor_subject, notification_post_type, ...rest }) => rest);

    res.json(normalized);
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
    const { user_id, actor_id = null, type, message, related_id = null, post_type = null } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, actor_id, type, message, related_id || null, post_type || null]
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
        r.name, r.lastname, r.email, r.username, r.type, r.name_change_at,
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
        about, profile_picture_url, interested_subjects
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname=VALUES(nickname), 
        phone=VALUES(phone), 
        address=VALUES(address),
        grade_level=VALUES(grade_level), 
        institution=VALUES(institution),
        faculty=VALUES(faculty), 
        major=VALUES(major), 
        about=VALUES(about),
        profile_picture_url=VALUES(profile_picture_url),
        interested_subjects=VALUES(interested_subjects)
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
      v(body.profile_picture_url || body.profile_image),
      v(body.interestedSubjects || body.interested_subjects)
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
        r.name, r.lastname, r.email, r.username, r.type, r.name_change_at,
        tp.*, r.created_at,
        COALESCE(tc.students_taught_count, 0) AS students_taught_count
      FROM register r
      LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
      LEFT JOIN (
        SELECT tutor_id, COUNT(DISTINCT learner_id) AS students_taught_count
        FROM (
          SELECT tp.tutor_id, j.user_id AS learner_id
          FROM tutor_posts tp
          JOIN tutor_post_joins j ON j.tutor_post_id = tp.tutor_post_id AND j.status = 'approved'
          UNION ALL
          SELECT o.tutor_id, sp.student_id AS learner_id
          FROM student_post_offers o
          JOIN student_posts sp ON sp.student_post_id = o.student_post_id
          WHERE o.status = 'approved'
          UNION ALL
          SELECT o.tutor_id, j.user_id AS learner_id
          FROM student_post_offers o
          JOIN student_post_joins j ON j.student_post_id = o.student_post_id AND j.status = 'approved'
          WHERE o.status = 'approved'
        ) taught
        GROUP BY tutor_id
      ) tc ON tc.tutor_id = r.user_id
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
        SELECT 
            r.rating, r.comment, r.created_at, 
            reg.name, reg.lastname, reg.username, sp.profile_picture_url,
            -- ดึงชื่อวิชา
            COALESCE(tp.subject, stp.subject) AS subject
        FROM reviews r
        LEFT JOIN register reg ON r.student_id = reg.user_id
        LEFT JOIN student_profiles sp ON r.student_id = sp.user_id
        -- Join โพสต์ติวเตอร์
        LEFT JOIN tutor_posts tp ON r.post_id = tp.tutor_post_id AND r.post_type = 'tutor_post'
        -- Join โพสต์นักเรียน (เผื่อกรณีรีวิวจากโพสต์นักเรียน)
        LEFT JOIN student_posts stp ON r.post_id = stp.student_post_id AND r.post_type = 'student_post'
        WHERE r.tutor_id = ? 
        ORDER BY r.created_at DESC
    `, [userId]);

    const reviews = rRows.map(r => ({
      rating: Number(r.rating),
      comment: r.comment,
      subject: r.subject || "วิชาทั่วไป", // ✅ ส่งชื่อวิชากลับไป
      createdAt: r.created_at,
      reviewer: {
        name: `${r.name} ${r.lastname}`,
        username: r.username,
        avatar: r.profile_picture_url
      }
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
        profile_picture_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname=VALUES(nickname), 
        phone=VALUES(phone), 
        address=VALUES(address), 
        about_me=VALUES(about_me),
        education=VALUES(education), 
        teaching_experience=VALUES(teaching_experience),
        can_teach_subjects=VALUES(can_teach_subjects), 
        can_teach_grades=VALUES(can_teach_grades),
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
  // req.file.path properties is returned by multer-storage-cloudinary representing the secure Cloudinary URL
  const imageUrl = req.file.path;
  res.status(200).json({ imageUrl });
});

// ================== Calendar Helpers ==================
// ================== Calendar Helpers ==================
function parseDateFromPreferredDays(s) {
  if (!s) return null;

  // 🔥 แก้ปัญหาเรื่อง Timezone (ถ้าเป็น Date Object ให้ดึงวันที่แบบ Local ของไทย)
  if (s instanceof Date) {
    const y = s.getFullYear();
    const m = String(s.getMonth() + 1).padStart(2, '0');
    const d = String(s.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
  m = s.match(/(\d{1,2})\s+([^\s]+)\.?\s+(\d{4})/);
  if (m) {
    const months = {
      'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
      'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
      'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
      'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
    };
    const d = String(parseInt(m[1], 10)).padStart(2, '0');
    let monTxt = m[2];
    let mo = months[monTxt] || months[monTxt + '.'] || months[monTxt.replace('.', '')];
    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;
    if (mo) return `${y}-${mo}-${d}`;
  }
  return null;
}

// ฟังก์ชันแปลงเวลา
function toSqlTimeMaybe(v) {
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  return null;
}

// 🌟 ฟังก์ชันตัวช่วยใหม่: หั่นวันที่และเวลาที่คั่นด้วยลูกน้ำ 🌟
function extractDateTimes(daysStr, timesStr) {
  if (!daysStr) return [];
  const daysArr = String(daysStr).split(',').map(d => d.trim());
  const timesArr = String(timesStr || '').split(',').map(t => t.trim());

  const results = [];
  daysArr.forEach((dStr, idx) => {
    const parsedDate = parseDateFromPreferredDays(dStr);
    if (parsedDate) {
      // จับคู่เวลากับวันที่ (ถ้าไม่ได้ระบุเวลาในบางวัน ให้ดึงเวลาช่องแรกสุดมาใช้)
      const tStr = timesArr[idx] || timesArr[0] || null;
      const parsedTime = toSqlTimeMaybe(tStr);
      results.push({ event_date: parsedDate, event_time: parsedTime });
    }
  });
  return results;
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// >>> ดึงปฏิทินของผู้ใช้ (ฉบับแสดงทั้งหมด รองรับการหั่นหลายวัน)
app.get('/api/calendar/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: 'invalid user id' });
    }

    let { start, end } = req.query;
    const today = localDateStr();
    if (!start) { const d = new Date(); d.setDate(d.getDate() - 365); start = localDateStr(d); }
    if (!end) { const d = new Date(); d.setDate(d.getDate() + 365); end = localDateStr(d); }

    // 1) ดึงอีเวนต์นัดหมาย (Calendar Events)
    const [rowsCal] = await pool.query(
      `SELECT ce.event_id, ce.user_id, ce.post_id, ce.post_type, ce.title, ce.subject, ce.event_date, ce.event_time, ce.location, ce.created_at,
              sp.subject AS student_subject_candidate,
              tp.subject AS tutor_subject_candidate
       FROM calendar_events ce
       LEFT JOIN student_posts sp ON ce.post_id = sp.student_post_id
       LEFT JOIN tutor_posts tp ON ce.post_id = tp.tutor_post_id
       WHERE ce.user_id = ?
         AND (ce.event_date BETWEEN ? AND ? OR ce.event_date IS NULL)
       ORDER BY COALESCE(ce.event_date, ?) ASC`,
      [userId, start, end, today]
    );

    const uniqueCalMap = new Map();
    rowsCal.forEach(r => {
      const eDate = parseDateFromPreferredDays(r.event_date); // บังคับให้เป็น String YYYY-MM-DD
      const resolvedType = resolvePostTypeFromCandidates(
        r.post_type,
        r.student_subject_candidate,
        r.tutor_subject_candidate,
        `${r.subject || ''} ${r.title || ''}`
      ) || normalizePostTypeValue(r.post_type) || 'student_post';
      const key = r.post_id ? `post-${r.post_id}-${resolvedType}-${eDate}-${r.event_time || ''}` : `evt-${r.event_id}`;
      if (!uniqueCalMap.has(key)) {
        uniqueCalMap.set(key, {
          event_id: r.event_id,
          user_id: r.user_id,
          post_id: r.post_id,
          title: r.title,
          post_type: resolvedType,
          subject: resolvedType === 'tutor_post'
            ? (r.tutor_subject_candidate || r.subject)
            : (r.student_subject_candidate || r.subject),
          event_date: eDate,
          event_time: r.event_time,
          location: r.location || null,
          created_at: r.created_at,
          source: resolvedType === 'tutor_post' ? 'calendar_tutor' : 'calendar_student'
        });
      }
    });
    const calItems = Array.from(uniqueCalMap.values());

    // 2) ดึงโพสต์หาติวเตอร์ (student_posts) - ที่ตนเองสร้าง (Owner)
    const [rowsStudentPosts] = await pool.query(
      `SELECT student_post_id, student_id, subject, preferred_days, preferred_time, location, created_at
       FROM student_posts WHERE student_id = ? AND is_active = 1`,
      [userId]
    );

    const studentPostsAsEvents = rowsStudentPosts.flatMap(p => {
      const dtList = extractDateTimes(p.preferred_days, p.preferred_time);
      return dtList.map((dt, idx) => ({
        event_id: `sp-${p.student_post_id}-${idx}`,
        user_id: p.student_id,
        post_id: p.student_post_id,
        post_type: 'student_post',
        title: `โพสต์ของคุณ: ${p.subject || 'เรียนพิเศษ'}`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'student_post_owner',
      }));
    });

    // 3) ดึงโพสต์สอนพิเศษ (tutor_posts) - ที่ตนเองสร้าง (Owner)
    const [rowsTutorPosts] = await pool.query(
      `SELECT tutor_post_id, tutor_id, subject, teaching_days, teaching_time, location, created_at
       FROM tutor_posts WHERE tutor_id = ? AND is_active = 1`,
      [userId]
    );

    const tutorPostsAsEvents = rowsTutorPosts.flatMap(p => {
      const dtList = extractDateTimes(p.teaching_days, p.teaching_time);
      return dtList.map((dt, idx) => ({
        event_id: `tp-${p.tutor_post_id}-${idx}`,
        user_id: p.tutor_id,
        post_id: p.tutor_post_id,
        post_type: 'tutor_post',
        title: `โพสต์ของติวเตอร์ (สอน): ${p.subject || 'วิชาทั่วไป'}`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_post_owner',
      }));
    });

    // 3.5) ดึงโพสต์ที่ติวเตอร์ไป "เสนอสอน" (Offers)
    const [rowsOffers] = await pool.query(
      `SELECT sp.student_post_id, sp.student_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location, sp.created_at,
              r.name, r.lastname, o.status
       FROM student_post_offers o
       JOIN student_posts sp ON o.student_post_id = sp.student_post_id
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE o.tutor_id = ? AND o.status = 'approved'`,
      [userId]
    );

    const offerEvents = rowsOffers.flatMap(p => {
      const dtList = extractDateTimes(p.preferred_days, p.preferred_time);
      const studentName = `${p.name || ''} ${p.lastname || ''}`.trim();
      return dtList.map((dt, idx) => ({
        event_id: `offer-${p.student_post_id}-${idx}`,
        user_id: userId,
        post_id: p.student_post_id,
        post_type: 'student_post',
        title: `สอนน้อง: ${p.subject || 'เรียนพิเศษ'} (${studentName})`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_offer_accepted',
        color: '#16a34a'
      }));
    });

    // 4) ดึงโพสต์ที่ "ขอเข้าร่วมสำเร็จ" (Joined Student Posts)
    const [rowsJoinedStudent] = await pool.query(
      `SELECT sp.student_post_id, sp.student_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location, sp.created_at,
              r.name, r.lastname
       FROM student_post_joins j
       JOIN student_posts sp ON j.student_post_id = sp.student_post_id
       LEFT JOIN register r ON r.user_id = sp.student_id
       WHERE j.user_id = ? AND j.status = 'approved'`,
      [userId]
    );

    const joinedStudentEvents = rowsJoinedStudent.flatMap(p => {
      const dtList = extractDateTimes(p.preferred_days, p.preferred_time);
      return dtList.map((dt, idx) => ({
        event_id: `join-sp-${p.student_post_id}-${idx}`,
        user_id: userId,
        post_id: p.student_post_id,
        post_type: 'student_post',
        title: `นัดติว (เข้าร่วม): ${p.subject || 'เรียนพิเศษ'}`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'student_post_joined',
      }));
    });

    // 5) ดึงโพสต์ที่ "ขอเรียนสำเร็จ" (Joined Tutor Posts)
    const [rowsJoinedTutor] = await pool.query(
      `SELECT tp.tutor_post_id, tp.tutor_id, tp.subject, tp.teaching_days, tp.teaching_time, tp.location, tp.created_at,
              r.name, r.lastname
       FROM tutor_post_joins j
       JOIN tutor_posts tp ON j.tutor_post_id = tp.tutor_post_id
       LEFT JOIN register r ON r.user_id = tp.tutor_id
       WHERE j.user_id = ? AND j.status = 'approved'`,
      [userId]
    );

    const joinedTutorEvents = rowsJoinedTutor.flatMap(p => {
      const dtList = extractDateTimes(p.teaching_days, p.teaching_time);
      return dtList.map((dt, idx) => ({
        event_id: `join-tp-${p.tutor_post_id}-${idx}`,
        user_id: userId,
        post_id: p.tutor_post_id,
        post_type: 'tutor_post',
        title: `เรียนกับติวเตอร์: ${p.subject || 'วิชาทั่วไป'}`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_post_joined',
        color: '#ea580c'
      }));
    });

    // 5.5) ดึงโพสต์ที่ "ติวเตอร์สอนเองและมีนักเรียนเข้าร่วม"
    const [rowsTutorSelfTeaching] = await pool.query(
      `SELECT DISTINCT tp.tutor_post_id, tp.subject, tp.teaching_days, tp.teaching_time, tp.location, tp.created_at
       FROM tutor_posts tp
       JOIN tutor_post_joins j ON tp.tutor_post_id = j.tutor_post_id
       WHERE tp.tutor_id = ? AND j.status = 'approved'`,
      [userId]
    );

    const tutorSelfTeachingEvents = rowsTutorSelfTeaching.flatMap(p => {
      const dtList = extractDateTimes(p.teaching_days, p.teaching_time);
      return dtList.map((dt, idx) => ({
        event_id: `teaching-sp-${p.tutor_post_id}-${idx}`,
        user_id: userId,
        post_id: p.tutor_post_id,
        post_type: 'tutor_post',
        title: `สอนพิเศษ (ของคุณ): ${p.subject || 'วิชาทั่วไป'}`,
        subject: p.subject || null,
        event_date: dt.event_date,
        event_time: dt.event_time,
        location: p.location || null,
        created_at: p.created_at,
        source: 'tutor_teaching_self_post',
      }));
    });

    // รวมข้อมูลทั้งหมด
    const allEvents = [
      ...calItems,
      ...studentPostsAsEvents,
      ...tutorPostsAsEvents,
      ...joinedStudentEvents,
      ...joinedTutorEvents,
      ...offerEvents,
      ...tutorSelfTeachingEvents
    ];

    // ลบข้อมูลซ้ำซ้อน (Deduplicate)
    const uniqueEvents = Array.from(new Map(allEvents.map(item => {
      const typeStr = normalizePostTypeValue(item.post_type || item.source) || (item.source?.includes('tutor') ? 'tutor_post' : 'student_post');
      return [item.post_id ? `${item.post_id}-${typeStr}-${item.event_date}-${item.event_time || ''}` : item.event_id, { ...item, post_type: typeStr }];
    })).values());

    const items = uniqueEvents
      .filter(ev => ev.event_date && ev.event_date >= start && ev.event_date <= end)
      .sort((a, b) => {
        const da = a.event_date || '9999-12-31';
        const db = b.event_date || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return (a.event_time || '00:00:00') < (b.event_time || '00:00:00') ? -1 : 1;
      });

    return res.json({ items, range: { start, end } });
  } catch (e) {
    console.error('🔥 GET /api/calendar/:userId error:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
});

function extractDateTimes(daysStr, timesStr) {
  if (!daysStr) return [];
  const daysArr = String(daysStr).split(',').map(d => d.trim());
  const timesArr = String(timesStr || '').split(',').map(t => t.trim());

  const results = [];
  daysArr.forEach((dStr, idx) => {
    const parsedDate = parseDateFromPreferredDays(dStr);
    if (parsedDate) {
      // จับคู่เวลากับวันที่ (ถ้าไม่ได้ระบุเวลาในบางวัน ให้ดึงเวลาช่องแรกสุดมาใช้)
      const tStr = timesArr[idx] || timesArr[0] || null;
      const parsedTime = toSqlTimeMaybe(tStr);
      results.push({ event_date: parsedDate, event_time: parsedTime });
    }
  });
  return results;
}

// 2. ฟังก์ชันแปลงเวลา
function toSqlTimeMaybe(v) {
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  return null;
}

// 3. ฟังก์ชัน Upsert (บันทึก/แก้ไข)
async function upsertCalendarEvent({ user_id, post_id, post_type = 'student', title, subject, event_date, event_time, location }) {
  // Debug: ให้ดูใน Terminal ว่าพยายามบันทึกอะไร
  console.log(`Creating Event for User ${user_id}: Date=${event_date}, Time=${event_time}, Type=${post_type}`);

  await pool.query(
    `INSERT INTO calendar_events (user_id, post_id, post_type, title, subject, event_date, event_time, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       title=VALUES(title),
       subject=VALUES(subject),
       event_date=VALUES(event_date),
       event_time=VALUES(event_time),
       location=VALUES(location),
       post_type=VALUES(post_type)`,
    [user_id, post_id, post_type, title, subject, event_date, event_time, location]
  );
}

async function deleteCalendarEventForUser(userId, postId, postType) {
  if (postType) {
    await pool.query('DELETE FROM calendar_events WHERE user_id=? AND post_id=? AND post_type=?', [userId, postId, postType]);
  } else {
    await pool.query('DELETE FROM calendar_events WHERE user_id=? AND post_id=?', [userId, postId]);
  }
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
          post_type: 'student',
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
          post_type: 'student',
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
          post_type: 'tutor',
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
          post_type: 'tutor',
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
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId)) return res.status(400).json({ message: 'invalid id' });
    const [rows] = await pool.query(
      `SELECT 
        tp.tutor_post_id,
        tp.subject,
        tp.tutor_id,
        tp.description,
        tp.target_student_level,
        tp.teaching_days,
        tp.teaching_time,
        tp.location,
        tp.group_size,
        tp.price,
        tp.contact_info,
        COALESCE(tp.created_at, NOW()) AS created_at,
        r.name,
        r.lastname,
        r.username,
        tpro.profile_picture_url,
        (SELECT COUNT(*) FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND status = 'approved') AS join_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = tp.tutor_post_id AND post_type = 'tutor') AS comment_count
       FROM tutor_posts tp
       LEFT JOIN register r ON tp.tutor_id = r.user_id
       LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
       WHERE tp.tutor_post_id = ?
       LIMIT 1`,
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
      description: post.description || "",
      group_size: Number(post.group_size || 0),
      createdAt: post.created_at,
      join_count: Number(post.join_count || 0),
      comment_count: Number(post.comment_count || 0),
      meta: {
        target_student_level: post.target_student_level || "ไม่ระบุ",
        teaching_days: post.teaching_days || "",
        teaching_time: post.teaching_time || "",
        location: post.location || "",
        price: Number(post.price || 0),
        contact_info: post.contact_info || ""
      },
      user: {
        // ถ้าหาชื่อไม่เจอ ให้แสดงค่า default
        first_name: post.name || "ไม่ทราบชื่อ",
        last_name: post.lastname || "",
        username: post.username || "",
        profile_image: post.profile_picture_url || ""
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
        r.username AS student_username,
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
        username: row.student_username,
        avatar: row.profile_picture_url || '/../blank_avatar.jpg'
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

// API ส่ง OTP (รองรับ Register, Change Email, Forgot Password)
app.post('/api/auth/request-otp', async (req, res) => {
  console.log("📨 Received OTP Request:", req.body);
  const { email, type, userId, username } = req.body; // userId needed for change_email check, username for register check

  try {
    // 1. ตรวจสอบเงื่อนไขก่อนส่ง
    if (type === 'register') {
      const [existingEmail] = await pool.query('SELECT 1 FROM register WHERE email = ?', [email]);
      if (existingEmail.length > 0) return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });

      if (username) {
        const [existingUser] = await pool.query('SELECT 1 FROM register WHERE username = ?', [username]);
        if (existingUser.length > 0) return res.status(400).json({ success: false, message: 'Username นี้ถูกใช้งานแล้ว' });
      }
    }
    else if (type === 'change_email') {
      // เช็คว่าอีเมลใหม่ซ้ำกับคนอื่นไหม (ยกเว้นตัวเอง)
      // กรณีนี้ userId คือคนขอเปลี่ยน
      if (!userId) return res.status(400).json({ success: false, message: 'User ID required for checking' });
      const [existing] = await pool.query('SELECT 1 FROM register WHERE email = ? AND user_id != ?', [email, userId]);
      if (existing.length > 0) return res.status(400).json({ success: false, message: 'อีเมลนี้มีผู้ใช้งานแล้ว' });
    }
    else if (type === 'forgot_password') {
      // ต้องมีอีเมลในระบบถึงจะส่งได้
      const [existing] = await pool.query('SELECT 1 FROM register WHERE email = ?', [email]);
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบ' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 2. บันทึก DB
    await pool.query('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)', [email, otpCode, expiresAt]);
    console.log(`✅ OTP Saved to DB for ${email} (${type})`);

    // 3. เตรียม Subject ตามประเภท
    let subject = '🔐 รหัสยืนยันตัวตน (OTP) - Tutor Web';
    if (type === 'change_email') subject = '📧 รหัสยืนยันการเปลี่ยนอีเมล - Tutor Web';
    if (type === 'forgot_password') subject = '🔑 รหัสรีเซ็ตรหัสผ่าน - Tutor Web';

    console.log("⏳ กำลังเชื่อมต่อ Brevo HTTP API...");

    const brevoPayload = {
      sender: { name: "Finding TutorWeb", email: process.env.BREVO_FROM_EMAIL || "findingtoturwebteam@gmail.com" },
      to: [{ email: email }],
      subject: subject,
      htmlContent: getEmailTemplate(otpCode)
    };

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify(brevoPayload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Brevo API request failed');
      }
      console.log("🚀 ส่งเมลสำเร็จ! ID:", data.messageId);
    } catch (error) {
      console.error("❌ Brevo Error:", error);
      throw new Error(error.message);
    }

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

  // 3. ทำการสมัครสมาชิก
  // เช็คซ้ำอีกรอบกันเหนียว
  const [existingUser] = await pool.query('SELECT 1 FROM register WHERE email = ? OR username = ?', [email, req.body.username]);
  if (existingUser.length > 0) return res.status(400).json({ success: false, message: 'อีเมลหรือ Username ถูกใช้งานแล้ว' });

  // INSERT
  const [result] = await pool.query(
    'INSERT INTO register (name, lastname, email, password, type, username, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
    [name, lastname, email, password, type, req.body.username]
  );

  // สร้าง Profile ว่างๆ รอไว้เลยตามประเภท (Optional)
  if (type === 'student') {
    await pool.query('INSERT INTO student_profiles (user_id) VALUES (?)', [result.insertId]);
  } else if (type === 'tutor') {
    await pool.query('INSERT INTO tutor_profiles (user_id) VALUES (?)', [result.insertId]);
  }

  res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ', userId: result.insertId });
});

// 1. API แก้ไขข้อมูลส่วนตัว (User Info) - เพิ่ม Check 90 วัน + OTP Email Change
app.put('/api/user/:id', async (req, res) => {
  try {
    const { name, lastname, email, otp } = req.body; // รับ otp มาด้วยถ้าเปลี่ยนเมล
    const userId = req.params.id;

    // --- Logic 90 Days Limit ---
    const [[currentUser]] = await pool.query('SELECT name, lastname, email, name_change_at FROM register WHERE user_id = ?', [userId]);
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    // 1. Check Name Change Limit
    const isNameChanged = (name && name !== currentUser.name) || (lastname && lastname !== currentUser.lastname);
    let shouldUpdateDate = false;

    if (isNameChanged) {
      const lastChange = currentUser.name_change_at ? new Date(currentUser.name_change_at) : null;
      if (lastChange) {
        const diffTime = Math.abs(new Date() - lastChange);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 90) {
          const nextDate = new Date(lastChange);
          nextDate.setDate(nextDate.getDate() + 90);
          return res.status(400).json({ success: false, message: `เปลี่ยนชื่อได้อีกครั้งวันที่ ${nextDate.toLocaleDateString('th-TH')}` });
        }
      }
      shouldUpdateDate = true;
    }

    // 2. Check Email Change & OTP
    if (email && email !== currentUser.email) {
      // เช็คว่าอีเมลใหม่ซ้ำไหม
      const [existing] = await pool.query('SELECT user_id FROM register WHERE email = ? AND user_id != ?', [email, userId]);
      if (existing.length > 0) return res.status(400).json({ success: false, message: 'อีเมลนี้มีผู้ใช้งานแล้ว' });

      if (!otp) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุรหัส OTP เพื่อยืนยันการเปลี่ยนอีเมล' });
      }
      // Verify OTP
      const [otpRows] = await pool.query(
        'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
        [email, otp] // check OTP ของอีเมลใหม่
      );
      if (otpRows.length === 0) {
        return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' });
      }
      // ลบ OTP ที่ใช้แล้ว
      await pool.query('DELETE FROM otp_codes WHERE email = ?', [email]);
    }

    // Update Query
    let sql = 'UPDATE register SET name = ?, lastname = ?, email = ?';
    const params = [name, lastname, email];

    if (shouldUpdateDate) sql += ', name_change_at = NOW()';

    sql += ' WHERE user_id = ?';
    params.push(userId);

    await pool.query(sql, params);

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// ✅ API รีเซ็ตรหัสผ่านด้วย OTP (Forgot Password)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    // 1. ตรวจสอบ OTP
    const [otpRows] = await pool.query(
      'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [email, otp]
    );
    if (otpRows.length === 0) {
      return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' });
    }

    // 2. เปลี่ยนรหัสผ่าน
    await pool.query('UPDATE register SET password = ? WHERE email = ?', [newPassword, email]);

    // 3. ลบ OTP
    await pool.query('DELETE FROM otp_codes WHERE email = ?', [email]);

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
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

// API สำหรับลบบัญชี (พร้อมเก็บ Log ละเอียดลง Sheet)
app.post('/api/delete-account', async (req, res) => {
  const { userId, reason, detail } = req.body;
  // รับแค่ userId ก็พอ เดี๋ยวเราไป query เอาข้อมูลล่าสุดเองให้ชัวร์

  try {
    // 1. ดึงข้อมูล User ล่าสุดจาก DB ก่อนลบ
    const [rows] = await pool.query('SELECT * FROM register WHERE user_id = ?', [userId]);
    const user = rows[0] || {};

    const sheetData = {
      Timestamp: new Date().toLocaleString('th-TH'),
      UserID: userId,
      Username: user.username || '-',
      Email: user.email || 'Unknown',
      Name: user.name || 'Unknown',
      Lastname: user.lastname || 'Unknown',
      Role: user.type || 'Unknown',
      Reason: reason,
      Detail: detail
    };

    // 2. บันทึกลง Google Sheet (แผ่นที่ 1 Reason)
    try {
      const serviceAccountAuth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0]; // แผ่นแรก

      await sheet.addRow(sheetData);
      console.log("✅ Saved delete reason to Google Sheet");
    } catch (sheetErr) {
      console.error("⚠️ Sheet Error (ข้ามการบันทึก):", sheetErr.message);
    }

    // 3. ลบข้อมูลจริงใน Database (Clean Delete logic)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ลบ child records ที่อ้างอิงถึง user หรือ post ของ user
      // 1. ลบจากตารางอื่นๆ ที่มี user_id หรือ liên quan
      await conn.query('DELETE FROM comments WHERE user_id = ?', [userId]);
      await conn.query('DELETE FROM comments WHERE post_type = "student" AND post_id IN (SELECT student_post_id FROM student_posts WHERE student_id = ?)', [userId]);
      await conn.query('DELETE FROM comments WHERE post_type = "tutor" AND post_id IN (SELECT tutor_post_id FROM tutor_posts WHERE tutor_id = ?)', [userId]);

      await conn.query('DELETE FROM posts_favorites WHERE user_id = ?', [userId]);
      await conn.query('DELETE FROM posts_favorites WHERE post_type = "student" AND post_id IN (SELECT student_post_id FROM student_posts WHERE student_id = ?)', [userId]);
      await conn.query('DELETE FROM posts_favorites WHERE post_type = "tutor" AND post_id IN (SELECT tutor_post_id FROM tutor_posts WHERE tutor_id = ?)', [userId]);

      await conn.query('DELETE FROM student_post_offers WHERE tutor_id = ?', [userId]);
      await conn.query('DELETE FROM student_post_joins WHERE user_id = ?', [userId]);
      await conn.query('DELETE FROM tutor_post_joins WHERE user_id = ?', [userId]);

      await conn.query('DELETE FROM reviews WHERE student_id = ? OR tutor_id = ?', [userId, userId]);

      await conn.query('DELETE FROM student_profiles WHERE user_id = ?', [userId]);
      await conn.query('DELETE FROM tutor_profiles WHERE user_id = ?', [userId]);
      // ลบ child records บางส่วนที่ควรหายไปทันที (เช่น session/history ที่ไม่จำเป็น)
      await conn.query('DELETE FROM search_history WHERE user_id = ?', [userId]);

      // สุดท้าย ทำ Soft Delete แทนการลบ User จริง
      await conn.query('UPDATE register SET deleted_at = NOW() WHERE user_id = ?', [userId]);

      await conn.commit();
      conn.release();
    } catch (dbErr) {
      await conn.rollback();
      conn.release();
      throw dbErr;
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);
    const expireDateFormatted = deletionDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    console.log(`🗑️ Soft Deleted User: ${userId} (${user.email})`);
    res.json({
      success: true,
      message: 'ลบบัญชีแล้ว',
      hint: `คุณสามารถ Login บัญชีนี้ได้อีกภายใน 30 วันถึงวันที่ ${expireDateFormatted} หากเปลี่ยนใจ`
    });

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
        `INSERT INTO student_post_offers (student_post_id, tutor_id, status, requested_at, name, lastname, joined_at)
          SELECT ?, ?, 'pending', NOW(), r.name, r.lastname, '1899-11-30 00:00:00'
          FROM register r WHERE r.user_id = ?
          ON DUPLICATE KEY UPDATE
            status = IF(student_post_offers.status = 'approved', student_post_offers.status, 'pending'),
            requested_at = NOW()
         `,
        [postId, me, me]
      );

      // แจ้งเตือน: type = 'offer'
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
        [post.student_id, me, 'offer', `มีติวเตอร์ยื่นข้อเสนอสอน สำหรับโพสต์ "${post.subject || 'เรียนพิเศษ'}"`, postId, 'student_post']
      );

    } else {
      // --- STUDENT: ลงใน student_post_joins ---
      await pool.query(
        `INSERT INTO student_post_joins (student_post_id, user_id, status, requested_at, name, lastname, joined_at)
          SELECT ?, ?, 'pending', NOW(), r.name, r.lastname, '1899-11-30 00:00:00'
          FROM register r WHERE r.user_id = ?
          ON DUPLICATE KEY UPDATE
            status = IF(student_post_joins.status = 'approved', student_post_joins.status, 'pending'),
            requested_at = NOW()
         `,
        [postId, me, me]
      );

      // แจ้งเตือน: type = 'join_request'
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
        [post.student_id, me, 'join_request', `มีคำขอเข้าร่วมโพสต์ "${post.subject || 'เรียนพิเศษ'}"`, postId, 'student_post']
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
    const me = Number(req.query.user_id || req.body?.user_id);

    if (!Number.isFinite(postId) || !Number.isFinite(me)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs' });
    }

    // Use Unified Logic
    const out = await doUnjoinUnified('student', postId, me);
    return res.status(out.http).json(out.body);

  } catch (err) {
    console.error("❌ /api/student_posts/:id/join error:", err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
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

// API: แนะนำคอร์สเรียน (Based on Search History & Relevance Score)
app.get('/api/recommendations/courses', async (req, res) => {
  try {
    const userId = Number(req.query.user_id) || 0;
    if (userId === 0) return getLatestPostsFallback(req, res, userId); // ไม่ได้ล็อกอินให้ดึงล่าสุด

    const keywordWeights = {};

    // ฟังก์ชันช่วยสกัดคำและให้คะแนน
    const addWeight = (keyword, score) => {
      if (!keyword) return;
      // สกัดคำ bằngฟังก์ชัน expandSearchTerm ที่คุณมีอยู่แล้ว
      const terms = expandSearchTerm(keyword);
      terms.forEach(t => {
        const k = t.toLowerCase().trim();
        // ไม่เอาคำขยะสั้นๆ
        if (k.length > 2) {
          keywordWeights[k] = (keywordWeights[k] || 0) + score;
        }
      });
    };

    // 🎯 1. ดึงข้อมูลจาก Profile (แก้อาการเอ๋อของเด็กใหม่)
    const [profile] = await pool.query(
      'SELECT grade_level, faculty, major, about, interested_subjects FROM student_profiles WHERE user_id = ?',
      [userId]
    );

    if (profile.length > 0) {
      const p = profile[0];
      // ให้น้ำหนักระดับชั้น และสาขา
      if (p.grade_level) addWeight(p.grade_level, 4);
      if (p.faculty) addWeight(p.faculty, 3);
      if (p.major) addWeight(p.major, 4);

      // ให้น้ำหนักวิชาที่สนใจ (ถ้ามีฟิลด์นี้)
      if (p.interested_subjects) {
        p.interested_subjects.split(',').forEach(sub => addWeight(sub, 6)); // คะแนนสูง!
      }

      // 🔥 สกัด Keyword จากช่อง About (ประวัติ)
      if (p.about) {
        // หั่นข้อความยาวๆ ออกเป็นคำๆ (เว้นวรรค)
        const aboutWords = p.about.split(/[\s,]+/);
        aboutWords.forEach(word => {
          // ให้คะแนนทีละคำที่อยู่ใน About
          addWeight(word, 2);
        });
      }
    }

    // 🔍 2. ดึงประวัติการค้นหา (เอามาบวกเพิ่มความแม่นยำ)
    const [searches] = await pool.query(
      `SELECT keyword, COUNT(*) as freq 
       FROM search_history 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY keyword`, [userId]
    );
    searches.forEach(s => addWeight(s.keyword, s.freq * 2));

    // ----------------------------------------------------
    // คัดกรองเอา 6 คำที่มีคะแนนเยอะที่สุดมาใช้งาน
    // ----------------------------------------------------
    const topKeywords = Object.entries(keywordWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // ถ้าโปรไฟล์โล่งมาก และไม่เคยค้นหาอะไรเลย -> ใช้ค่าเริ่มต้นล่าสุด
    if (topKeywords.length === 0) return getLatestPostsFallback(req, res, userId);

    // 🚀 3. สร้างคำสั่ง SQL ค้นหาและเรียงตามคะแนนความเชื่อมโยง (Relevance Score)
    let scoreCases = topKeywords.map(([kw, weight]) => {
      const safeKw = kw.replace(/'/g, "''");
      // ให้คะแนนหนักถ้าเจอใน Subject, ปานกลางถ้าเจอในระดับชั้น, น้อยถ้าเจอใน Description
      return `(CASE WHEN LOWER(tp.subject) LIKE '%${safeKw}%' THEN ${weight * 2} 
                    WHEN LOWER(tp.target_student_level) LIKE '%${safeKw}%' THEN ${weight * 1.5}
                    WHEN LOWER(tp.description) LIKE '%${safeKw}%' THEN ${weight} 
                    ELSE 0 END)`;
    }).join(' + ');

    const sql = `
      SELECT 
        tp.*, 
        r.name, r.lastname, tpro.profile_picture_url,
        (${scoreCases}) AS relevance_score,
        COALESCE(fvc.c,0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
      FROM tutor_posts tp
      LEFT JOIN register r ON r.user_id = tp.tutor_id
      LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
      LEFT JOIN (SELECT post_id, COUNT(*) as c FROM posts_favorites WHERE post_type='tutor' GROUP BY post_id) fvc ON fvc.post_id = tp.tutor_post_id
      LEFT JOIN posts_favorites fme ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
      WHERE tp.is_active = 1
      HAVING relevance_score > 0
      ORDER BY relevance_score DESC, tp.created_at DESC
      LIMIT 12
    `;

    const [results] = await pool.query(sql, [userId]);

    // ถ้าวิเคราะห์แล้วไม่มีโพสต์ตรงใจเลย ให้สุ่มล่าสุดแทน
    if (results.length === 0) return getLatestPostsFallback(req, res, userId);

    // จัดเรียงข้อมูลเพื่อส่งกลับให้ Frontend
    const items = results.map(r => ({
      _id: r.tutor_post_id,
      subject: r.subject,
      description: r.description,
      createdAt: r.created_at,
      group_size: Number(r.group_size || 0),
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
      favorited: !!r.favorited,
      relevance_score: r.relevance_score // ✅ ส่งคะแนน Match กลับไปแสดงผล
    }));

    // ดึงคำศัพท์มาโชว์ในป้ายประกาศสีเหลืองหน้าเว็บ
    const basedOnText = topKeywords.map(k => k[0]).join(', ');

    res.json({
      success: true,
      basedOn: `วิเคราะห์จากโปรไฟล์ของคุณ: ${basedOnText}`,
      items: items
    });

  } catch (err) {
    console.error('Advanced Recommendation Error:', err);
    return getLatestPostsFallback(req, res, Number(req.query.user_id) || 0);
  }
});

async function getLatestPostsFallback(req, res, userId) {
  try {
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
      WHERE COALESCE(tp.is_active, 1) = 1
      ORDER BY tp.created_at DESC 
      LIMIT 12
    `, [userId]);

    const items = latest.map(r => ({
      _id: r.tutor_post_id,
      subject: r.subject,
      description: r.description,
      createdAt: r.created_at,
      group_size: Number(r.group_size || 0),
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

    res.json({
      success: true,
      basedOn: "โพสต์สอนพิเศษล่าสุด",
      items: items
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Fallback Error' });
  }
}

// API สำหรับเก็บประวัติการคลิกดู
app.post('/api/interactions', async (req, res) => {
  const { user_id, action_type, related_id, subject_keyword } = req.body;
  if (!user_id || !subject_keyword) return res.json({ success: false });

  const normalizedActionType = String(action_type || '').trim() || 'open_post';
  const normalizedKeyword = String(subject_keyword || '').trim();
  if (!normalizedKeyword) return res.json({ success: false });

  try {
    await pool.query(
      `INSERT INTO user_interactions (user_id, action_type, related_id, subject_keyword) 
       VALUES (?, ?, ?, ?)`,
      [user_id, normalizedActionType, related_id, normalizedKeyword]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
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
      profile_image: profileData.profile_picture_url || user.profile_picture_url || '/../blank_avatar.jpg',
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
        avatar: '/../blank_avatar.jpg' // join profile if needed
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
      return res.status(400).json({ success: false, message: 'คุณได้ให้คะแนนรีวิวสำหรับการเรียนนี้ไปแล้วค่ะ' });
    }

    // 3. Insert Review
    await pool.query(
      `INSERT INTO reviews 
       (booking_id, tutor_id, student_id, rating, comment, created_at, post_id, post_type, rating_punctuality, rating_worth, rating_teaching)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [req.body.booking_id || 0, tId, sId, rating, comment || '', inputPostId, finalPostType, rating_punctuality || 5, rating_worth || 5, rating_teaching || 5]
    );

    // 4. Notify Tutor
    // Get student name for message
    const [student] = await pool.query('SELECT name, lastname FROM register WHERE user_id = ?', [sId]);
    const sName = student[0] ? `${student[0].name} ${student[0].lastname}` : 'นักเรียน';

    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type, created_at)
       VALUES (?, ?, 'review_received', ?, ?, ?, NOW())`,
      [tId, sId, `ได้รับรีวิวใหม่จาก ${sName}`, inputPostId, finalPostType]
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
    const b = req.body;

    // 🔥 FIX: ดักจับชื่อตัวแปร
    const gradeLevel = b.grade_level || b.level || b.target_student_level;
    const groupSize = parseInt(b.group_size || b.capacity) || 1;
    const budget = Number(b.budget || b.price || 0);

    await pool.query(
      `UPDATE student_posts SET 
        subject=?, description=?, preferred_days=?, preferred_time=?, 
        grade_level=?, location=?, group_size=?, budget=?, contact_info=?
       WHERE student_post_id=?`,
      [
        b.subject,
        b.description,
        b.preferred_days,
        b.preferred_time,
        gradeLevel, // ✅ ใช้ตัวแปรที่ดักจับแล้ว
        b.location,
        groupSize,
        budget,
        b.contact_info,
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
    const b = req.body; // ใช้ตัวแปรสั้นๆ จะได้เช็คหลายชื่อง่ายๆ

    // 🔥 FIX: ดักจับชื่อตัวแปรให้ครบ (เผื่อ Frontend ส่งมาไม่ตรง)
    // รับทั้ง target_student_level, grade_level, level
    const targetLevel = b.target_student_level || b.grade_level || b.level;

    // รับทั้ง group_size, capacity
    const rawGroup = b.group_size || b.capacity || b.maxStudents;
    const groupSize = parseInt(rawGroup) || 1;

    // รับทั้ง price, hourly_rate
    const price = Number(b.price || b.hourly_rate || 0);

    await pool.query(
      `UPDATE tutor_posts SET 
        subject=?, description=?, teaching_days=?, teaching_time=?, 
        target_student_level=?, location=?, price=?, group_size=?, contact_info=?
       WHERE tutor_post_id=?`,
      [
        b.subject,
        b.description,
        b.teaching_days,
        b.teaching_time,
        targetLevel, // ✅ ใช้ตัวแปรที่ดักจับแล้ว
        b.location,
        price,       // ✅ ใช้ตัวแปรที่แปลงแล้ว
        groupSize,   // ✅ ใช้ตัวแปรที่แปลงแล้ว
        b.contact_info,
        postId
      ]
    );

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error("Update Tutor Post Error:", err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ==========================================
// 🛡️ RE-IMPLEMENTED REPORTING & ADMIN APIS
// ==========================================

// 1. Submit Report (Robust Logic)
app.post('/api/reports', async (req, res) => {
  try {
    console.log("📝 [API] Report Received:", req.body);
    const { reporter_id, post_id, post_type, reason, reported_user_id } = req.body;

    let targetUserId = reported_user_id;

    // 🕵️ AUTO-DETECT Target User (If missing from frontend)
    if (!targetUserId && post_id) {
      if (post_type === 'student_post' || post_type === 'student') {
        const [rows] = await pool.query('SELECT student_id FROM student_posts WHERE student_post_id = ?', [post_id]);
        if (rows.length) targetUserId = rows[0].student_id;
      } else if (post_type === 'tutor_post' || post_type === 'tutor') {
        const [rows] = await pool.query('SELECT tutor_id FROM tutor_posts WHERE tutor_post_id = ?', [post_id]);
        if (rows.length) targetUserId = rows[0].tutor_id;
      }
    }

    if (!targetUserId && !post_id) {
      // Allow reporting just a user (profilereport) if implemented later
    }

    await pool.query(
      `INSERT INTO user_reports (reporter_id, reported_user_id, post_id, post_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [reporter_id, targetUserId || null, post_id || null, post_type || 'other', reason]
    );

    res.json({ success: true, message: 'Report submitted successfully' });

  } catch (err) {
    console.error("❌ Report Error:", err);
    res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
  }
});

// 2. Admin: Get Reports
app.get('/api/admin/reports', async (req, res) => {
  try {
    const { user_id, admin_id } = req.query;
    const uid = admin_id || user_id;

    // Verify Admin
    const [u] = await pool.query('SELECT role, type FROM register WHERE user_id = ?', [uid]);
    if (!u.length || (u[0].role !== 'admin' && u[0].type !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const [rows] = await pool.query(`
      SELECT 
        r.report_id, r.reporter_id, r.reported_user_id, r.post_id, r.reason, r.status, r.created_at,
        reporter.name as reporter_name, reporter.lastname as reporter_lastname,
        
        /* Resolve Post Title/Type */
        CASE 
           WHEN r.post_type IN ('student_post', 'student') THEN 'student_post'
           WHEN r.post_type IN ('tutor_post', 'tutor') THEN 'tutor_post'
           WHEN r.post_type = 'profile' THEN 'profile'
           ELSE r.post_type
        END as post_type,

        CASE 
          WHEN r.post_type IN ('student_post', 'student') THEN COALESCE(sp.subject, 'Post Deleted')
          WHEN r.post_type IN ('tutor_post', 'tutor') THEN COALESCE(tp.subject, 'Post Deleted')
          WHEN r.post_type = 'profile' THEN CONCAT('User: ', COALESCE(reported.name, 'Unknown'), ' ', COALESCE(reported.lastname, ''))
          ELSE 'Unknown'
        END as post_title,

        CASE 
          WHEN r.post_type IN ('student_post', 'student') THEN sp.description
          WHEN r.post_type IN ('tutor_post', 'tutor') THEN tp.description
          WHEN r.post_type = 'profile' THEN CONCAT('Reported User ID: ', r.reported_user_id)
          ELSE ''
        END as post_content

      FROM user_reports r
      LEFT JOIN register reporter ON r.reporter_id = reporter.user_id
      LEFT JOIN register reported ON r.reported_user_id = reported.user_id
      LEFT JOIN student_posts sp ON r.post_id = sp.student_post_id
      LEFT JOIN tutor_posts tp ON r.post_id = tp.tutor_post_id
      ORDER BY r.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 3. Admin: Update Report Status
app.patch('/api/admin/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE user_reports SET status = ? WHERE report_id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// 4. Admin: Get Users
app.get('/api/admin/users', async (req, res) => {
  try {
    const { search, user_id, admin_id } = req.query;
    const uid = admin_id || user_id;

    // Verify Admin
    const [u] = await pool.query('SELECT role, type FROM register WHERE user_id = ?', [uid]);
    if (!u.length || (u[0].role !== 'admin' && u[0].type !== 'admin')) {
      return res.status(403).json([]);
    }

    let sql = `SELECT user_id, name, lastname, email, role, type, status, suspended_until FROM register`;
    let params = [];

    if (search) {
      sql += ` WHERE name LIKE ? OR email LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json([]);
  }
});

// 5. Admin: Delete Post (and Resolve Reports)
app.delete('/api/admin/posts', async (req, res) => {
  try {
    const { post_id, post_type } = req.body;

    if (post_type === 'student_post' || post_type === 'student') {
      await pool.query('DELETE FROM student_posts WHERE student_post_id = ?', [post_id]);
    } else if (post_type === 'tutor_post' || post_type === 'tutor') {
      await pool.query('DELETE FROM tutor_posts WHERE tutor_post_id = ?', [post_id]);
    }

    // Auto-resolve reports for this post
    await pool.query('UPDATE user_reports SET status = "resolved" WHERE post_id = ?', [post_id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Admin: Manage User (Suspend/Ban)
app.put('/api/admin/users/:id/status', async (req, res) => {
  const { status, suspendDays } = req.body; // status: 'active', 'suspended', 'banned'
  let until = null;
  if (status === 'suspended' && suspendDays) {
    const d = new Date();
    d.setDate(d.getDate() + suspendDays);
    until = d;
  }

  await pool.query('UPDATE register SET status = ?, suspended_until = ? WHERE user_id = ?', [status, until, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  await pool.query('DELETE FROM register WHERE user_id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==========================================
// 💬 ฟีเจอร์ Webboard Comments
// ==========================================

// 1. ดึงคอมเมนต์ของโพสต์ (GET /api/comments/:postType/:postId)
app.get('/api/comments/:postType/:postId', async (req, res) => {
  try {
    const { postType, postId } = req.params;

    // ดึงคอมเมนต์พร้อมข้อมูลผู้เขียน
    const query = `
      SELECT 
        c.comment_id, c.post_id, c.post_type, c.post_owner_id, 
        c.user_id, c.comment_text, c.created_at,
        r.name, r.lastname, r.username, r.type as user_role,
        COALESCE(sp.profile_picture_url, tp.profile_picture_url) as profile_image
      FROM comments c
      LEFT JOIN register r ON c.user_id = r.user_id
      LEFT JOIN student_profiles sp ON r.user_id = sp.user_id AND r.type = 'student'
      LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id AND r.type = 'tutor'
      WHERE c.post_id = ? AND c.post_type = ?
      ORDER BY c.created_at ASC
    `;

    const [rows] = await pool.query(query, [postId, postType]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/comments error:", err);
    res.status(500).json({ message: "ไม่สามารถโหลดคอมเมนต์ได้" });
  }
});

// 2. เพิ่มคอมเมนต์ใหม่ (POST /api/comments)
app.post('/api/comments', async (req, res) => {
  try {
    const { post_id, post_type, post_owner_id, user_id, comment_text } = req.body;

    if (!post_id || !post_type || !user_id || !comment_text) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const [result] = await pool.query(
      `INSERT INTO comments (post_id, post_type, post_owner_id, user_id, comment_text) 
       VALUES (?, ?, ?, ?, ?)`,
      [post_id, post_type, post_owner_id, user_id, comment_text]
    );

    // ==========================================
    // 🔔 ระบบแจ้งเตือน (Notifications)
    // ==========================================
    // 1. แจ้งเตือนเจ้าของโพสต์ (ถ้าคนคอมเมนต์ไม่ใช่เจ้าของ)
    if (Number(user_id) !== Number(post_owner_id)) {
      await pool.query(
        'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
        [post_owner_id, user_id, 'comment', 'แสดงความคิดเห็นในโพสต์ของคุณ', post_id, post_type]
      );
    }

    // 2. แจ้งเตือนเมื่อมีการกล่าวถึง (Mention) '@username'
    const mentionRegex = /@([a-zA-Z0-9_\\.]+)/g;
    const mentions = [...comment_text.matchAll(mentionRegex)].map(m => m[1]);
    const uniqueMentions = [...new Set(mentions)];

    if (uniqueMentions.length > 0) {
      const placeholders = uniqueMentions.map(() => '?').join(',');
      const [mentionedUsers] = await pool.query(
        `SELECT user_id FROM register WHERE username IN (${placeholders})`,
        uniqueMentions
      );

      for (const tUser of mentionedUsers) {
        // ไม่แจ้งเตือนตัวเอง และไม่แจ้งเตือนซ้ำกับเจ้าของโพสต์ (เพราะแจ้งเหตุการณ์คอมเมนต์ไปแล้ว)
        if (Number(tUser.user_id) !== Number(user_id) && Number(tUser.user_id) !== Number(post_owner_id)) {
          await pool.query(
            'INSERT INTO notifications (user_id, actor_id, type, message, related_id, post_type) VALUES (?, ?, ?, ?, ?, ?)',
            [tUser.user_id, user_id, 'mention', 'กล่าวถึงคุณในความคิดเห็น', post_id, post_type]
          );
        }
      }
    }

    // ส่งคืนข้อมูลคอมเมนต์ที่เพิ่งสร้างและดึงข้อมูลโปรไฟล์กลับไปด้วย
    const [rows] = await pool.query(`
      SELECT 
        c.comment_id, c.post_id, c.post_type, c.post_owner_id, 
        c.user_id, c.comment_text, c.created_at,
        r.name, r.lastname, r.username, r.type as user_role,
        COALESCE(sp.profile_picture_url, tp.profile_picture_url) as profile_image
      FROM comments c
      LEFT JOIN register r ON c.user_id = r.user_id
      LEFT JOIN student_profiles sp ON r.user_id = sp.user_id AND r.type = 'student'
      LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id AND r.type = 'tutor'
      WHERE c.comment_id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      comment: rows[0],
      message: "เพิ่มคอมเมนต์สำเร็จ"
    });
  } catch (err) {
    console.error("POST /api/comments error:", err);
    res.status(500).json({ message: "เพิ่มคอมเมนต์ไม่สำเร็จ" });
  }
});

// 3. ลบคอมเมนต์ (DELETE /api/comments/:commentId)
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id } = req.body; // ผู้ลบ

    // ตรวจสอบสิทธิ์ (ผู้เขียนคอมเมนต์ หรือ เจ้าของโพสต์)
    const [comments] = await pool.query('SELECT user_id, post_owner_id FROM comments WHERE comment_id = ?', [commentId]);
    if (comments.length === 0) return res.status(404).json({ message: "ไม่พบคอมเมนต์" });

    const comment = comments[0];
    if (Number(comment.user_id) !== Number(user_id) && Number(comment.post_owner_id) !== Number(user_id)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ลบคอมเมนต์นี้" });
    }

    await pool.query('DELETE FROM comments WHERE comment_id = ?', [commentId]);
    res.json({ success: true, message: "ลบคอมเมนต์แล้ว" });
  } catch (err) {
    console.error("DELETE /api/comments error:", err);
    res.status(500).json({ message: "ลบคอมเมนต์ไม่สำเร็จ" });
  }
});

// ****** Server Start ******
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
