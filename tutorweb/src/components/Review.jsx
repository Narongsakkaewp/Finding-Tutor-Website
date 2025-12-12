import React, { useState, useEffect } from "react";
import { Star, X } from "lucide-react";

const Review = ({ postId, studentId, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const [displayInfo, setDisplayInfo] = useState({
    subject: "กำลังโหลด...",
    tutorName: "กำลังโหลด...",
    tutorId: null
  });

  // ✅ 1. แก้ไข useEffect เพื่อดึงข้อมูลและ Debug
  useEffect(() => {
    if (!postId) {
      console.error("❌ Review Component: ไม่ได้รับ postId (postId เป็น null หรือ undefined)");
      setDisplayInfo({ subject: "ไม่พบ ID โพสต์", tutorName: "-", tutorId: null });
      return;
    }

    const fetchInfo = async () => {
      try {
        console.log(`📡 Review: กำลังดึงข้อมูลจาก http://localhost:5000/api/tutor-posts/${postId}`);

        const res = await fetch(`http://localhost:5000/api/tutor-posts/${postId}`);
        const data = await res.json();
        console.log("✅ Review: ข้อมูลที่ได้จาก Server:", data);
        const postData = data.item || data;

        // ตรวจสอบว่ามีข้อมูลจริงไหม (เช็คจาก subject หรือ id)
        if (res.ok && (postData.subject || postData.tutor_post_id)) {

          // ดึงชื่อติวเตอร์ (รองรับกรณี user อยู่ใน object หรืออยู่นอก object)
          const firstName = postData.user?.first_name || postData.user?.name || postData.name || "";
          const lastName = postData.user?.last_name || postData.user?.lastname || postData.lastname || "";
          const fullName = `${firstName} ${lastName}`.trim();

          console.log("✨ Review: กำลังตั้งค่า State...");
          console.log("   - Subject:", postData.subject);
          console.log("   - TutorName:", fullName);

          setDisplayInfo({
            subject: postData.subject || "ไม่ระบุวิชา",
            tutorName: fullName || "ไม่ระบุชื่อติวเตอร์",
            tutorId: postData.owner_id || postData.tutor_id // ใช้สำหรับ save
          });
        } else {
          console.warn("⚠️ Review: ข้อมูลไม่ครบถ้วน หรือไม่พบโพสต์");
          setDisplayInfo({ subject: "ไม่พบข้อมูล", tutorName: "-", tutorId: null });
        }

      } catch (err) {
        console.error("❌ Review Error:", err);
        setDisplayInfo({ subject: "Error การเชื่อมต่อ", tutorName: "โปรดลองใหม่", tutorId: null });
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
    if (!displayInfo.tutorId) {
      alert("ระบบยังโหลดข้อมูลติวเตอร์ไม่เสร็จ หรือไม่พบข้อมูล กรุณาลองใหม่");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_post_id: postId,
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
      if (onClose) onClose();

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white shadow-xl rounded-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">รีวิวการเรียน</h2>

        {/* ส่วนแสดงข้อมูล */}
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
          <p className="text-gray-800 text-lg">
            <span className="font-semibold text-red-600">วิชา:</span> {displayInfo.subject}
          </p>
          <p className="text-gray-800 text-lg">
            <span className="font-semibold text-blue-600">ติวเตอร์:</span> {displayInfo.tutorName}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col items-center mb-6">
            <label className="text-gray-600 mb-2 font-medium">ความพึงพอใจ</label>
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, index) => {
                const starValue = index + 1;
                return (
                  <Star
                    key={starValue}
                    size={36}
                    className={`cursor-pointer transition-all duration-200 ${starValue <= (hover || rating)
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
          </div>

          <div className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="เขียนความรู้สึกของคุณที่ได้เรียนกับติวเตอร์..."
              className="w-full h-32 border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none text-gray-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !displayInfo.tutorId}
            className={`w-full text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] ${loading || !displayInfo.tutorId
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200"
              }`}
          >
            {loading ? "กำลังส่ง..." : "ส่งรีวิว"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Review;