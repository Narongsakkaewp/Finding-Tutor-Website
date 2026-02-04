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
        // ถ้านักเรียนหาติวเตอร์: ราคาติวเตอร์ <= งบนักเรียน
        // ถ้าติวเตอร์หานักเรียน: งบนักเรียน >= ราคาติวเตอร์
        // Logic นี้ใช้แบบยืดหยุ่นได้
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


// --- 🚀 Exports ---

// 1. Get Recommended Tutors (For Students) - 🌟 ฉบับ "หน้าจอไม่โล่ง" (Smart Fill)
exports.getRecommendations = async (req, res) => {
    try {
        const pool = req.db;
        const userId = req.query.user_id;

        // 1. ดึง Candidates (Tutor Posts) ทั้งหมดมาก่อน (ดึงมาเยอะหน่อยเผื่อเลือก)
        const [candidates] = await pool.query(`
            SELECT tp.*, r.name, r.lastname, r.email, 
                   tpro.profile_picture_url, tpro.phone, tpro.nickname, 
                   tpro.education, tpro.teaching_experience, tpro.about_me AS profile_bio,
                   COALESCE(rv.avg_rating, 0) AS avg_rating,
                   COALESCE(rv.review_count, 0) AS review_count
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
            LEFT JOIN (
                SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count
                FROM reviews
                GROUP BY tutor_id
            ) rv ON tp.tutor_id = rv.tutor_id
            ORDER BY tp.created_at DESC LIMIT 100
        `);

        // ถ้าเป็น Guest หรือไม่มี UserID ให้ส่งกลับเลยแบบเรียงตามเวลา
        if (!userId || userId === '0') {
            return res.json({
                items: candidates.slice(0, 24).map(c => ({
                    ...c,
                    rating: Number(c.avg_rating || 0),
                    reviews: Number(c.review_count || 0)
                })),
                based_on: ""
            });
        }

        // 2. รวบรวมความสนใจ (Interests)
        let allInterests = [];
        const [history] = await pool.query('SELECT keyword, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]);
        history.forEach(h => allInterests.push({ subject: h.keyword, date: new Date(h.created_at), weight: 0.8 })); // [MOD] Reduce search weight slightly

        // [MOD] Increase LIMIT to 10 to capture more preferences, and Increase Weight to 2.5
        const [myPosts] = await pool.query('SELECT subject, budget, location, created_at FROM student_posts WHERE student_id = ? ORDER BY created_at DESC LIMIT 10', [userId]);
        myPosts.forEach(p => allInterests.push({ subject: p.subject, budget: p.budget, location: p.location, date: new Date(p.created_at), weight: 2.5 }));

        allInterests.sort((a, b) => b.date - a.date); // เรียงตามเวลา (ใหม่สุดอยู่หน้า)

        // ถ้าไม่มีความสนใจเลย -> ส่งแบบล่าสุดกลับไป
        if (allInterests.length === 0) {
            return res.json({
                items: candidates.slice(0, 12).map(c => ({
                    ...c,
                    rating: Number(c.avg_rating || 0),
                    reviews: Number(c.review_count || 0)
                })),
                based_on: "โพสต์ล่าสุด"
            });
        }

        // 3. ให้คะแนน (Scoring)
        let scoredTutors = candidates.map(tutor => {
            let maxScore = 0;
            let bestMatchReason = "";

            allInterests.forEach((interest, index) => {
                let score = calculateSmartScore(interest.subject, tutor.subject, tutor.price, tutor.location, interest.budget, interest.location);
                const decayFactor = Math.max(0.4, 1 - (index * 0.15)); // Time Decay
                const finalScore = score * interest.weight * decayFactor;

                if (finalScore > maxScore) {
                    maxScore = finalScore;
                    bestMatchReason = interest.subject;
                }
            });

            return {
                ...tutor,
                relevance_score: maxScore,
                matched_topic: bestMatchReason,
                rating: Number(tutor.avg_rating || 0),
                reviews: Number(tutor.review_count || 0)
            };
        });

        // 4. แยกกลุ่ม "ตรงใจ" (Recommended)
        // กรองเอาเฉพาะที่มีคะแนน > 0 (หรือกำหนด Threshold ต่ำๆ เช่น 10 เพื่อความเข้มข้น)

        // [MOD] - Date Parsing Logic
        const parseDate = (dStr) => {
            if (!dStr) return null;
            // 1. ISO Format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
            if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(dStr);

            // 2. Thai Format (e.g. 8 กันยายน 2568)
            const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
            const parts = dStr.split(" ");
            if (parts.length >= 3) {
                const day = parseInt(parts[0]);
                const monthIdx = thaiMonths.indexOf(parts[1]);
                let year = parseInt(parts[2]);
                if (year > 2400) year -= 543; // Convert BE to CE
                if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
                    return new Date(year, monthIdx, day);
                }
            }
            return null; // Cannot parse
        };

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Reset time to start of day

        let processedTutors = scoredTutors.map(t => {
            const tDate = parseDate(t.teaching_days);
            const isExpired = tDate && tDate < now;
            return { ...t, is_expired: isExpired, tDate }; // Attach parsed date
        });

        // Sort: Non-Expired First, then High Score
        let recommended = processedTutors
            .filter(t => t.relevance_score > 10)
            .sort((a, b) => {
                // 1. Expired Last
                if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
                // 2. High Score First
                return b.relevance_score - a.relevance_score;
            });

        const topMatch = recommended.length > 0 ? recommended[0].matched_topic : null;

        // 🔥 5. ระบบเติมเต็ม (Smart Fill): ถ้าได้ผลลัพธ์น้อยกว่า 6 ให้หาอย่างอื่นมาเติม
        const MIN_DISPLAY = 6;

        if (recommended.length < MIN_DISPLAY) {
            // หา ID ที่มีอยู่แล้ว เพื่อไม่ให้ซ้ำ
            const existingIds = recommended.map(t => t.tutor_post_id);

            // ดึงโพสต์ที่เหลือ (ที่คะแนนน้อย หรือเป็น 0) มาเติม
            const fillers = processedTutors // Use processed candidates (with is_expired)
                .filter(t => !existingIds.includes(t.tutor_post_id)) // ต้องไม่ซ้ำกับที่มีแล้ว
                .sort((a, b) => {
                    if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
                    return b.avg_rating - a.avg_rating; // Fallback sort
                })
                .slice(0, MIN_DISPLAY - recommended.length); // ตัดมาเติมให้ครบจำนวน

            // เอามาต่อท้าย
            recommended = [...recommended, ...fillers];
        }

        // ตัดส่งกลับไปแค่ 12 อัน (หรือจำนวนที่คุณต้องการ)
        const finalResult = recommended.slice(0, 12);

        res.json({
            items: finalResult,
            // ถ้ามี Top Match ให้บอกว่าอ้างอิงจากอะไร ถ้าไม่มี (เป็น Filler ล้วนๆ) ให้บอกว่ามาใหม่
            based_on: topMatch ? `ความสนใจเรื่อง "${topMatch}" และอื่นๆ` : "โพสต์แนะนำสำหรับคุณ"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

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
            const [latest] = await pool.query(`SELECT sp.*, r.name, r.lastname, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
            return res.json({ items: latest, based_on: "โพสต์ล่าสุด (กรุณากรอกวิชาที่สอน)" });
        }

        // 2. ดึง Student Posts มาเทียบ
        const [candidates] = await pool.query(`
            SELECT sp.*, r.name, r.lastname, spro.profile_picture_url
            FROM student_posts sp
            LEFT JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            ORDER BY sp.created_at DESC LIMIT 100
        `);

        // 3. Scoring (ใช้ Smart Logic แบบเดียวกัน)
        const scoredPosts = candidates.map(post => {
            let maxScore = 0;

            tutorSkills.forEach(skill => {
                // ใช้ฟังก์ชัน calculateSmartScore ตัวเดียวกับข้างบน เพื่อความฉลาดเท่ากัน
                // Note: สลับตำแหน่ง price/budget เล็กน้อยตามบริบท
                let score = calculateSmartScore(skill, post.subject, post.budget, post.location, tutorRate, tutorAddr);

                if (score > maxScore) maxScore = score;
            });

            return { ...post, relevance_score: maxScore };
        });

        const recommended = scoredPosts
            .filter(p => p.relevance_score > 20)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 30);

        if (recommended.length === 0) {
            const [fallback] = await pool.query(`SELECT sp.*, r.name, r.lastname, spro.profile_picture_url FROM student_posts sp LEFT JOIN register r ON sp.student_id = r.user_id LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id ORDER BY sp.created_at DESC LIMIT 30`);
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

// ... (ส่วน getRecommendedCourses และ getStudyBuddyRecommendations คงเดิม ใช้ได้ดีแล้ว) ...
// เพื่อความครบถ้วน ถ้าต้องการแปะทับไฟล์ ให้คงฟังก์ชันที่เหลือไว้ด้านล่างนี้ได้เลยครับ

exports.getRecommendedCourses = async (req, res) => {
    // ... (ใช้โค้ดเดิมจาก Turn 18 ได้เลยครับ ส่วนนี้ไม่มีปัญหาเรื่อง Time Decay) ...
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
                 (SELECT COUNT(*) FROM student_post_offers WHERE student_post_id = sp.student_post_id AND status = 'approved') AS has_tutor
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
            join_count: Number(p.join_count || 0), has_tutor: Number(p.has_tutor) > 0,
            createdAt: p.created_at, post_type: 'student'
        }));
        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getStudyBuddyRecommendations = async (req, res) => {
    // ... (ใช้โค้ดเดิมจาก Turn 18 ได้เลยครับ) ...
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
            // Clean string: remove emojis, special chars, extra spaces, lowercase
            let clean = rawTerm.trim().toLowerCase().replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s]/g, '');
            if (clean.length < 2) return; // Skip too short

            // Check map
            let key = normalizeMap[clean] || clean;

            // Standardize capitalization for Thai/English mixed display if needed, 
            // but for aggregation use the mapped key.

            if (!scores[key]) scores[key] = 0;
            scores[key] += (count * weight);
        };

        searches.forEach(s => processTerm(s.keyword, s.count, 1.0));
        studentPosts.forEach(s => processTerm(s.subject, s.count, 3.0)); // Weight actual posts higher

        // Convert to array
        let trending = Object.entries(scores)
            .map(([key, score]) => {
                // Formatting Title for Display (Capitalize English)
                let title = key.charAt(0).toUpperCase() + key.slice(1);
                return {
                    key: key,
                    title: title,
                    score: score,
                    tutorCount: Math.ceil(score) // Estimate 'stats' based on score
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
