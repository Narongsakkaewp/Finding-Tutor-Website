// src/controllers/searchController.js
const SUBJECT_KNOWLEDGE_BASE = {
    'program': ['code', 'python', 'java', 'c++', 'html', 'css', 'react', 'node', 'sql', 'คอมพิวเตอร์'],
    'code': ['program', 'python', 'java', 'script', 'web', 'app', 'dev'],
    'คอม': ['com', 'it', 'program', 'excel', 'word', 'powerpoint'],
    'คณิต': ['math', 'cal', 'เลข', 'algebra', 'stat'],
    'math': ['คณิต', 'cal', 'เลข'],
    'phy': ['ฟิสิกส์', 'sci', 'กลศาสตร์'],
    'eng': ['อังกฤษ', 'english', 'toefl', 'ielts', 'toeic', 'conversation'],
    'jap': ['ญี่ปุ่น', 'japanese', 'n5', 'n4', 'n3'],
    'จีน': ['chinese', 'hsk'],
    'sci': ['วิทย์', 'bio', 'chem', 'phy', 'ดาราศาสตร์'],
    'chem': ['เคมี', 'sci'],
    'bio': ['ชีว', 'sci']
};

// ฟังก์ชันขยายคำค้นหา
const expandKeywords = (text) => {
    if (!text) return [];
    let keywords = [text.toLowerCase()];
    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        if (text.toLowerCase().includes(key)) {
            keywords = [...keywords, ...SUBJECT_KNOWLEDGE_BASE[key]];
        }
    });
    return keywords; // เช่น หา "คอม" -> ได้ ["คอม", "com", "it", "excel"...]
};

// ฟังก์ชันบันทึกประวัติการค้นหา
const logSearchHistory = async (pool, userId, keyword) => {
    if (!keyword) return;
    try {
        await pool.query(
            'INSERT INTO search_history (user_id, keyword) VALUES (?, ?)',
            [userId || null, keyword]
        );
    } catch (err) {
        console.error("Log Search Error:", err); // ไม่ต้อง throw error ให้ User เห็น แค่ log ไว้
    }
};

exports.smartSearch = async (req, res) => {
    try {
        const pool = req.db;
        const { q, user_id } = req.query; // q = คำค้นหา, user_id = คนค้น

        if (!q || q.trim() === "") {
            return res.json({ tutors: [], students: [] });
        }

        // 1. บันทึกประวัติการค้นหา (ทำงานเบื้องหลัง)
        logSearchHistory(pool, user_id, q);

        // 2. ขยายคำค้นหา (Smart Keywords)
        const searchKeywords = expandKeywords(q);

        // สร้างเงื่อนไข SQL OR (LIKE %kw1% OR LIKE %kw2% ...)
        const likeConditions = searchKeywords.map(() => `(subject LIKE ? OR description LIKE ?)`).join(' OR ');

        // เตรียม Params (ต้องเบิ้ล 2 ครั้งต่อ 1 คำ เพราะเราเช็คทั้ง subject และ description)
        const sqlParams = [];
        searchKeywords.forEach(kw => {
            sqlParams.push(`%${kw}%`, `%${kw}%`);
        });

        // 3. ค้นหาติวเตอร์ (Tutor Posts)
        const [tutors] = await pool.query(`
            SELECT 
                tp.*, 
                r.name, r.lastname, 
                tpro.profile_picture_url
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            WHERE ${likeConditions}
            ORDER BY tp.created_at DESC
            LIMIT 20
        `, sqlParams);

        // 4. ค้นหาโพสต์นักเรียน (Student Posts)
        const [students] = await pool.query(`
            SELECT 
                sp.*, 
                r.name, r.lastname, 
                spro.profile_picture_url
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            WHERE ${likeConditions}
            ORDER BY sp.created_at DESC
            LIMIT 20
        `, sqlParams);

        // 5. ส่งผลลัพธ์กลับ
        res.json({
            keyword_used: q,
            expanded_keywords: searchKeywords, // บอก Frontend ว่าเราแอบขยายคำเป็นอะไรบ้าง (เผื่ออยากโชว์)
            tutors: tutors,
            students: students
        });

    } catch (err) {
        console.error("Smart Search Error:", err);
        res.status(500).json({ error: 'Search failed' });
    }
};

// API สำหรับดึง "คำที่ค้นหาบ่อยของฉัน" (Search History)
exports.getMySearchHistory = async (req, res) => {
    try {
        const pool = req.db;
        const { user_id } = req.query;

        if (!user_id) return res.json([]);

        // ดึง 5 คำล่าสุดที่ไม่ซ้ำกัน
        const [rows] = await pool.query(`
            SELECT keyword
            FROM search_history 
            WHERE user_id = ? 
            GROUP BY keyword
            ORDER BY MAX(created_at) DESC 
            LIMIT 5
        `, [user_id]);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Fetch history failed' });
    }
};

// API สำหรับลบประวัติการค้นหา
// API สำหรับลบประวัติการค้นหา (รองรับทั้งลบทีละคำ และลบทั้งหมด)
exports.deleteSearchHistory = async (req, res) => {
    try {
        const pool = req.db;
        const { user_id, keyword } = req.query;

        // 1. ลบทีละคำ (Delete specific keyword for user)
        if (user_id && keyword) {
            await pool.query('DELETE FROM search_history WHERE user_id = ? AND keyword = ?', [user_id, keyword]);
            return res.json({ success: true, message: `Deleted keyword: ${keyword}` });
        }

        // 2. ล้างทั้งหมด (Clear all history for user)
        if (user_id) {
            await pool.query('DELETE FROM search_history WHERE user_id = ?', [user_id]);
            return res.json({ success: true, message: 'History cleared' });
        }

        res.status(400).json({ error: 'Missing parameters (user_id required)' });

    } catch (err) {
        console.error("Delete history error:", err);
        res.status(500).json({ error: 'Delete failed' });
    }
};