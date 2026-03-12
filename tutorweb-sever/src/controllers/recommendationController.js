// tutorweb-sever/src/controllers/recommendationController.js
const geolib = require('geolib');

// --- 🧠 1. Knowledge Base ---
const SUBJECT_KNOWLEDGE_BASE = {
    'program': ['code', 'python', 'java', 'c++', 'html', 'css', 'react', 'node', 'sql', 'คอมพิวเตอร์'],
    'code': ['program', 'python', 'java', 'script', 'web', 'app', 'dev'],
    'คอม': ['com', 'it', 'program', 'excel', 'word', 'powerpoint'],
    'คณิต': ['math', 'cal', 'เลข', 'algebra', 'stat'],
    'math': ['คณิต', 'cal', 'เลข'],
    'phy': ['ฟิสิกส์', 'mechanics', 'กลศาสตร์', 'ไฟฟ้า'],
    'eng': ['อังกฤษ', 'english', 'toefl', 'ielts', 'toeic', 'conversation'],
    'jap': ['ญี่ปุ่น', 'japanese', 'n5', 'n4', 'n3'],
    'จีน': ['chinese', 'hsk'],
    'sci': ['วิทยาศาสตร์', 'วิทย์พื้นฐาน', 'วิทย์', 'bio', 'chem', 'phy', 'ดาราศาสตร์'],
    'chem': ['เคมี', 'sci'],
    'bio': ['ชีว', 'sci']
};

// Function to expand search keywords
const expandKeywords = (text) => {
    if (!text) return [];
    const lowerText = text.toLowerCase().trim();
    let keywords = new Set([lowerText]);

    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        const values = SUBJECT_KNOWLEDGE_BASE[key];

        // 1. ตรวจสอบว่าคำค้นหา "ตรงกับ" Key หรือไม่ (Exact Match)
        if (lowerText === key || values.includes(lowerText)) {
            // เพิ่มคำในกลุ่มเดียวกันเข้าไป
            keywords.add(key);
            values.forEach(v => keywords.add(v));
        }
    });
    return Array.from(keywords);
};

// Helper: Escape Regex characters
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// --- ⚖️ 2. Scoring Weights ---
const WEIGHTS = {
    SUBJECT_EXACT: 80,
    SUBJECT_PARTIAL: 30,
    SUBJECT_RELATED: 20,
    GRADE: 20,
    BUDGET: 15,
    LOCATION: 25
};

// --- 🧠 Shared Matching Engine (ใช้ร่วมกันทั้ง นร. และ ติวเตอร์ เพื่อความแม่นยำ) ---
const calculateSmartScore = (keyword, targetSubject, targetPrice, targetLocation, reqBudget, reqLocation) => {
    let score = 0;
    const cleanKeyword = (keyword || "").trim().toLowerCase();
    const cleanTarget = (targetSubject || "").trim().toLowerCase();

    if (cleanKeyword && cleanTarget) {
        const escapedKw = escapeRegExp(cleanKeyword);

        // 1. Subject Score (เน้นความแม่นยำ)
        if (cleanKeyword === cleanTarget) {
            score += WEIGHTS.SUBJECT_EXACT + 20; // ตรงเป๊ะ 100%
        }
        else if (new RegExp(`(?:^|\\s)${escapedKw}(?:$|\\s)`, 'i').test(cleanTarget)) {
            score += WEIGHTS.SUBJECT_EXACT; // ตรงแบบเต็มคำ (Word Boundary)
        }
        else if (cleanTarget.includes(cleanKeyword)) {
            score += WEIGHTS.SUBJECT_PARTIAL; // เป็นส่วนประกอบ (เช่น Java ใน JavaScript)
        }
        else {
            const expanded = expandKeywords(cleanKeyword);
            if (expanded.some(kw => cleanTarget === kw)) {
                score += WEIGHTS.SUBJECT_RELATED;
            } else if (expanded.some(kw => cleanTarget.includes(kw))) {
                score += (WEIGHTS.SUBJECT_RELATED / 2);
            }
        }
    }

    // 2. Budget Score
    const price = Number(targetPrice) || 0;
    const budget = Number(reqBudget) || 0;
    if (price > 0 && budget > 0) {
        if (price <= budget * 1.2 && price >= budget * 0.5) score += WEIGHTS.BUDGET;
    }

    // 3. Location Score
    if (reqLocation && targetLocation) {
        if (targetLocation.includes(reqLocation) || reqLocation.includes(targetLocation)) {
            score += WEIGHTS.LOCATION;
        }
    }

    return score;
};


// --- 🕒 3. Expiry Checker ---
const calculateIsExpired = (post) => {
    if (!post) return false;

    // 1. ตรวจสอบ teaching_days (ถ้าเป็นวันที่/เวลาที่เจาะจง)
    // ถ้ารูปแบบเป๊ะๆ เช่น YYYY-MM-DD
    const teachingDays = post.teaching_days || post.preferred_days || '';
    if (teachingDays.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const targetDate = new Date(teachingDays);
        const today = new Date();
        // เทียบแค่วันที่ ไม่รวมเวลา
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        if (targetDate < today) {
            return true;
        }
    }

    // 2. ถ้าไม่ได้ระบุวันชัดเจน ใช้ fallback 30 วันนับจาก created_at
    if (post.created_at) {
        const createdAt = new Date(post.created_at);
        const today = new Date();
        const diffTime = Math.abs(today - createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
            return true;
        }
    }

    return false;
};

// --- 🚀 Exports ---

// 🌟 1. Get Recommended Tutors (For Students) - อัปเกรดเป็น Hybrid Weighted System V4 (เพิ่มประวัติการตั้งโพสต์)
exports.getRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = Number(req.query.user_id) || 0;

        let rows = [];
        let basedOnKeywords = [];

        if (userId === 0) {
            return getLatestTutorPostsFallback(pool, res, userId);
        }

        const keywordWeights = {};

        // Helper: ฟังก์ชันเพิ่มคะแนนเฉพาะ "คำศัพท์วิชา" (เวอร์ชันบดคำละเอียด)
        const addWeight = (keyword, score) => {
            if (!keyword) return;
            const rawWords = keyword.split(/[\s,\-\/]+/);
            rawWords.forEach(word => {
                const terms = expandKeywords(word);
                terms.forEach(t => {
                    const k = t.toLowerCase().trim();
                    const excluded = ['ประถมศึกษา', 'มัธยมต้น', 'มัธยมปลาย', 'ปริญญาตรี', 'บุคคลทั่วไป', 'ทั่วไป', 'วิชา', 'เรียน', 'ติว'];
                    if (k.length > 1 && !excluded.includes(k)) {
                        keywordWeights[k] = (keywordWeights[k] || 0) + score;
                    }
                });
            });
        };

        // 🎯 1. ดึงข้อมูลจาก Profile นักเรียน
        let userGrade = "";
        const [profile] = await pool.query(
            'SELECT grade_level, faculty, major, about, interested_subjects FROM student_profiles WHERE user_id = ?',
            [userId]
        );

        if (profile.length > 0) {
            const p = profile[0];
            userGrade = p.grade_level || "";

            if (p.faculty) addWeight(p.faculty, 4);
            if (p.major) addWeight(p.major, 5);
            if (p.interested_subjects) p.interested_subjects.split(',').forEach(sub => addWeight(sub, 10));
            if (p.about) p.about.split(/[\s,]+/).forEach(word => addWeight(word, 1));
        }

        // =========================================================
        // 🌟 1.5 [NEW] ดึง "ชื่อวิชา" จากโพสต์ที่ตัวเองเคยสร้าง (My Posts) 
        // =========================================================
        const [myPosts] = await pool.query(
            `SELECT subject FROM student_posts WHERE student_id = ? AND is_active = 1`,
            [userId]
        );
        // ถ้าเคยตั้งโพสต์วิชาไหน ให้คะแนนหนักมากๆ (15 คะแนน) เพราะคือความต้องการปัจจุบันสุดๆ
        myPosts.forEach(post => addWeight(post.subject, 15));
        // =========================================================

        // 🔍 2. ดึงประวัติการค้นหา
        const [searches] = await pool.query(
            `SELECT keyword, COUNT(*) as freq 
             FROM search_history 
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY keyword`, [userId]
        );
        searches.forEach(s => addWeight(s.keyword, s.freq * 3));

        // 👆 3. ดึงประวัติการคลิกดู (Interactions)
        try {
            const [interactions] = await pool.query(
                `SELECT subject_keyword, COUNT(*) as clicks 
                 FROM user_interactions 
                 WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                 GROUP BY subject_keyword`, [userId]
            );
            interactions.forEach(i => addWeight(i.subject_keyword, i.clicks * 2));
        } catch (e) { }

        // --- ส่วนที่เหลือเหมือนเดิมทั้งหมด (เรียงคะแนน, Query, และ ส่งกลับ) ---
        const topKeywords = Object.entries(keywordWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        if (topKeywords.length === 0) {
            return getLatestTutorPostsFallback(pool, res, userId);
        }

        basedOnKeywords = topKeywords.map(k => k[0]);

        // 🚀 4. ดึง Candidate โพสต์ติวเตอร์ทั้งหมด แล้วให้คะแนน
        const [candidates] = await pool.query(`
            SELECT tp.*, r.name, r.lastname, r.email, r.username, 
                   tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                   tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio,
                   COALESCE(rv.avg_rating, 0) AS avg_rating,
                   COALESCE(rv.review_count, 0) AS review_count,
                   COALESCE(fvc.c,0) AS fav_count,
                   CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
                   (SELECT COUNT(*) FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND status='approved') AS join_count,
                   (SELECT status FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND user_id = ?) AS my_join_status
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            LEFT JOIN (SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews GROUP BY tutor_id) rv ON tp.tutor_id = rv.tutor_id
            LEFT JOIN (SELECT post_id, COUNT(*) as c FROM posts_favorites WHERE post_type='tutor' GROUP BY post_id) fvc ON fvc.post_id = tp.tutor_post_id
            LEFT JOIN posts_favorites fme ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
            WHERE COALESCE(tp.is_active, 1) = 1
            ORDER BY tp.created_at DESC
            LIMIT 150
        `, [userId, userId]);

        // 🧠 คำนวณคะแนน Relevance Score ของแต่ละโพสต์อย่างฉลาด
        candidates.forEach(tutor => {
            let score = 0;
            const subj = (tutor.subject || "").toLowerCase();
            const desc = (tutor.description || "").toLowerCase();
            const targetGrades = (tutor.target_student_level || "");

            // ⛔ 1. กรองระดับชั้น (ถ้าไม่ตรง ข้ามให้คะแนนติดลบเลย)
            if (userGrade && targetGrades && !targetGrades.includes(userGrade) && !targetGrades.includes("บุคคลทั่วไป")) {
                tutor.relevance_score = -1000;
                return;
            }

            // ✅ 2. เช็คคะแนน "วิชา" 
            topKeywords.forEach(([kw, weight]) => {
                if (subj.includes(kw)) {
                    score += (weight * 3);
                } else if (desc.includes(kw)) {
                    score += weight;
                }
            });

            // ✅ 3. โบนัสความตรงเป้าหมาย (ให้เฉพาะถ้าวิชาตรงกันเท่านั้น)
            if (score > 0 && userGrade && targetGrades.includes(userGrade)) {
                score += 5;
            }

            tutor.relevance_score = score;
        });

        // 5. กรองอันที่ได้คะแนนความสนใจ > 0 ขึ้นมา
        rows = candidates
            .filter(t => t.relevance_score > 0)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 12);

        // 6. ถ้าหาโพสต์ตรงใจไม่ครบ 12 อัน ให้สุ่มโพสต์ล่าสุด "ที่ระดับชั้นตรง" มาเติม
        if (rows.length < 12) {
            let fillers = candidates
                .filter(t => !rows.find(r => r.tutor_post_id === t.tutor_post_id) && t.relevance_score > -1000)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 12 - rows.length);
            rows = [...rows, ...fillers];
        }

        // 7. Map ส่งกลับ
        const items = rows.map(r => ({
            ...r,
            id: r.tutor_post_id,
            _id: r.tutor_post_id,
            post_type: 'tutor',
            user: {
                first_name: r.name,
                last_name: r.lastname,
                profile_image: r.profile_picture_url || '/../blank_avatar.jpg',
                username: r.username
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
            rating: Number(r.avg_rating || 0),
            reviews: Number(r.review_count || 0),
            is_expired: calculateIsExpired(r),
            joined: r.my_join_status === 'approved' || r.my_join_status === 'pending',
            pending_me: r.my_join_status === 'pending',
            join_count: Number(r.join_count || 0),
            relevance_score: r.relevance_score || 0
        }));

        res.json({
            success: true,
            based_on: basedOnKeywords.length > 0 ? `วิเคราะห์จากความสนใจของคุณ: ${basedOnKeywords.join(', ')}` : "โพสต์แนะนำในระดับชั้นของคุณ",
            items: items
        });

    } catch (err) {
        console.error("Advanced Recommendation Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ฟังก์ชัน Fallback แยกมาเพื่อให้โค้ดอ่านง่าย
async function getLatestTutorPostsFallback(pool, res) {
    try {
        const [latest] = await pool.query(`
            SELECT tp.*, r.name, r.lastname, r.username, tpro.profile_picture_url,
                   COALESCE(rv.avg_rating, 0) AS avg_rating,
                   COALESCE(rv.review_count, 0) AS review_count,
                   (SELECT COUNT(*) FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND status='approved') AS join_count
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            LEFT JOIN (SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews GROUP BY tutor_id) rv ON tp.tutor_id = rv.tutor_id
            WHERE COALESCE(tp.is_active, 1) = 1
            ORDER BY tp.created_at DESC 
            LIMIT 12
        `);

        const items = latest.map(r => ({
            ...r,
            id: r.tutor_post_id,
            _id: r.tutor_post_id,
            post_type: 'tutor',
            user: {
                first_name: r.name,
                last_name: r.lastname,
                profile_image: r.profile_picture_url || '/../blank_avatar.jpg',
                username: r.username
            },
            meta: {
                target_student_level: r.target_student_level || 'ไม่ระบุ',
                teaching_days: r.teaching_days,
                teaching_time: r.teaching_time,
                location: r.location,
                price: Number(r.price || 0),
                contact_info: r.contact_info
            },
            rating: Number(r.avg_rating || 0),
            reviews: Number(r.review_count || 0),
            join_count: Number(r.join_count || 0),
            is_expired: calculateIsExpired(r)
        }));

        res.json({
            success: true,
            based_on: "โพสต์แนะนำในระดับชั้นของคุณ",
            items: items
        });
    } catch (e) {
        res.status(500).json({ error: 'Fallback Error' });
    }
}

// 2. Get Student Requests (For Tutors) - 🌟 เพิ่ม Smart Matching
exports.getStudentRequestsForTutor = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        if (!userId) return res.json({ items: [], based_on: "" });

        // 1. รวบรวม Skill ของ Tutor
        let tutorSkills = [];
        let tutorRate = 0;
        let tutorAddr = "";

        const [profile] = await pool.query('SELECT can_teach_subjects, address FROM tutor_profiles WHERE user_id = ?', [userId]);
        if (profile.length) {
            tutorRate = 0; // Removed hourly_rate from profile
            tutorAddr = profile[0].address || "";
            if (profile[0].can_teach_subjects) {
                tutorSkills.push(...profile[0].can_teach_subjects.split(',').map(s => s.trim()));
            }
        }

        const [myPosts] = await pool.query('SELECT subject FROM tutor_posts WHERE tutor_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        myPosts.forEach(p => tutorSkills.push(p.subject));

        // ตัดคำซ้ำ
        tutorSkills = [...new Set(tutorSkills.filter(s => s))];

        if (tutorSkills.length === 0) {
            // Fallback
            const [latest] = await pool.query(`SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
            return res.json({ items: latest, based_on: "โพสต์ล่าสุด (กรุณากรอกวิชาที่สอน)" });
        }

        // 2. ดึง Student Posts มาเทียบ พร้อมชื่อติวเตอร์ที่ถูกอนุมัติ
        const [candidates] = await pool.query(`
            SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url,
                   (SELECT COUNT(*) FROM student_post_offers WHERE student_post_id = sp.student_post_id AND status = 'approved') AS has_tutor_count,
                   (SELECT t_reg.name FROM student_post_offers o JOIN register t_reg ON o.tutor_id = t_reg.user_id WHERE o.student_post_id = sp.student_post_id AND o.status = 'approved' LIMIT 1) AS approved_tutor_name
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            ORDER BY sp.created_at DESC LIMIT 100
        `);

        // 3. Scoring (ใช้ Smart Logic แบบเดียวกัน)
        const scoredPosts = candidates.map(post => {
            let maxScore = 0;

            tutorSkills.forEach(skill => {
                let score = calculateSmartScore(skill, post.subject, post.budget, post.location, tutorRate, tutorAddr);
                if (score > maxScore) maxScore = score;
            });

            return {
                ...post,
                relevance_score: maxScore,
                is_expired: calculateIsExpired(post),
                has_tutor: Number(post.has_tutor_count) > 0,
                approved_tutor_name: post.approved_tutor_name || null
            };
        });

        const recommended = scoredPosts
            .filter(p => p.relevance_score > 20)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 30);

        if (recommended.length === 0) {
            const [fallback] = await pool.query(`SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
            return res.json({ items: fallback, based_on: "โพสต์ล่าสุด (ไม่พบที่ตรงกับวิชาที่สอน)" });
        }

        res.json({
            items: recommended,
            based_on: `วิชาที่คุณถนัด: ${tutorSkills.slice(0, 3).join(", ")}`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.getRecommendedCourses = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const pool = req.db;
        let gradeLevel = "";
        if (userId) {
            const [users] = await pool.query("SELECT grade_level FROM register WHERE user_id = ?", [userId]);
            if (users.length) gradeLevel = users[0].grade_level;
        }
        let sql = `
          SELECT sp.student_post_id, sp.student_id, sp.subject, sp.description, 
                 sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, 
                 sp.budget, sp.grade_level, sp.created_at,
                 r.first_name, r.last_name, r.profile_picture_url,
                 (SELECT COUNT(*) FROM student_post_joins WHERE student_post_id = sp.student_post_id) AS join_count,
                 (SELECT COUNT(*) FROM student_post_offers WHERE student_post_id = sp.student_post_id AND status = 'approved') AS has_tutor,
                 (SELECT t_reg.name FROM student_post_offers o JOIN register t_reg ON o.tutor_id = t_reg.user_id WHERE o.student_post_id = sp.student_post_id AND o.status = 'approved' LIMIT 1) AS approved_tutor_name
          FROM student_posts sp
          JOIN register r ON sp.student_id = r.user_id
          WHERE 1=1
        `;
        const params = [];
        if (userId) { sql += ` AND sp.student_id != ? `; params.push(userId); }
        if (gradeLevel) { sql += ` AND (sp.grade_level = ? OR sp.grade_level IS NULL OR sp.grade_level = '')`; params.push(gradeLevel); }
        sql += ` ORDER BY sp.created_at DESC LIMIT 12`;
        const [posts] = await pool.query(sql, params);
        const formatted = posts.map(p => ({
            id: p.student_post_id,
            user: { first_name: p.first_name, last_name: p.last_name, profile_image: p.profile_picture_url || "/../blank_avatar.jpg" },
            subject: p.subject, description: p.description, location: p.location, budget: p.budget,
            preferred_days: p.preferred_days, preferred_time: p.preferred_time,
            join_count: Number(p.join_count || 0),
            has_tutor: Number(p.has_tutor) > 0,
            approved_tutor_name: p.approved_tutor_name || null,
            createdAt: p.created_at, post_type: 'student',
            is_expired: calculateIsExpired(p)
        }));
        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getStudyBuddyRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;
        if (!userId) return res.json([]);
        const [myProfile] = await pool.query('SELECT address, grade_level, institution FROM student_profiles WHERE user_id = ?', [userId]);
        const [myPosts] = await pool.query('SELECT subject, location FROM student_posts WHERE student_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        const myLocation = myProfile[0]?.address || "";
        const myInterests = myPosts.map(p => p.subject);
        if (myInterests.length === 0 && !myLocation) {
            const [randomFriends] = await pool.query(`SELECT r.user_id, r.name, r.lastname, sp.profile_picture_url, sp.grade_level, sp.institution FROM register r JOIN student_profiles sp ON r.user_id = sp.user_id WHERE r.user_id != ? AND r.type = 'student' ORDER BY r.created_at DESC LIMIT 5`, [userId]);
            return res.json(randomFriends);
        }
        let searchKeywords = [];
        myInterests.forEach(subj => { searchKeywords.push(...expandKeywords(subj)); });
        searchKeywords = [...new Set(searchKeywords)];
        const [candidates] = await pool.query(`SELECT r.user_id, r.name, r.lastname, sp.profile_picture_url, sp.grade_level, sp.institution, sp.address, (SELECT GROUP_CONCAT(subject SEPARATOR ', ') FROM student_posts WHERE student_id = r.user_id ORDER BY created_at DESC LIMIT 3) as looking_for FROM register r JOIN student_profiles sp ON r.user_id = sp.user_id WHERE r.user_id != ? AND r.type = 'student' LIMIT 100`, [userId]);
        const scoredFriends = candidates.map(friend => {
            let score = 0;
            const friendLookingFor = (friend.looking_for || "").toLowerCase();
            const friendLocation = (friend.address || "").toLowerCase();
            const isSubjectMatch = searchKeywords.some(kw => friendLookingFor.includes(kw));
            if (isSubjectMatch) score += 50;
            if (myLocation && friendLocation) { if (friendLocation.includes(myLocation) || myLocation.includes(friendLocation)) score += 30; }
            if (myProfile[0]?.institution && friend.institution) { if (friend.institution === myProfile[0].institution) score += 20; }
            return { ...friend, match_score: score };
        });

        const buddies = scoredFriends.filter(f => f.match_score > 0).sort((a, b) => b.match_score - a.match_score).slice(0, 5);
        res.json(buddies);
    } catch (err) {
        console.error("Study Buddy Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- 🔥 3. Get Trending Subjects (Dynamic Stats) ---
exports.getTrendingSubjects = async (req, res) => {
    try {
        const pool = req.db;

        // 1. Fetch data sources
        const [searches] = await pool.query(`
            SELECT keyword, COUNT(*) as count 
            FROM search_history 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) 
            GROUP BY keyword
        `);

        const [studentPosts] = await pool.query(`
            SELECT subject, COUNT(*) as count 
            FROM student_posts 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) 
            GROUP BY subject
        `);

        const normalizeMap = {
            'eng': 'ภาษาอังกฤษ', 'english': 'ภาษาอังกฤษ', 'อังกฤษ': 'ภาษาอังกฤษ',
            'math': 'คณิตศาสตร์', 'maths': 'คณิตศาสตร์', 'mathematics': 'คณิตศาสตร์', 'คณิต': 'คณิตศาสตร์',
            'phy': 'ฟิสิกส์', 'physics': 'ฟิสิกส์', 'ฟิสิก': 'ฟิสิกส์',
            'chem': 'เคมี', 'chemistry': 'เคมี',
            'bio': 'ชีววิทยา', 'biology': 'ชีววิทยา', 'ชีวะ': 'ชีววิทยา',
            'sci': 'วิทยาศาสตร์', 'science': 'วิทยาศาสตร์', 'วิทย์': 'วิทยาศาสตร์',
            'prog': 'เขียนโปรแกรม', 'program': 'เขียนโปรแกรม', 'programming': 'เขียนโปรแกรม', 'code': 'เขียนโปรแกรม', 'coding': 'เขียนโปรแกรม', 'คอม': 'คอมพิวเตอร์', 'computer': 'คอมพิวเตอร์',
            'social': 'สังคมศึกษา', 'soc': 'สังคมศึกษา', 'สังคม': 'สังคมศึกษา',
            'thai': 'ภาษาไทย', 'th': 'ภาษาไทย', 'ไทย': 'ภาษาไทย'
        };

        const scores = {};

        const processTerm = (rawTerm, count, weight) => {
            if (!rawTerm) return;
            // Clean string
            let clean = rawTerm.trim().toLowerCase().replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s]/g, '');
            if (clean.length < 2) return;

            // Check map
            let key = normalizeMap[clean] || clean;

            if (!scores[key]) scores[key] = 0;
            scores[key] += (count * weight);
        };

        searches.forEach(s => processTerm(s.keyword, s.count, 1.0));
        studentPosts.forEach(s => processTerm(s.subject, s.count, 3.0));

        // Convert to array
        let trending = Object.entries(scores)
            .map(([key, score]) => {
                let title = key.charAt(0).toUpperCase() + key.slice(1);
                return {
                    key: key,
                    title: title,
                    score: score,
                    tutorCount: Math.ceil(score)
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

        res.json(trending);

    } catch (err) {
        console.error("Trending Error:", err);
        res.status(500).json({ error: err.message });
    }
};