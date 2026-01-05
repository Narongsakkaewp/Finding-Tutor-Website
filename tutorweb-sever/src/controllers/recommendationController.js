// src/controllers/recommendationController.js
const pool = require('../../db');
const geolib = require('geolib');

// --- เกณฑ์คะแนน (Configurable Weights) ---
const WEIGHTS = {
    SUBJECT: 40,      // วิชาตรงกัน (สำคัญสุด)
    GRADE: 20,        // ระดับชั้นสอนได้
    BUDGET: 20,       // ราคาอยู่ในงบ
    LOCATION: 20      // ระยะทางใกล้ (หรือสถานที่ตรง)
};

// ฟังก์ชันคำนวณคะแนน (Core Logic)
const calculateRelevanceScore = (studentReq, tutorPost) => {
    let score = 0;

    // 1. เช็ควิชา (Subject) - ใช้การค้นหาคำ (Partial Match)
    // เช่น นร.หา "คณิต" เจอครูสอน "คณิตศาสตร์ ม.ปลาย" ถือว่าตรง
    if (tutorPost.subject.includes(studentReq.subject) || studentReq.subject.includes(tutorPost.subject)) {
        score += WEIGHTS.SUBJECT;
    }

    // 2. เช็คระดับชั้น (Grade Level)
    // สมมติใน DB เก็บเป็น string คั่นด้วยคอมม่า เช่น "ม.ต้น,ม.ปลาย"
    if (tutorPost.target_student_level && studentReq.grade_level) {
        if (tutorPost.target_student_level.includes(studentReq.grade_level)) {
            score += WEIGHTS.GRADE;
        }
    }

    // 3. เช็คราคา (Price/Budget)
    // ถ้าราคาครู ต่ำกว่าหรือเท่ากับ งบนักเรียน (หรือเกินได้นิดหน่อย +20%)
    if (tutorPost.price <= (studentReq.budget * 1.2)) {
        score += WEIGHTS.BUDGET;
    }

    // 4. เช็คสถานที่ (Location)
    // กรณีที่ 1: ใช้ Lat/Lon คำนวณระยะทาง (ถ้ามี geolib และมีพิกัดทั้งคู่)
    if (studentReq.lat && studentReq.lon && tutorPost.lat && tutorPost.lon) {
        const distance = geolib.getDistance(
            { latitude: studentReq.lat, longitude: studentReq.lon },
            { latitude: tutorPost.lat, longitude: tutorPost.lon }
        );
        // ถ้าห่างกันไม่เกิน 15 กม. ให้คะแนนเต็ม
        if (distance <= 15000) { 
            score += WEIGHTS.LOCATION;
        } else if (distance <= 30000) {
            score += (WEIGHTS.LOCATION / 2); // ห่างไม่เกิน 30 กม. ให้ครึ่งเดียว
        }
    } 
    // กรณีที่ 2: ไม่มีพิกัด ใช้เช็คชื่อสถานที่เอา (String Match)
    else if (tutorPost.location && studentReq.location) {
        if (tutorPost.location.includes(studentReq.location) || studentReq.location.includes(tutorPost.location)) {
            score += WEIGHTS.LOCATION;
        }
    }

    return score;
};

exports.getRecommendations = async (req, res) => {
    try {
        const userId = req.query.user_id;

        // ถ้าไม่มี user_id (Guest) ให้ส่งโพสต์ล่าสุดไปแทน
        if (!userId || userId === '0') {
            const [rows] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(rows);
        }

        // STEP 1: หา "ความต้องการ" ของนักเรียน (Student Needs)
        // ดึงจากโพสต์ล่าสุดที่นักเรียนคนนี้เคยโพสต์หาครู (เพราะสะท้อนความต้องการปัจจุบันที่สุด)
        const [studentRequests] = await pool.query(
            `SELECT subject, grade_level, budget, location, lat, lon 
             FROM student_posts 
             WHERE owner_id = ? 
             ORDER BY created_at DESC LIMIT 1`, 
            [userId]
        );

        // ถ้าไม่เคยโพสต์หาครูเลย ให้ไปดึงจาก Profile แทน (ถ้ามี field สนใจ) หรือส่งค่า Default
        let requirement = studentRequests[0];
        if (!requirement) {
            // Fallback: ดึงโพสต์ติวเตอร์ล่าสุดไปเลย
            const [fallback] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(fallback);
        }

        // STEP 2: ดึงโพสต์ติวเตอร์ทั้งหมดมาเปรียบเทียบ
        // (ในอนาคตถ้าข้อมูลเยอะ อาจจะดึงแค่ Active หรือเฉพาะวิชาที่ใกล้เคียงก่อนเพื่อ Performance)
        const [tutorPosts] = await pool.query(`
            SELECT 
                tp.*, 
                u.name as first_name, u.lastname as last_name, 
                COALESCE(tp.profile_image, u.profile_picture_url) as profile_image
            FROM tutor_posts tp
            JOIN register u ON tp.tutor_id = u.user_id
        `);

        // STEP 3: วนลูปคำนวณคะแนน
        const scoredTutors = tutorPosts.map(post => {
            const score = calculateRelevanceScore(requirement, post);
            return { ...post, relevance_score: score };
        });

        // STEP 4: เรียงลำดับจากคะแนนมาก -> น้อย
        scoredTutors.sort((a, b) => b.relevance_score - a.relevance_score);

        // STEP 5: ส่งคืน Top 6-10 อันดับแรก
        const topRecommendations = scoredTutors.slice(0, 6);

        res.json({
            based_on: requirement.subject, // บอก Frontend ว่าแนะนำจากวิชาอะไร
            items: topRecommendations
        });

    } catch (err) {
        console.error("Recommendation Error:", err);
        res.status(500).json({ error: 'Server error in recommendation' });
    }
};