import React, { useEffect, useMemo, useState } from "react";
import {
  Heart, Users, BookOpen, Search, Filter, Trash2,
  Sparkles, MapPin, DollarSign, User
} from "lucide-react";

// ✅ 1. ตรวจสอบ URL ให้ถูกต้อง
const API_BASE = "http://localhost:5000";

// --------------------------- Utilities ---------------------------
const formatPrice = (n) => new Intl.NumberFormat("th-TH").format(n);
const formatDate = (dateString) =>
  new Date(dateString).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function getMe() {
  try {
    const u = JSON.parse(localStorage.getItem("user"));
    return u || {};
  } catch {
    return {};
  }
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
        const student = [];
        const tutor = [];
        json.items.forEach((it) => {
          const item = {
            uniqueId: `${it.post_type}-${it.post_id}`,
            post_type: it.post_type,
            post_id: it.post_id,
            title: it.subject || "(ไม่มีหัวข้อ)",
            body: it.description || "",
            authorName: it.author || "ไม่ระบุชื่อ",
            likedAt: it.created_at,
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

function PostCardSimple({ item, onUnfav }) {
  const isTutor = item.post_type === "tutor";
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 h-full">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isTutor ? "bg-green-200 text-green-700" : "bg-rose-200 text-rose-700"
            }`}>
            {isTutor ? <Users size={12} /> : <BookOpen size={12} />}
            {isTutor ? "ติวเตอร์" : "นักเรียน"}
          </span>
          <span className="text-xs text-gray-400">{formatDate(item.likedAt)}</span>
        </div>
        <h3 className="font-bold text-gray-800 text-lg line-clamp-1 mb-2">{item.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
          {item.body || "ไม่มีรายละเอียดเพิ่มเติม"}
        </p>
      </div>
      <div className="flex items-center justify-between border-t pt-4 mt-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <User size={14} />
          </div>
          <span className="truncate max-w-[120px]">{item.authorName}</span>
        </div>
        {/* ปุ่มลบ (ถังขยะ) */}
        <button
          onClick={() => onUnfav(item)}
          className="text-red-500 hover:bg-red-50 p-2 rounded-full transition cursor-pointer"
          title="ลบออกจากรายการโปรด"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ✅ 3. RecommendCard: แก้ไขให้แสดงผลได้ทั้ง นักเรียน และ ติวเตอร์
function RecommendCard({ post, reasonSubjects }) {
  const isMatch = reasonSubjects.includes(post.subject);
  // เช็คประเภทโพสต์ (Backend ส่งมาเป็น 'student' หรือ 'tutor')
  const isTutor = post.post_type === 'tutor';

  return (
    <div className={`flex flex-col min-w-[280px] md:min-w-[300px] rounded-2xl border bg-white p-4 shadow-sm hover:shadow-lg transition-all duration-300 ${isMatch ? 'border-yellow-400 ring-1 ring-yellow-100' : 'border-gray-100'}`}>

      {/* Badge ประเภท และ แนะนำ */}
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
          src={post.profile_picture_url || "/default-avatar.png"}
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
          {/* ✅ แสดงราคา หรือ งบประมาณ ตามประเภทโพสต์ */}
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

  const list = useMemo(() => {
    const source = tab === "student" ? data.student : data.tutor;
    if (!q) return source;
    const lowerQ = q.toLowerCase();
    return source.filter(item =>
      item.title.toLowerCase().includes(lowerQ) ||
      item.authorName.toLowerCase().includes(lowerQ)
    );
  }, [tab, data, q]);

  // ✅ 2. แก้ไข handleUnfav ให้ลบจริงใน Database
  const handleUnfav = async (item) => {
    // 2.1 Optimistic Update: ลบจากหน้าจอทันทีเพื่อให้ลื่นไหล
    setData(prev => ({
      student: prev.student.filter(x => x.uniqueId !== item.uniqueId),
      tutor: prev.tutor.filter(x => x.uniqueId !== item.uniqueId)
    }));

    try {
      // 2.2 ยิง API ไปลบที่ Backend (สำคัญมาก: ชื่อตัวแปรต้องตรง)
      console.log("Removing favorite:", item);

      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: me.user_id, // ✅ ต้องเป็น user_id (snake_case)
          post_id: item.post_id, // ✅ ต้องเป็น post_id
          post_type: item.post_type // ✅ ต้องระบุ type ('student' หรือ 'tutor')
        }),
      });

      const result = await res.json();
      if (!result.success) {
        console.error("Failed to remove favorite:", result);
        // (Optional) ถ้าลบไม่สำเร็จ อาจจะโหลดข้อมูลใหม่มาแสดง
        // window.location.reload(); 
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
              <PostCardSimple key={item.uniqueId} item={item} onUnfav={handleUnfav} />
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
                  // ใช้ key ที่ไม่ซ้ำกันแน่นอน
                  key={`${post.post_type}-${post.tutor_post_id || post.student_post_id}`}
                  post={post}
                  reasonSubjects={subjects}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}