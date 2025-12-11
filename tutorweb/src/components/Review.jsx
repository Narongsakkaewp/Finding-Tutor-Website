import React, { useState, useEffect } from "react";
import { Star, X } from "lucide-react"; // เพิ่ม X icon สำหรับปิด

// ✅ เปลี่ยนชื่อ Props ให้สื่อความหมายและตรงกัน
const Review = ({ postId, studentId, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  
  // State เก็บข้อมูลที่จะแสดง
  const [displayInfo, setDisplayInfo] = useState({
    subject: "กำลังโหลด...",
    tutorName: "กำลังโหลด...",
    tutorId: null // เก็บ ID ติวเตอร์ไว้ใช้ตอนกดส่ง
  });

  // ✅ ดึงข้อมูลโพสต์เมื่อ Component โหลด
  useEffect(() => {
    if (!postId) return;

    const fetchInfo = async () => {
      try {
        // เรียก API ที่ถูกต้อง (ตัวล่างสุดใน server.js ของคุณ)
        const res = await fetch(`http://localhost:5000/api/tutor-posts/${postId}`);
        const data = await res.json();

        // ตรวจสอบว่าได้ข้อมูลมาจริงหรือไม่ (API นี้คืนค่าเป็น Object เลย ไม่ได้ห่อด้วย success: true)
        if (res.ok && data.tutor_post_id) {
            // ดึงชื่อจาก object user
            const fullName = `${data.user?.first_name || ''} ${data.user?.last_name || ''}`;
            
            setDisplayInfo({
                subject: data.subject,
                tutorName: fullName.trim() || "ไม่ระบุชื่อ",
                tutorId: data.owner_id // เก็บ ID ติวเตอร์ไว้ใช้บันทึก
            });
        } else {
            setDisplayInfo(prev => ({ ...prev, subject: "ไม่พบข้อมูล", tutorName: "-" }));
        }
      } catch (err) {
        console.error("Error fetching review info:", err);
        setDisplayInfo({ subject: "Error", tutorName: "Error", tutorId: null });
      }
    };

    fetchInfo();
  }, [postId]);


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      alert("กรุณาให้คะแนนก่อนส่งรีวิว");
      return;
    }
    // ต้องเช็คว่ามี tutorId หรือยัง (ถ้ายังโหลดไม่เสร็จจะบันทึกไม่ได้)
    if (!displayInfo.tutorId) {
        alert("ไม่พบข้อมูลติวเตอร์ ไม่สามารถบันทึกได้");
        return;
    }

    setLoading(true);

    try {
      // เรียก API บันทึกรีวิว (ตัวที่ 2 ใน server.js ของคุณ)
      const res = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tutor_post_id: postId, // ส่ง ID โพสต์ไป (เผื่อ Server ใช้หา tutor_id อีกที)
          tutor_id: displayInfo.tutorId, // ส่ง ID ติวเตอร์ไปตรงๆ เลยก็ได้ (ถ้า API รองรับ)
          student_id: studentId,
          rating: rating,
          comment: comment,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "ไม่สามารถส่งรีวิวได้");
      }

      alert("ขอบคุณสำหรับรีวิวของคุณ!");
      setRating(0);
      setComment("");
      if (onClose) onClose();

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งรีวิว: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // เพิ่ม div overlay สีดำจางๆ และจัดกึ่งกลาง (Modal Style)
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white shadow-xl rounded-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* ปุ่มปิด (X) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">รีวิวการเรียน</h2>

        {/* แสดงข้อมูลติวเตอร์และวิชา */}
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
            <p className="text-gray-700 text-lg">
                <span className="font-semibold text-blue-600">วิชา:</span> {displayInfo.subject}
            </p>
            <p className="text-gray-600">
                <span className="font-semibold">ติวเตอร์:</span> {displayInfo.tutorName}
            </p>
        </div>

        <form onSubmit={handleSubmit}>
        {/* ส่วนให้ดาว (เหมือนเดิม) */}
        <div className="flex flex-col items-center mb-6">
            <label className="text-gray-600 mb-2 font-medium">ความพึงพอใจ</label>
            <div className="flex items-center gap-2">
                {[...Array(5)].map((_, index) => {
                const starValue = index + 1;
                return (
                    <Star
                    key={starValue}
                    size={36}
                    className={`cursor-pointer transition-all duration-200 ${
                        starValue <= (hover || rating)
                        ? "text-yellow-400 fill-yellow-400 scale-110"
                        : "text-gray-300 hover:text-yellow-200"
                    }`}
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHover(starValue)}
                    onMouseLeave={() => setHover(0)}
                    />
                );
                })}
            </div>
             <p className="text-sm text-gray-400 mt-1 h-5 text-center">
                {hover === 1 && "แย่มาก"}
                {hover === 2 && "พอใช้"}
                {hover === 3 && "ปานกลาง"}
                {hover === 4 && "ดี"}
                {hover === 5 && "ดีมาก!"}
            </p>
        </div>

        {/* กล่องคอมเมนต์ (เหมือนเดิม) */}
        <div className="mb-6">
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="เขียนความประทับใจ หรือข้อเสนอแนะเพิ่มเติม..."
                className="w-full h-32 border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none text-gray-700 placeholder-gray-400"
            />
        </div>

        {/* ปุ่มโพสต์ */}
        <button
            type="submit"
            disabled={loading || !displayInfo.tutorId}
            className={`w-full text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] ${
            loading || !displayInfo.tutorId
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200"
            }`}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    กำลังส่งข้อมูล...
                </span>
            ) : "ส่งรีวิว"}
        </button>
      </form>
      </div>
    </div>
  );
};

export default Review;