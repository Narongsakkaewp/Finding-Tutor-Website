// tutorweb/src/components/RecommendedTutors.jsx
import React, { useEffect, useState } from "react";
import { Star, MapPin, User } from "lucide-react";

export default function RecommendedTutors({ userId }) {
  const [recs, setRecs] = useState({ items: [], based_on: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ถ้าไม่มี userId (Guest) ให้ส่ง 0 ไป
    const id = userId || 0;
    
    fetch(`http://localhost:5000/api/recommendations?user_id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        // ถ้า API ส่งกลับมาเป็น Array (กรณี Guest) ให้ปรับโครงสร้างให้เหมือนกัน
        if (Array.isArray(data)) {
            setRecs({ items: data, based_on: "" });
        } else {
            setRecs(data);
        }
      })
      .catch((err) => console.error("Recs Error:", err))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="text-center py-4 text-gray-500">กำลังประมวลผลติวเตอร์ที่เหมาะกับคุณ...</div>;
  if (!recs.items || recs.items.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-yellow-500 fill-yellow-500" size={24} />
        <h2 className="text-xl font-bold text-gray-800">
          ติวเตอร์แนะนำสำหรับคุณ
        </h2>
      </div>
      
      {recs.based_on && (
        <p className="text-sm text-gray-600 mb-4 bg-white inline-block px-3 py-1 rounded-full border">
          💡 อ้างอิงจากความสนใจวิชา: <span className="font-bold text-indigo-600">{recs.based_on}</span>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.items.map((tutor) => (
          <div 
            key={tutor.tutor_post_id} 
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border hover:border-indigo-300 cursor-pointer group"
            onClick={() => window.location.href = `/post/${tutor.tutor_post_id}`} // หรือใช้ Link ของ React Router
          >
            <div className="flex items-start gap-3">
              <img 
                src={tutor.profile_picture_url || "/default-avatar.png"} 
                alt="tutor" 
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                  {tutor.subject}
                </h3>
                <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <User size={14} />
                  {tutor.first_name || tutor.name || "ติวเตอร์"} {tutor.last_name || tutor.lastname || ""}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin size={12} />
                  {tutor.location || "ไม่ระบุสถานที่"}
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
               <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-md">
                 {tutor.price} บ./ชม.
               </span>
               {tutor.relevance_score > 0 && (
                 <span className="text-xs text-indigo-500 font-medium">
                   ความตรงใจ {tutor.relevance_score}%
                 </span>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}