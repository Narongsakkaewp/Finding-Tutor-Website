// src/controllers/favoriteController.js
const pool = require('../../db'); // ✅ Path นี้ถูกแล้ว ถ้าไฟล์อยู่ที่ src/controllers/
console.log("FavoriteController loaded/updated at " + new Date().toISOString());

// 1. กดถูกใจ / ยกเลิกถูกใจ (Toggle Like)
exports.toggleLike = async (req, res) => {
    const { user_id, post_id, post_type } = req.body;

    // Validation
    if (!user_id || !post_id || !['student', 'tutor'].includes(post_type)) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. เช็คว่าเคยไลค์ไหม
        const [have] = await conn.query(
            'SELECT fav_id FROM posts_favorites WHERE user_id = ? AND post_id = ? AND post_type = ?',
            [user_id, post_id, post_type]
        );

        let action = 'added';
        if (have.length > 0) {
            // Un-like: ลบออก
            await conn.query(
                'DELETE FROM posts_favorites WHERE user_id = ? AND post_id = ? AND post_type = ?',
                [user_id, post_id, post_type]
            );
            action = 'unliked'; // หรือ 'removed' ตาม Frontend เช็ค
        } else {
            // Like: เพิ่มใหม่
            await conn.query(
                'INSERT INTO posts_favorites (user_id, post_id, post_type, created_at) VALUES (?, ?, ?, NOW())',
                [user_id, post_id, post_type]
            );
            action = 'liked'; // หรือ 'added'
        }

        // 2. ⚠️ สำคัญ: นับจำนวนไลก์ล่าสุด เพื่อส่งกลับไปให้หน้าเว็บแสดงผล
        const [cntRows] = await conn.query(
            'SELECT COUNT(*) AS c FROM posts_favorites WHERE post_type = ? AND post_id = ?',
            [post_type, post_id]
        );
        const fav_count = Number(cntRows[0]?.c || 0);

        // 3. ⚠️ สำคัญ: อัปเดตลงตารางโพสต์ (เพื่อให้ Query Feed เร็วขึ้น)
        if (post_type === 'student') {
            await conn.query('UPDATE student_posts SET fav_count = ? WHERE student_post_id = ?', [fav_count, post_id]);
        } else {
            await conn.query('UPDATE tutor_posts SET fav_count = ? WHERE tutor_post_id = ?', [fav_count, post_id]);
        }

        await conn.commit();

        // ส่งค่า fav_count กลับไปด้วย เพื่อให้หน้าเว็บอัปเดตเลข
        return res.json({ success: true, action, fav_count });

    } catch (err) {
        await conn.rollback();
        console.error('Toggle Like Error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        conn.release();
    }
};

// 2. ดึงรายการโปรดทั้งหมดของผู้ใช้ (Get My Favorites)
exports.getMyFavorites = async (req, res) => {
    const { user_id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT 
                f.post_type, 
                f.post_id, 
                f.created_at,
                
                -- ✅ ดึงข้อมูลโพสต์ (รวมทั้งของ Student และ Tutor)
                COALESCE(sp.subject, tp.subject) AS subject,
                COALESCE(sp.description, tp.description) AS description,
                COALESCE(sp.location, tp.location) AS location,
                COALESCE(sp.contact_info, tp.contact_info) AS contact_info, -- 🔥 เพิ่มอันนี้ครับ
                COALESCE(sp.grade_level, tp.target_student_level) AS grade_level,
                COALESCE(sp.preferred_days, tp.teaching_days) AS preferred_days,
                COALESCE(sp.preferred_time, tp.teaching_time) AS preferred_time,
                sp.budget, 
                tp.price,

                COALESCE(r_s.name, r_t.name) AS author, -- (Frontend คุณใช้ชื่อตัวแปร author)
                COALESCE(spro.profile_picture_url, tpro.profile_picture_url) AS profile_picture_url

            FROM posts_favorites f
            LEFT JOIN student_posts sp ON f.post_type='student' AND f.post_id = sp.student_post_id
            LEFT JOIN register r_s ON sp.student_id = r_s.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
            
            -- 🔵 จอยฝั่งติวเตอร์
            LEFT JOIN tutor_posts tp ON f.post_type='tutor' AND f.post_id = tp.tutor_post_id
            LEFT JOIN register r_t ON tp.tutor_id = r_t.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id

            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `, [user_id]);

        res.json({ success: true, items: rows });
    } catch (err) {
        console.error('Get Favorites Error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
};

// 3. ระบบแนะนำติวเตอร์ตามความชอบ (Recommendation System)
exports.getRecommendedFeed = async (req, res) => {
    const { studentId } = req.params;
    try {
        // 1. หาความสนใจ (จากประวัติการกดไลก์)
        const [favSubjects] = await pool.query(`
            SELECT DISTINCT COALESCE(tp.subject, sp.subject) as subject
            FROM posts_favorites pf
            LEFT JOIN tutor_posts tp ON pf.post_id = tp.tutor_post_id AND pf.post_type = 'tutor'
            LEFT JOIN student_posts sp ON pf.post_id = sp.student_post_id AND pf.post_type = 'student'
            WHERE pf.user_id = ?
        `, [studentId]);

        const interests = favSubjects.map(row => row.subject).filter(s => s);

        // 2. Query Tutor Posts (ดึง price)
        let tutorSql = `
            SELECT tp.tutor_post_id, tp.tutor_id, tp.subject, tp.description, 
                   tp.location, tp.price, tp.created_at, tp.fav_count,
                   'tutor' as post_type,
                   r.name, r.lastname, tpro.profile_picture_url 
            FROM tutor_posts tp 
            JOIN register r ON tp.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
        `;

        // 3. Query Student Posts (ดึง budget ตามชื่อจริงใน DB)
        let studentSql = `
            SELECT sp.student_post_id, sp.student_id, sp.subject, sp.description, 
                   sp.location, sp.budget, sp.created_at, sp.fav_count,
                   'student' as post_type,
                   r.name, r.lastname, spro.profile_picture_url
            FROM student_posts sp
            JOIN register r ON sp.student_id = r.user_id
            LEFT JOIN student_profiles spro ON sp.student_id = spro.user_id
        `;

        const [tutorPosts] = await pool.query(tutorSql);
        const [studentPosts] = await pool.query(studentSql);

        // 4. รวมและจัดลำดับ
        let allPosts = [...tutorPosts, ...studentPosts];

        if (interests.length > 0) {
            allPosts = allPosts.map(post => {
                const score = interests.includes(post.subject) ? 2 : 0;
                return { ...post, score };
            }).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return new Date(b.created_at) - new Date(a.created_at);
            });
        } else {
            allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const topPosts = allPosts.slice(0, 20);

        res.json({ success: true, recommended_subjects: interests, posts: topPosts });

    } catch (err) {
        console.error('Recommendation Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};