// tutorweb-server/src/controllers/searchController.js

// 🌟 อัปเกรด Dictionary ให้ครอบคลุมการค้นหาแบบอิสระ
const SUBJECT_KNOWLEDGE_BASE = {
    'program': ['code', 'python', 'java', 'oop', 'c++', 'html', 'css', 'react', 'node', 'sql', 'คอมพิวเตอร์', 'เขียนโปรแกรม'],
    'เขียนโปรแกรม': ['python', 'java', 'oop', 'c++', 'html', 'css', 'react', 'node', 'sql', 'program', 'code'],
    'code': ['program', 'python', 'java', 'oop', 'script', 'web', 'app', 'dev'],
    'คอม': ['com', 'it', 'program', 'excel', 'word', 'powerpoint'],
    'คณิต': ['math', 'cal', 'เลข', 'algebra', 'stat', 'คณิตศาสตร์'],
    'math': ['คณิต', 'cal', 'เลข'],
    'phy': ['ฟิสิกส์', 'sci', 'กลศาสตร์'],
    'eng': ['อังกฤษ', 'english', 'toefl', 'ielts', 'toeic', 'conversation'],
    'jap': ['ญี่ปุ่น', 'japanese', 'n5', 'n4', 'n3'],
    'จีน': ['chinese', 'hsk'],
    'sci': ['วิทย์', 'bio', 'chem', 'phy', 'ดาราศาสตร์', 'วิทยาศาสตร์'],
    'chem': ['เคมี', 'sci'],
    'bio': ['ชีว', 'sci', 'ชีววิทยา'],
    'ชีว': ['bio', 'biology', 'ชีววิทยา', 'sci']
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
        console.error("Log Search Error:", err);
    }
};

exports.smartSearch = async (req, res) => {
    try {
        const pool = req.db;
        const { q, user_id } = req.query; // q = คำค้นหา

        if (!q || q.trim() === "") {
            return res.json({ tutors: [], students: [], posts: [] });
        }

        // 1. บันทึกประวัติการค้นหา
        logSearchHistory(pool, user_id, q);

        // 2. ระบบ Hybrid Search (หั่นคำ + แตกคำศัพท์จาก Dictionary)
        const searchWords = q.trim().toLowerCase().split(/\s+/);
        
        const conditions = [];
        const sqlParams = [];

        // ลูปตรวจสอบทีละคำ ว่ามีคำเหมือนใน Dictionary ไหม?
        searchWords.forEach(word => {
            let wordGroup = [word];
            
            // แตกหน่อคำพ้องความหมาย (ถ้ามี)
            if (SUBJECT_KNOWLEDGE_BASE[word]) {
                wordGroup = wordGroup.concat(SUBJECT_KNOWLEDGE_BASE[word]);
            }

            // สร้างเงื่อนไข OR สำหรับคำกลุ่มนี้ (หาทั้งในชื่อวิชา, รายละเอียด, ชื่อคน, ชื่อเล่น, และวิชาที่สอนได้)
            const synConditions = wordGroup.map(() => `
                (LOWER(tp.subject) LIKE ? OR 
                 LOWER(tp.description) LIKE ? OR 
                 LOWER(r.name) LIKE ? OR 
                 LOWER(r.lastname) LIKE ? OR 
                 LOWER(tpro.nickname) LIKE ? OR 
                 LOWER(tpro.can_teach_subjects) LIKE ?)
            `).join(' OR ');

            conditions.push(`(${synConditions})`);

            // หยอดพารามิเตอร์ 6 ตัว ต่อ 1 คำ (เพราะหาใน 6 คอลัมน์)
            wordGroup.forEach(syn => {
                const safeSyn = `%${syn}%`;
                sqlParams.push(safeSyn, safeSyn, safeSyn, safeSyn, safeSyn, safeSyn);
            });
        });

        // สร้าง WHERE Clause บังคับให้ต้องเจอทุกคำที่พิมพ์ (AND)
        const likeConditions = conditions.join(' AND ');

        const exactPhrase = q.replace(/'/g, "''").toLowerCase();

        // 3. ค้นหาติวเตอร์ (Tutor Posts) พร้อม Smart Scoring
        const [tutors] = await pool.query(`
            SELECT 
                tp.*, r.name, r.lastname, r.username, tpro.profile_picture_url, tpro.nickname,
                tpro.about_me, tpro.education, tpro.teaching_experience,  
                tpro.can_teach_grades, tpro.can_teach_subjects, tpro.phone, tpro.address,
                -- 🌟 การให้คะแนน (Scoring): บังคับชื่อวิชา หรือ ชื่อติวเตอร์ ให้ขึ้นก่อน
                (CASE 
                    WHEN LOWER(tp.subject) = '${exactPhrase}' THEN 100 
                    WHEN LOWER(tpro.nickname) = '${exactPhrase}' THEN 95 
                    WHEN LOWER(tp.subject) LIKE '${exactPhrase}%' THEN 90 
                    WHEN LOWER(tp.subject) LIKE '%${exactPhrase}%' THEN 80 
                    WHEN LOWER(r.name) LIKE '%${exactPhrase}%' OR LOWER(r.lastname) LIKE '%${exactPhrase}%' THEN 75 
                    WHEN LOWER(tpro.can_teach_subjects) LIKE '%${exactPhrase}%' THEN 60 
                    WHEN LOWER(tp.description) LIKE '%${exactPhrase}%' THEN 40
                    ELSE 10 
                END) AS relevance_score,
                COALESCE(tp.location, tpro.address, 'ไม่ระบุสถานที่') AS location
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            WHERE ${likeConditions}
            GROUP BY tp.tutor_id
            ORDER BY relevance_score DESC, tp.created_at DESC
            LIMIT 20
        `, sqlParams);

        // 4. ค้นหาประกาศสอน (Tutor Posts) คืนค่ากลับไปเหมือนเดิม แต่เรียงลำดับให้ฉลาดขึ้น
        const [posts] = await pool.query(`
            SELECT 
                tp.*, 
                r.name, r.lastname, r.username,
                tpro.profile_picture_url, tpro.nickname,
                (CASE 
                    WHEN LOWER(tp.subject) = '${exactPhrase}' THEN 100 
                    WHEN LOWER(tp.subject) LIKE '${exactPhrase}%' THEN 90 
                    WHEN LOWER(tp.subject) LIKE '%${exactPhrase}%' THEN 80 
                    WHEN LOWER(tp.description) LIKE '%${exactPhrase}%' THEN 40
                    ELSE 10 
                END) AS relevance_score
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            WHERE ${likeConditions}
            ORDER BY relevance_score DESC, tp.created_at DESC
            LIMIT 20
        `, sqlParams);

        // 5. ส่งผลลัพธ์กลับ
        res.json({
            keyword_used: q,
            tutors: tutors.map(t => {
                try {
                    if (typeof t.education === 'string') t.education = JSON.parse(t.education);
                    if (typeof t.teaching_experience === 'string') t.teaching_experience = JSON.parse(t.teaching_experience);
                } catch (e) { }
                return t;
            }),
            posts: posts
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
exports.deleteSearchHistory = async (req, res) => {
    try {
        const pool = req.db;
        const { user_id, keyword } = req.query;

        if (user_id && keyword) {
            await pool.query('DELETE FROM search_history WHERE user_id = ? AND keyword = ?', [user_id, keyword]);
            return res.json({ success: true, message: `Deleted keyword: ${keyword}` });
        }

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

// API สำหรับดึง "วิชายอดฮิต"
exports.getPopularSubjects = async (req, res) => {
    try {
        const pool = req.db;

        const [postSubjects] = await pool.query(`
            SELECT subject, COUNT(*) as count 
            FROM student_posts 
            WHERE is_active = 1 
            GROUP BY subject 
            ORDER BY count DESC 
            LIMIT 6
        `);

        const [searchKeywords] = await pool.query(`
            SELECT keyword as subject, COUNT(*) as count 
            FROM search_history 
            GROUP BY keyword 
            ORDER BY count DESC 
            LIMIT 6
        `);

        const combined = [...postSubjects, ...searchKeywords];
        const uniqueSubjects = {};

        combined.forEach(item => {
            const subj = item.subject.trim();
            if (!uniqueSubjects[subj]) {
                uniqueSubjects[subj] = 0;
            }
            uniqueSubjects[subj] += item.count;
        });

        const sortedSubjects = Object.keys(uniqueSubjects)
            .map(key => ({ title: key, count: uniqueSubjects[key] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8); 

        // Helper เพื่อหาหมวดหมู่
        const getCategory = (text) => {
            const t = text.toLowerCase();
            // ตรวจสอบแบบ Array ป้องกัน Error
            const mathBase = SUBJECT_KNOWLEDGE_BASE['math'] || [];
            const sciBase = SUBJECT_KNOWLEDGE_BASE['sci'] || [];
            const engBase = SUBJECT_KNOWLEDGE_BASE['eng'] || [];
            const progBase = SUBJECT_KNOWLEDGE_BASE['program'] || [];

            if (mathBase.some(k => t.includes(k))) return { icon: 'Calculator', color: 'blue' };
            if (sciBase.some(k => t.includes(k))) return { icon: 'FlaskConical', color: 'emerald' };
            if (engBase.some(k => t.includes(k))) return { icon: 'Languages', color: 'rose' };
            if (progBase.some(k => t.includes(k))) return { icon: 'Laptop', color: 'indigo' };
            return { icon: 'BookOpen', color: 'amber' }; 
        };

        const result = sortedSubjects.map(s => {
            const style = getCategory(s.title);
            return {
                id: s.title,
                name: s.title, 
                count: s.count,
                ...style
            };
        });

        res.json(result);

    } catch (err) {
        console.error("Popular Subjects Error:", err);
        res.status(500).json({ error: 'Failed to fetch popular subjects' });
    }
};