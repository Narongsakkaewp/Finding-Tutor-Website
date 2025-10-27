// src/components/MyPost.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

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
  favorited: !!p.favorited,
  post_type: "student",
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
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

  return {
    id: p.id ?? p._id ?? p.tutor_post_id,
    owner_id: p.tutor_id ?? p.user_id ?? p.owner_id ?? p.authorId?.id,
    createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
    subject: p.subject || p.title || "",
    description: p.content || p.description || "",
    meta: {
      teaching_days: p.meta?.teaching_days ?? p.teaching_days ?? "",
      teaching_time: p.meta?.teaching_time ?? p.teaching_time ?? "",
      location: p.meta?.location ?? p.location ?? "",
      price:
        typeof (p.meta?.price ?? p.price) === "number"
          ? (p.meta?.price ?? p.price)
          : Number(p.meta?.price ?? p.price ?? 0),
      contact_info: p.meta?.contact_info ?? p.contact_info ?? "",
    },
    fav_count: Number(p.fav_count ?? 0),
    favorited: !!p.favorited,
    // ★ NEW (Tutor Join): รองรับการ join โพสต์ติวเตอร์
    join_count: Number(p.join_count ?? 0),
    joined: !!p.joined,
    pending_me: !!p.pending_me,
    post_type: "tutor",
    user: p.user || {
      first_name: first,
      last_name: last,
      profile_image: p.profile_image || p.authorId?.avatarUrl || "/default-avatar.png",
    },
  };
};

const postGradeLevelOptions = [
  { value: "ประถมศึกษา", label: "ประถมศึกษา" },
  { value: "ม.1-ม.3", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
  { value: "ม.4-ม.6", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" }
];

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-100">ปิด</button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}


/* ---------- component ---------- */
function MyPost({ setPostsCache }) {
  const user = pickUser();
  const userType = pickUserType();               // 'student' | 'tutor' | ''
  const isTutor = userType === "tutor";          // ★ ใช้ตรวจว่าผู้ใช้เป็นติวเตอร์
  const meId = user.user_id || 0;
  const tutorId = useMemo(() => pickTutorId(), []);

  // ให้ค่าเริ่มต้นเหมือนเดิม (student) และยังคงมีปุ่มสลับแท็บ
  const [feedType, setFeedType] = useState("student"); // 'student' | 'tutor'

  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState({});
  const [favLoading, setFavLoading] = useState({});
  const [error, setError] = useState("");

  // ฟอร์ม
  const initialFormData = {
    subject: "",
    description: "",
    preferred_days: "", // สำหรับ input type="date"
    preferred_time: "", // สำหรับ input type="time"
    location: "ออนไลน์", // ใส่ค่าเริ่มต้น
    group_size: "1",
    budget: "",
    contact_info: "",
    // สำหรับติวเตอร์
    target_student_level: [],
    teaching_days: "",
    teaching_time: "",
    price: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  /* ---------- fetch posts (ตามแท็บ) ---------- */
  const fetchPosts = useCallback(async () => {
    console.log("[DEBUG] fetchPosts triggered:", feedType, meId);
    try {
      setError("");

      if (feedType === "student") {
        const res = await fetch(`${API_BASE}/api/student_posts?me=${meId}`);
        const data = await res.json();
        const list = extractList(data);
        const normalized = list.map(normalizeStudentPost).filter(p => p.id != null);
        setPosts(normalized);
        setPostsCache?.(normalized);
      } else {
        // tutor feed — แนบ me เพื่อให้ backend คืน favorited/fav_count/join flags ให้ถูก
        const url = `${API_BASE}/api/tutor-posts?page=1&limit=20`;
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
    console.log("[DEBUG] useEffect triggered by feedType:", feedType);
    fetchPosts();
  }, [fetchPosts]);

  /* ---------- form handlers ---------- */
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[DEBUG] Submit formData:", feedType, formData);
    if (!user?.user_id) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

    try {
      setLoading(true);
      setError("");

      if (feedType === "student") {
        const required = ["subject", "description", "preferred_days", "preferred_time", "location", "group_size", "budget", "contact_info"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");

        const payload = {
          user_id: meId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          preferred_days: formData.preferred_days,
          preferred_time: formData.preferred_time,
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
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message || "เกิดข้อผิดพลาด");

      } else {
        // ✅✅✅ 8. START: แก้ไข Bug ของติวเตอร์ ✅✅✅
        const required = ["subject", "description", "teaching_days", "teaching_time", "location", "price", "contact_info"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
        if (formData.target_student_level.length === 0) {
          return alert("กรุณาเลือกระดับชั้นที่สอนอย่างน้อย 1 ระดับ");
        }
        if (userType !== "tutor") {
          throw new Error("เฉพาะติวเตอร์เท่านั้นที่โพสต์ฝั่งติวเตอร์ได้");
        }

        // สร้าง payload แบบ Flat Object ให้ตรงกับ Backend API
        const payload = {
          tutor_id: tutorId, // ใช้ tutorId ที่ดึงมาจาก useMemo
          subject: formData.subject.trim(),
          description: formData.description.trim(), // <--- แก้จาก content
          target_student_level: formData.target_student_level.join(','), // แปลง Array เป็น String
          teaching_days: formData.teaching_days, // <--- ย้ายออกมาจาก meta
          teaching_time: formData.teaching_time, // <--- ย้ายออกมาจาก meta
          location: formData.location.trim(),      // <--- ย้ายออกมาจาก meta
          price: Number(formData.price),           // <--- ย้ายออกมาจาก meta
          contact_info: formData.contact_info.trim(), // <--- ย้ายออกมาจาก meta
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
        // ✅✅✅ END: แก้ไข Bug ของติวเตอร์ ✅✅✅
      }

      await fetchPosts(); // เรียกโหลดโพสต์ใหม่ทั้งหมด
      setExpanded(false); // ปิด Modal
      setFormData(initialFormData); // ✅ 9. รีเซ็ตฟอร์มด้วยค่าเริ่มต้นที่ถูกต้อง

    } catch (err) {
      alert(err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Join / Unjoin (student-only on student posts) ---------- */
  const handleJoin = async (post) => {
    if (feedType !== "student") return;
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${post.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: meId })
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "Join ไม่สำเร็จ");

      const updater = (arr) =>
        arr.map(p => p.id === post.id
          ? { ...p, pending_me: true, joined: false, join_count: data.join_count }
          : p);

      setPosts(updater);
      setPostsCache?.(updater);
    } finally {
      setJoinLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  const handleUnjoin = async (post) => {
    if (feedType !== "student") return;
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/student_posts/${post.id}/join?user_id=${meId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "ยกเลิกไม่สำเร็จ");

      const updater = (arr) =>
        arr.map(p => p.id === post.id
          ? { ...p, joined: false, pending_me: false, join_count: data.join_count }
          : p);

      setPosts(updater);
      setPostsCache?.(updater);
    } finally {
      setJoinLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  /* ---------- ★ NEW: Join / Unjoin สำหรับโพสต์ติวเตอร์ ---------- */
  const handleJoinTutor = async (post) => {
    // เฉพาะนักเรียนที่ดูแท็บ "ติวเตอร์"
    if (feedType !== "tutor") return;
    if (isTutor) return alert("บัญชีติวเตอร์ไม่สามารถ Join โพสต์ติวเตอร์ได้");
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    setJoinLoading((s) => ({ ...s, [post.id]: true }));

    const prev = { joined: !!post.joined, count: Number(post.join_count || 0) };

    // optimistic
    const optimistic = (arr) =>
      arr.map((p) =>
        p.id === post.id
          ? { ...p, joined: true, pending_me: true, join_count: prev.count + 1 }
          : p
      );
    setPosts(optimistic);
    setPostsCache?.(optimistic);

    try {
      // ✅ ใช้ unified endpoint ที่ฝั่ง server มีแน่นอน
      const res = await fetch(`${API_BASE}/api/posts/tutor/${post.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: meId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Join ไม่สำเร็จ");

      const sync = (arr) =>
        arr.map((p) =>
          p.id === post.id
            ? {
              ...p,
              joined: !!data.joined,
              pending_me: !!data.pending_me,
              join_count:
                typeof data.join_count === "number"
                  ? data.join_count
                  : prev.count + 1,
            }
            : p
        );
      setPosts(sync);
      setPostsCache?.(sync);
    } catch (e) {
      const rollback = (arr) =>
        arr.map((p) =>
          p.id === post.id
            ? {
              ...p,
              joined: prev.joined,
              pending_me: false,
              join_count: prev.count,
            }
            : p
        );
      setPosts(rollback);
      setPostsCache?.(rollback);
      alert(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setJoinLoading((s) => ({ ...s, [post.id]: false }));
    }
  };

  const handleUnjoinTutor = async (post) => {
    if (feedType !== "tutor") return;
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    setJoinLoading((s) => ({ ...s, [post.id]: true }));
    const prev = { joined: !!post.joined, count: Number(post.join_count || 0) };

    // optimistic
    const optimistic = (arr) =>
      arr.map((p) =>
        p.id === post.id
          ? {
            ...p,
            joined: false,
            pending_me: false,
            join_count: Math.max(0, prev.count - 1),
          }
          : p
      );
    setPosts(optimistic);
    setPostsCache?.(optimistic);

    try {
      const res = await fetch(
        `${API_BASE}/api/posts/tutor/${post.id}/join?user_id=${meId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "ยกเลิกไม่สำเร็จ");

      const sync = (arr) =>
        arr.map((p) =>
          p.id === post.id
            ? {
              ...p,
              joined: !!data.joined,
              pending_me: !!data.pending_me,
              join_count:
                typeof data.join_count === "number"
                  ? data.join_count
                  : Math.max(0, prev.count - 1),
            }
            : p
        );
      setPosts(sync);
      setPostsCache?.(sync);
    } catch (e) {
      const rollback = (arr) =>
        arr.map((p) =>
          p.id === post.id ? { ...p, joined: prev.joined, join_count: prev.count } : p
        );
      setPosts(rollback);
      setPostsCache?.(rollback);
      alert(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setJoinLoading((s) => ({ ...s, [post.id]: false }));
    }
  };

  /* ---------- Favorite (student & tutor feed) ---------- */
  const toggleFavorite = async (post) => {
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");
    const postType = post.post_type || (feedType === "student" ? "student" : "tutor");

    setFavLoading(s => ({ ...s, [post.id]: true }));

    // optimistic flip
    const optimistic = (arr) => arr.map(p => {
      if (p.id !== post.id) return p;
      const turnedOn = !p.favorited;
      const nextCount = Math.max(0, (Number(p.fav_count) || 0) + (turnedOn ? 1 : -1));
      return { ...p, favorited: turnedOn, fav_count: nextCount };
    });
    setPosts(optimistic);
    setPostsCache?.(optimistic);

    try {
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: meId,
          post_id: post.id,
          post_type: postType,
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data?.action || typeof data?.fav_count === "number")) {
        const sync = (arr) => arr.map(p => {
          if (p.id !== post.id) return p;
          const turnedOn = data.action ? (data.action === "added") : p.favorited;
          const count = typeof data.fav_count === "number" ? data.fav_count : p.fav_count;
          return { ...p, favorited: turnedOn, fav_count: Math.max(0, Number(count || 0)) };
        });
        setPosts(sync);
        setPostsCache?.(sync);
      } else if (!res.ok) {
        throw new Error(data?.message || "favorite api failed");
      }
    } catch (e) {
      console.error("toggleFavorite error:", e);
      // rollback
      const rollback = (arr) => arr.map(p => {
        if (p.id !== post.id) return p;
        const weTurnedOn = !post.favorited;
        const nextCount = Math.max(0, (Number(p.fav_count) || 0) + (weTurnedOn ? -1 : 1));
        return { ...p, favorited: post.favorited, fav_count: nextCount };
      });
      setPosts(rollback);
      setPostsCache?.(rollback);
      alert("บันทึกถูกใจไม่สำเร็จ");
    } finally {
      setFavLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  const currentUserName = user?.name || user?.first_name || "";

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">ฟีดโพสต์</h1>

          {/* ปุ่มแท็บ: คงไว้ทั้ง "นักเรียน" และ "ติวเตอร์" ตามที่ต้องการ */}
          <div className="inline-flex rounded-xl border overflow-hidden">
            <button
              className={`px-4 py-2 text-sm ${feedType === 'student' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setFeedType('student')}
            >
              นักเรียน
            </button>
            <button
              className={`px-4 py-2 text-sm ${feedType === 'tutor' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => {
                console.log("Switching to tutor feed");
                setFeedType('tutor');
              }}
            >
              ติวเตอร์
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {feedType === "student" ? "แสดงโพสต์ของนักเรียน" : "แสดงโพสต์ของติวเตอร์"}
        </p>

        {error && (
          <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* compose box */}
        {(
          (feedType === "student" && !isTutor) ||
          (feedType === "tutor" && isTutor)
        ) && (
            <div className="bg-white rounded-xl shadow p-4 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src={user?.profile_picture_url || user?.profile_image || "/default-avatar.png"}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
                  onClick={() => setExpanded(true)} // กดแล้วเปิด Modal
                >
                  {`สวัสดี, ${currentUserName} — ${feedType === 'student' ? 'สร้างโพสต์หานักเรียน...' : 'สร้างโพสต์รับสอน...'}`}
                </div>
              </div>

              <Modal
                open={expanded}
                onClose={() => setExpanded(false)}
                title={feedType === "student" ? "นักเรียนสร้างโพสต์" : "ติวเตอร์สร้างโพสต์"}
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text" name="subject" placeholder="วิชา/หัวข้อ"
                    value={formData.subject} onChange={handleChange} required
                    className="border rounded p-2 w-full"
                  />
                  <textarea
                    name="description"
                    placeholder={feedType === "student" ? "รายละเอียดความต้องการเรียน" : "รายละเอียดคอร์ส/แนวทางการสอน"}
                    value={formData.description} onChange={handleChange} required
                    className="border rounded p-2 w-full"
                  />

                  {feedType === "student" ? (
                    <>
                      {/* ✅ 8. เปลี่ยน "วันสะดวก" เป็น date picker */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <input type="date" name="preferred_days" placeholder="วันสะดวก"
                          value={formData.preferred_days} onChange={handleChange} required className="border rounded p-2 w-full" />
                        <input type="time" name="preferred_time"
                          value={formData.preferred_time} onChange={handleChange} required className="border rounded p-2 w-full" />
                      </div>
                      <input type="text" name="location" placeholder="สถานที่"
                        value={formData.location} onChange={handleChange} required className="border rounded p-2 w-full" />
                      <div className="grid md:grid-cols-2 gap-3">
                        <input type="number" name="group_size" placeholder="จำนวนคน (ขั้นต่ำ 1)" min="1"
                          value={formData.group_size} onChange={handleChange} required className="border rounded p-2 w-full" />
                        <input type="number" name="budget" placeholder="งบประมาณ (บาท)" min="0"
                          value={formData.budget} onChange={handleChange} required className="border rounded p-2 w-full" />
                      </div>
                      <input type="text" name="contact_info" placeholder="ข้อมูลติดต่อ"
                        value={formData.contact_info} onChange={handleChange} required className="border rounded p-2 w-full" />
                    </>
                  ) : (
                    <>
                      {/* ✅ 9. เพิ่มฟิลด์ "ระดับชั้น" สำหรับติวเตอร์ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">ระดับชั้นที่สอน (เลือกได้หลายข้อ)</label>
                        <div className="mt-2 space-y-2 border rounded-md p-4">
                          {postGradeLevelOptions.map(option => (
                            <div key={option.value} className="flex items-center">
                              <input
                                id={`level-${option.value}`} type="checkbox"
                                value={option.value}
                                checked={(formData.target_student_level || []).includes(option.value)}
                                onChange={() => handleLevelChange(option.value)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor={`level-${option.value}`} className="ml-3 block text-sm text-gray-900">
                                {option.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <input type="date" name="teaching_days" placeholder="วันที่สอน"
                          value={formData.teaching_days} onChange={handleChange} required className="border rounded p-2 w-full" />
                        <input type="time" name="teaching_time" placeholder="ช่วงเวลา"
                          value={formData.teaching_time} onChange={handleChange} required className="border rounded p-2 w-full" />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <input type="text" name="location" placeholder="สถานที่ (ออนไลน์/ออนไซต์)"
                          value={formData.location} onChange={handleChange} required className="border rounded p-2 w-full" />
                        <input type="number" name="price" placeholder="ราคา (บาท/ชม.)" min="0"
                          value={formData.price} onChange={handleChange} required className="border rounded p-2 w-full" />
                      </div>
                      <input type="text" name="contact_info" placeholder="ช่องทางติดต่อ (LINE/เบอร์/อีเมล)"
                        value={formData.contact_info} onChange={handleChange} required className="border rounded p-2 w-full" />
                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={() => setExpanded(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
                      ยกเลิก
                    </button>
                    <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                      {loading ? "กำลังโพสต์..." : "โพสต์"}
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

        {/* list */}
        {posts.length === 0 ? (
          <div className="text-sm text-gray-500">ยังไม่มีโพสต์</div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const isOwner = meId === post.owner_id;
              const busy = !!joinLoading[post.id];
              const favBusy = !!favLoading[post.id];
              const isFull =
                post.post_type === "student"
                  ? Number(post.join_count) >= Number(post.group_size || 0)
                  : false;

              return (
                <div key={post.id} className="bg-white border p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={post.user?.profile_image || "/default-avatar.png"}
                      alt="avatar"
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-semibold">
                        {post.user?.first_name} {post.user?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(post.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold">{post.subject}</h3>
                  <p className="mb-2 whitespace-pre-line">{post.description}</p>

                  {post.post_type === "student" ? (
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>📍 สถานที่: {post.location}</p>
                      <p>👥 จำนวนคน: {post.group_size} คน</p>
                      <p>💰 งบประมาณ: {post.budget} บาท</p>
                      <p>📅 วันสะดวก: {post.preferred_days}</p>
                      <p>⏰ เวลา: {post.preferred_time}</p>
                      <p>✉️ ข้อมูลติดต่อ: {post.contact_info}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 grid md:grid-cols-2 gap-y-1">
                      <p>📅 วันที่สอน: {post.meta?.teaching_days}</p>
                      <p>⏰ ช่วงเวลา: {post.meta?.teaching_time}</p>
                      <p>📍 สถานที่: {post.meta?.location}</p>
                      <p>💸 ราคา: {Number(post.meta?.price || 0).toFixed(2)} บาท/ชม.</p>
                      <p className="md:col-span-2">☎️ ติดต่อ: {post.meta?.contact_info}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between pt-3">
                    <div className="text-sm text-gray-600">
                      {post.post_type === "student" ? (
                        <>
                          เข้าร่วมแล้ว (อนุมัติ): <b>{post.join_count}</b> / {post.group_size} คน
                          {post.joined && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">
                              คุณเข้าร่วมแล้ว
                            </span>
                          )}
                          {post.pending_me && !post.joined && (
                            <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded-full">
                              รออนุมัติจากเจ้าของโพสต์
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full mr-2">
                            โพสต์รับสอน
                          </span>
                          {/* ★ NEW: แสดงจำนวนผู้เข้าร่วม/สนใจสำหรับโพสต์ติวเตอร์ */}
                          <span className="text-gray-600">
                            ผู้เข้าร่วม: <b>{Number(post.join_count || 0)}</b>
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Favorite */}
                      <button
                        disabled={favBusy}
                        onClick={() => toggleFavorite(post)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition
                          ${post.favorited ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600'}
                          disabled:opacity-60`}
                        title={post.favorited ? 'นำออกจากที่สนใจ' : 'เพิ่มในที่สนใจ'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={post.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span className="text-sm">{Number(post.fav_count || 0)}</span>
                      </button>

                      {post.post_type === "student" ? (
                        // ----- เดิม (คงไว้) -----
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                            คุณเป็นเจ้าของโพสต์
                          </span>
                        ) : post.joined ? (
                          <button
                            disabled={busy}
                            onClick={() => handleUnjoin(post)}
                            className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {busy ? "กำลังยกเลิก..." : "เลิกร่วม"}
                          </button>
                        ) : post.pending_me ? (
                          <button
                            disabled={busy}
                            onClick={() => handleUnjoin(post)}
                            className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="ยกเลิกคำขอที่รออนุมัติ"
                          >
                            {busy ? "กำลังยกเลิก..." : "ยกเลิกคำขอ"}
                          </button>
                        ) : (
                          <button
                            disabled={busy || isFull}
                            onClick={() => handleJoin(post)}
                            className={`px-4 py-2 rounded-xl text-white disabled:opacity-60 ${isFull ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                          >
                            {isFull ? "เต็มแล้ว" : busy ? "กำลังส่งคำขอ..." : "Join"}
                          </button>
                        )
                      ) : (
                        // ----- ★ NEW: ปุ่ม Join สำหรับโพสต์ติวเตอร์ -----
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                            โพสต์ของฉัน
                          </span>
                        ) : isTutor ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600" title="เฉพาะนักเรียนเท่านั้นที่ Join ได้">
                            สำหรับนักเรียน
                          </span>
                        ) : post.joined ? (
                          <button
                            disabled={busy}
                            onClick={() => handleUnjoinTutor(post)}
                            className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {busy ? "กำลังยกเลิก..." : "เลิกร่วม"}
                          </button>
                        ) : post.pending_me ? (
                          <button
                            disabled={busy}
                            onClick={() => handleUnjoinTutor(post)}
                            className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="ยกเลิกคำขอที่รออนุมัติ"
                          >
                            {busy ? "กำลังยกเลิก..." : "ยกเลิกคำขอ"}
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => handleJoinTutor(post)}
                            className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busy ? "กำลังเข้าร่วม..." : "Join"}
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