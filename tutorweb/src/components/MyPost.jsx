// src/components/MyPost.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapPin, Calendar, Clock, Users, DollarSign, Heart,
  Filter, Search, Plus, X, ChevronDown, Mail, Phone, User, Star
} from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';

const API_BASE = "http://localhost:5000";

/* ---------- helpers ---------- */
function pickUser() {
  try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
}
function pickUserType() {
  try { return (localStorage.getItem("userType") || "").toLowerCase(); } catch { return ""; }
}
function pickTutorId() {
  const u = pickUser();
  return u.user_id || localStorage.getItem("tutorId") || "";
}
function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.docs)) return data.docs;
  if (data.items && Array.isArray(data.items.docs)) return data.items.docs;
  return [];
}

/* ---------- normalizers ---------- */
const normalizeStudentPost = (p = {}) => ({
  id: p.id ?? p._id ?? p.student_post_id,
  owner_id: p.owner_id ?? p.student_id ?? p.user_id,
  createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
  subject: p.subject || p.title || "",
  description: p.description || p.content || "",
  grade_level: p.grade_level || (p.meta && p.meta.grade_level) || "ไม่ระบุ",
  location: p.location || p.place || p.location_name || "",
  group_size: Number(p.group_size ?? p.seats ?? p.groupSize ?? 0),
  budget: Number(p.budget ?? p.price ?? p.cost ?? 0),
  preferred_days: p.preferred_days || p.days || p.available_days || "",
  preferred_time: p.preferred_time || p.time || p.available_time || "",
  contact_info: p.contact_info || p.contact || p.email || "",
  join_count: Number(p.join_count ?? 0),
  joined: !!p.joined,
  pending_me: !!p.pending_me,
  fav_count: Number(p.fav_count ?? 0),
  fav_count: Number(p.fav_count ?? 0),
  favorited: !!p.favorited,
  has_tutor: !!p.has_tutor, // [NEW]
  post_type: "student",
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_picture_url || "/default-avatar.png",
    email: p.email || "",
    phone: p.phone || ""
  },
});

const normalizeTutorPost = (p = {}) => {
  const full = (p.authorId?.name || p.name || "").trim();
  let first = p.first_name || "";
  let last = p.last_name || "";

  if (!first && full) {
    const parts = full.split(" ");
    first = parts.shift() || "";
    last = parts.join(" ");
  }

  const targetLevel = p.target_student_level || (p.meta && p.meta.target_student_level) || (p.meta && p.meta.level) || "ไม่ระบุ";

  return {
    id: p.id ?? p._id ?? p.tutor_post_id,
    owner_id: p.tutor_id ?? p.user_id ?? p.owner_id ?? p.authorId?.id,
    createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
    subject: p.subject || p.title || "",
    description: p.content || p.description || "",
    meta: {
      target_student_level: targetLevel,
      teaching_days: p.meta?.teaching_days ?? p.teaching_days ?? "",
      teaching_time: p.meta?.teaching_time ?? p.teaching_time ?? "",
      location: p.meta?.location ?? p.location ?? "",
      price: typeof (p.meta?.price ?? p.price) === "number" ? (p.meta?.price ?? p.price) : Number(p.meta?.price ?? p.price ?? 0),
      contact_info: p.meta?.contact_info ?? p.contact_info ?? "",
    },
    fav_count: Number(p.fav_count ?? 0),
    favorited: !!p.favorited,
    join_count: Number(p.join_count ?? 0),
    joined: !!p.joined,
    pending_me: !!p.pending_me,
    group_size: Number(p.group_size ?? p.meta?.group_size ?? 0),
    post_type: "tutor",
    user: p.user || {
      first_name: first,
      last_name: last,
      profile_image: p.profile_image || p.authorId?.avatarUrl || "/default-avatar.png",
      email: p.email || "",
      phone: p.phone || ""
    },
  };
};

const postGradeLevelOptions = [
  { value: "ประถมศึกษา", label: "ประถมศึกษา" },
  { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
  { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

const today = new Date().toISOString().split("T")[0];

// --- Helper: ลิงก์สถานที่ไป Google Maps ---
const LocationLink = ({ value }) => {
  if (!value) return <span>-</span>;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline hover:text-blue-800 break-words"
      title="เปิดใน Google Maps"
    >
      {value}
    </a>
  );
};

// --- Helper: ลิงก์ติดต่อ (โทร, อีเมล, ไลน์) ---
const ContactLink = ({ value }) => {
  if (!value) return <span>-</span>;
  const text = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(text)) {
    return <a href={`mailto:${text}`} className="text-indigo-600 hover:underline">{text}</a>;
  }
  const cleanNumber = text.replace(/[- \(\)]/g, '');
  if (/^0\d{8,9}$/.test(cleanNumber)) {
    return <a href={`tel:${cleanNumber}`} className="text-emerald-600 hover:underline">{text}</a>;
  }
  const lineMatch = text.match(/^(?:line|id|line\s*id)\s*[:\.]?\s*(.+)/i);
  if (lineMatch) {
    const lineId = lineMatch[1];
    return (
      <a
        href={`https://line.me/ti/p/~${lineId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-600 hover:underline font-medium"
        title="เปิดใน Line"
      >
        {text}
      </a>
    );
  }
  return <span>{text}</span>;
};

/* ---------- UI Components ---------- */
function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-base text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */
function MyPost({ setPostsCache, onViewProfile }) {
  const user = pickUser();
  const userType = pickUserType();
  const isTutor = userType === "tutor";
  const meId = user.user_id || 0;
  const tutorId = useMemo(() => pickTutorId(), []);

  const [feedType, setFeedType] = useState("student");
  const [filterLevel, setFilterLevel] = useState("all");

  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState({});
  const [favLoading, setFavLoading] = useState({});
  const [error, setError] = useState("");

  const initialFormData = {
    subject: "",
    description: "",
    preferred_days: "",
    preferred_time: "",
    grade_level: "",
    location: "",
    group_size: "",
    budget: "",
    contact_info: "",
    target_student_level: [],
    teaching_days: "",
    teaching_time: "",
    price: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  // Logic การกรองข้อมูล
  const filteredPosts = useMemo(() => {
    if (filterLevel === "all") return posts;
    return posts.filter(p => {
      let levelData = "";
      if (p.post_type === "student") {
        levelData = p.grade_level || "";
      } else {
        levelData = p.meta?.target_student_level || "";
      }
      return String(levelData).includes(filterLevel);
    });
  }, [posts, filterLevel]);

  const fetchPosts = useCallback(async () => {
    try {
      setError("");
      if (feedType === "student") {
        const res = await fetch(`${API_BASE}/api/student_posts?me=${meId}&limit=100`);
        const data = await res.json();
        const list = extractList(data);
        const normalized = list.map(normalizeStudentPost).filter(p => p.id != null);
        setPosts(normalized);
        setPostsCache?.(normalized);
      } else {
        const url = `${API_BASE}/api/tutor-posts?page=1&limit=100&me=${meId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = extractList(data);
        const normalized = list.map(normalizeTutorPost).filter(p => p.id != null);
        setPosts(normalized);
        setPostsCache?.(normalized);
      }
    } catch (e) {
      console.error("fetchPosts error:", e);
      setError("โหลดโพสต์ไม่สำเร็จ");
      setPosts([]); setPostsCache?.([]);
    }
  }, [feedType, meId, setPostsCache]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLevelChange = (levelValue) => {
    setFormData(prev => {
      const currentLevels = prev.target_student_level || [];
      if (currentLevels.includes(levelValue)) {
        return { ...prev, target_student_level: currentLevels.filter(l => l !== levelValue) };
      } else {
        return { ...prev, target_student_level: [...currentLevels, levelValue] };
      }
    });
  };

  const handleLocationSelect = (address, locationObj) => {
    setFormData(prev => ({
      ...prev,
      location: address
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.user_id) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

    try {
      setLoading(true);
      setError("");

      if (feedType === "student") {
        const required = ["subject", "description", "preferred_days", "preferred_time", "location", "group_size", "budget", "contact_info", "grade_level"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");

        const payload = {
          user_id: meId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          preferred_days: formData.preferred_days,
          preferred_time: formData.preferred_time,
          grade_level: formData.grade_level,
          location: formData.location.trim(),
          group_size: Number(formData.group_size),
          budget: Number(formData.budget),
          contact_info: formData.contact_info.trim(),
        };
        const res = await fetch(`${API_BASE}/api/student_posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("เกิดข้อผิดพลาด");

      } else {
        const required = ["subject", "description", "teaching_days", "teaching_time", "location", "price", "contact_info"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
        if (formData.target_student_level.length === 0) {
          return alert("กรุณาเลือกระดับชั้นที่สอนอย่างน้อย 1 ระดับ");
        }
        if (userType !== "tutor") {
          throw new Error("เฉพาะติวเตอร์เท่านั้นที่โพสต์ฝั่งติวเตอร์ได้");
        }

        const payload = {
          tutor_id: tutorId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          target_student_level: formData.target_student_level.join(','),
          teaching_days: formData.teaching_days,
          teaching_time: formData.teaching_time,
          location: formData.location.trim(),
          group_size: Number(formData.group_size) || 1,
          price: Number(formData.price),
          contact_info: formData.contact_info.trim(),
        };

        const res = await fetch(`${API_BASE}/api/tutor-posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body?.message || "เกิดข้อผิดพลาดในการสร้างโพสต์ (tutor)");
        }
      }

      await fetchPosts();
      setExpanded(false);
      setFormData(initialFormData);

    } catch (err) {
      alert(err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (post) => {
    if (feedType !== "student") return;
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    if (isTutor) {
      if (!window.confirm("ยืนยันที่จะเสนอสอนให้นักเรียนคนนี้?")) return;
    }

    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${post.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: meId }) });
      const data = await res.json();
      if (!res.ok) return alert(data?.message);

      // อัปเดต state: ถ้ากด Join สำเร็จ สถานะจะเป็น pending_me (รออนุมัติ / ส่งข้อเสนอแล้ว)
      const updater = (arr) => arr.map(p => p.id === post.id ? { ...p, pending_me: true, joined: false, join_count: data.join_count } : p);
      setPosts(updater);
    } finally { setJoinLoading(s => ({ ...s, [post.id]: false })); }
  };

  const handleUnjoin = async (post) => {
    if (feedType !== "student") return;
    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${post.id}/join?user_id=${meId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data?.message);

      // อัปเดต state: ถ้ากดเลิก สถานะ pending_me และ joined จะเป็น false
      const updater = (arr) => arr.map(p => p.id === post.id ? { ...p, joined: false, pending_me: false, join_count: data.join_count } : p);
      setPosts(updater);
    } finally { setJoinLoading(s => ({ ...s, [post.id]: false })); }
  };

  const handleJoinTutor = async (post) => {
    if (feedType !== "tutor") return;
    if (isTutor) return alert("บัญชีติวเตอร์ไม่สามารถ Join ได้");
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");
    setJoinLoading((s) => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${post.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: meId }) });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPosts(arr => arr.map(p => p.id === post.id ? { ...p, joined: !!data.joined, pending_me: !!data.pending_me, join_count: data.join_count ?? (p.join_count + 1) } : p));
    } catch { alert("Error"); } finally { setJoinLoading((s) => ({ ...s, [post.id]: false })); }
  };

  const handleUnjoinTutor = async (post) => {
    if (feedType !== "tutor") return;
    setJoinLoading((s) => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${post.id}/join?user_id=${meId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPosts(arr => arr.map(p => p.id === post.id ? { ...p, joined: !!data.joined, pending_me: !!data.pending_me, join_count: data.join_count ?? (p.join_count - 1) } : p));
    } catch { alert("Error"); } finally { setJoinLoading((s) => ({ ...s, [post.id]: false })); }
  };

  const toggleFavorite = async (post) => {
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    const postType = post.post_type || (feedType === "student" ? "student" : "tutor");

    setPosts(currentPosts => currentPosts.map(p => {
      if (p.id === post.id) {
        const isFav = !p.favorited;
        return {
          ...p,
          favorited: isFav,
          fav_count: isFav ? p.fav_count + 1 : p.fav_count - 1
        };
      }
      return p;
    }));

    setFavLoading(s => ({ ...s, [post.id]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: meId,
          post_id: post.id,
          post_type: postType
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPosts(arr => arr.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              fav_count: data.fav_count
            };
          }
          return p;
        }));
      } else {
        throw new Error("Server returned unsuccessful");
      }

    } catch (err) {
      console.error("Fav Error:", err);
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === post.id) {
          const isFav = !p.favorited;
          return {
            ...p,
            favorited: isFav,
            fav_count: isFav ? p.fav_count + 1 : p.fav_count - 1
          };
        }
        return p;
      }));
      alert("เกิดข้อผิดพลาด ไม่สามารถกดถูกใจได้");
    } finally {
      setFavLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  const currentUserName = user?.name || user?.first_name || "User";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold">ฟีดโพสต์</h1>

          <div className="inline-flex rounded-xl border overflow-hidden">
            <button
              className={`px-4 py-2 text-sm ${feedType === 'student' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => { setFeedType('student'); setFilterLevel('all'); }}
            >
              นักเรียน
            </button>
            <button
              className={`px-4 py-2 text-sm ${feedType === 'tutor' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => { setFeedType('tutor'); setFilterLevel('all'); }}
            >
              ติวเตอร์
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {feedType === "student" ? "แสดงโพสต์ของนักเรียน" : "แสดงโพสต์ของติวเตอร์"}
        </p>

        {/* Dropdown Filter */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="text-sm text-gray-600 font-medium">กรองระดับชั้น:</span>
          <div className="relative">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="appearance-none bg-white border border-gray-300 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">แสดงทั้งหมด</option>
              {postGradeLevelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Compose Box */}
        {(
          (feedType === "student" && !isTutor) ||
          (feedType === "tutor" && isTutor)
        ) && (
            <div className="bg-white rounded-xl shadow p-4 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src={user?.profile_picture_url || user?.profile_image || "/default-avatar.png"}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
                  onClick={() => setExpanded(true)}
                >
                  {`สวัสดี, ${currentUserName} — ${feedType === 'student' ? 'สร้างโพสต์...' : 'สร้างโพสต์รับสอน...'}`}
                </div>
              </div>

              <Modal
                open={expanded}
                onClose={() => setExpanded(false)}
                title={feedType === "student" ? "นักเรียนสร้างโพสต์" : "ติวเตอร์สร้างโพสต์"}
              >
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* วิชา/หัวข้อ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">วิชา / หัวข้อ</label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                  </div>

                  {/* รายละเอียด */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เนื้อหาที่ต้องการเรียน</label>
                    <textarea name="description" rows="3" value={formData.description} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>

                  {feedType === "student" ? (
                    <>
                      {/* วันและเวลาที่สะดวก */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สะดวก</label>
                          <input type="date" name="preferred_days" value={formData.preferred_days} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" min={today} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สะดวก</label>
                          <input type="time" name="preferred_time" value={formData.preferred_time} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      {/* ระดับชั้น */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้นของผู้เรียน</label>
                        <select name="grade_level" value={formData.grade_level} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                          <option value="">-- กรุณาเลือก --</option>
                          {postGradeLevelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>

                      {/* สถานที่ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่เรียน</label>
                        <LongdoLocationPicker
                          onLocationSelect={handleLocationSelect}
                          defaultLocation={formData.location}
                          showMap={false}
                        />
                      </div>

                      {/* จำนวนคนและงบประมาณ */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                          <input type="number" name="group_size" min="1" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">งบประมาณ (ราคาต่อชั่วโมง)</label>
                          <input type="number" name="budget" min="0" value={formData.budget} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      {/* ข้อมูลติดต่อ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ (เช่น Line ID, เบอร์โทร)</label>
                        <input type="text" name="contact_info" value={formData.contact_info} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ส่วนของ Tutor */}
                      <div className="border rounded-xl p-4">
                        <label className="block text-sm font-bold text-gray-800 mb-3">ระดับชั้นที่รับสอน (เลือกได้มากกว่า 1)</label>
                        <div className="flex flex-wrap gap-3">
                          {postGradeLevelOptions.map(option => (
                            <label
                              key={option.value}
                              className="flex items-center space-x-2 cursor-pointer px-3 py-2 bg-white hover:bg-blue-50 border border-gray-200 rounded-lg transition-all shadow-sm select-none">
                              <input
                                id={`level-${option.value}`}
                                type="checkbox"
                                value={option.value}
                                checked={(formData.target_student_level || []).includes(option.value)}
                                onChange={() => handleLevelChange(option.value)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-sm text-gray-700 whitespace-nowrap">{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สะดวกสอน</label>
                          <input type="date" name="teaching_days" value={formData.teaching_days} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" min={today} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สะดวกสอน</label>
                          <input type="time" name="teaching_time" value={formData.teaching_time} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                          <input type="number" name="group_size" min="0" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่สอน</label>
                          <LongdoLocationPicker
                            onLocationSelect={handleLocationSelect}
                            defaultLocation={formData.location}
                            showMap={false}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อชั่วโมง (บาท)</label>
                          <input type="number" name="price" min="0" value={formData.price} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ</label>
                          <input type="text" name="contact_info" value={formData.contact_info} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                    <button type="button" onClick={() => setExpanded(false)} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors">ยกเลิก</button>
                    <button disabled={loading} type="submit" className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          กำลังโพสต์...
                        </span>
                      ) : "สร้างโพสต์"}
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

        {/* List */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-10 text-gray-500 border rounded-lg border-dashed">
            <p>ไม่พบโพสต์ที่ตรงกับตัวกรอง</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map((post) => {
              const isOwner = meId === post.owner_id;
              const busy = !!joinLoading[post.id];
              const favBusy = !!favLoading[post.id];
              const cap = Number(post.group_size || 0);
              const joinedCount = Number(post.join_count || 0);
              const isFull = cap > 0 && joinedCount >= cap;


              //เงื่อนไขที่ถ้าเลยวันที่โพสต์แล้ว จะไม่สามารถกด Join ได้
              let isExpired = false;
              try {
                // ดึงวันที่และเวลาตามประเภทโพสต์
                let dateStr = "";
                let timeStr = "";

                if (post.post_type === "student") {
                  dateStr = post.preferred_days; // รูปแบบ YYYY-MM-DD
                  timeStr = post.preferred_time; // รูปแบบ HH:mm
                } else {
                  dateStr = post.meta?.teaching_days;
                  timeStr = post.meta?.teaching_time;
                }

                if (dateStr) {
                  const targetDateTimeStr = timeStr
                    ? `${dateStr}T${timeStr}`
                    : `${dateStr}T23:59:59`;

                  const targetDate = new Date(targetDateTimeStr);
                  const now = new Date();

                  if (now > targetDate) {
                    isExpired = true;
                  }
                }
              } catch (e) {
                console.error("Date check error", e);
              }

              return (
                <div key={post.id} className="bg-white border p-4 rounded-2xl shadow-sm">
                  <div
                    className="flex items-center gap-3 mb-2 cursor-pointer group"
                    onClick={() => {
                      // Use onViewProfile if available
                      if (onViewProfile) {
                        // Prefer owner_id for fetching profile
                        onViewProfile(post.owner_id);
                      }
                    }}
                  >
                    <img
                      src={post.user?.profile_image}
                      alt="profile"
                      className="w-10 h-10 rounded-full object-cover mr-3 shrink-0 border group-hover:border-indigo-500 transition-colors"
                    />
                    <div>
                      <p className="font-semibold group-hover:text-indigo-600 group-hover:underline transition-colors">
                        {post.user?.first_name} {post.user?.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${post.post_type === 'student'
                          ? 'bg-rose-200 text-rose-700'
                          : 'bg-green-200 text-green-700'
                          }`}>
                          {post.post_type === 'student' ? 'นักเรียน' : 'ติวเตอร์'}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(post.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold">{post.subject}</h3>
                  <p className="mb-2 whitespace-pre-line">{post.description}</p>

                  {/* Post Details */}
                  {post.post_type === "student" ? (
                    <div className="text-sm text-gray-600 grid md:grid-cols-2 gap-y-1">
                      <p><span className="font-bold text-red-500">📚 ระดับชั้น: </span> {post.grade_level}</p>

                      {/* ✅ แก้ไข: ใช้ LocationLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">📍 สถานที่: </span>
                        <LocationLink value={post.location} />
                      </p>

                      <p><span className="font-bold">👥 จำนวนคน: </span> {post.group_size} คน</p>
                      <p><span className="font-bold">💰 งบประมาณ: </span> {post.budget} บาท</p>
                      <p><span className="font-bold">📅 วันสะดวก: </span> {post.preferred_days}</p>
                      <p><span className="font-bold">⏰ เวลา: </span> {post.preferred_time}</p>

                      {/* ✅ แก้ไข: ใช้ ContactLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">✉️ ข้อมูลติดต่อ: </span>
                        <ContactLink value={post.contact_info} />
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 grid md:grid-cols-2 gap-y-1">
                      <p>📚 ระดับชั้นที่สอน: {post.meta?.target_student_level}</p>
                      <p>📅 วันที่สอน: {post.meta?.teaching_days}</p>
                      <p>⏰ ช่วงเวลา: {post.meta?.teaching_time}</p>

                      {/* ✅ แก้ไข: ใช้ LocationLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">📍 สถานที่: </span>
                        <LocationLink value={post.meta?.location} />
                      </p>

                      {typeof post.group_size === 'number' && post.group_size > 0 ? (
                        <p>👥 จำนวนคน: {post.group_size} คน</p>
                      ) : null}
                      <p>💸 ราคา: {Number(post.meta?.price || 0).toFixed(2)} บาท/ชม.</p>

                      {/* ✅ แก้ไข: ใช้ ContactLink */}
                      <p className="md:col-span-2 flex items-start gap-1">
                        <span className="font-bold shrink-0">☎️ ติดต่อ: </span>
                        <ContactLink value={post.meta?.contact_info} />
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between pt-3">
                    <div className="text-sm text-gray-600">
                      {post.post_type === "student" ? (
                        <>
                          เข้าร่วมแล้ว : <b>{post.join_count}</b> / {post.group_size} คน
                          {/* [NEW] Badge shown to everyone */}
                          {post.has_tutor && <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-bold border border-indigo-200">ได้ติวเตอร์แล้ว</span>}

                          {post.joined && <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">คุณเข้าร่วมแล้ว</span>}
                          {post.pending_me && !post.joined && <span className="ml-2 px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded-full">รออนุมัติ</span>}
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full mr-2">โพสต์รับสอน</span>
                          <span className="text-gray-600">ผู้เข้าร่วม: {post.group_size ? (<b>{Number(post.join_count || 0)} / {post.group_size} คน</b>) : (<b>{Number(post.join_count || 0)} คน</b>)}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button disabled={favBusy} onClick={() => toggleFavorite(post)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition ${post.favorited ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600'} disabled:opacity-60`}>
                        <Heart size={16} fill={post.favorited ? 'currentColor' : 'none'} />
                        <span className="text-sm">{Number(post.fav_count || 0)}</span>
                      </button>

                      {/* Action Buttons (Join/Unjoin) - LOGIC ที่แก้ไขให้ถูกต้อง */}
                      {post.post_type === "student" ? (
                        // === Student Post ===
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">คุณเป็นเจ้าของโพสต์</span>
                        ) : (
                          // ถ้าไม่ใช่เจ้าของ (เป็นคนอื่นมาดู)
                          (post.joined || post.pending_me) ? (
                            // 1. ถ้าเคยกดไปแล้ว (ไม่ว่า Joined หรือ Pending) ให้แสดงปุ่มยกเลิก
                            <button
                              disabled={busy}
                              onClick={() => handleUnjoin(post)}
                              className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50"
                            >
                              {busy ? "..." : (isTutor ? "ยกเลิกข้อเสนอ" : "ยกเลิกคำขอ")}
                            </button>
                          ) : (
                            // 2. ถ้ายังไม่เคยกด
                            <button
                              disabled={busy || isExpired || (isFull && !isTutor)}
                              onClick={() => handleJoin(post)}
                              className={`px-4 py-2 rounded-xl text-white ${isExpired ? "bg-gray-400 cursor-not-allowed" :
                                (isFull && !isTutor) ? "bg-gray-400 cursor-not-allowed" :
                                  isTutor ? "bg-indigo-600 hover:bg-indigo-700" : // สีครามสำหรับติวเตอร์
                                    "bg-purple-600 hover:bg-purple-700"
                                }`}
                            >
                              {isExpired ? "หมดเวลา" :
                                (isFull && !isTutor) ? "เต็มแล้ว" :
                                  busy ? "..." :
                                    (isTutor ? "ต้องการสอน" : "Join")}
                            </button>
                          )
                        )
                      ) : (
                        // === Tutor Post (คงเดิม) ===
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">โพสต์ของฉัน</span>
                        ) : isTutor ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">สำหรับนักเรียน</span>
                        ) : (post.joined || post.pending_me) ? (
                          <button disabled={busy} onClick={() => handleUnjoinTutor(post)} className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50">
                            {busy ? "..." : "เลิกร่วม"}
                          </button>
                        ) : (
                          <button
                            disabled={busy || isExpired || isFull}
                            onClick={() => handleJoinTutor(post)}
                            className={`px-4 py-2 rounded-xl text-white ${(isExpired || isFull) ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                              }`}
                          >
                            {isExpired ? "หมดเวลา" : isFull ? "เต็มแล้ว" : busy ? "..." : "Join"}
                          </button>
                        )

                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}



      </div>
    </div>
  );
}

export default MyPost;