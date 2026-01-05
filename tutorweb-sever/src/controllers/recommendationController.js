// src/controllers/recommendationController.js
const geolib = require('geolib');

// --- เกณฑ์คะแนน ---
const WEIGHTS = {
    SUBJECT: 40,
    GRADE: 20,
    BUDGET: 20,
    LOCATION: 20
};

const calculateRelevanceScore = (studentReq, tutorPost) => {
    let score = 0;

    // กันค่า Null
    const reqSubject = studentReq.subject || "";
    const tutorSubject = tutorPost.subject || "";
    const reqGrade = studentReq.grade_level || "";
    const tutorTarget = tutorPost.target_student_level || ""; // แก้ให้ตรงกับ DB
    const reqLocation = studentReq.location || "";
    const tutorLocation = tutorPost.location || "";

    // 1. วิชา
    if (tutorSubject.includes(reqSubject) || reqSubject.includes(tutorSubject)) {
        score += WEIGHTS.SUBJECT;
    }

    // 2. ระดับชั้น
    if (tutorTarget && reqGrade) {
        if (tutorTarget.includes(reqGrade)) {
            score += WEIGHTS.GRADE;
        }
    }

    // 3. ราคา (งบนักเรียน vs ราคาครู)
    // หมายเหตุ: เช็คให้ดีว่า studentReq.budget เป็น number
    if (tutorPost.price <= (studentReq.budget * 1.2)) {
        score += WEIGHTS.BUDGET;
    }

    // 4. สถานที่
    // กรณีมี Lat/Lon (ถ้า Database คุณเก็บ)
    if (studentReq.lat && studentReq.lon && tutorPost.lat && tutorPost.lon) {
        const distance = geolib.getDistance(
            { latitude: studentReq.lat, longitude: studentReq.lon },
            { latitude: tutorPost.lat, longitude: tutorPost.lon }
        );
        if (distance <= 15000) score += WEIGHTS.LOCATION;
        else if (distance <= 30000) score += (WEIGHTS.LOCATION / 2);
    } 
    // กรณีใช้ชื่อสถานที่
    else if (tutorLocation && reqLocation) {
        if (tutorLocation.includes(reqLocation) || reqLocation.includes(tutorLocation)) {
            score += WEIGHTS.LOCATION;
        }
    }

    return score;
};

exports.getRecommendations = async (req, res) => {
    try {
        // ✅ 1. ดึง DB จาก req ที่ฝากไว้ใน server.js
        const pool = req.db; 
        if (!pool) {
            console.error("❌ Database pool not found in req.db");
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const userId = req.query.user_id;
        console.log(`🔍 Recommend for User ID: ${userId}`);

        // Guest User
        if (!userId || userId === '0') {
            const [rows] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(rows);
        }

        // ✅ 2. แก้ชื่อคอลัมน์จาก owner_id เป็น student_id
        // และดึง grade_level ให้ถูกต้อง
        const [studentRequests] = await pool.query(
            `SELECT subject, grade_level, budget, location 
             FROM student_posts 
             WHERE student_id = ? 
             ORDER BY created_at DESC LIMIT 1`, 
            [userId]
        );

        let requirement = studentRequests[0];
        
        // ถ้าไม่เคยโพสต์ ให้ดึงล่าสุดมาโชว์แทน (Fallback)
        if (!requirement) {
            console.log("⚠️ No student requirement found, returning recent posts.");
            const [fallback] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(fallback);
        }

        console.log("✅ Student Requirement:", requirement);

        // ✅ 3. แก้ Query ดึงข้อมูล Tutor (JOIN ให้ถูกต้อง)
        // ตารางคุณชื่อ tutor_posts และ register
        const [tutorPosts] = await pool.query(`
            SELECT 
                tp.*, 
                r.name, r.lastname, 
                tpro.profile_picture_url
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
        `);

        // 4. คำนวณคะแนน
        const scoredTutors = tutorPosts.map(post => {
            const score = calculateRelevanceScore(requirement, post);
            return { ...post, relevance_score: score };
        });

        // 5. เรียงลำดับ
        scoredTutors.sort((a, b) => b.relevance_score - a.relevance_score);
        const topRecommendations = scoredTutors.slice(0, 6);

        res.json({
            based_on: requirement.subject,
            items: topRecommendations
        });

    } catch (err) {
        // ✅ 6. Log Error ตัวจริงออกมาดู
        console.error("❌ Recommendation Error Detail:", err);
        res.status(500).json({ error: 'Server error in recommendation', details: err.message });
    }
};