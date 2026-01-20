// src/controllers/recommendationController.js
const geolib = require('geolib');

// --- 🧠 1. Knowledge Base ---
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

// Function to expand search keywords
const expandKeywords = (text) => {
    if (!text) return [];
    let keywords = [text.toLowerCase()];
    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        if (text.toLowerCase().includes(key)) {
            keywords = [...keywords, ...SUBJECT_KNOWLEDGE_BASE[key]];
        }
    });
    return keywords;
};

// --- ⚖️ 2. Scoring Weights ---
const WEIGHTS = {
    SUBJECT_EXACT: 60,   // Exact subject match
    SUBJECT_RELATED: 40, // Related subject match
    GRADE: 20,           // Grade level match
    BUDGET: 15,          // Budget match
    LOCATION: 25         // Location match
};

// --- 🧠 Matching Engine for Student (Finding Tutors) ---
const calculateRelevanceScore = (requirement, tutorPost) => {
    let score = 0;

    const reqSubject = (requirement.subject || "").toLowerCase();
    const tutorSubject = (tutorPost.subject || "").toLowerCase();

    // 1. Subject Score
    const expandedReq = expandKeywords(reqSubject);
    if (tutorSubject.includes(reqSubject) || reqSubject.includes(tutorSubject)) {
        score += WEIGHTS.SUBJECT_EXACT;
    } else if (expandedReq.some(kw => tutorSubject.includes(kw))) {
        score += WEIGHTS.SUBJECT_RELATED;
    }

    // 2. Budget Score
    if (requirement.budget > 0) {
        const price = Number(tutorPost.price) || 0;
        if (price <= requirement.budget) score += WEIGHTS.BUDGET;
        else if (price <= requirement.budget * 1.2) score += (WEIGHTS.BUDGET / 2);
    }

    // 3. Location Score
    if (requirement.location && tutorPost.location) {
        // Simple string matching for location
        if (tutorPost.location.includes(requirement.location) || requirement.location.includes(tutorPost.location)) {
            score += WEIGHTS.LOCATION;
        }
        // (Geolib logic can be re-enabled here if lat/lon are available)
    }

    // 4. Grade Matching
    const reqGrade = requirement.grade_level || "";
    const tutorTarget = tutorPost.target_student_level || "";
    if (tutorTarget && reqGrade) {
        if (tutorTarget.includes(reqGrade) || reqGrade.includes("บุคคลทั่วไป")) {
            score += WEIGHTS.GRADE;
        }
    }

    return score;
};

// --- 🧠 Matching Engine for Tutor (Finding Student Posts) ---
const calculateScoreForTutor = (tutorProfile, studentPost) => {
    let score = 0;

    const studentSubject = (studentPost.subject || "").toLowerCase();
    const tutorSubjects = (tutorProfile.can_teach_subjects || "").toLowerCase();

    // 1. Subject Match
    const skills = tutorSubjects.split(',').map(s => s.trim()).filter(s => s);
    const isSubjectMatch = skills.some(skill => {
        const expandedSkill = expandKeywords(skill);
        return expandedSkill.some(kw => studentSubject.includes(kw));
    });

    if (isSubjectMatch) {
        score += 60;
    } else {
        // Fallback to search history interest
        if (tutorProfile.interestKeyword && studentSubject.includes(tutorProfile.interestKeyword)) {
            score += 40;
        }
    }

    // 2. Budget vs Hourly Rate
    const studentBudget = Number(studentPost.budget) || 0;
    const tutorRate = Number(tutorProfile.hourly_rate) || 0;

    if (studentBudget >= tutorRate) {
        score += 25;
    } else if (studentBudget >= tutorRate * 0.8) {
        score += 10;
    }

    // 3. Location
    if (tutorProfile.address && studentPost.location) {
        if (studentPost.location.includes(tutorProfile.address) || tutorProfile.address.includes(studentPost.location)) {
            score += 15;
        }
    }

    return score;
};

// --- 🚀 Exports ---

// 1. Get Recommended Tutors (For Students)
exports.getRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        // Guest User: Return latest posts
        if (!userId || userId === '0') {
            const [rows] = await pool.query(`
                SELECT tp.*, r.name, r.lastname, r.email, 
                       tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                       tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio
                FROM tutor_posts tp
                LEFT JOIN register r ON tp.tutor_id = r.user_id
                LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
                ORDER BY tp.created_at DESC LIMIT 6
            `);
            return res.json({ items: rows, based_on: "" });
        }

        // Get Student Interests (Search History + My Posts)
        let interests = [];
        const [history] = await pool.query('SELECT keyword FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        history.forEach(h => interests.push({ type: 'search', subject: h.keyword }));

        const [myPosts] = await pool.query('SELECT subject, budget, location, grade_level FROM student_posts WHERE student_id = ? ORDER BY created_at DESC LIMIT 3', [userId]);
        myPosts.forEach(p => interests.push({ type: 'post', ...p }));

        // Fallback if no interests
        if (interests.length === 0) {
            const [latest] = await pool.query(`
                SELECT tp.*, r.name, r.lastname, r.email, 
                       tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                       tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio
                FROM tutor_posts tp
                LEFT JOIN register r ON tp.tutor_id = r.user_id
                LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
                ORDER BY tp.created_at DESC LIMIT 6
            `);
            return res.json({ items: latest, based_on: "โพสต์ล่าสุด (สำหรับผู้เริ่มต้น)" });
        }

        // Get Candidates (Tutor Posts)
        const [candidates] = await pool.query(`
            SELECT tp.*, r.name, r.lastname, r.email, 
                   tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                   tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            ORDER BY tp.created_at DESC LIMIT 100
        `);

        // Scoring
        const scoredTutors = candidates.map(tutor => {
            let maxScore = 0;
            let bestMatchReason = "";

            interests.forEach(interest => {
                const score = calculateRelevanceScore(interest, tutor);
                if (score > maxScore) {
                    maxScore = score;
                    bestMatchReason = interest.subject;
                }
            });

            return { ...tutor, relevance_score: maxScore, matched_topic: bestMatchReason };
        });

        // Filter & Sort
        const recommended = scoredTutors
            .filter(t => t.relevance_score > 0)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 24);

        if (recommended.length === 0) {
            const [fallback] = await pool.query(`
                SELECT tp.*, r.name, r.lastname, r.email, 
                       tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                       tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio
                FROM tutor_posts tp
                LEFT JOIN register r ON tp.tutor_id = r.user_id
                LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
                ORDER BY tp.created_at DESC LIMIT 24
            `);
            return res.json({ items: fallback, based_on: "โพสต์ล่าสุด" });
        }

        const topMatch = recommended[0].matched_topic;
        res.json({
            items: recommended,
            based_on: topMatch ? `ความสนใจเรื่อง "${topMatch}"` : "ความสนใจของคุณ"
        });

    } catch (err) {
        console.error("Recommendation System Error:", err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// 2. Get Student Requests (For Tutors)
exports.getStudentRequestsForTutor = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        if (!userId) return res.json({ items: [], based_on: "" });

        // -------------------------------------------------------------
        // 1. รวบรวม "สกิลและความสนใจ" ของติวเตอร์ (Tutor's DNA)
        // -------------------------------------------------------------
        let tutorSkills = [];
        let sourceDescription = "";

        // 1.1 ดึงจาก Profile (Bio/Can Teach)
        const [profile] = await pool.query('SELECT can_teach_subjects, hourly_rate, address FROM tutor_profiles WHERE user_id = ?', [userId]);
        const tutorProfile = profile[0] || {};

        if (tutorProfile.can_teach_subjects) {
            tutorSkills.push(...tutorProfile.can_teach_subjects.split(','));
            sourceDescription = "โปรไฟล์ของคุณ";
        }

        // 1.2 ดึงจาก "โพสต์ที่ติวเตอร์เคยลงประกาศไว้" (My Own Posts) -> สำคัญ! เพราะสะท้อนวิชาที่สอนจริง
        const [myPosts] = await pool.query('SELECT subject FROM tutor_posts WHERE tutor_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        if (myPosts.length > 0) {
            myPosts.forEach(p => tutorSkills.push(p.subject));
            if (!sourceDescription) sourceDescription = "วิชาที่คุณเปิดสอน";
        }

        // 1.3 ดึงจาก "ประวัติการค้นหา" (เผื่อกำลังสนใจตลาดวิชาใหม่ๆ)
        const [history] = await pool.query('SELECT keyword FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 3', [userId]);
        history.forEach(h => tutorSkills.push(h.keyword));

        // Clean ข้อมูล: ตัดคำซ้ำ และค่าว่างทิ้ง
        tutorSkills = [...new Set(tutorSkills.map(s => s.trim()).filter(s => s))];

        // ถ้าไม่มีข้อมูลอะไรเลย -> ส่ง Fallback (ล่าสุด)
        if (tutorSkills.length === 0) {
            const [latest] = await pool.query(`
                SELECT sp.*, r.name, r.lastname, spro.profile_picture_url
                FROM student_posts sp
                LEFT JOIN register r ON sp.student_id = r.user_id
                LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
                ORDER BY sp.created_at DESC LIMIT 30
            `);
            return res.json({ items: latest, based_on: "โพสต์ล่าสุด (แนะนำให้กรอกประวัติสอน เพื่อผลลัพธ์ที่แม่นยำ)" });
        }

        // -------------------------------------------------------------
        // 2. ดึง "โพสต์นักเรียน" มาเทียบ (Matching)
        // -------------------------------------------------------------
        // สร้างเงื่อนไข SQL แบบ Dynamic OR Matching
        // "หานักเรียนที่ต้องการวิชา A หรือ B หรือ C..."
        const expandedSkills = [];
        tutorSkills.forEach(skill => {
            expandedSkills.push(...expandKeywords(skill)); // ขยายคำ เช่น "คอม" -> "python", "java"
        });
        const uniqueKeywords = [...new Set(expandedSkills)];

        // สร้าง WHERE clause: (subject LIKE %kw1% OR subject LIKE %kw2% ...)
        const likeClauses = uniqueKeywords.map(() => 'sp.subject LIKE ?').join(' OR ');
        const params = uniqueKeywords.map(k => `%${k}%`);

        const [candidates] = await pool.query(`
            SELECT sp.*, r.name, r.lastname, spro.profile_picture_url
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            WHERE (${likeClauses}) 
            ORDER BY sp.created_at DESC LIMIT 50
        `, params);

        // -------------------------------------------------------------
        // 3. ให้คะแนนความเหมาะสม (Scoring)
        // -------------------------------------------------------------
        const scoredPosts = candidates.map(post => {
            let score = 0;
            const studentSubject = post.subject.toLowerCase();
            const tutorRate = Number(tutorProfile.hourly_rate) || 0;
            const studentBudget = Number(post.budget) || 0;

            // คะแนนวิชา (ได้แน่ๆ เพราะกรองมาแล้วจาก SQL แต่ให้คะแนนความเป๊ะเพิ่ม)
            if (tutorSkills.some(s => studentSubject.includes(s.toLowerCase()))) score += 60;
            else score += 40; // ตรงแบบ Keyword ขยาย

            // คะแนนงบประมาณ (นักเรียนจ่ายไหวไหม)
            if (tutorRate > 0 && studentBudget > 0) {
                if (studentBudget >= tutorRate) score += 30; // จ่ายไหว = คะแนนพุ่ง
                else if (studentBudget >= tutorRate * 0.8) score += 10; // ต่อรองได้นิดหน่อย
            }

            // คะแนนสถานที่
            if (tutorProfile.address && post.location) {
                if (post.location.includes(tutorProfile.address)) score += 20;
            }

            return { ...post, relevance_score: score };
        });

        // เรียงคะแนนมาก -> น้อย
        const recommended = scoredPosts.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 30);

        if (recommended.length === 0) {
            const [fallback] = await pool.query(`
                SELECT sp.*, r.name, r.lastname, spro.profile_picture_url
                FROM student_posts sp
                LEFT JOIN register r ON sp.student_id = r.user_id
                LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
                ORDER BY sp.created_at DESC LIMIT 30
            `);
            return res.json({ items: fallback, based_on: "โพสต์ล่าสุด (ไม่พบที่ตรงกับความถนัด)" });
        }

        res.json({
            items: recommended,
            based_on: `แนะนำจากความถนัด: ${tutorSkills.slice(0, 3).join(", ")}`
        });

    } catch (err) {
        console.error("Tutor Smart Recs Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ✅ 3. Recommended Courses (Student Posts for Student - เพื่อนหาเพื่อนติว)
exports.getRecommendedCourses = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const pool = req.db;

        // 1. Get user profile to find "Peer" (Same Grade Level or Similar Interest)
        let gradeLevel = "";
        if (userId) {
            const [users] = await pool.query("SELECT grade_level FROM register WHERE user_id = ?", [userId]);
            if (users.length) gradeLevel = users[0].grade_level;
        }

        // 2. Build Query for STUDENT POSTS (Not Tutor Posts)
        // Filter by Grade Level to find "Peers"
        let sql = `
          SELECT sp.student_post_id, sp.student_id, sp.subject, sp.description, 
                 sp.preferred_days, sp.preferred_time, sp.location, sp.group_size, 
                 sp.budget, sp.grade_level, sp.created_at,
                 r.first_name, r.last_name, r.profile_picture_url,
                 (SELECT COUNT(*) FROM student_post_joins WHERE student_post_id = sp.student_post_id) AS join_count,
                 (SELECT COUNT(*) FROM student_post_offers WHERE student_post_id = sp.student_post_id AND status = 'approved') AS has_tutor
          FROM student_posts sp
          JOIN register r ON sp.student_id = r.user_id
          WHERE 1=1
        `;
        const params = [];

        if (userId) {
            sql += ` AND sp.student_id != ? `;
            params.push(userId);
        }

        if (gradeLevel) {
            // Prioritize same grade level
            sql += ` AND (sp.grade_level = ? OR sp.grade_level IS NULL OR sp.grade_level = '')`;
            params.push(gradeLevel);
        }

        sql += ` ORDER BY sp.created_at DESC LIMIT 12`;

        const [posts] = await pool.query(sql, params);

        // Format
        const formatted = posts.map(p => ({
            id: p.student_post_id,
            user: {
                first_name: p.first_name,
                last_name: p.last_name,
                profile_image: p.profile_picture_url || "/default-avatar.png"
            },
            subject: p.subject,
            description: p.description,
            location: p.location,
            budget: p.budget,
            preferred_days: p.preferred_days,
            preferred_time: p.preferred_time,
            join_count: Number(p.join_count || 0),
            has_tutor: Number(p.has_tutor) > 0,
            createdAt: p.created_at,
            post_type: 'student'
        }));

        res.json(formatted);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};