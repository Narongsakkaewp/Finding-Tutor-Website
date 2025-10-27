import React, { useState } from "react";
import { Star } from "lucide-react";

const Review = ({ bookingId, tutorId, studentId, subject, tutorName }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      alert("กรุณาให้คะแนนก่อนส่งรีวิว");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: bookingId,
          tutor_id: tutorId,
          student_id: studentId,
          rating,
          comment,
        }),
      });

      if (!res.ok) throw new Error("ไม่สามารถส่งรีวิวได้");

      alert("ขอบคุณสำหรับรีวิวของคุณ!");
      setRating(0);
      setComment("");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งรีวิว");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white shadow-md rounded-2xl p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">เขียนรีวิวติวเตอร์</h2>

      {/* แสดงข้อมูลติวเตอร์ */}
      <div className="mb-4 text-gray-600">
        <p><strong>วิชา:</strong> {subject}</p>
        <p><strong>ติวเตอร์:</strong> {tutorName}</p>
      </div>

      {/* ส่วนให้ดาว */}
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, index) => {
          const starValue = index + 1;
          return (
            <Star
              key={starValue}
              size={28}
              className={`cursor-pointer transition-colors ${
                starValue <= (hover || rating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }`}
              onClick={() => setRating(starValue)}
              onMouseEnter={() => setHover(starValue)}
              onMouseLeave={() => setHover(0)}
            />
          );
        })}
      </div>

      {/* กล่องคอมเมนต์ */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="เขียนความคิดเห็นของคุณ..."
        className="w-full h-28 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none mb-4"
      />

      {/* ปุ่มโพสต์ */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full text-white py-2 px-4 rounded-xl shadow-md transition ${
          loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "กำลังส่ง..." : "โพสต์รีวิว"}
      </button>
    </div>
  );
};

export default Review;