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

// Function to expand search keywords (Bidirectional: Parent <-> Child)
const expandKeywords = (text) => {
    if (!text) return [];

    // Use Set to avoid duplicates automatically
    let keywords = new Set([text.toLowerCase()]);
    const lowerText = text.toLowerCase();

    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        const values = SUBJECT_KNOWLEDGE_BASE[key];

        // 1. Forward: If text contains "Key" -> Add "Values"
        // (e.g. Search "Program" -> Get "Python", "Java", "Code")
        if (lowerText.includes(key)) {
            values.forEach(v => keywords.add(v));
        }

        // 2. Reverse: If text contains any "Value" -> Add "Key"
        // (e.g. Search "Python" -> Get "Program", "Code")
        const isMatchValue = values.some(v => lowerText.includes(v));
        if (isMatchValue) {
            keywords.add(key);
            // Optional: Add other siblings? Maybe too much noise.
            // keeping it simple adds the Category name.
        }
    });

    return Array.from(keywords);
};

// ฟังก์ชันช่วยแปลงตัวอักษรพิเศษให้ใช้กับ Regex ได้ (เช่น C++, C#)
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// --- ⚖️ 2. Scoring Weights () ---
const WEIGHTS = {
    SUBJECT_EXACT: 80,
    SUBJECT_PARTIAL: 30,
    SUBJECT_RELATED: 20,
    GRADE: 20,
    BUDGET: 15,
    LOCATION: 25
};

// --- 🧠 Matching Engine for Student (Finding Tutors) ---
const calculateRelevanceScore = (requirement, tutorPost) => {
    let score = 0;

    const reqSubject = (requirement.subject || "").trim().toLowerCase();
    const tutorSubject = (tutorPost.subject || "").trim().toLowerCase();

    // 1. Subject Score (Logic ใหม่ ฉลาดขึ้น) 🧠
    if (reqSubject && tutorSubject) {
        // สร้าง Regex เพื่อหาคำแบบ "เต็มคำ" (Word Boundary)
        // \b หมายถึงขอบคำ เช่น หา "Java" จะไม่เจอใน "JavaScript"
        // แต่ถ้าเป็น C++ หรือ C# ต้องระวังเรื่อง \b เราเลยใช้การเช็คแบบพิเศษ

        const escapedReq = escapeRegExp(reqSubject);

        // 1.1 ตรงกันเป๊ะๆ 100%
        if (reqSubject === tutorSubject) {
            score += WEIGHTS.SUBJECT_EXACT + 20; // โบนัสพิเศษ
        }
        // 1.2 ตรงแบบเต็มคำ (เช่น "ติว Java ตัวต่อตัว" มีคำว่า "Java" โดดๆ)
        else if (new RegExp(`(?:^|\\s)${escapedReq}(?:$|\\s)`, 'i').test(tutorSubject)) {
            score += WEIGHTS.SUBJECT_EXACT;
        }
        // 1.3 ตรงแบบเป็นส่วนประกอบ (เช่นหา "Java" เจอ "JavaScript")
        else if (tutorSubject.includes(reqSubject)) {
            score += WEIGHTS.SUBJECT_PARTIAL; // ให้คะแนนแค่นิดเดียวพอ
        }
        // 1.4 คำที่เกี่ยวข้อง (Knowledge Base)
        else {
            const expandedReq = expandKeywords(reqSubject);
            if (expandedReq.some(kw => tutorSubject.includes(kw))) {
                score += WEIGHTS.SUBJECT_RELATED;
            }
        }
    }

    // 2. Budget Score (เหมือนเดิม)
    if (requirement.budget > 0) {
        const price = Number(tutorPost.price) || 0;
        if (price > 0 && price <= requirement.budget) score += WEIGHTS.BUDGET;
        else if (price <= requirement.budget * 1.2) score += (WEIGHTS.BUDGET / 2);
    }

    // 3. Location Score (เหมือนเดิม)
    if (requirement.location && tutorPost.location) {
        if (tutorPost.location.includes(requirement.location) || requirement.location.includes(tutorPost.location)) {
            score += WEIGHTS.LOCATION;
        }
    }

    // 4. Grade Matching (เหมือนเดิม)
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
// ---------------------------------------------------------
// 🧠 PART 3: ระบบแนะนำ "เพื่อนติว" (Study Buddy)
// ---------------------------------------------------------
exports.getStudyBuddyRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        if (!userId) return res.json([]);

        // 1. ดึงข้อมูล "ตัวเรา" (My Profile & My Posts)
        // ดูว่าเราโพสต์หาติววิชาอะไรบ้าง และเราอยู่ที่ไหน
        const [myProfile] = await pool.query('SELECT address, grade_level, institution FROM student_profiles WHERE user_id = ?', [userId]);
        const [myPosts] = await pool.query('SELECT subject, location FROM student_posts WHERE student_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);

        const myLocation = myProfile[0]?.address || "";
        const myInterests = myPosts.map(p => p.subject); // วิชาที่เราอยากเรียน

        if (myInterests.length === 0 && !myLocation) {
            // ถ้าไม่มีข้อมูลอะไรเลย ส่งเพื่อนล่าสุดไปให้ดูเล่นๆ
            const [randomFriends] = await pool.query(`
                SELECT r.user_id, r.name, r.lastname, sp.profile_picture_url, sp.grade_level, sp.institution
                FROM register r
                JOIN student_profiles sp ON r.user_id = sp.user_id
                WHERE r.user_id != ? AND r.type = 'student'
                ORDER BY r.created_at DESC LIMIT 5
            `, [userId]);
            return res.json(randomFriends);
        }

        // 2. ขยายคำค้นหา (เช่น เราหา "คอม" ระบบจะหาเพื่อนที่หา "Python" ด้วย)
        let searchKeywords = [];
        myInterests.forEach(subj => {
            searchKeywords.push(...expandKeywords(subj));
        });
        searchKeywords = [...new Set(searchKeywords)]; // ตัดคำซ้ำ

        // 3. ดึง "เพื่อนคนอื่น" มาเทียบ (Candidates)
        // กรองเบื้องต้น: เป็นนักเรียนเหมือนกัน (role='student') และไม่ใช่ตัวเรา
        const [candidates] = await pool.query(`
            SELECT 
                r.user_id, r.name, r.lastname, 
                sp.profile_picture_url, sp.grade_level, sp.institution, sp.address,
                (SELECT GROUP_CONCAT(subject SEPARATOR ', ') FROM student_posts WHERE student_id = r.user_id ORDER BY created_at DESC LIMIT 3) as looking_for
            FROM register r
            JOIN student_profiles sp ON r.user_id = sp.user_id
            WHERE r.user_id != ? AND r.type = 'student'
            LIMIT 100
        `, [userId]);

        // 4. ให้คะแนนความเข้ากันได้ (Scoring)
        const scoredFriends = candidates.map(friend => {
            let score = 0;
            const friendLookingFor = (friend.looking_for || "").toLowerCase();
            const friendLocation = (friend.address || "").toLowerCase();

            // 4.1 วิชาตรงกัน (หาติววิชาเดียวกัน = ไปติวด้วยกันได้)
            const isSubjectMatch = searchKeywords.some(kw => friendLookingFor.includes(kw));
            if (isSubjectMatch) score += 50;

            // 4.2 สถานที่ใกล้กัน (จังหวัด/เขต เดียวกัน)
            if (myLocation && friendLocation) {
                if (friendLocation.includes(myLocation) || myLocation.includes(friendLocation)) {
                    score += 30;
                }
            }

            // 4.3 ระดับชั้น/สถาบัน ใกล้เคียงกัน
            if (myProfile[0]?.institution && friend.institution) {
                if (friend.institution === myProfile[0].institution) score += 20; // โรงเรียนเดียวกัน
            }

            return { ...friend, match_score: score };
        });

        // 5. คัดเลือกเฉพาะคนที่มีคะแนน > 0 และเรียงลำดับ
        const buddies = scoredFriends
            .filter(f => f.match_score > 0)
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 5); // เอาแค่ 5 คน

        res.json(buddies);

    } catch (err) {
        console.error("Study Buddy Error:", err);
        res.status(500).json({ error: err.message });
    }
};