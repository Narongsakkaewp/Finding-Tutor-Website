// tutorweb-sever/src/controllers/scheduleController.js
const pool = require('../../db');

// Helper: Get Day Names
function getDayNames(date) {
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysEnShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const daysThFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const dayIndex = date.getDay();
    return [daysEn[dayIndex], daysEnShort[dayIndex], daysTh[dayIndex], daysThFull[dayIndex]];
}

// Helper: Date Matching Logic (Shared with Cron)
function isDayMatch(daysString, targetDayNames, targetDate) {
    if (!daysString) return false;
    const str = String(daysString).trim();
    const lowerStr = str.toLowerCase();

    // 1. Recurring Day Name
    const isRecurring = targetDayNames.some(d => lowerStr.includes(d.toLowerCase()));
    if (isRecurring) return true;

    // 2. Specific Date logic
    try {
        const dmy = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (dmy) {
            const d = parseInt(dmy[1], 10);
            const m = parseInt(dmy[2], 10) - 1;
            let y = parseInt(dmy[3], 10);
            if (y > 2400) y -= 543;
            const matchDate = new Date(y, m, d);
            return isSameDate(matchDate, targetDate);
        }
        const ymd = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (ymd) {
            const y = parseInt(ymd[1], 10);
            const m = parseInt(ymd[2], 10) - 1;
            const d = parseInt(ymd[3], 10);
            const matchDate = new Date(y, m, d);
            return isSameDate(matchDate, targetDate);
        }
    } catch (e) { }
    return false;
}

function isSameDate(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

async function getAlertsForDate(conn, userId, targetDate, type, notificationDate) {
    const alerts = [];
    const dayNames = getDayNames(targetDate);

    // Fix: Use Local Date for SQL (avoid UTC mismatch)
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const sqlDate = `${yyyy}-${mm}-${dd}`;

    // Fix: Set created_at to 05:00 AM of the NOTIFICATION DATE
    const alertTime = new Date(notificationDate);
    alertTime.setHours(5, 0, 0, 0);
    const alertTimestamp = alertTime.toISOString();

    console.log(`[ScheduleAPI] 🔎 Checking ${type} for ${sqlDate} (UserID: ${userId})`);

    try {
        // 1. Check Student Posts (Owners & Joiners)
        const [sp] = await conn.query(`
            SELECT DISTINCT sp.student_post_id, sp.subject, sp.preferred_days
            FROM student_posts sp
            LEFT JOIN student_post_joins j ON j.student_post_id = sp.student_post_id AND j.status = 'approved' AND j.user_id = ?
            WHERE (sp.student_id = ? AND EXISTS (SELECT 1 FROM student_post_joins WHERE student_post_id = sp.student_post_id AND status='approved'))
               OR (j.user_id IS NOT NULL)
        `, [userId, userId]);

        sp.forEach(post => {
            if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
                if (!alerts.some(a => String(a.related_id) === String(post.student_post_id))) {
                    alerts.push({
                        type: type.replace('schedule', 'schedule_student'), // [FIX]
                        related_id: post.student_post_id, post_subject: post.subject,
                        actor_firstname: 'ระบบ', actor_lastname: '',
                        created_at: alertTimestamp
                    });
                }
            }
        });

        // 2. Check Tutor Posts (Owners & Joiners)
        // [FIX] For Owner (Tutor): Show all posts regardless of join status (Matches Calendar Logic)
        const [tp] = await conn.query(`
            SELECT DISTINCT tp.tutor_post_id, tp.subject, tp.teaching_days
            FROM tutor_posts tp
            LEFT JOIN tutor_post_joins j ON j.tutor_post_id = tp.tutor_post_id AND j.status = 'approved' AND j.user_id = ?
            WHERE (tp.tutor_id = ?) 
               OR (j.user_id IS NOT NULL)
        `, [userId, userId]);

        tp.forEach(post => {
            if (isDayMatch(post.teaching_days, dayNames, targetDate)) {
                if (!alerts.some(a => String(a.related_id) === String(post.tutor_post_id))) {
                    alerts.push({
                        type: type.replace('schedule', 'schedule_tutor'), // [FIX]
                        related_id: post.tutor_post_id, post_subject: post.subject,
                        actor_firstname: 'ระบบ', actor_lastname: '',
                        created_at: alertTimestamp
                    });
                }
            }
        });

        // 3. Check OFFERS (Tutor offers to teach Student, and Acccepted)
        const [offers] = await conn.query(`
            SELECT DISTINCT sp.student_post_id, sp.subject, sp.preferred_days
            FROM student_posts sp
            JOIN student_post_offers o ON o.student_post_id = sp.student_post_id
            WHERE o.status = 'approved' 
              AND (o.tutor_id = ? OR sp.student_id = ?)
        `, [userId, userId]);

        offers.forEach(post => {
            if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
                if (!alerts.some(a => String(a.related_id) === String(post.student_post_id))) {
                    alerts.push({
                        type: type.replace('schedule', 'schedule_student'), // [FIX]
                        related_id: post.student_post_id, post_subject: post.subject,
                        actor_firstname: 'ระบบ', actor_lastname: '',
                        created_at: alertTimestamp
                    });
                }
            }
        });

        // 4. Check Calendar Events (Fallback)
        const [events] = await conn.query(`
            SELECT post_id, title, subject 
            FROM calendar_events 
            WHERE user_id = ? AND event_date = ?
        `, [userId, sqlDate]);

        events.forEach(e => {
            const subject = e.subject || e.title || "";
            const id = e.post_id || 0;
            if (!alerts.some(a => String(a.related_id) === String(id) && a.related_id !== 0)) {
                alerts.push({
                    type, related_id: id, post_subject: subject,
                    actor_firstname: 'ระบบ', actor_lastname: '',
                    created_at: alertTimestamp
                });
            }
        });

    } catch (err) {
        console.error(`[ScheduleAPI] Error getting alerts for date ${sqlDate}:`, err);
    }

    return alerts;
}

exports.getScheduleAlerts = async (req, res) => {
    try {
        const userId = Number(req.params.userId);


        if (!userId) {
            console.log('[ScheduleAPI] No UserID provided');
            return res.json([]);
        }

        const today = new Date();
        console.log(`[ScheduleAPI] Fetching for User ${userId} at ${today.toISOString()}`);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const conn = req.db;

        // Get Today's Alerts (Notification Date = Today)
        const todayAlerts = await getAlertsForDate(conn, userId, today, 'schedule_today', today);

        // Get Tomorrow's Alerts (Notification Date = Today, but Target Date = Tomorrow)
        const tomorrowAlerts = await getAlertsForDate(conn, userId, tomorrow, 'schedule_tomorrow', today);

        res.json([...todayAlerts, ...tomorrowAlerts]);

    } catch (err) {
        console.error("Schedule Alert Error TRACE:", err);
        res.status(500).json({ error: "Server Error" });
    }
};
