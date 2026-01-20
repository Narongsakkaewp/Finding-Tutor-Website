const cron = require('node-cron');
const pool = require('../../db');

// Helper: Get Day Names for matching
function getDayNames(date) {
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysEnShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const daysThFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

    const dayIndex = date.getDay();
    return [
        daysEn[dayIndex],
        daysEnShort[dayIndex],
        daysTh[dayIndex],
        daysThFull[dayIndex]
    ];
}

async function checkAndSendNotifications() {
    console.log('⏰ [Cron] Running Scheduled Notification Check...');
    const conn = await pool.getConnection();

    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayNames = getDayNames(today);
        const tomorrowNames = getDayNames(tomorrow);

        // 1. Check for "Tomorrow" Classes
        console.log(`🔎 [Cron] Checking Tomorrow: ${tomorrow.toDateString()}`);
        await processNotifications(conn, tomorrowNames, tomorrow, 'schedule_tomorrow', 'พรุ่งนี้คุณมีนัดติว/สอน');
        await processCalendarEvents(conn, tomorrow, 'schedule_tomorrow', 'พรุ่งนี้คุณมีนัดติว/สอน');

        // 2. Check for "Today" Classes
        console.log(`🔎 [Cron] Checking Today: ${today.toDateString()}`);
        await processNotifications(conn, todayNames, today, 'schedule_today', 'วันนี้คุณมีนัดติว/สอน');
        await processCalendarEvents(conn, today, 'schedule_today', 'วันนี้คุณมีนัดติว/สอน');

    } catch (err) {
        console.error('❌ [Cron] Error:', err);
    } finally {
        conn.release();
        console.log('✅ [Cron] Check Complete.');
    }
}

async function processNotifications(conn, dayNames, targetDate, notiType, messagePrefix) {
    // --- A. Student Posts (Student requests Tutor, Join Approved) ---
    const [studentPosts] = await conn.query(`
    SELECT sp.student_post_id, sp.subject, sp.preferred_days,
           sp.student_id AS owner_id, j.user_id AS joiner_id
    FROM student_posts sp
    JOIN student_post_joins j ON sp.student_post_id = j.student_post_id
    WHERE j.status = 'approved'
  `);

    for (const post of studentPosts) {
        if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
            const msg = `${messagePrefix}: ${post.subject}`;
            // [FIX] Use specific type for redirection
            const typeVar = notiType.replace('schedule', 'schedule_student');
            await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.student_post_id);
            await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.student_post_id);
        }
    }

    // --- B. Tutor Posts (Tutor announces Class, Student Joined) ---
    const [tutorPosts] = await conn.query(`
    SELECT tp.tutor_post_id, tp.subject, tp.teaching_days,
           tp.tutor_id AS owner_id, j.user_id AS joiner_id
    FROM tutor_posts tp
    JOIN tutor_post_joins j ON tp.tutor_post_id = j.tutor_post_id
    WHERE j.status = 'approved'
  `);

    for (const post of tutorPosts) {
        if (isDayMatch(post.teaching_days, dayNames, targetDate)) {
            const msg = `${messagePrefix}: ${post.subject}`;
            // [FIX] Use specific type for redirection (Tutor Post)
            const typeVar = notiType.replace('schedule', 'schedule_tutor');
            await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.tutor_post_id);
            await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.tutor_post_id);
        }
    }

    // --- C. Student Post OFFERS (Tutor Offers to Teach, Approved) ---
    const [offers] = await conn.query(`
    SELECT sp.student_post_id, sp.subject, sp.preferred_days,
           sp.student_id AS owner_id, o.tutor_id AS joiner_id
    FROM student_posts sp
    JOIN student_post_offers o ON sp.student_post_id = o.student_post_id
    WHERE o.status = 'approved'
    `);

    for (const post of offers) {
        if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
            console.log(`     - [Cron] Offer Match! Post #${post.student_post_id} (${post.subject})`);
            const msg = `${messagePrefix}: ${post.subject}`;
            // [FIX] Ensure Offers (on Student Posts) go to Student Tab
            const typeVar = notiType.replace('schedule', 'schedule_student');
            await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.student_post_id);
            await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.student_post_id);
        }
    }
}

async function processCalendarEvents(conn, targetDate, notiType, messagePrefix) {
    // Logic: Query calendar_events table directly
    // This ensures that if it shows in the calendar, it sends a notification regardless of post string parsing.

    // Convert targetDate to YYYY-MM-DD
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const sqlDate = `${yyyy}-${mm}-${dd}`;

    const [events] = await conn.query(`
        SELECT user_id, post_id, title, subject 
        FROM calendar_events 
        WHERE event_date = ?
    `, [sqlDate]);

    console.log(`   > Found ${events.length} Calendar Events for ${sqlDate}`);

    for (const event of events) {
        console.log(`     - Event: "${event.title}" for User ${event.user_id}`);
        const msg = `${messagePrefix}: ${event.subject || event.title}`;
        await sendNotificationIfNotExists(conn, event.user_id, notiType, msg, event.post_id);
    }
}

function isDayMatch(daysString, targetDayNames, targetDate) {
    if (!daysString) return false;
    const str = String(daysString).trim();
    const lowerStr = str.toLowerCase();

    // 1. Check for Recurring Days (Mon, Tue, etc.)
    const isRecurring = targetDayNames.some(d => lowerStr.includes(d.toLowerCase()));
    if (isRecurring) return true;

    // 2. Check for Specific Date (DD/MM/YYYY or YYYY-MM-DD)
    // Try parsing specific date patterns from the string
    try {
        // Regex for DD/MM/YYYY
        const dmy = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (dmy) {
            const d = parseInt(dmy[1], 10);
            const m = parseInt(dmy[2], 10) - 1; // Month is 0-indexed
            let y = parseInt(dmy[3], 10);
            if (y > 2400) y -= 543; // Convert Thai Year

            const matchDate = new Date(y, m, d);
            return isSameDate(matchDate, targetDate);
        }

        // Regex for YYYY-MM-DD
        const ymd = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (ymd) {
            const y = parseInt(ymd[1], 10);
            const m = parseInt(ymd[2], 10) - 1;
            const d = parseInt(ymd[3], 10);

            const matchDate = new Date(y, m, d);
            return isSameDate(matchDate, targetDate);
        }
    } catch (e) {
        // Ignore parsing errors
    }

    return false;
}

function isSameDate(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

async function sendNotificationIfNotExists(conn, userId, type, message, relatedId) {
    if (!userId) return;

    // Prevent duplicate for same day (Check if sent in last 1 MINUTE to allow easier testing)
    const [existing] = await conn.query(`
    SELECT notification_id FROM notifications 
    WHERE user_id = ? AND type = ? AND related_id = ? 
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    LIMIT 1
  `, [userId, type, relatedId]);

    if (existing.length === 0) {
        console.log(`        🔔 Sending Notification to User ID: ${userId} (${type})`);
        await conn.query(`
      INSERT INTO notifications (user_id, actor_id, type, message, related_id, created_at)
      VALUES (?, NULL, ?, ?, ?, NOW())
    `, [userId, type, message, relatedId]);
    } else {
        console.log(`        ⚠️ Skipping User ID: ${userId} (Already sent recently)`);
    }
}

// Initialize Cron
function initCron() {
    // schedule: Run every day at 05:00 AM
    cron.schedule('0 5 * * *', () => {
        checkAndSendNotifications();
    });

    console.log('✅ Scheduler Initialized (Daily at 05:00)');

    // For verify: Uncomment to run immediately on start (or add a test route)
    // setTimeout(checkAndSendNotifications, 5000); 
}

module.exports = { initCron, checkAndSendNotifications };
