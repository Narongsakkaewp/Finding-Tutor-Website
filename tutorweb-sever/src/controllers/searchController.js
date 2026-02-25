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

        const studentConditions = [];
        const studentSqlParams = [];

        // ลูปตรวจสอบทีละคำ ว่ามีคำเหมือนใน Dictionary ไหม?
        searchWords.forEach(word => {
            let wordGroup = [word];

            // แตกหน่อคำพ้องความหมาย (ถ้ามี)
            if (SUBJECT_KNOWLEDGE_BASE[word]) {
                wordGroup = wordGroup.concat(SUBJECT_KNOWLEDGE_BASE[word]);
            }

            // สร้างเงื่อนไข OR สำหรับคำกลุ่มนี้ของ Tutor
            const synConditions = wordGroup.map(() => `
                (LOWER(tp.subject) LIKE ? OR 
                 LOWER(tp.description) LIKE ? OR 
                 LOWER(r.name) LIKE ? OR 
                 LOWER(r.lastname) LIKE ? OR 
                 LOWER(tpro.nickname) LIKE ? OR 
                 LOWER(tpro.can_teach_subjects) LIKE ?)
            `).join(' OR ');
            conditions.push(`(${synConditions})`);

            // สร้างเงื่อนไข OR สำหรับคำกลุ่มนี้ของ Student
            const studentSynConditions = wordGroup.map(() => `
                (LOWER(sp.subject) LIKE ? OR 
                 LOWER(sp.description) LIKE ? OR 
                 LOWER(r.name) LIKE ? OR 
                 LOWER(r.lastname) LIKE ?)
            `).join(' OR ');
            studentConditions.push(`(${studentSynConditions})`);

            // หยอดพารามิเตอร์
            wordGroup.forEach(syn => {
                const safeSyn = `%${syn}%`;
                sqlParams.push(safeSyn, safeSyn, safeSyn, safeSyn, safeSyn, safeSyn);
                studentSqlParams.push(safeSyn, safeSyn, safeSyn, safeSyn);
            });
        });

        // สร้าง WHERE Clause บังคับให้ต้องเจอทุกคำที่พิมพ์ (AND)
        const likeConditions = conditions.join(' AND ');
        const studentLikeConditions = studentConditions.join(' AND ');

        const exactPhrase = q.replace(/'/g, "''").toLowerCase();

        // 3. ค้นหาติวเตอร์ (Tutor Posts) พร้อม Smart Scoring
        const [tutors] = await pool.query(`
            SELECT 
                tp.tutor_id, r.name, r.lastname, r.username, tpro.profile_picture_url, tpro.nickname,
                tpro.about_me, tpro.education, tpro.teaching_experience,  
                tpro.can_teach_grades, tpro.can_teach_subjects, tpro.phone, tpro.address,
                COALESCE(rv.avg_rating, 0) AS avg_rating,
                COALESCE(rv.review_count, 0) AS review_count,
                MAX(CASE 
                    WHEN LOWER(tp.subject) = '${exactPhrase}' THEN 100 
                    WHEN LOWER(tpro.nickname) = '${exactPhrase}' THEN 95 
                    WHEN LOWER(tp.subject) LIKE '${exactPhrase}%' THEN 90 
                    WHEN LOWER(tp.subject) LIKE '%${exactPhrase}%' THEN 80 
                    WHEN LOWER(r.name) LIKE '%${exactPhrase}%' OR LOWER(r.lastname) LIKE '%${exactPhrase}%' THEN 75 
                    WHEN LOWER(tpro.can_teach_subjects) LIKE '%${exactPhrase}%' THEN 60 
                    WHEN LOWER(tp.description) LIKE '%${exactPhrase}%' THEN 40
                    ELSE 10 
                END) AS relevance_score,
                MAX(tp.created_at) AS latest_post,
                COALESCE(tpro.address, 'ไม่ระบุสถานที่') AS tutor_location
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            LEFT JOIN (SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews GROUP BY tutor_id) rv ON tp.tutor_id = rv.tutor_id
            WHERE ${likeConditions}
            GROUP BY tp.tutor_id, r.name, r.lastname, r.username, tpro.profile_picture_url, tpro.nickname, tpro.about_me, tpro.education, tpro.teaching_experience, tpro.can_teach_grades, tpro.can_teach_subjects, tpro.phone, tpro.address, rv.avg_rating, rv.review_count
            ORDER BY relevance_score DESC, latest_post DESC
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

        // 4.. ค้นหานักเรียน (Student Posts) 
        const [students] = await pool.query(`
            SELECT 
                sp.*, 
                r.name, r.lastname, r.username,
                spro.profile_picture_url,
                (CASE 
                    WHEN LOWER(sp.subject) = '${exactPhrase}' THEN 100 
                    WHEN LOWER(sp.subject) LIKE '${exactPhrase}%' THEN 90 
                    WHEN LOWER(sp.subject) LIKE '%${exactPhrase}%' THEN 80 
                    WHEN LOWER(sp.description) LIKE '%${exactPhrase}%' THEN 40
                    ELSE 10 
                END) AS relevance_score,
                sp.location
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            WHERE ${studentLikeConditions}
            ORDER BY relevance_score DESC, sp.created_at DESC
            LIMIT 20
        `, studentSqlParams);

        // 5. ส่งผลลัพธ์กลับ
        res.json({
            keyword_used: q,
            tutors: tutors.map(t => {
                let education = [];
                let experience = [];
                try {
                    education = typeof t.education === 'string' ? JSON.parse(t.education) : (t.education || []);
                    experience = typeof t.teaching_experience === 'string' ? JSON.parse(t.teaching_experience) : (t.teaching_experience || []);
                } catch (e) { }
                return {
                    ...t,
                    id: t.tutor_id,
                    dbTutorId: t.tutor_id,
                    name: `${t.name || ''} ${t.lastname || ''}`.trim(),
                    nickname: t.nickname,
                    image: t.profile_picture_url || '/../blank_avatar.jpg',
                    city: t.tutor_location || t.address || 'ไม่ระบุสถานที่',
                    rating: Number(t.avg_rating || 0),
                    reviews: Number(t.review_count || 0),
                    subject: t.can_teach_subjects || 'ไม่ระบุวิชา',
                    education: education,
                    teaching_experience: experience
                };
            }),
            posts: posts.map(p => ({
                ...p,
                _id: p.tutor_post_id,
                content: p.description,
                user: {
                    first_name: p.name,
                    last_name: p.lastname,
                    profile_image: p.profile_picture_url || '/../blank_avatar.jpg',
                    username: p.username
                },
                meta: {
                    target_student_level: p.target_student_level || 'ทั่วไป',
                    location: p.location || 'ออนไลน์',
                    teaching_days: p.teaching_days || '-',
                    teaching_time: p.teaching_time || '-'
                }
            })),
            students: students.map(s => ({
                ...s,
                id: s.student_post_id,
                user: {
                    first_name: s.name,
                    last_name: s.lastname,
                    profile_image: s.profile_picture_url || '/../blank_avatar.jpg',
                    username: s.username
                }
            }))
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