// ไฟล์นี้รวมฟังก์ชันส่งอีเมลทั้งหมดของระบบ Finding Tutor
// ใช้ fetch ส่งข้อมูลไปยัง Brevo API โดยตรง

// ฟังก์ชันนี้ใช้สร้างโครง HTML กลางของอีเมลทุกประเภท
// title คือหัวข้อใหญ่ในตัวอีเมล
// bodyContent คือเนื้อหาหลักของอีเมลแต่ละแบบ
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

// URL ฝั่ง frontend ใช้สำหรับสร้างลิงก์ในอีเมล
// ถ้าไม่มีค่าใน .env จะใช้ URL นี้แทน
const FRONTEND_URL = process.env.FRONTEND_URL || "https://finding-tutor.up.railway.app";

// API key ของ Brevo ใช้ยืนยันตัวตนเวลาเรียก API
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// อีเมลผู้ส่ง ถ้าไม่ได้ตั้งค่าใน .env จะใช้ค่า default นี้
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || "findingtoturwebteam@gmail.com";

// ฟังก์ชันนี้คืนค่าข้อมูลผู้ส่งในรูปแบบที่ Brevo ต้องการ
function getBrevoSender() {
    return {
        name: "Finding Tutor Notification",
        email: BREVO_FROM_EMAIL
    };
}

// ฟังก์ชันนี้ใช้เช็กว่าเราส่งอีเมลได้หรือยัง
// ถ้าไม่มี BREVO_API_KEY แปลว่ายังใช้ Brevo ไม่ได้
function canSendBrevoEmail(emailType) {
    if (!BREVO_API_KEY) {
        console.warn(`⚠️ [Email Skipped] ${emailType}: missing BREVO_API_KEY in .env`);
        return false;
    }
    return true;
}

// ฟังก์ชันกลางสำหรับส่งอีเมลไปที่ Brevo
// แยกออกมาเพื่อไม่ต้องเขียน fetch ซ้ำหลายรอบ
async function sendViaBrevo(toEmail, subject, htmlContent) {
    // สร้างข้อมูลตามรูปแบบที่ Brevo API ต้องใช้
    const brevoPayload = {
        sender: getBrevoSender(),
        to: [{ email: toEmail }],
        subject,
        htmlContent
    };

    // ส่ง request ไปยัง Brevo
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json"
        },
        body: JSON.stringify(brevoPayload)
    });

    // อ่านผลลัพธ์ที่ Brevo ส่งกลับมา
    const data = await response.json();

    // ถ้า response ไม่สำเร็จ ให้โยน error ออกไป
    if (!response.ok) {
        throw new Error(data.message || "Brevo API request failed");
    }

    // คืนค่าผลลัพธ์กลับไป เผื่อภายหลังอยากใช้ต่อ
    return data;
}

/**
 * ส่งอีเมลยืนยันนัดหมาย
 * ใช้ตอนคำขอเรียน/สอนได้รับการอนุมัติแล้ว
 */
async function sendBookingConfirmationEmail(toEmail, details) {
    // ถ้าไม่มีอีเมลผู้รับ ก็ไม่ต้องส่ง
    if (!toEmail) return;

    // ถ้า Brevo ยังไม่พร้อมใช้งาน ก็หยุดตรงนี้
    if (!canSendBrevoEmail("Send Confirmation")) return;

    try {
        // ดึงข้อมูลที่ต้องใช้จาก details
        const {
            courseName,
            date,
            time,
            location,
            partnerName,
            role
        } = details;

        // หัวข้ออีเมลที่จะไปแสดงใน inbox
        const subject = `📌 ยืนยันนัดหมาย: ${courseName}`;

        // เนื้อหาจริงของอีเมลยืนยันนัดหมาย
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

        // เอา body ไปครอบด้วย layout กลางของอีเมล
        const htmlContent = wrapHtml("ยืนยันนัดหมายการเรียน", body);

        // ส่งอีเมลผ่าน Brevo
        await sendViaBrevo(toEmail, subject, htmlContent);

        // log ไว้ดูใน console ว่าส่งสำเร็จ
        console.log(`📧 [Email] Sent Confirmation to ${toEmail}`);
    } catch (err) {
        // ถ้ามีปัญหาใดๆ ระหว่างสร้างหรือส่งอีเมล จะมาเข้า catch นี้
        console.error(`❌ [Email Error] Send Confirmation Failed: ${err.message}`);
    }
}

/**
 * ส่งอีเมลเชิญให้รีวิวหลังเรียนเสร็จ
 * ใช้หลังจากคลาสจบแล้ว
 */
async function sendReviewReminderEmail(toEmail, details) {
    // ถ้าไม่มีอีเมลผู้รับ ก็ไม่ต้องส่ง
    if (!toEmail) return;

    // เช็กก่อนว่า Brevo พร้อมหรือไม่
    if (!canSendBrevoEmail("Send Review Reminder")) return;

    try {
        // ดึงข้อมูลที่จำเป็นออกมา
        // type ใช้กำหนดว่าจะพาไปยังโพสต์ฝั่ง tutor หรือ student
        const {
            courseName,
            date,
            partnerName,
            postId,
            type
        } = details;

        // หัวข้ออีเมล
        const subject = `⭐ ให้คะแนนการเรียนของคุณ: ${courseName}`;

        // เนื้อหาอีเมลชวนให้กลับมารีวิว
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

        // ครอบเนื้อหาด้วย layout กลาง
        const htmlContent = wrapHtml("📝 เชิญร่วมรีวิวการเรียนการสอน", body);

        // ส่งอีเมลจริงผ่าน Brevo
        await sendViaBrevo(toEmail, subject, htmlContent);

        // log ว่าส่งสำเร็จ
        console.log(`📧 [Email] Sent Review Reminder to ${toEmail}`);
    } catch (err) {
        // log เมื่อส่งไม่สำเร็จ
        console.error(`❌ [Email Error] Send Reminder Failed: ${err.message}`);
    }
}

/**
 * ส่งอีเมลเตือนเรียนในวันจริง
 * ฟังก์ชันนี้มักถูกเรียกจาก cron job
 */
async function sendClassReminderEmail(toEmail, details) {
    // ถ้าไม่มีอีเมลผู้รับ ก็ไม่ต้องส่ง
    if (!toEmail) return;

    // เช็กก่อนว่า Brevo ใช้งานได้ไหม
    if (!canSendBrevoEmail("Send Class Reminder")) return;

    try {
        // ดึงข้อมูลที่ต้องใช้จาก details
        // ฟังก์ชันนี้รองรับหลายกรณี จึงมีข้อมูลหลายตัว
        const {
            courseName,
            time,
            tutorName,
            studentNames,
            location,
            role,
            roleLabel,
            primaryLabel,
            primaryName,
            participantLabel,
            participantNames,
            date
        } = details;

        // สร้างหัวข้ออีเมลเตือนเรียน
        const subject = `📌 แจ้งเตือนตารางเรียน/สอน วันที่ ${date}`;

        // สร้างเนื้อหาอีเมลเตือนเรียน
        const body = `
            <p>สวัสดีคุณ <strong>${roleLabel || (role === 'student' ? 'นักเรียน' : 'ติวเตอร์')}</strong>,</p>
            <p>อย่าลืมนะคะ! คุณมีนัดหมายการติว/สอน รายละเอียดดังนี้:</p>

            <div class="info-box">
                <p><strong>วิชา:</strong> ${courseName}</p>
                <p><strong>${primaryLabel || 'ชื่อผู้สอน'}:</strong> ${primaryName || tutorName || 'ไม่ระบุ'}</p>
                <p><strong>${participantLabel || 'เรียนกับ'}:</strong> ${participantNames || studentNames || 'ไม่ระบุ'}</p>
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

        // ครอบ body ด้วยโครง HTML กลาง
        const htmlContent = wrapHtml(`แจ้งเตือนตารางเรียนวันที่ ${date}`, body);

        // ส่งอีเมลจริงผ่าน Brevo
        await sendViaBrevo(toEmail, subject, htmlContent);

        // log ว่าส่งสำเร็จ
        console.log(`📧 [Email] Sent Class Reminder to ${toEmail}`);
    } catch (err) {
        // log เมื่อเกิดปัญหาระหว่างส่ง
        console.error(`❌ [Email Error] Send Class Reminder Failed: ${err.message}`);
    }
}

// export ฟังก์ชันออกไปให้ไฟล์อื่นเรียกใช้งานได้
module.exports = {
    sendBookingConfirmationEmail,
    sendReviewReminderEmail,
    sendClassReminderEmail
};
