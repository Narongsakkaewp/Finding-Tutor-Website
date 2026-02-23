// tutorweb/src/components/RecommendedTutors.jsx
import React, { useEffect, useState } from "react";
import { Star, MapPin, User } from "lucide-react";

export default function RecommendedTutors({ userId, onOpen }) {
  const [recs, setRecs] = useState({ items: [], based_on: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = userId || 0;

    fetch(`http://localhost:5000/api/recommendations?user_id=${id}`)
      .then((res) => res.json())
      .then((data) => {
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
          แนะนำสำหรับคุณ
        </h2>
      </div>

      {recs.based_on && (
        <p className="text-sm text-gray-600 mb-4 bg-white inline-block px-3 py-1 rounded-full border">
          💡 อ้างอิงจากความสนใจวิชาที่คุณสนใจ
          <span className="font-bold text-indigo-600">  {recs.based_on}</span>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.items.map((tutor) => {
          const isExpired = tutor.is_expired;
          return (
            <div
              key={tutor.tutor_post_id}
              className={`rounded-xl p-4 shadow-sm hover:shadow-md transition-all border cursor-pointer group relative overflow-hidden ${isExpired
                ? "bg-gray-50 border-gray-200 opacity-80"
                : "bg-white hover:border-indigo-300"
                }`}
              onClick={() => {
                // Construct standardized item object for Modal with FULL details
                const contactParts = [];
                if (tutor.contact_info) contactParts.push(tutor.contact_info);
                if (tutor.phone) contactParts.push(`Tel: ${tutor.phone}`);
                if (tutor.email) contactParts.push(`Email: ${tutor.email}`);

                const item = {
                  // Post Data
                  id: tutor.id || tutor.tutor_post_id,
                  subject: tutor.subject,
                  post_desc: tutor.description, // Post description
                  price: tutor.price,
                  location: tutor.location,
                  teaching_days: tutor.teaching_days,
                  teaching_time: tutor.teaching_time,
                  target_student_level: tutor.target_student_level,
                  group_size: tutor.group_size,

                  // Profile Data
                  dbTutorId: tutor.tutor_id || tutor.owner_id,
                  name: `${tutor.first_name || tutor.name || ""} ${tutor.last_name || tutor.lastname || ""}`.trim(),
                  username: tutor.username,
                  nickname: tutor.nickname,
                  image: tutor.profile_picture_url || "../blank_avatar.jpg",
                  profile_bio: tutor.profile_bio, // Personal Bio
                  education: tutor.education,
                  teaching_experience: tutor.teaching_experience,
                  contact_info: contactParts.join('\n') || "ไม่ระบุข้อมูลติดต่อ",
                  phone: tutor.phone,
                  email: tutor.email,

                  // Meta
                  rating: tutor.rating || 0,
                  reviews: tutor.review_count || 0,
                  createdAt: tutor.createdAt || tutor.created_at,
                  is_expired: isExpired // Pass flag to modal if needed
                };
                onOpen?.(item);
              }}
            >
              {isExpired && (
                <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                  เลยวันเรียนแล้ว
                </div>
              )}

              <div className="flex items-start gap-3">
                <img
                  src={tutor.profile_picture_url || "../blank_avatar.jpg"}
                  alt="tutor"
                  className={`w-12 h-12 rounded-full object-cover border ${isExpired ? 'grayscale' : ''}`}
                />
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate group-hover:text-indigo-600 transition-colors ${isExpired ? 'text-gray-600' : 'text-gray-900'}`}>
                    {tutor.subject}
                  </h3>
                  <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <User size={14} />
                    {tutor.first_name || tutor.name || "ติวเตอร์"} {tutor.last_name || tutor.lastname || ""}
                  </div>
                  <div className="text-xs flex items-center gap-1 mt-1">
                    {(tutor.location?.startsWith("Online:") || tutor.location === "Online") ? (
                      <>
                        <User size={12} className="text-indigo-500" />
                        <span className="text-indigo-600 font-medium truncate">{tutor.location}</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={12} className="text-gray-400" />
                        <span className="text-gray-400 truncate">{tutor.location || "ไม่ระบุสถานที่"}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t flex flex-wrap justify-between items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${isExpired ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                  {tutor.price} บ./ชม.
                </span>

                {isExpired ? (
                  <span className="text-[10px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                    ติดต่อติวเตอร์โดยตรง
                  </span>
                ) : (
                  tutor.relevance_score > 0 && (
                    <span className="text-xs text-indigo-500 font-medium"></span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}