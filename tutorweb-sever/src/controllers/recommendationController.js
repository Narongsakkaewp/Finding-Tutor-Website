// tutorweb-server/src/controllers/recommendationController.js
const geolib = require('geolib');

// ==========================================
// 🧠 1. KNOWLEDGE BASE & DICTIONARY
// ==========================================
const SUBJECT_KNOWLEDGE_BASE = {
    'เว็บ': ['web', 'website', 'เขียนเว็บ', 'สร้างเว็บ', 'พัฒนาเว็บ', 'html', 'css', 'react', 'node', 'frontend', 'backend', 'เว็บไซต์'],
    'web': ['เว็บ', 'website', 'เขียนเว็บ', 'สร้างเว็บ', 'html', 'css', 'javascript'],
    'react': ['web', 'frontend', 'code', 'program', 'javascript', 'js'],
    'js': ['javascript', 'web', 'react', 'node'],
    'program': ['code', 'python', 'java', 'oop', 'c++', 'html', 'css', 'react', 'node', 'sql', 'คอมพิวเตอร์', 'เขียนโปรแกรม', 'javascript', 'typescript', 'backend', 'frontend', 'fullstack'],
    'เขียนโปรแกรม': ['python', 'java', 'oop', 'c++', 'html', 'css', 'react', 'node', 'sql', 'program', 'code'],
    'code': ['program', 'python', 'java', 'oop', 'script', 'web', 'app', 'dev', 'coding', 'algorithms', 'data structures'],
    'คอม': ['com', 'it', 'program', 'excel', 'word', 'powerpoint', 'office', 'computer science'],
    'คณิต': ['math', 'cal', 'เลข', 'algebra', 'stat', 'trigonometry', 'calculus', 'แคลคูลัส', 'คณิตศาสตร์'],
    'math': ['คณิต', 'cal', 'เลข', 'algebra', 'calculus', 'statistics', 'discrete'],
    'phy': ['ฟิสิกส์', 'mechanics', 'กลศาสตร์', 'ไฟฟ้า', 'physics', 'astronomy'],
    'eng': ['อังกฤษ', 'english', 'toefl', 'ielts', 'toeic', 'conversation', 'grammar', 'writing', 'speaking', 'ภาษาอังกฤษ'],
    'jap': ['ญี่ปุ่น', 'japanese', 'n5', 'n4', 'n3', 'n2', 'n1', 'jlpt', 'minna'],
    'จีน': ['chinese', 'hsk', 'pinyin', 'เหล่าซือ', 'mandarin'],
    'sci': ['วิทยาศาสตร์', 'วิทย์พื้นฐาน', 'วิทย์', 'bio', 'chem', 'phy', 'ดาราศาสตร์', 'science', 'earth science'],
    'chem': ['เคมี', 'sci', 'organic chem', 'chemistry'],
    'bio': ['ชีว', 'sci', 'ชีววิทยา', 'biology', 'genetics', 'anatomy'],
    'ai': ['machine learning', 'data science', 'deep learning', 'python', 'ml', 'nlp', 'vision'],
    'design': ['ux', 'ui', 'figma', 'photoshop', 'illustrator', 'graphic', 'art', 'canva'],
    'music': ['guitar', 'piano', 'vocal', 'ร้องเพลง', 'กีตาร์', 'เปียโน', 'ดนตรี', 'theory']
};

// ==========================================
// 🛠️ 2. HELPER FUNCTIONS
// ==========================================
const expandKeywords = (text) => {
    if (!text) return [];
    const lowerText = text.toLowerCase().trim();
    let keywords = new Set([lowerText]);

    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        const values = SUBJECT_KNOWLEDGE_BASE[key];
        if (lowerText === key || values.includes(lowerText) || lowerText.includes(key)) {
            keywords.add(key);
            values.forEach(v => keywords.add(v));
        }
    });
    return Array.from(keywords);
};

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ฟังก์ชันกรองโพสต์หมดอายุ (แม่นยำ 100%)
const calculateIsExpired = (post) => {
    if (!post) return false;

    const teachingDays = post.teaching_days || post.preferred_days || '';

    // เช็คกรณีระบุวันที่ชัดเจน (เช่น "2026-03-10, 2026-03-17")
    if (teachingDays) {
        const dates = teachingDays.split(',').map(d => d.trim());
        let allExpired = true; 

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dStr of dates) {
            let m = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (m) {
                const targetDate = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00`);
                if (targetDate >= today) {
                    allExpired = false; // ถ้ามีแค่วันเดียวที่ยังไม่ถึง ถือว่าโพสต์ยังอยู่!
                    break;
                }
            } else {
                // ถ้าระบุเป็นคำพูด (เช่น "วันเสาร์") ให้ถือว่ายังไม่หมดอายุ
                allExpired = false;
            }
        }
        if (dates.length > 0 && allExpired) return true;
    }

    // กรณีไม่ได้ระบุวัน ให้ถือว่ามีอายุ 30 วันนับจากวันที่ตั้งโพสต์
    if (post.created_at) {
        const createdAt = new Date(post.created_at);
        const today = new Date();
        const diffDays = Math.ceil((today - createdAt) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) return true;
    }

    return false;
};

// ==========================================
// 🚀 3. CORE RECOMMENDATION (STUDENT -> TUTOR)
// ==========================================
exports.getRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = Number(req.query.user_id) || 0;

        if (userId === 0) {
            return getLatestTutorPostsFallback(pool, res, userId);
        }

        const keywordWeights = {};
        let basedOnKeywords = [];
        let userGrade = "";
        let mappedGrade = ""; 

        // ระบบให้คะแนนสะสม
        const addWeight = (keyword, score) => {
            if (!keyword) return;
            const rawWords = keyword.split(/[\s,\-\/]+/);
            rawWords.forEach(word => {
                const terms = expandKeywords(word);
                terms.forEach(t => {
                    const k = t.toLowerCase().trim();
                    // แบนคำขยะที่ไม่เกี่ยวกับการเรียน
                    const excluded = ['บุคคลทั่วไป', 'ทั่วไป', 'วิชา', 'เรียน', 'ติว', 'อยาก', 'หา', 'สอน'];
                    if (k.length > 1 && !excluded.includes(k)) {
                        keywordWeights[k] = (keywordWeights[k] || 0) + score;
                    }
                });
            });
        };

        // --- STEP 1: Deep Profile Analytics ---
        const [profile] = await pool.query(
            'SELECT grade_level, institution, faculty, major, about, interested_subjects FROM student_profiles WHERE user_id = ?',
            [userId]
        );

        if (profile.length > 0) {
            const p = profile[0];
            userGrade = p.grade_level || "";
            const gradeMapping = {
                'ม.1': 'มัธยมต้น', 'ม.2': 'มัธยมต้น', 'ม.3': 'มัธยมต้น',
                'ม.4': 'มัธยมปลาย', 'ม.5': 'มัธยมปลาย', 'ม.6': 'มัธยมปลาย'
            };
            mappedGrade = gradeMapping[userGrade] || "";

            if (userGrade) addWeight(userGrade, 3);
            if (mappedGrade) addWeight(mappedGrade, 3);
            if (p.institution) addWeight(p.institution, 3);
            if (p.faculty) addWeight(p.faculty, 4);
            if (p.major) addWeight(p.major, 4);
            if (p.interested_subjects) p.interested_subjects.split(/[\s,]+/).forEach(sub => addWeight(sub, 5));
            if (p.about) p.about.split(/[\s,]+/).forEach(word => addWeight(word, 1));
        }

        // --- STEP 2: My Own Posts ---
        const [myPosts] = await pool.query(
            `SELECT subject FROM student_posts WHERE student_id = ? AND is_active = 1`, [userId]
        );
        myPosts.forEach(post => addWeight(post.subject, 10));

        // --- STEP 3: Search History (Highest Priority = Real-time Response) ---
        const [searches] = await pool.query(
            `SELECT keyword, COUNT(*) as freq 
             FROM search_history 
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY keyword`, [userId]
        );
        searches.forEach(s => addWeight(s.keyword, s.freq * 15)); // บูสต์คะแนนคูณ 15 ให้ค้นหาใหม่ชนะโปรไฟล์เก่า

        // --- STEP 4: Interactions (Click History) ---
        try {
            const [interactions] = await pool.query(
                `SELECT subject_keyword, COUNT(*) as clicks 
                 FROM user_interactions 
                 WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                 GROUP BY subject_keyword`, [userId]
            );
            interactions.forEach(i => addWeight(i.subject_keyword, i.clicks * 5));
        } catch (e) { /* Ignore if table not exist */ }

        // --- รวบรวม Top 20 Keywords ---
        const topKeywords = Object.entries(keywordWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20); 

        if (topKeywords.length === 0) {
            return getLatestTutorPostsFallback(pool, res, userId);
        }

        basedOnKeywords = topKeywords.slice(0, 4).map(k => k[0]); // ดึงไปโชว์ป้ายเหลืองแค่ 4 คำแรก

        // --- STEP 5: ดึงโพสต์ติวเตอร์และให้คะแนน (Scoring Engine) ---
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
            LIMIT 300
        `, [userId, userId]);

        candidates.forEach(tutor => {
            let score = 0;
            const subj = (tutor.subject || "").toLowerCase();
            const desc = (tutor.description || "").toLowerCase();
            const targetGrades = (tutor.target_student_level || "");

            // ตรวจสอบวันหมดอายุ
            tutor.is_expired = calculateIsExpired(tutor);

            // กรองระดับชั้นแบบเข้มงวด
            if (userGrade && targetGrades) {
                if (!targetGrades.includes(userGrade) &&
                    !(mappedGrade && targetGrades.includes(mappedGrade)) &&
                    !targetGrades.includes("บุคคลทั่วไป")) {
                    score -= 10000;
                }
            }

            // คำนวณคะแนนตามคีย์เวิร์ด
            topKeywords.forEach(([kw, weight]) => {
                if (subj.includes(kw)) score += (weight * 4);
                else if (targetGrades.toLowerCase().includes(kw)) score += (weight * 1.5);
                else if (desc.includes(kw)) score += weight;
            });

            // โบนัสคะแนนคุณภาพ
            if (!tutor.is_expired && score > 0) {
                if (tutor.avg_rating >= 4.5) score += 20;
                else if (tutor.avg_rating >= 4.0) score += 10;
            }

            tutor.relevance_score = score;
        });

        // --- STEP 6: กรองเฉพาะโพสต์ที่ไม่หมดอายุ และได้คะแนนความสนใจ ---
        let rows = candidates
            .filter(t => t.relevance_score > 0 && !t.is_expired)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 12);

        // ถ้าได้ไม่ครบ 12 ให้สุ่มโพสต์ "ที่ไม่หมดอายุและตรงระดับชั้น" มาเติม
        if (rows.length < 12) {
            let fillers = candidates
                .filter(t => !t.is_expired && t.relevance_score > -5000 && !rows.find(r => r.tutor_post_id === t.tutor_post_id))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 12 - rows.length);
            rows = [...rows, ...fillers];
        }

        const items = rows.map(r => ({
            ...r,
            id: r.tutor_post_id,
            _id: r.tutor_post_id,
            post_type: 'tutor',
            user: { first_name: r.name, last_name: r.lastname, profile_image: r.profile_picture_url || '/../blank_avatar.jpg', username: r.username },
            meta: { target_student_level: r.target_student_level || 'ไม่ระบุ', teaching_days: r.teaching_days, teaching_time: r.teaching_time, location: r.location, price: Number(r.price || 0), contact_info: r.contact_info },
            fav_count: Number(r.fav_count || 0),
            favorited: !!r.favorited,
            rating: Number(r.avg_rating || 0),
            reviews: Number(r.review_count || 0),
            is_expired: r.is_expired,
            joined: r.my_join_status === 'approved' || r.my_join_status === 'pending',
            pending_me: r.my_join_status === 'pending',
            join_count: Number(r.join_count || 0)
        }));

        res.json({
            success: true,
            based_on: basedOnKeywords.length > 0 ? `วิเคราะห์จากความสนใจ: ${basedOnKeywords.join(', ')}` : "โพสต์แนะนำในระดับชั้นของคุณ",
            items: items
        });

    } catch (err) {
        console.error("Advanced Recommendation Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 🛡️ 4. FALLBACK RECOMMENDATION 
// ==========================================
async function getLatestTutorPostsFallback(pool, res, userId) {
    try {
        let userGrade = "";
        let mappedGrade = "";
        if (userId) {
            const [profile] = await pool.query('SELECT grade_level FROM student_profiles WHERE user_id = ?', [userId]);
            if (profile.length > 0) {
                userGrade = profile[0].grade_level || "";
                const gradeMapping = { 'ม.1': 'มัธยมต้น', 'ม.2': 'มัธยมต้น', 'ม.3': 'มัธยมต้น', 'ม.4': 'มัธยมปลาย', 'ม.5': 'มัธยมปลาย', 'ม.6': 'มัธยมปลาย' };
                mappedGrade = gradeMapping[userGrade] || "";
            }
        }

        const [latest] = await pool.query(`
            SELECT tp.*, r.name, r.lastname, r.username, tpro.profile_picture_url,
                   COALESCE(rv.avg_rating, 0) AS avg_rating,
                   COALESCE(rv.review_count, 0) AS review_count,
                   (SELECT COUNT(*) FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND status='approved') AS join_count,
                   COALESCE(fvc.c,0) AS fav_count,
                   CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            LEFT JOIN (SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews GROUP BY tutor_id) rv ON tp.tutor_id = rv.tutor_id
            LEFT JOIN (SELECT post_id, COUNT(*) as c FROM posts_favorites WHERE post_type='tutor' GROUP BY post_id) fvc ON fvc.post_id = tp.tutor_post_id
            LEFT JOIN posts_favorites fme ON fme.post_id = tp.tutor_post_id AND fme.post_type='tutor' AND fme.user_id = ?
            WHERE COALESCE(tp.is_active, 1) = 1
            ORDER BY tp.created_at DESC 
            LIMIT 100
        `, [userId]);

        let processed = latest.map(t => {
            t.is_expired = calculateIsExpired(t);
            return t;
        });

        // 🌟 กรองเอาโพสต์ที่ "ยังไม่หมดอายุ" มาโชว์เท่านั้น
        let filtered = processed.filter(t => !t.is_expired);

        if (userGrade) {
            filtered = filtered.filter(t => {
                const tg = t.target_student_level || "";
                return !tg || tg.includes(userGrade) || (mappedGrade && tg.includes(mappedGrade)) || tg.includes("บุคคลทั่วไป");
            });
        }

        const items = filtered.slice(0, 12).map(r => ({
            ...r,
            id: r.tutor_post_id,
            _id: r.tutor_post_id,
            post_type: 'tutor',
            user: { first_name: r.name, last_name: r.lastname, profile_image: r.profile_picture_url || '/../blank_avatar.jpg', username: r.username },
            meta: { target_student_level: r.target_student_level || 'ไม่ระบุ', teaching_days: r.teaching_days, teaching_time: r.teaching_time, location: r.location, price: Number(r.price || 0), contact_info: r.contact_info },
            rating: Number(r.avg_rating || 0),
            reviews: Number(r.review_count || 0),
            join_count: Number(r.join_count || 0),
            fav_count: Number(r.fav_count || 0),
            favorited: !!r.favorited,
            is_expired: r.is_expired
        }));

        res.json({
            success: true,
            based_on: "โพสต์ติวเตอร์ล่าสุด (ที่ยังไม่หมดอายุ)",
            items: items
        });
    } catch (e) {
        res.status(500).json({ error: 'Fallback Error' });
    }
}

// ==========================================
// 🎓 5. OTHER APIS (TUTOR REQUESTS, BUDDIES, TRENDING)
// ==========================================
const calculateSmartScore = (keyword, targetSubject, targetPrice, targetLocation, reqBudget, reqLocation) => {
    let score = 0;
    const cleanKeyword = (keyword || "").trim().toLowerCase();
    const cleanTarget = (targetSubject || "").trim().toLowerCase();

    if (cleanKeyword && cleanTarget) {
        const escapedKw = escapeRegExp(cleanKeyword);
        if (cleanKeyword === cleanTarget) score += 100;
        else if (new RegExp(`(?:^|\\s)${escapedKw}(?:$|\\s)`, 'i').test(cleanTarget)) score += 80;
        else if (cleanTarget.includes(cleanKeyword)) score += 30;
        else {
            const expanded = expandKeywords(cleanKeyword);
            if (expanded.some(kw => cleanTarget === kw)) score += 20;
            else if (expanded.some(kw => cleanTarget.includes(kw))) score += 10;
        }
    }
    return score;
};

exports.getStudentRequestsForTutor = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        if (!userId) return res.json({ items: [], based_on: "" });

        let tutorSkills = [];
        let tutorRate = 0;
        let tutorAddr = "";

        const [profile] = await pool.query('SELECT can_teach_subjects, address FROM tutor_profiles WHERE user_id = ?', [userId]);
        if (profile.length) {
            tutorAddr = profile[0].address || "";
            if (profile[0].can_teach_subjects) {
                tutorSkills.push(...profile[0].can_teach_subjects.split(',').map(s => s.trim()));
            }
        }

        const [myPosts] = await pool.query('SELECT subject FROM tutor_posts WHERE tutor_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        myPosts.forEach(p => tutorSkills.push(p.subject));
        tutorSkills = [...new Set(tutorSkills.filter(s => s))];

        if (tutorSkills.length === 0) {
            const [latest] = await pool.query(`SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
            return res.json({ items: latest, based_on: "โพสต์ล่าสุด (กรุณากรอกวิชาที่สอน)" });
        }

        const [candidates] = await pool.query(`
            SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url,
                   (SELECT COUNT(*) FROM student_post_offers WHERE student_post_id = sp.student_post_id AND status = 'approved') AS has_tutor_count,
                   (SELECT t_reg.name FROM student_post_offers o JOIN register t_reg ON o.tutor_id = t_reg.user_id WHERE o.student_post_id = sp.student_post_id AND o.status = 'approved' LIMIT 1) AS approved_tutor_name
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            ORDER BY sp.created_at DESC LIMIT 100
        `);

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
            .sort((a, b) => {
                if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
                return b.relevance_score - a.relevance_score;
            })
            .slice(0, 30);

        if (recommended.length === 0) {
            const [fallback] = await pool.query(`SELECT sp.*, r.name, r.lastname, r.username, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
            return res.json({ items: fallback, based_on: "โพสต์ล่าสุด (ไม่พบที่ตรงกับวิชาที่สอน)" });
        }

        res.json({ items: recommended, based_on: `วิชาที่คุณถนัด: ${tutorSkills.slice(0, 3).join(", ")}` });

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
        const processed = posts.map(p => ({
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

        processed.sort((a, b) => {
            if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json(processed);
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

exports.getTrendingSubjects = async (req, res) => {
    try {
        const pool = req.db;
        const [searches] = await pool.query(`SELECT keyword, COUNT(*) as count FROM search_history WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY keyword`);
        const [studentPosts] = await pool.query(`SELECT subject, COUNT(*) as count FROM student_posts WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY subject`);
        
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
            let clean = rawTerm.trim().toLowerCase().replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s]/g, '');
            if (clean.length < 2) return;
            let key = normalizeMap[clean] || clean;
            if (!scores[key]) scores[key] = 0;
            scores[key] += (count * weight);
        };

        searches.forEach(s => processTerm(s.keyword, s.count, 1.0));
        studentPosts.forEach(s => processTerm(s.subject, s.count, 3.0));

        let trending = Object.entries(scores)
            .map(([key, score]) => {
                let title = key.charAt(0).toUpperCase() + key.slice(1);
                return { key: key, title: title, score: score, tutorCount: Math.ceil(score) };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

        res.json(trending);
    } catch (err) {
        console.error("Trending Error:", err);
        res.status(500).json({ error: err.message });
    }
};