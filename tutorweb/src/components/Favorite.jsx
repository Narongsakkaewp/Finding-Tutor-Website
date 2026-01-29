// src/pages/Favorite.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Heart, Users, BookOpen, Search, Filter, Trash2,
  Sparkles, MapPin, DollarSign, User, X, Calendar, Phone, GraduationCap
} from "lucide-react";

const API_BASE = "http://localhost:5000";

// --------------------------- Utilities ---------------------------
const formatPrice = (n) => new Intl.NumberFormat("th-TH").format(n || 0);
const formatDate = (dateString) =>
  dateString ? new Date(dateString).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }) : "-";

function getMe() {
  try {
    const u = JSON.parse(localStorage.getItem("user"));
    return u || {};
  } catch {
    return {};
  }
}

// --------------------------- Components: Modal ---------------------------
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white/95 backdrop-blur">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// --------------------------- Hooks ---------------------------
function useFavorites() {
  const me = getMe();
  const [data, setData] = useState({ student: [], tutor: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!me?.user_id) return;

      const res = await fetch(`${API_BASE}/api/favorites/user/${me.user_id}`);
      const json = await res.json();

      if (json.success) {
        console.log("Favorites fetched:", json.items); // Debugging
        const student = [];
        const tutor = [];

        // ✅ Map ข้อมูลให้พร้อมใช้งาน (รวมถึง contact_info, price/budget ที่มาจาก Backend ใหม่)
        json.items.forEach((it) => {
          const item = {
            ...it, // เก็บทุกฟิลด์จาก DB (สำคัญมาก!)
            uniqueId: `${it.post_type}-${it.post_id}`,
            title: it.subject || "(ไม่มีหัวข้อ)",
            body: it.description || "",
            authorName: it.author || "ไม่ระบุชื่อ",
            likedAt: it.created_at,
            // Map ค่าให้เป็นชื่อกลาง เพื่อความง่ายในการแสดงผล
            priceDisplay: it.post_type === 'tutor' ? it.price : it.budget,
            location: it.location || "ไม่ระบุ",
            grade: it.grade_level || it.target_student_level || "-"
          };

          if (it.post_type === "student") student.push(item);
          else tutor.push(item);
        });

        setData({ student, tutor });
      }
    } catch (err) {
      console.error("Fav Error:", err);
      setError("โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [me?.user_id]);

  return { me, data, setData, loading, error, refetch: fetchData };
}

function useRecommendations(userId) {
  const [recs, setRecs] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchRecs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/favorites/feed-recommend/${userId}`);
        const json = await res.json();

        if (json.success) {
          setRecs(json.posts || []);
          setSubjects(json.recommended_subjects || []);
        }
      } catch (err) {
        console.error("Recs Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [userId]);

  return { recs, subjects, loading };
}

// --------------------------- Components ---------------------------

function TabButton({ active, children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${active
        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
        }`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

function PostCardSimple({ item, onUnfav, onClick }) {
  const isTutor = item.post_type === "tutor";
  return (
    <div
      onClick={onClick} // ✅ กดการ์ดเพื่อเปิด Modal
      className="group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 h-full cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isTutor ? "bg-green-200 text-green-700" : "bg-rose-200 text-rose-700"
            }`}>
            {isTutor ? <Users size={12} /> : <BookOpen size={12} />}
            {isTutor ? "ติวเตอร์" : "นักเรียน"}
          </span>
          <span className="text-xs text-gray-400">{formatDate(item.likedAt)}</span>
        </div>
        <h3 className="font-bold text-gray-800 text-lg line-clamp-1 mb-2 group-hover:text-blue-600 transition-colors">{item.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
          {item.body || "ไม่มีรายละเอียดเพิ่มเติม"}
        </p>
      </div>
      <div className="flex items-center justify-between border-t pt-4 mt-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            <img src={item.profile_picture_url || "/blank_avatar.jpg"} className="w-full h-full object-cover" alt="" />
          </div>
          <span className="truncate max-w-[120px]">{item.authorName}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnfav(item);
          }}
          className="text-red-500 hover:bg-red-50 p-2 rounded-full transition cursor-pointer z-10"
          title="ลบออกจากรายการโปรด"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function RecommendCard({ post, reasonSubjects }) {
  const isMatch = reasonSubjects.includes(post.subject);
  const isTutor = post.post_type === 'tutor';

  return (
    <div className={`flex flex-col min-w-[280px] md:min-w-[300px] rounded-2xl border bg-white p-4 shadow-sm hover:shadow-lg transition-all duration-300 ${isMatch ? 'border-yellow-400 ring-1 ring-yellow-100' : 'border-gray-100'}`}>

      <div className="flex justify-between items-start mb-3">
        {isMatch ? (
          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-md font-medium">
            <Sparkles size={12} />
          </span>
        ) : <div></div>}

        <span className={`text-[10px] px-2 py-0.5 rounded ml-auto ${isTutor ? 'bg-green-200 text-green-700' : 'bg-rose-200 text-rose-700'}`}>
          {isTutor ? 'ติวเตอร์' : 'นักเรียน'}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <img
          src={post.profile_picture_url || "/blank_avatar.jpg"}
          alt={post.name}
          className="w-12 h-12 rounded-full object-cover border border-gray-200"
        />
        <div>
          <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{post.name} {post.lastname}</h4>
          <p className="text-xs text-gray-500">{post.subject}</p>
        </div>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-grow h-10">{post.description}</p>

      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t">
        <div className="flex items-center gap-1 max-w-[50%] truncate">
          <MapPin size={12} /> {post.location || "ออนไลน์"}
        </div>
        <div className="flex items-center gap-1 font-semibold text-blue-600">
          <DollarSign size={12} />
          {isTutor ? `${formatPrice(post.price || 0)}/ชม.` : `งบ ${formatPrice(post.budget || 0)}`}
        </div>
      </div>
    </div>
  );
}

// --------------------------- Main Page ---------------------------
export default function Favorite() {
  const { me, data, setData, loading, error } = useFavorites();
  const { recs, subjects } = useRecommendations(me?.user_id);

  const [tab, setTab] = useState("tutor");
  const [q, setQ] = useState("");
  const [previewPost, setPreviewPost] = useState(null); // ✅ State สำหรับ Modal

  const list = useMemo(() => {
    const source = tab === "student" ? data.student : data.tutor;
    if (!q) return source;
    const lowerQ = q.toLowerCase();
    return source.filter(item =>
      item.title.toLowerCase().includes(lowerQ) ||
      item.authorName.toLowerCase().includes(lowerQ)
    );
  }, [tab, data, q]);

  const handleUnfav = async (item) => {
    // Optimistic UI Update
    setData(prev => ({
      student: prev.student.filter(x => x.uniqueId !== item.uniqueId),
      tutor: prev.tutor.filter(x => x.uniqueId !== item.uniqueId)
    }));

    try {
      console.log("Removing favorite:", item);
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: me.user_id,
          post_id: item.post_id,
          post_type: item.post_type
        }),
      });

      const result = await res.json();
      if (!result.success) {
        console.error("Failed to remove favorite:", result);
      }
    } catch (e) {
      console.error("Unfav error:", e);
      alert("เกิดข้อผิดพลาดในการลบรายการโปรด");
    }
  };

  if (loading) return <div className="p-10 text-center">กำลังโหลด...</div>;
  if (error) return <div className="p-10 text-center text-red-500">เกิดข้อผิดพลาด: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50/30 pb-20">

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 p-2.5 rounded-xl text-white shadow-lg shadow-red-500/30">
              <Heart size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">รายการที่สนใจ</h1>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหา..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-3 mb-6">
          <TabButton active={tab === "tutor"} onClick={() => setTab("tutor")} icon={Users}>
            ติวเตอร์ ({data.tutor.length})
          </TabButton>
          <TabButton active={tab === "student"} onClick={() => setTab("student")} icon={BookOpen}>
            นักเรียน ({data.student.length})
          </TabButton>
        </div>

        {list.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map(item => (
              <PostCardSimple
                key={item.uniqueId}
                item={item}
                onUnfav={handleUnfav}
                onClick={() => setPreviewPost(item)} // ✅ เปิด Modal เมื่อคลิก
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500">ยังไม่มีรายการในหมวดนี้</p>
          </div>
        )}
      </div>

      {/* Recommendation Section */}
      {recs.length > 0 && (
        <div className="mt-16 bg-gradient-to-b from-blue-50 to-white py-12 border-t">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-400 rounded-lg text-white shadow-lg shadow-yellow-200">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">แนะนำสำหรับคุณ</h2>
                <p className="text-sm text-gray-500">
                  รวมโพสต์ติวเตอร์และนักเรียนที่น่าสนใจ: <span className="font-semibold text-blue-600">{subjects.join(", ")}</span>
                </p>
              </div>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x">
              {recs.map((post) => (
                <RecommendCard
                  key={`${post.post_type}-${post.tutor_post_id || post.student_post_id}`}
                  post={post}
                  reasonSubjects={subjects}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal แสดงรายละเอียด (ใช้ดีไซน์เดียวกับ HomeTutor เป๊ะ) */}
      <Modal open={!!previewPost} onClose={() => setPreviewPost(null)} title={previewPost?.post_type === 'tutor' ? "รายละเอียดติวเตอร์" : "รายละเอียดประกาศนักเรียน"}>
        {previewPost && (
          <div className="space-y-6">
            {/* Header: รูปและชื่อ */}
            <div className="flex items-start gap-4">
              <img
                src={previewPost.profile_picture_url || "/blank_avatar.jpg"}
                className="w-16 h-16 rounded-full object-cover border"
                alt=""
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {previewPost.authorName}
                </h3>
                <div className="text-sm text-gray-500">
                  ลงประกาศเมื่อ: {formatDate(previewPost.likedAt)}
                </div>
                {previewPost.post_type === 'student' && <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">กำลังหาครู</span>}
                {previewPost.post_type === 'tutor' && <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">รับสอนพิเศษ</span>}
              </div>
            </div>

            {/* Subject & Description */}
            <div className="bg-gray-50 p-5 rounded-2xl space-y-3 border border-gray-100">
              <h4 className="text-lg font-bold text-indigo-700">{previewPost.title}</h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{previewPost.body || "-"}</p>
            </div>

            {/* Grid Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">สถานที่</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin size={16} /> {previewPost.location || "-"}
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">
                  {previewPost.post_type === 'tutor' ? 'ราคา/ชั่วโมง' : 'งบประมาณ'}
                </div>
                <div className="font-semibold text-emerald-600 flex items-center gap-2">
                  <DollarSign size={16} />
                  {formatPrice(previewPost.priceDisplay || 0)} ฿
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">วัน/เวลา</div>
                <div className="font-semibold text-blue-600 flex items-center gap-2">
                  <Calendar size={16} />
                  {previewPost.preferred_days || "-"}
                  {previewPost.preferred_time ? ` ${previewPost.preferred_time}` : ""}
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">ระดับชั้น</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <GraduationCap size={16} /> {previewPost.grade || "-"}
                </div>
              </div>
            </div>

            {/* 🔥 Contact Info (แสดงเบอร์โทร/ไลน์) */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold text-gray-900 mb-3">ข้อมูลติดต่อ</h4>
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="text-green-800 font-bold text-lg select-all">
                    {previewPost.contact_info || "ไม่ระบุข้อมูลติดต่อ"}
                  </p>
                  <p className="text-xs text-green-600">
                    ช่องทางติดต่อ (Line ID / เบอร์โทร)
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}