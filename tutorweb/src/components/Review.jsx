import React, { useState } from "react";
import { Star } from "lucide-react"; // ใช้ icon ดาว

const Review = ({ subject, tutor }) => {
  const [rating, setRating] = useState(0); // เก็บจำนวนดาวที่เลือก
  const [hover, setHover] = useState(0);   // สำหรับไฮไลท์ตอน hover
  const [comment, setComment] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // ตรงนี้สามารถเรียก API ส่งรีวิวไป backend ได้
    console.log({
      subject,
      tutor,
      rating,
      comment,
    });
    alert("ขอบคุณสำหรับรีวิวของคุณ!");
    setRating(0);
    setComment("");
  };

  return (
    <div className="max-w-lg mx-auto bg-white shadow-md rounded-2xl p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">เขียนรีวิว</h2>

      {/* แสดงชื่อวิชาและติวเตอร์ */}
      <div className="mb-4">
        <p className="text-gray-600">
          <strong>วิชา:</strong> {subject}
        </p>
        <p className="text-gray-600">
          <strong>ติวเตอร์:</strong> {tutor}
        </p>
      </div>

      {/* ให้ดาว */}
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, index) => {
          const starValue = index + 1;
          return (
            <Star
              key={starValue}
              size={28}
              className={`cursor-pointer ${
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

      {/* ช่องคอมเมนต์ */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="เขียนความคิดเห็นของคุณ..."
        className="w-full h-28 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none mb-4"
      />

      {/* ปุ่มโพสต์ */}
      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl shadow-md transition"
      >
        โพสต์รีวิว
      </button>
    </div>
  );
};

export default Review;