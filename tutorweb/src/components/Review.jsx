import React, { useState, useEffect } from "react";
import { Star, X } from "lucide-react";

// Helper Component for Star Row
const StarRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-700 font-medium w-32 text-sm">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform active:scale-95"
        >
          <Star
            size={24}
            className={`transition-colors ${star <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
          />
        </button>
      ))}
    </div>
  </div>
);

const Review = ({ postId, tutorId, studentId, onClose, initialSubject, initialTutorName, initialTutorImage }) => {
  const [rating, setRating] = useState(0);    // ภาพรวม
  const [punctuality, setPunctuality] = useState(0); // ตรงต่อเวลา
  const [worth, setWorth] = useState(0);      // คุ้มค่า
  const [teaching, setTeaching] = useState(0); // เนื้อหาที่สอน

  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Use props if available, otherwise default to loading/error state
  // We remove the internal fetch because often the parent has the context (Notification)
  // If postId implies a different ID type, internal fetch might be fragile.
  const subject = initialSubject || "ไม่ระบุวิชา";
  const tutorName = initialTutorName || "ติวเตอร์";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      alert("กรุณาให้คะแนนภาพรวมก่อนส่งรีวิว");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutor_post_id: postId,
          tutor_id: tutorId, // Explicitly pass tutorId
          student_id: studentId,
          rating,
          rating_punctuality: punctuality || rating,
          rating_worth: worth || rating,
          rating_teaching: teaching || rating,
          comment,
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header (Blue Design) */}
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">รีวิวการเรียน</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Info Section */}
          <div className="flex flex-col items-center mb-6">
            <img
              src={initialTutorImage || "/default-avatar.png"}
              alt={tutorName}
              className="w-20 h-20 rounded-full object-cover border-4 border-indigo-50 mb-3"
            />
            <h4 className="font-bold text-lg text-gray-900">{tutorName}</h4>
            <p className="text-gray-500 text-sm">{subject}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-gray-50 p-4 rounded-xl mb-6 space-y-2">
              <StarRow label="ความพึงพอใจ" value={rating} onChange={setRating} />
              <StarRow label="ความตรงต่อเวลา" value={punctuality} onChange={setPunctuality} />
              <StarRow label="ความคุ้มค่า" value={worth} onChange={setWorth} />
              <StarRow label="เนื้อหาที่สอน" value={teaching} onChange={setTeaching} />
            </div>

            <div className="mb-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ความรู้สึกของคุณที่ได้เรียนกับติวเตอร์..."
                className="w-full h-24 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200"
                }`}
            >
              {loading ? "กำลังส่ง..." : "ส่งรีวิว"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Review;