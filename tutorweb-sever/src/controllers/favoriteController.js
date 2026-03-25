// tutorweb-sever/src/controllers/favoriteController.js
const pool = require('../../db'); // ✅ Path นี้ถูกแล้ว ถ้าไฟล์อยู่ที่ src/controllers/
const { getMixedFeedRecommendations } = require('../utils/discoveryEngine');
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
        const result = await getMixedFeedRecommendations(pool, Number(studentId), { limit: 20 });
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Recommendation Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 4. กดติดตามติวเตอร์ (Follow/Favorite Tutor)
exports.toggleTutorLike = async (req, res) => {
    const { user_id, tutor_id } = req.body;

    if (!user_id || !tutor_id) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Check existing
        const [have] = await conn.query(
            'SELECT * FROM tutor_favorites WHERE user_id = ? AND tutor_id = ?',
            [user_id, tutor_id]
        );

        let action = 'added';
        if (have.length > 0) {
            // Remove
            await conn.query(
                'DELETE FROM tutor_favorites WHERE user_id = ? AND tutor_id = ?',
                [user_id, tutor_id]
            );
            action = 'removed';
        } else {
            // Add
            await conn.query(
                'INSERT INTO tutor_favorites (user_id, tutor_id, created_at) VALUES (?, ?, NOW())',
                [user_id, tutor_id]
            );
            action = 'added';
        }

        await conn.commit();
        res.json({ success: true, action });

    } catch (err) {
        await conn.rollback();
        console.error('Toggle Tutor Like Error:', err);
        res.status(500).json({ success: false, message: 'Database error', error: err.message });
    } finally {
        conn.release();
    }
};

// 5. ดึงรายชื่อติวเตอร์ที่ติดตาม
exports.getMyTutorFavorites = async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT 
                r.user_id, r.name, r.lastname, r.email, r.username,
                tp.nickname, tp.can_teach_subjects, tp.profile_picture_url, 
                tp.address as location, tp.phone,
                tp.can_teach_grades, tp.about_me,
                tf.created_at as liked_at,
                -- Review stats
                COALESCE(rv.avg_rating, 0) AS avg_rating,
                COALESCE(rv.review_count, 0) AS review_count
            FROM tutor_favorites tf
            JOIN register r ON tf.tutor_id = r.user_id
            LEFT JOIN tutor_profiles tp ON r.user_id = tp.user_id
            LEFT JOIN (
                SELECT tutor_id, AVG(rating) as avg_rating, COUNT(*) as review_count
                FROM reviews
                GROUP BY tutor_id
            ) rv ON r.user_id = rv.tutor_id
            WHERE tf.user_id = ?
            ORDER BY tf.created_at DESC
        `, [userId]);

        const items = rows.map(r => {
            const contactParts = [];
            if (r.phone) contactParts.push(`Tel: ${r.phone}`);
            if (r.email) contactParts.push(`Email: ${r.email}`);

            return {
                post_type: 'tutor_profile',
                uniqueId: `tutor-${r.user_id}`,
                post_id: r.user_id,
                authorName: `${r.name} ${r.lastname}`.trim(),
                username: r.username,
                nickname: r.nickname,
                title: r.can_teach_subjects || "ติวเตอร์",
                body: r.about_me || "ไม่ได้ระบุข้อมูลแนะนำตัว",
                profile_picture_url: r.profile_picture_url || '/../blank_avatar.jpg',
                location: r.location,
                priceDisplay: 0, // ไม่มี col price ใน tutor_profiles
                contact_info: contactParts.join('\n') || "ไม่ระบุข้อมูลติดต่อ",
                rating: Number(r.avg_rating || 0),
                reviews: Number(r.review_count || 0),
                likedAt: r.liked_at,
                grade: r.can_teach_grades, // Map to grade
                preferred_days: "-", // ไม่มีข้อมูล
                preferred_time: "-"  // ไม่มีข้อมูล
            };
        });

        res.json({ success: true, items });
    } catch (err) {
        console.error('Get Tutor Favorites Error:', err);
        res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
};
