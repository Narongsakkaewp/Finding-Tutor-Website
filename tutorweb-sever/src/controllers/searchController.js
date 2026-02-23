// tutorweb-server/src/controllers/searchController.js
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
    'bio': ['ชีว', 'sci'],
    'ชีว': ['bio', 'biology', 'ชีววิทยา', 'sci']
};

// ฟังก์ชันขยายคำค้นหา
const expandKeywords = (text) => {
    if (!text) return [];
    const lowerText = text.toLowerCase().trim();
    let keywords = [lowerText];

    // ตรวจสอบว่าคำค้นหา "ตรงกับ" Key ไหนแบบเป๊ะๆ หรือไม่
    if (SUBJECT_KNOWLEDGE_BASE[lowerText]) {
        keywords = [...keywords, ...SUBJECT_KNOWLEDGE_BASE[lowerText]];
    }

    // หรือถ้าอยากให้ครอบคลุม "ชีววิทยา" -> "ชีว"
    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        if (key === lowerText || (lowerText.length > 2 && key.includes(lowerText))) {
            keywords = Array.from(new Set([...keywords, ...SUBJECT_KNOWLEDGE_BASE[key]]));
        }
    });

    return keywords;
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
        // ✅ UPDATE: เพิ่มการค้นหาชื่อ (r.name), นามสกุล (r.lastname) และชื่อเล่น (tpro.nickname) และวิชาที่สอนได้ (tpro.can_teach_subjects)
        const likeConditions = searchKeywords.map(() => `
            (tp.subject LIKE ? OR tp.description LIKE ? OR r.name LIKE ? OR r.lastname LIKE ? OR tpro.nickname LIKE ? OR tpro.can_teach_subjects LIKE ?)
        `).join(' OR ');

        // เตรียม Params (ต้องเบิ้ล 6 ครั้งต่อ 1 คำ)
        const sqlParams = [];
        searchKeywords.forEach(kw => {
            const likeKw = `%${kw}%`;
            sqlParams.push(likeKw, likeKw, likeKw, likeKw, likeKw, likeKw);
        });

        // 3. ค้นหาติวเตอร์ (Tutor Posts)
        const [tutors] = await pool.query(`
            SELECT 
                tp.*, r.name, r.lastname, r.username, tpro.profile_picture_url, tpro.nickname,
                tpro.about_me, tpro.education, tpro.teaching_experience,  
                tpro.can_teach_grades, tpro.can_teach_subjects, tpro.phone, tpro.address,
                -- ให้คะแนนความเกี่ยวข้อง
                (CASE 
                    WHEN tp.subject LIKE ? THEN 100  -- ตรงเป๊ะกับที่พิมพ์มา
                    WHEN tpro.nickname LIKE ? THEN 90 -- ตรงกับชื่อเล่น
                    WHEN r.name LIKE ? THEN 80       -- ตรงกับชื่อจริง
                    WHEN tp.subject LIKE ? THEN 50   -- มีคำค้นหาอยู่ในชื่อวิชา
                    WHEN tpro.can_teach_subjects LIKE ? THEN 40 -- มีในวิชาที่สอนได้
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
        `, [q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, ...sqlParams]);

        // 4. ค้นหาประกาศสอน (Tutor Posts - Class Announcements)
        const [posts] = await pool.query(`
            SELECT 
                tp.*, 
                r.name, r.lastname, r.username,
                tpro.profile_picture_url, tpro.nickname
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            WHERE ${likeConditions}
            ORDER BY tp.created_at DESC
            LIMIT 20
        `, sqlParams);

        // 5. ส่งผลลัพธ์กลับ
        res.json({
            keyword_used: q,
            expanded_keywords: searchKeywords, // บอก Frontend ว่าเราแอบขยายคำเป็นอะไรบ้าง (เผื่ออยากโชว์)
            tutors: tutors.map(t => {
                // Parse JSON fields safely
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

// API สำหรับดึง "วิชายอดฮิต" (จากโพสต์นักเรียน + คำค้นหา)
exports.getPopularSubjects = async (req, res) => {
    try {
        const pool = req.db;

        // 1. ดึงวิชาที่มีการโพสต์หาครูเยอะที่สุด
        const [postSubjects] = await pool.query(`
            SELECT subject, COUNT(*) as count 
            FROM student_posts 
            WHERE is_active = 1 
            GROUP BY subject 
            ORDER BY count DESC 
            LIMIT 6
        `);

        // 2. ดึงคำค้นหายอดฮิต
        const [searchKeywords] = await pool.query(`
            SELECT keyword as subject, COUNT(*) as count 
            FROM search_history 
            GROUP BY keyword 
            ORDER BY count DESC 
            LIMIT 6
        `);

        // 3. รวมและจัดอันดับใหม่ (Simple Merge)
        const combined = [...postSubjects, ...searchKeywords];
        const uniqueSubjects = {};

        combined.forEach(item => {
            const subj = item.subject.trim();
            if (!uniqueSubjects[subj]) {
                uniqueSubjects[subj] = 0;
            }
            uniqueSubjects[subj] += item.count;
        });

        // Convert back to array & Sort
        const sortedSubjects = Object.keys(uniqueSubjects)
            .map(key => ({ title: key, count: uniqueSubjects[key] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8); // เอาแค่ 8 อันดับแรก

        // ✅ Map ข้อมูลสำหรับแสดงผล (ใส่รูป/ไอคอนตาม Keyword)
        // Helper เพื่อหาหมวดหมู่
        const getCategory = (text) => {
            const t = text.toLowerCase();
            if (SUBJECT_KNOWLEDGE_BASE['math'].some(k => t.includes(k))) return { icon: 'Calculator', color: 'blue' };
            if (SUBJECT_KNOWLEDGE_BASE['sci'].some(k => t.includes(k))) return { icon: 'FlaskConical', color: 'emerald' };
            if (SUBJECT_KNOWLEDGE_BASE['eng'].some(k => t.includes(k))) return { icon: 'Languages', color: 'rose' };
            if (SUBJECT_KNOWLEDGE_BASE['program'].some(k => t.includes(k))) return { icon: 'Laptop', color: 'indigo' };
            return { icon: 'BookOpen', color: 'amber' }; // Default
        };

        const result = sortedSubjects.map(s => {
            const style = getCategory(s.title);
            return {
                id: s.title,
                name: s.title, // ชื่อวิชา
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