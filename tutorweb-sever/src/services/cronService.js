const cron = require('node-cron');
const pool = require('../../db');
const { sendReviewReminderEmail, sendClassReminderEmail } = require('../utils/emailService');

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

        // 3. Clean up deleted accounts (Hard delete after 60 days)
        console.log("?? [Cron] Cleaning up soft-deleted accounts (>60 days)...");
        await cleanupDeletedAccounts(conn);

        // 4. Check for Reviews (Today + Yesterday)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayNames = getDayNames(yesterday);

        console.log(`🔎 [Cron] Checking for Review Requests...`);
        // Today: only those older than 2 hours
        await processReviewRequests(conn, todayNames, today, true);
        // Yesterday: all
        await processReviewRequests(conn, yesterdayNames, yesterday, false);

    } catch (err) {
        console.error('❌ [Cron] Error:', err);
    } finally {
        conn.release();
        console.log('✅ [Cron] Check Complete.');
    }
}

async function processNotifications(conn, dayNames, targetDate, notiType, messagePrefix) {
    // Determine if we should send emails (only for schedule reminders)
    const isReminder = notiType.startsWith('schedule_');
    const roleMap = { owner: 'student', joiner: 'tutor' }; // Default assumption (Student Post)

    const dateStr = targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

    // --- A. Student Posts (Student requests Tutor, Join Approved) ---
    // Owner = Student, Joiner = Tutor (usually, unless study buddy)
    const [studentPosts] = await conn.query(`
    SELECT sp.student_post_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location,
           sp.student_id AS owner_id, j.user_id AS joiner_id,
           ro.email AS owner_email, rj.email AS joiner_email,
           ro.name AS owner_name, ro.lastname AS owner_lastname,
           rj.name AS joiner_name, rj.lastname AS joiner_lastname
    FROM student_posts sp
    JOIN student_post_joins j ON sp.student_post_id = j.student_post_id
    JOIN register ro ON ro.user_id = sp.student_id
    JOIN register rj ON rj.user_id = j.user_id
    WHERE j.status = 'approved'
  `);

    for (const post of studentPosts) {
        if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
            const msg = `${messagePrefix}: ${post.subject}`;
            const typeVar = notiType.replace('schedule', 'schedule_student');

            const sentOwner = await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.student_post_id);
            const sentJoiner = await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.student_post_id);

            // [EMAIL] Reminder
            if (isReminder) {
                const commonDetails = {
                    courseName: post.subject,
                    time: post.preferred_time,
                    date: dateStr,
                    location: post.location || 'ไม่ได้ระบุ'
                };

                // For Student Posts, usually Owner=Student, Joiner=Tutor.
                const tutorName = `${post.joiner_name} ${post.joiner_lastname}`;
                const studentName = `${post.owner_name} ${post.owner_lastname}`;

                // Send to Owner (Student)
                if (sentOwner) {
                    sendClassReminderEmail(post.owner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: 'เรียนตัวต่อตัว',
                        role: 'student'
                    });
                }
                // Send to Joiner
                if (sentJoiner) {
                    sendClassReminderEmail(post.joiner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: `${studentName} (เรียนตัวต่อตัว)`,
                        role: 'tutor'
                    });
                }
            }
        }
    }

    // --- B. Tutor Posts (Tutor announces Class, Student Joined) ---
    // Owner = Tutor, Joiner = Student
    const [tutorPosts] = await conn.query(`
    SELECT tp.tutor_post_id, tp.subject, tp.teaching_days, tp.teaching_time, tp.location,
           tp.tutor_id AS owner_id, j.user_id AS joiner_id,
           ro.email AS owner_email, rj.email AS joiner_email,
           ro.name AS owner_name, ro.lastname AS owner_lastname,
           rj.name AS joiner_name, rj.lastname AS joiner_lastname
    FROM tutor_posts tp
    JOIN tutor_post_joins j ON tp.tutor_post_id = j.tutor_post_id
    JOIN register ro ON ro.user_id = tp.tutor_id
    JOIN register rj ON rj.user_id = j.user_id
    WHERE j.status = 'approved'
  `);

    for (const post of tutorPosts) {
        if (isDayMatch(post.teaching_days, dayNames, targetDate)) {
            const msg = `${messagePrefix}: ${post.subject}`;
            const typeVar = notiType.replace('schedule', 'schedule_tutor');

            const sentOwner = await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.tutor_post_id);
            const sentJoiner = await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.tutor_post_id);

            // [EMAIL] Reminder
            if (isReminder) {
                const commonDetails = {
                    courseName: post.subject,
                    time: post.teaching_time,
                    date: dateStr,
                    location: post.location || 'ไม่ได้ระบุ'
                };

                const tutorName = `${post.owner_name} ${post.owner_lastname}`;
                const studentName = `${post.joiner_name} ${post.joiner_lastname}`;

                // Send to Owner (Tutor)
                if (sentOwner) {
                    sendClassReminderEmail(post.owner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: `${studentName} (เรียนตัวต่อตัว)`, // simplified 1-on-1 text
                        role: 'tutor'
                    });
                }
                // Send to Joiner (Student)
                if (sentJoiner) {
                    sendClassReminderEmail(post.joiner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: 'เรียนตัวต่อตัว',
                        role: 'student'
                    });
                }
            }
        }
    }

    // --- C. Student Post OFFERS (Tutor Offers to Teach, Approved) ---
    // Owner = Student, Joiner = Tutor (Offer-er)
    const [offers] = await conn.query(`
    SELECT sp.student_post_id, sp.subject, sp.preferred_days, sp.preferred_time, sp.location,
           sp.student_id AS owner_id, o.tutor_id AS joiner_id,
           ro.email AS owner_email, rj.email AS joiner_email,
           ro.name AS owner_name, ro.lastname AS owner_lastname,
           rj.name AS joiner_name, rj.lastname AS joiner_lastname
    FROM student_posts sp
    JOIN student_post_offers o ON sp.student_post_id = o.student_post_id
    JOIN register ro ON ro.user_id = sp.student_id
    JOIN register rj ON rj.user_id = o.tutor_id
    WHERE o.status = 'approved'
    `);

    for (const post of offers) {
        if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
            console.log(`     - [Cron] Offer Match! Post #${post.student_post_id} (${post.subject})`);
            const msg = `${messagePrefix}: ${post.subject}`;
            const typeVar = notiType.replace('schedule', 'schedule_student');

            const sentOwner = await sendNotificationIfNotExists(conn, post.owner_id, typeVar, msg, post.student_post_id);
            const sentJoiner = await sendNotificationIfNotExists(conn, post.joiner_id, typeVar, msg, post.student_post_id);

            // [EMAIL] Reminder
            if (isReminder) {
                const commonDetails = {
                    courseName: post.subject,
                    time: post.preferred_time,
                    date: dateStr,
                    location: post.location || 'ไม่ได้ระบุ'
                };

                const tutorName = `${post.joiner_name} ${post.joiner_lastname}`;
                const studentName = `${post.owner_name} ${post.owner_lastname}`;

                // Send to Owner (Student)
                if (sentOwner) {
                    sendClassReminderEmail(post.owner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: 'เรียนตัวต่อตัว',
                        role: 'student'
                    });
                }
                // Send to Joiner (Tutor)
                if (sentJoiner) {
                    sendClassReminderEmail(post.joiner_email, {
                        ...commonDetails,
                        tutorName: tutorName,
                        studentNames: `${studentName} (เรียนตัวต่อตัว)`,
                        role: 'tutor'
                    });
                }
            }
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
        SELECT user_id, post_id, post_type, title, subject 
        FROM calendar_events 
        WHERE DATE(event_date) = ?
    `, [sqlDate]);

    console.log(`   > Found ${events.length} Calendar Events for ${sqlDate}`);

    for (const event of events) {
        console.log(`     - Event: "${event.title}" for User ${event.user_id}`);
        const msg = `${messagePrefix}: ${event.subject || event.title}`;
        const normalizedPostType = String(event.post_type || '').toLowerCase().includes('tutor') ? 'tutor' : 'student';
        const typeVar = notiType.replace('schedule', `schedule_${normalizedPostType}`);
        await sendNotificationIfNotExists(conn, event.user_id, typeVar, msg, event.post_id);
    }
}

// Restore missing helper functions
function isDayMatch(daysString, targetDayNames, targetDate) {
    if (!daysString) return false;
    const str = String(daysString).trim();
    const lowerStr = str.toLowerCase();

    // 1. Check for Recurring Days (Mon, Tue, etc.)
    const isRecurring = targetDayNames.some(d => lowerStr.includes(d.toLowerCase()));
    if (isRecurring) return true;

    // 2. Check for Specific Date (DD/MM/YYYY or YYYY-MM-DD)
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

async function sendNotificationIfNotExists(conn, userId, type, message, relatedId, actorId = null) {
    if (!userId) return false;
    const [existing] = await conn.query(`
    SELECT notification_id FROM notifications 
    WHERE user_id = ? AND type = ? AND related_id = ? 
    AND DATE(created_at) = CURDATE()
    LIMIT 1
  `, [userId, type, relatedId]);

    if (existing.length === 0) {
        console.log(`        🔔 Sending Notification to User ID: ${userId} (${type})`);
        await conn.query(`
      INSERT INTO notifications (user_id, actor_id, type, message, related_id, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [userId, actorId, type, message, relatedId]);
        return true;
    }
    return false;
}


// Initialize Cron
function initCron() {
    // Run every 2 hours
    cron.schedule('0 */2 * * *', () => {
        checkAndSendNotifications();
    });

    console.log('✅ Scheduler Initialized (Every 2 hours)');
}

function isTimePassed(timeStr, hoursToWait = 2) {
    if (!timeStr) return true;
    try {
        const now = new Date();
        // Handle "16:00" or "16:00 - 18:00"
        const startTimeStr = timeStr.split('-')[0].trim();
        const match = startTimeStr.match(/(\d{1,2})[.:](\d{2})/);
        if (!match) return true;

        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);

        const startTime = new Date();
        startTime.setHours(h, m, 0, 0);

        const targetTime = new Date(startTime.getTime() + (hoursToWait * 60 * 60 * 1000));
        return now >= targetTime;
    } catch (e) {
        return true;
    }
}


async function processReviewRequests(conn, dayNames, targetDate, isToday = false) {
    const dateStr = targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

    // A. Student Accepted Tutor Offer (Student = Owner, Tutor = Joiner)
    const [offers] = await conn.query(`
        SELECT sp.student_post_id, sp.subject, sp.preferred_days, sp.preferred_time,
               sp.student_id AS student_id, o.tutor_id AS tutor_id,
               rs.email AS student_email, rt.email AS tutor_email,
               rs.name AS student_name, rs.lastname AS student_lastname,
               rt.name AS tutor_name, rt.lastname AS tutor_lastname
        FROM student_posts sp
        JOIN student_post_offers o ON sp.student_post_id = o.student_post_id
        JOIN register rs ON rs.user_id = sp.student_id
        JOIN register rt ON rt.user_id = o.tutor_id
        WHERE o.status = 'approved'
    `);

    for (const post of offers) {
        if (isDayMatch(post.preferred_days, dayNames, targetDate)) {
            // Apply 2-hour delay if it's today
            if (isToday && !isTimePassed(post.preferred_time, 2)) {
                continue;
            }
            // 1. Notify Owner (Student) -> Reminder to review Tutor
            try {
                const [exists] = await conn.query(
                    `SELECT review_id FROM reviews WHERE student_id=? AND post_id=? AND post_type='student_post'`,
                    [post.student_id, post.student_post_id]
                );
                if (exists.length === 0) {
                    const sent = await sendNotificationIfNotExists(conn, post.student_id, 'tutor_review_request',
                        `อย่าลืมให้คะแนนการเรียนเมื่อวันที่ : ${dateStr} วิชา : ${post.subject}`, post.student_post_id, post.tutor_id);

                    // [EMAIL] Send Reminder to Student ONLY if new notification
                    if (sent) {
                        sendReviewReminderEmail(post.student_email, {
                            courseName: post.subject,
                            date: dateStr,
                            partnerName: `ติวเตอร์ ${post.tutor_name} ${post.tutor_lastname}`,
                            postId: post.student_post_id,
                            type: 'student'
                        });
                    }
                }
            } catch (e) {
                console.log("⚠️ Error checking review existence (Owner):", e.message);
            }

            // 2. Notify Joiners (Study Buddies)
            try {
                const [joiners] = await conn.query(
                    `SELECT j.user_id, r.email, r.name, r.lastname 
                     FROM student_post_joins j 
                     JOIN register r ON r.user_id = j.user_id
                     WHERE j.student_post_id = ? AND j.status = 'approved'`,
                    [post.student_post_id]
                );

                for (const joiner of joiners) {
                    // Check if joiner already reviewed
                    const [jExists] = await conn.query(
                        `SELECT review_id FROM reviews WHERE student_id=? AND post_id=? AND post_type='student_post'`,
                        [joiner.user_id, post.student_post_id]
                    );
                    if (jExists.length === 0) {
                        const sent = await sendNotificationIfNotExists(conn, joiner.user_id, 'review_request',
                            `อย่าลืมให้คะแนนการเรียนเมื่อวันที่ : ${dateStr} วิชา : ${post.subject} (ร่วมติว)`, post.student_post_id, post.tutor_id);

                        // [EMAIL] Send Reminder to Study Buddy ONLY if new notification
                        if (sent) {
                            sendReviewReminderEmail(joiner.email, {
                                courseName: post.subject,
                                date: dateStr,
                                partnerName: `ติวเตอร์ ${post.tutor_name} ${post.tutor_lastname}`,
                                postId: post.student_post_id,
                                type: 'student'
                            });
                        }
                    }
                }
            } catch (e) {
                console.log("⚠️ Error processing study buddies:", e.message);
            }
        }
    }

    // B. Student Joined Tutor Post
    const [joins] = await conn.query(`
         SELECT tp.tutor_post_id, tp.subject, tp.teaching_days, tp.teaching_time,
                tp.tutor_id AS tutor_id, j.user_id AS student_id,
                rs.email AS student_email, rt.name AS tutor_name, rt.lastname AS tutor_lastname
         FROM tutor_posts tp
         JOIN tutor_post_joins j ON tp.tutor_post_id = j.tutor_post_id
         JOIN register rs ON rs.user_id = j.user_id
         JOIN register rt ON rt.user_id = tp.tutor_id
         WHERE j.status = 'approved'
    `);

    for (const post of joins) {
        if (isDayMatch(post.teaching_days, dayNames, targetDate)) {
            // Apply 2-hour delay if it's today
            if (isToday && !isTimePassed(post.teaching_time, 2)) {
                continue;
            }
            try {
                const [exists] = await conn.query(
                    `SELECT review_id FROM reviews WHERE student_id=? AND post_id=? AND post_type='tutor_post'`,
                    [post.student_id, post.tutor_post_id]
                );
                if (exists.length === 0) {
                    const sent = await sendNotificationIfNotExists(conn, post.student_id, 'tutor_review_request',
                        `อย่าลืมให้คะแนนการเรียนเมื่อวันที่ : ${dateStr} วิชา : ${post.subject}`, post.tutor_post_id, post.tutor_id);

                    // [EMAIL] Send Reminder ONLY if new notification
                    if (sent) {
                        sendReviewReminderEmail(post.student_email, {
                            courseName: post.subject,
                            date: dateStr,
                            partnerName: `ติวเตอร์ ${post.tutor_name} ${post.tutor_lastname}`,
                            postId: post.tutor_post_id,
                            type: 'tutor'
                        });
                    }
                }
            } catch (e) {
                console.log("⚠️ Error checking review existence:", e.message);
            }
        }
    }
}


async function checkMissedReviewRequests(daysBack = 7) {
    console.log(`🔎 [Manual] Checking missed reviews for past ${daysBack} days...`);
    const conn = await pool.getConnection();
    try {
        const today = new Date();
        for (let i = 1; i <= daysBack; i++) {
            const pastDate = new Date(today);
            pastDate.setDate(pastDate.getDate() - i);

            const dayNames = getDayNames(pastDate);
            console.log(`   > Checking date: ${pastDate.toDateString()}`);
            await processReviewRequests(conn, dayNames, pastDate);
        }
    } catch (e) {
        console.error("Manual review check error:", e);
    } finally {
        conn.release();
    }
}

module.exports = { initCron, checkAndSendNotifications, checkMissedReviewRequests };




async function cleanupDeletedAccounts(conn) {
    try {
        const [rows] = await conn.query(
            "SELECT user_id, email FROM register WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL 60 DAY"
        );
        if (rows.length > 0) {
            console.log(`    > Found  accounts to permanently delete.`);
            for (const row of rows) {
                await conn.query('DELETE FROM register WHERE user_id = ?', [row.user_id]);
                console.log(`      - Permanently deleted user  ()`);
            }
        } else {
            console.log('    > No accounts to permanently delete today.');
        }
    } catch (e) {
        console.error('? [Cron] Error cleaning deleted accounts:', e.message);
    }
}

