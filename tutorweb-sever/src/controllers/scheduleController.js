const pool = require('../../db');

function getDayNames(date) {
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysEnShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const daysThFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const dayIndex = date.getDay();

    return [daysEn[dayIndex], daysEnShort[dayIndex], daysTh[dayIndex], daysThFull[dayIndex]];
}

function isSameDate(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function isDayMatch(daysString, targetDayNames, targetDate) {
    if (!daysString) return false;
    const str = String(daysString).trim();
    const lowerStr = str.toLowerCase();

    const isRecurring = targetDayNames.some((d) => lowerStr.includes(d.toLowerCase()));
    if (isRecurring) return true;

    try {
        const dmy = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (dmy) {
            const d = parseInt(dmy[1], 10);
            const m = parseInt(dmy[2], 10) - 1;
            let y = parseInt(dmy[3], 10);
            if (y > 2400) y -= 543;
            return isSameDate(new Date(y, m, d), targetDate);
        }

        const ymd = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (ymd) {
            const y = parseInt(ymd[1], 10);
            const m = parseInt(ymd[2], 10) - 1;
            const d = parseInt(ymd[3], 10);
            return isSameDate(new Date(y, m, d), targetDate);
        }
    } catch (e) {
        return false;
    }

    return false;
}

function normalizePostType(postType) {
    const value = String(postType || '').toLowerCase();
    if (value.includes('tutor')) return 'tutor_post';
    if (value.includes('student')) return 'student_post';
    return null;
}

function buildAlert({ type, related_id, post_type, post_subject, created_at }) {
    return {
        type,
        related_id,
        post_type,
        post_subject,
        actor_firstname: 'ระบบ',
        actor_lastname: '',
        created_at,
    };
}

function alertKey(item) {
    return `${item.related_id || 0}:${normalizePostType(item.post_type) || 'unknown'}`;
}

function pushUniqueAlert(alerts, alert) {
    if (!alert.related_id) return;
    if (alerts.some((item) => alertKey(item) === alertKey(alert))) return;
    alerts.push(alert);
}

async function getAlertsForDate(conn, userId, targetDate, type, notificationDate) {
    const alerts = [];
    const dayNames = getDayNames(targetDate);

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const sqlDate = `${yyyy}-${mm}-${dd}`;

    const alertTime = new Date(notificationDate);
    alertTime.setHours(5, 0, 0, 0);
    const alertTimestamp = alertTime.toISOString();

    try {
        const [studentPosts] = await conn.query(`
            SELECT DISTINCT sp.student_post_id, sp.subject, sp.preferred_days
            FROM student_posts sp
            LEFT JOIN student_post_joins j
              ON j.student_post_id = sp.student_post_id
             AND j.status = 'approved'
             AND j.user_id = ?
            WHERE (sp.student_id = ? AND EXISTS (
                SELECT 1
                FROM student_post_joins
                WHERE student_post_id = sp.student_post_id
                  AND status = 'approved'
            ))
               OR (j.user_id IS NOT NULL)
        `, [userId, userId]);

        studentPosts.forEach((post) => {
            if (!isDayMatch(post.preferred_days, dayNames, targetDate)) return;
            pushUniqueAlert(alerts, buildAlert({
                type: type.replace('schedule', 'schedule_student'),
                related_id: post.student_post_id,
                post_type: 'student_post',
                post_subject: post.subject,
                created_at: alertTimestamp,
            }));
        });

        const [tutorPosts] = await conn.query(`
            SELECT DISTINCT tp.tutor_post_id, tp.subject, tp.teaching_days
            FROM tutor_posts tp
            LEFT JOIN tutor_post_joins j
              ON j.tutor_post_id = tp.tutor_post_id
             AND j.status = 'approved'
             AND j.user_id = ?
            WHERE tp.tutor_id = ?
               OR j.user_id IS NOT NULL
        `, [userId, userId]);

        tutorPosts.forEach((post) => {
            if (!isDayMatch(post.teaching_days, dayNames, targetDate)) return;
            pushUniqueAlert(alerts, buildAlert({
                type: type.replace('schedule', 'schedule_tutor'),
                related_id: post.tutor_post_id,
                post_type: 'tutor_post',
                post_subject: post.subject,
                created_at: alertTimestamp,
            }));
        });

        const [offers] = await conn.query(`
            SELECT DISTINCT sp.student_post_id, sp.subject, sp.preferred_days
            FROM student_posts sp
            JOIN student_post_offers o ON o.student_post_id = sp.student_post_id
            WHERE o.status = 'approved'
              AND (o.tutor_id = ? OR sp.student_id = ?)
        `, [userId, userId]);

        offers.forEach((post) => {
            if (!isDayMatch(post.preferred_days, dayNames, targetDate)) return;
            pushUniqueAlert(alerts, buildAlert({
                type: type.replace('schedule', 'schedule_student'),
                related_id: post.student_post_id,
                post_type: 'student_post',
                post_subject: post.subject,
                created_at: alertTimestamp,
            }));
        });

        const [events] = await conn.query(`
            SELECT post_id, post_type, title, subject
            FROM calendar_events
            WHERE user_id = ?
              AND event_date = ?
        `, [userId, sqlDate]);

        events.forEach((event) => {
            const postType = normalizePostType(event.post_type) || 'student_post';
            pushUniqueAlert(alerts, buildAlert({
                type: postType === 'tutor_post'
                    ? type.replace('schedule', 'schedule_tutor')
                    : type.replace('schedule', 'schedule_student'),
                related_id: event.post_id,
                post_type: postType,
                post_subject: event.subject || event.title || '',
                created_at: alertTimestamp,
            }));
        });
    } catch (err) {
        console.error(`[ScheduleAPI] Error getting alerts for date ${sqlDate}:`, err);
    }

    return alerts;
}

exports.getScheduleAlerts = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!userId) return res.json([]);

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const conn = req.db || pool;
        const todayAlerts = await getAlertsForDate(conn, userId, today, 'schedule_today', today);
        const tomorrowAlerts = await getAlertsForDate(conn, userId, tomorrow, 'schedule_tomorrow', today);

        res.json([...todayAlerts, ...tomorrowAlerts]);
    } catch (err) {
        console.error('Schedule Alert Error TRACE:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};
