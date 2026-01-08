// src/controllers/recommendationController.js
const geolib = require('geolib');

const SUBJECT_KNOWLEDGE_BASE = {
    // หมวด Coding / Computer
    'program': ['code', 'python', 'java', 'c++', 'html', 'css', 'react', 'node', 'sql', 'คอมพิวเตอร์'],
    'code':    ['program', 'python', 'java', 'script', 'web', 'app', 'dev'],
    'คอม':     ['com', 'it', 'program', 'excel', 'word', 'powerpoint'],
    // หมวดคำนวณ
    'คณิต':    ['math', 'cal', 'เลข', 'algebra', 'stat'],
    'math':    ['คณิต', 'cal', 'เลข'],
    'phy':     ['ฟิสิกส์', 'sci', 'กลศาสตร์'],
    // หมวดภาษา
    'eng':     ['อังกฤษ', 'english', 'toefl', 'ielts', 'toeic', 'conversation'],
    'jap':     ['ญี่ปุ่น', 'japanese', 'n5', 'n4', 'n3'],
    'จีน':      ['chinese', 'hsk'],
    // หมวดวิทย์
    'sci':     ['วิทย์', 'bio', 'chem', 'phy', 'ดาราศาสตร์'],
    'chem':    ['เคมี', 'sci'],
    'bio':     ['ชีว', 'sci']
};

// ฟังก์ชันช่วยขยายคำค้นหา (Input: "เรียน code" -> Output: ["code", "program", "python", ...])
const expandKeywords = (text) => {
    if (!text) return [];
    let keywords = [text.toLowerCase()];
    
    // วนลูปเช็คว่าคำใน text ตรงกับหมวดหมู่ไหนบ้าง
    Object.keys(SUBJECT_KNOWLEDGE_BASE).forEach(key => {
        if (text.toLowerCase().includes(key)) {
            keywords = [...keywords, ...SUBJECT_KNOWLEDGE_BASE[key]];
        }
    });
    return keywords;
};

// --- เกณฑ์คะแนน (ปรับจูนได้) ---
const WEIGHTS = {
    SUBJECT_EXACT: 60,   // ตรงเป๊ะ
    SUBJECT_RELATED: 40, // คำใกล้เคียง (เช่น หาคอม เจอ Python)
    GRADE: 20,
    BUDGET: 15,
    LOCATION: 25
};

const calculateRelevanceScore = (studentReq, tutorPost) => {
    let score = 0;

    const reqSubjectRaw = (studentReq.subject || "").toLowerCase();
    const tutorSubjectRaw = (tutorPost.subject || "").toLowerCase();
    
    // ==========================================
    // 🧠 LOGIC 1: Smart Subject Matching (ฉลาดขึ้น)
    // ==========================================
    
    // 1.1 เช็คแบบตรงตัว (Exact Match) - ได้คะแนนเยอะสุด
    if (tutorSubjectRaw.includes(reqSubjectRaw) || reqSubjectRaw.includes(tutorSubjectRaw)) {
        score += WEIGHTS.SUBJECT_EXACT;
    } 
    else {
        // 1.2 เช็คแบบคำใกล้เคียง (Related Match)
        // ขยายคำค้นหาของนักเรียน เช่น "เขียนโปรแกรม" -> ["program", "code", "python", "java"...]
        const expandedKeywords = expandKeywords(reqSubjectRaw);
        
        // ถ้าวิชาของติวเตอร์ มีคำใดคำหนึ่งในกลุ่มคำที่ขยายออกมา
        const isRelated = expandedKeywords.some(kw => tutorSubjectRaw.includes(kw));
        
        if (isRelated) {
            score += WEIGHTS.SUBJECT_RELATED; // ได้คะแนนรองลงมา
        }
    }

    // ==========================================
    // 🧠 LOGIC 2: Flexible Budget (ยืดหยุ่น)
    // ==========================================
    // ถ้าราคาถูกกว่างบ ยิ่งดี (ให้คะแนนเต็ม)
    // ถ้าราคาแพงกว่างบได้ไม่เกิน 20% (ให้คะแนนครึ่งเดียว)
    const budget = Number(studentReq.budget) || 9999;
    const price = Number(tutorPost.price) || 0;

    if (price <= budget) {
        score += WEIGHTS.BUDGET;
    } else if (price <= budget * 1.2) {
        score += (WEIGHTS.BUDGET / 2); // ยอมให้แพงกว่าได้นิดหน่อย แต่คะแนนลดลง
    }

    // ==========================================
    // 🧠 LOGIC 3: Grade Matching
    // ==========================================
    const reqGrade = studentReq.grade_level || "";
    const tutorTarget = tutorPost.target_student_level || "";
    if (tutorTarget && reqGrade) {
        if (tutorTarget.includes(reqGrade) || reqGrade.includes("บุคคลทั่วไป")) {
            score += WEIGHTS.GRADE;
        }
    }

    // ==========================================
    // 🧠 LOGIC 4: Location (Geo or String)
    // ==========================================
    const reqLocation = studentReq.location || "";
    const tutorLocation = tutorPost.location || "";

    // ใช้ Lat/Lon คำนวณ (ถ้ามี)
    if (studentReq.lat && studentReq.lon && tutorPost.lat && tutorPost.lon) {
        const distance = geolib.getDistance(
            { latitude: studentReq.lat, longitude: studentReq.lon },
            { latitude: tutorPost.lat, longitude: tutorPost.lon }
        );
        // < 10 km = เต็ม, < 30 km = ครึ่งหนึ่ง
        if (distance <= 10000) score += WEIGHTS.LOCATION;
        else if (distance <= 30000) score += (WEIGHTS.LOCATION / 2);
    } 
    // ใช้ชื่อสถานที่ (Text)
    else if (tutorLocation && reqLocation) {
        if (tutorLocation.includes(reqLocation) || reqLocation.includes(tutorLocation)) {
            score += WEIGHTS.LOCATION;
        }
    }

    return score;
};

exports.getRecommendations = async (req, res) => {
    try {
        const pool = req.db; 
        if (!pool) return res.status(500).json({ error: 'Database connection failed' });

        const userId = req.query.user_id;

        // Guest: ส่งล่าสุดไปเลย
        if (!userId || userId === '0') {
            const [rows] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(rows);
        }

        // 1. ดึงความต้องการจาก "โพสต์ล่าสุด" ของนักเรียน
        const [studentRequests] = await pool.query(
            `SELECT subject, grade_level, budget, location 
             FROM student_posts 
             WHERE student_id = ? 
             ORDER BY created_at DESC LIMIT 1`, 
            [userId]
        );

        let requirement = studentRequests[0];

        // ⚠️ Fallback: ถ้าไม่เคยโพสต์ ให้ลองไปดึงจาก "Profile" ที่เขากรอกสนใจไว้ (ถ้ามี)
        if (!requirement) {
            // (สมมติว่าคุณมี column 'interested_subjects' ใน student_profiles)
            // const [profile] = await pool.query('SELECT interested_subjects FROM student_profiles WHERE user_id = ?', [userId]);
            // requirement = { subject: profile[0]?.interested_subjects || "" ... }
            
            // ถ้าไม่มีจริงๆ ส่งติวเตอร์ล่าสุดไป
            const [fallback] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
            return res.json(fallback);
        }

        // 2. ดึงติวเตอร์ทั้งหมด (Join เอาชื่อและรูป)
        const [tutorPosts] = await pool.query(`
            SELECT 
                tp.*, 
                r.name, r.lastname, 
                tpro.profile_picture_url
            FROM tutor_posts tp
            LEFT JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
        `);

        // 3. ให้คะแนนความฉลาด
        const scoredTutors = tutorPosts.map(post => {
            const score = calculateRelevanceScore(requirement, post);
            return { ...post, relevance_score: score };
        });

        // 4. เรียงลำดับ (คะแนนมากขึ่นก่อน)
        scoredTutors.sort((a, b) => b.relevance_score - a.relevance_score);

        // 5. ตัดเอาเฉพาะที่มีคะแนน > 0 (ถ้าคะแนน 0 แปลว่าไม่เกี่ยวเลย ไม่ต้องแนะนำ)
        const filteredTutors = scoredTutors.filter(t => t.relevance_score > 0).slice(0, 6);

        // ถ้ากรองแล้วไม่เหลือใครเลย (Empty) ให้ส่งตัวล่าสุดไปแทน (User จะได้ไม่เห็นหน้าจอโล่งๆ)
        if (filteredTutors.length === 0) {
             const [fallback] = await pool.query('SELECT * FROM tutor_posts ORDER BY created_at DESC LIMIT 6');
             return res.json({
                 based_on: "โพสต์ล่าสุด (เนื่องจากไม่พบคนที่ตรงเงื่อนไข)",
                 items: fallback
             });
        }

        res.json({
            based_on: requirement.subject,
            items: filteredTutors
        });

    } catch (err) {
        console.error("❌ Recommendation Error:", err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};