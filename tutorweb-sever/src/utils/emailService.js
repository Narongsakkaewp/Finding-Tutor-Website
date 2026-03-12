// ----- Email Deps -----
// Using native fetch for Brevo to avoid SDK CommonJS bugs

// Helper for generic HTML email structure
const wrapHtml = (title, bodyContent) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Sarabun', sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: #fd7e14; padding: 20px; text-align: center; color: white; }
        .content { padding: 30px; color: #374151; line-height: 1.6; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af; }
        .btn { display: inline-block; background: #fd7e14; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
        .highlight { color: #fd7e14; font-weight: bold; }
        .info-box { background: #fff7ed; border-left: 4px solid #fd7e14; padding: 15px; margin: 15px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0; font-size: 24px;">Finding Tutor</h1>
        </div>
        <div class="content">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            ${bodyContent}
        </div>
        <div class="footer">
            © 2026 Finding Tutor Website (KMUTNB)<br>
            ระบบแจ้งเตือนอัตโนมัติ
        </div>
    </div>
</body>
</html>
`;

const FRONTEND_URL = process.env.FRONTEND_URL || "https://finding-tutor.up.railway.app";

/**
 * Send Booking Confirmation Email
 * Sent to Student and Tutor when a request is APPROVED.
 */
async function sendBookingConfirmationEmail(toEmail, details) {
    if (!toEmail) return;

    try {
        const { courseName, date, time, location, partnerName, role } = details;
        const subject = `📅 ยืนยันนัดหมาย: ${courseName}`;

        const body = `
            <p>สวัสดีคุณ <strong>${role === 'student' ? 'นักเรียน' : 'ติวเตอร์'}</strong>,</p>
            <p>ระบบได้ทำการยืนยันนัดหมายติว/สอนของคุณเรียบร้อยแล้ว รายละเอียดดังนี้:</p>
            
            <div class="info-box">
                <p><strong>วิชา/หัวข้อ:</strong> ${courseName}</p>
                <p><strong>ผู้เรียน/ผู้สอนร่วม:</strong> ${partnerName}</p>
                <p><strong>📅 วันที่เรียน:</strong> ${date}</p>
                <p><strong>⏰ เวลา:</strong> ${time}</p>
                <p><strong>📍 สถานที่:</strong> ${location}</p>
            </div>

            <p>โปรดเตรียมตัวให้พร้อมก่อนเวลาเริ่มเรียน หากมีข้อสงสัย สามารถติดต่อได้ผ่านช่องทางติดต่อที่ระบุไว้ในโพสต์</p>
            <br>
            <center>
                <a href="${FRONTEND_URL}/?page=student_calendar" class="btn">ดูตารางเรียนแบบเต็ม</a>
            </center>
        `;

        const brevoPayload = {
            sender: { name: "Finding Tutor Notification", email: process.env.BREVO_FROM_EMAIL || "findingtoturwebteam@gmail.com" },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: wrapHtml('ยืนยันนัดหมายการเรียน', body)
        };

        try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": process.env.BREVO_API_KEY,
                    "content-type": "application/json"
                },
                body: JSON.stringify(brevoPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Brevo API request failed');
        } catch (error) {
            throw new Error(error.message);
        }

        console.log(`📧 [Email] Sent Confirmation to ${toEmail}`);
    } catch (err) {
        console.error(`❌ [Email Error] Send Confirmation Failed: ${err.message}`);
    }
}

/**
 * Send Review Reminder Email
 * Sent after the class has finished.
 */
async function sendReviewReminderEmail(toEmail, details) {
    if (!toEmail) return;

    try {
        const { courseName, date, partnerName, postId, type } = details; // type = 'tutor' or 'student'
        const subject = `⭐ ให้คะแนนการเรียนของคุณ: ${courseName}`;

        const body = `
            <p>สวัสดีครับ,</p>
            <p>การเรียนวิชา <span class="highlight">"${courseName}"</span> เมื่อวันที่ <strong>${date}</strong> กับ <strong>${partnerName}</strong> เป็นอย่างไรบ้างคะ?</p>
            
            <p>ความคิดเห็นของคุณสำคัญมาก! ช่วยให้คะแนนและรีวิวเพื่อเป็นประโยชน์ต่อเพื่อนๆ ในชุมชนของเรา</p>

            <br>
            <center>
                <a href="${FRONTEND_URL}/?page=mypost_details&postId=${postId}&postType=${type === 'tutor' ? 'tutor' : 'student'}" class="btn">เขียนรีวิวตอนนี้</a>
            </center>
            <br>
            <p style="font-size: 14px; color: #6b7280;">*หากคุณรีวิวไปแล้ว โปรดเพิกเฉยต่ออีเมลนี้</p>
        `;

        const brevoPayload = {
            sender: { name: "Finding Tutor Notification", email: process.env.BREVO_FROM_EMAIL || "findingtoturwebteam@gmail.com" },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: wrapHtml('📝 เชิญร่วมรีวิวการเรียนการสอน', body)
        };

        try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": process.env.BREVO_API_KEY,
                    "content-type": "application/json"
                },
                body: JSON.stringify(brevoPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Brevo API request failed');
        } catch (error) {
            throw new Error(error.message);
        }

        console.log(`📧 [Email] Sent Review Reminder to ${toEmail}`);
    } catch (err) {
        console.error(`❌ [Email Error] Send Reminder Failed: ${err.message}`);
    }
}

/**
 * Send Class Reminder Email (Day-of)
 * Sent on the day of teaching (cron job).
 */
async function sendClassReminderEmail(toEmail, details) {
    if (!toEmail) return;

    try {
        const { courseName, time, tutorName, studentNames, location, role, date } = details;
        const subject = `📅 แจ้งเตือนตารางเรียน/สอน วันที่ ${date}`;

        const body = `
            <p>สวัสดีคุณ <strong>${role === 'student' ? 'นักเรียน' : 'ติวเตอร์'}</strong>,</p>
            <p>อย่าลืมนะคะ! คุณมีนัดหมายการติว/สอน รายละเอียดดังนี้:</p>
            
            <div class="info-box">
                <p><strong>วิชา:</strong> ${courseName}</p>
                <p><strong>ชื่อผู้สอน:</strong> ${tutorName || 'ไม่ระบุ'}</p>
                <p><strong>เรียนกับ:</strong> ${studentNames || 'ไม่ระบุ'}</p>
                <p><strong>📅 วันที่:</strong> ${date}</p>
                <p><strong>⏰ เวลา:</strong> ${time || 'ตามตกลง'}</p>
                <p><strong>📍 สถานที่:</strong> ${location || 'ไม่ระบุ'}</p>
            </div>

            <p>ขอให้เป็นวันที่ดีของการเรียนรู้นะคะ!</p>
            <br>
            <center>
                <a href="${FRONTEND_URL}/?page=student_calendar" class="btn">ดูตารางเรียนแบบเต็ม</a>
            </center>
        `;

        const brevoPayload = {
            sender: { name: "Finding Tutor Notification", email: process.env.BREVO_FROM_EMAIL || "findingtoturwebteam@gmail.com" },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: wrapHtml(`แจ้งเตือนตารางเรียนวันที่ ${date}`, body)
        };

        try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": process.env.BREVO_API_KEY,
                    "content-type": "application/json"
                },
                body: JSON.stringify(brevoPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Brevo API request failed');
        } catch (error) {
            throw new Error(error.message);
        }

        console.log(`📧 [Email] Sent Class Reminder to ${toEmail}`);
    } catch (err) {
        console.error(`❌ [Email Error] Send Class Reminder Failed: ${err.message}`);
    }
}

module.exports = {
    sendBookingConfirmationEmail,
    sendReviewReminderEmail,
    sendClassReminderEmail
};
