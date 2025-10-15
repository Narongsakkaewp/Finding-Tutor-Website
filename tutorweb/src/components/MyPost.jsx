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
  return localStorage.getItem("tutorId") || u.tutor_id || u.user_id || "";
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
  description: p.description || p.body || p.details || "",
  location: p.location || p.place || p.location_name || "",
  group_size: Number(p.group_size ?? p.seats ?? p.groupSize ?? 0),
  budget: Number(p.budget ?? p.price ?? p.cost ?? 0),
  preferred_days: p.preferred_days || p.days || p.available_days || "",
  preferred_time: p.preferred_time || p.time || p.available_time || "",
  contact_info: p.contact_info || p.contact || p.email || "",
  join_count: Number(p.join_count ?? 0),               // อนุมัติแล้วเท่านั้น
  joined: !!p.joined,                                   // ฉันถูกอนุมัติแล้ว
  pending_me: !!p.pending_me,                           // ฉันกำลังรออนุมัติ
  fav_count: Number(p.fav_count ?? 0),                  // ★ Favorite
  favorited: !!p.favorited,                             // ★ Favorite
  post_type: "student",                                 // ★ ชนิดโพสต์ (ใช้ตอนยิง API)
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
  },
});

// แทนที่ normalizeTutorPost เดิมทั้งก้อน (เหมือนเวอร์ชันก่อนหน้า)
const normalizeTutorPost = (p = {}) => {
  const full = (p.authorId?.name || p.name || "").trim();
  let first = p.first_name || "";
  let last  = p.last_name  || "";

  if (!first && full) {
    const parts = full.split(" ");
    first = parts.shift() || "";
    last  = parts.join(" ");
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
    fav_count: Number(p.fav_count ?? 0),                // ★ Favorite
    favorited: !!p.favorited,                           // ★ Favorite
    post_type: "tutor",                                 // ★ ชนิดโพสต์ (ใช้ตอนยิง API)
    user: p.user || {
      first_name: first,
      last_name: last,
      profile_image: p.profile_image || p.authorId?.avatarUrl || "/default-avatar.png",
    },
  };
};

/* ---------- component ---------- */
function MyPost({ setPostsCache }) {
  const user = pickUser();
  const userType = pickUserType();               // 'student' | 'tutor' | ''
  const meId = user.user_id || 0;
  const tutorId = useMemo(() => pickTutorId(), []);

  // แท็บมุมมอง (ค่าเริ่มต้น: นักเรียน)
  const [feedType, setFeedType] = useState("student"); // 'student' | 'tutor'

  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState({});
  const [favLoading, setFavLoading] = useState({});      // ★ Favorite
  const [error, setError] = useState("");

  // ฟอร์ม
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    preferred_days: "",
    preferred_time: "",
    location: "",
    group_size: "",
    budget: "",
    contact_info: "",
    // สำหรับติวเตอร์
    teaching_days: "",
    teaching_time: "",
    price: "",
  });

  /* ---------- fetch posts (ตามแท็บ) ---------- */
  const fetchPosts = useCallback(async () => {
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
        // tutor feed — แนบ me เพื่อให้ backend คืน favorited/fav_count ให้ถูก (เหมือนฝั่ง student)
        const url = `${API_BASE}/api/tutor-posts?page=1&limit=20&me=${meId}`;
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

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  /* ---------- form handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.user_id) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

    // ตรวจค่าว่างตามประเภทแบบฟอร์ม
    if (feedType === "student") {
      const required = ["subject","description","preferred_days","preferred_time","location","group_size","budget","contact_info"];
      for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
    } else {
      const required = ["subject","description","teaching_days","teaching_time","location","price","contact_info"];
      for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
    }

    try {
      setLoading(true);

      if (feedType === "student") {
        const payload = {
          user_id: meId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          preferred_days: formData.preferred_days.trim(),
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
        if (!res.ok) return alert(body?.message || "เกิดข้อผิดพลาด");

        const created = normalizeStudentPost({
          ...payload, ...body,
          user: {
            first_name: user?.first_name || user?.name || "",
            last_name: user?.last_name || "",
            profile_image: user?.profile_image || "/default-avatar.png",
          },
        });

        setPosts(prev => [created, ...prev]);
        setPostsCache?.(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
        setExpanded(false);
        setFormData({
          subject:"", description:"", preferred_days:"", preferred_time:"",
          location:"", group_size:"", budget:"", contact_info:"",
          teaching_days:"", teaching_time:"", price:""
        });
      } else {
        if (userType !== "tutor") {
          return alert("เฉพาะติวเตอร์เท่านั้นที่โพสต์ฝั่งติวเตอร์ได้");
        }
        const tId = tutorId;
        const payload = {
          tutorId: tId,
          tutor_id: tId,
          subject: formData.subject.trim(),
          content: formData.description.trim(),
          meta: {
            teaching_days: formData.teaching_days.trim(),
            teaching_time: formData.teaching_time.trim(),
            location: formData.location.trim(),
            price: Number(formData.price),
            contact_info: formData.contact_info.trim(),
          },
        };

        const res = await fetch(`${API_BASE}/api/tutor-posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) return alert(body?.message || "เกิดข้อผิดพลาด");

        const created = normalizeTutorPost({
          ...payload, ...body,
          user: {
            first_name: user?.first_name || user?.name || "",
            last_name: user?.last_name || "",
            profile_image: user?.profile_image || "/default-avatar.png",
          },
        });

        setPosts(prev => [created, ...prev]);
        setPostsCache?.(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
        setExpanded(false);
        setFormData({
          subject:"", description:"", preferred_days:"", preferred_time:"",
          location:"ออนไลน์", group_size:"", budget:"", contact_info:"",
          teaching_days:"", teaching_time:"", price:""
        });
      }
    } catch {
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Join / Unjoin (student only) ---------- */
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

  /* ---------- Favorite (student & tutor feed) ---------- */
  const toggleFavorite = async (post) => { // ★ Favorite
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
          post_type: postType, // ใช้ตามชนิดโพสต์จริง
        })
      });

      const data = await res.json().catch(() => ({}));

      // ถ้า backend คืน action/fav_count มา ให้ sync ให้ตรงเซิร์ฟเวอร์
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
        const weTurnedOn = !post.favorited; // สถานะก่อนหน้า
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
          <h1 className="text-xl font-bold">
            ฟีดโพสต์
          </h1>
          <div className="inline-flex rounded-xl border overflow-hidden">
            <button
              className={`px-4 py-2 text-sm ${feedType==='student'?'bg-blue-600 text-white':'bg-white'}`}
              onClick={() => setFeedType('student')}
            >
              นักเรียน
            </button>
            <button
              className={`px-4 py-2 text-sm ${feedType==='tutor'?'bg-blue-600 text-white':'bg-white'}`}
              onClick={() => setFeedType('tutor')}
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
        {(feedType === "student" || userType === "tutor") && (
          <div className="bg-white rounded-xl shadow p-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={user?.profile_image || "/default-avatar.png"}
                alt="avatar"
                className="w-10 h-10 rounded-full"
              />
              <div
                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
                onClick={() => setExpanded(true)}
              >
                {`สวัสดี, ${currentUserName} — ${feedType==='student' ? 'สร้างโพสต์ของคุณเลย' : 'สร้างโพสต์ของคุณเลย'}`}
              </div>
            </div>

            {expanded && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <input
                  type="text"
                  name="subject"
                  placeholder="วิชา/หัวข้อ"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="border rounded p-2 w-full"
                />
                <textarea
                  name="description"
                  placeholder={feedType === "student" ? "รายละเอียดความต้องการเรียน" : "รายละเอียดคอร์ส/แนวทางการสอน"}
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="border rounded p-2 w-full"
                />

                {feedType === "student" ? (
                  <>
                    <input type="text" name="preferred_days" placeholder="วันสะดวก (เช่น จ-พ หรือ 10 ตุลาคม 2568)"
                      value={formData.preferred_days} onChange={handleChange} required className="border rounded p-2 w-full" />
                    <input type="time" name="preferred_time"
                      value={formData.preferred_time} onChange={handleChange} required className="border rounded p-2 w-full" />
                    <input type="text" name="location" placeholder="สถานที่"
                      value={formData.location} onChange={handleChange} required className="border rounded p-2 w-full" />
                    <input type="number" name="group_size" placeholder="จำนวนคน"
                      value={formData.group_size} onChange={handleChange} required className="border rounded p-2 w-full" />
                    <input type="number" name="budget" placeholder="งบประมาณ (บาท)"
                      value={formData.budget} onChange={handleChange} required className="border rounded p-2 w-full" />
                    <input type="text" name="contact_info" placeholder="ข้อมูลติดต่อ"
                      value={formData.contact_info} onChange={handleChange} required className="border rounded p-2 w-full" />
                  </>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-3">
                      <input type="text" name="teaching_days" placeholder="วันที่สอน (เช่น เสาร์-อาทิตย์)"
                        value={formData.teaching_days} onChange={handleChange} required className="border rounded p-2 w-full" />
                      <input type="text" name="teaching_time" placeholder="ช่วงเวลา (เช่น 18:00-20:00)"
                        value={formData.teaching_time} onChange={handleChange} required className="border rounded p-2 w-full" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <input type="text" name="location" placeholder="สถานที่ (ออนไลน์/ออนไซต์)"
                        value={formData.location} onChange={handleChange} required className="border rounded p-2 w-full" />
                      <input type="number" name="price" placeholder="ราคา (บาท/ชม.)"
                        value={formData.price} onChange={handleChange} required className="border rounded p-2 w-full" />
                    </div>
                    <input type="text" name="contact_info" placeholder="ช่องทางติดต่อ (LINE/เบอร์/อีเมล)"
                      value={formData.contact_info} onChange={handleChange} required className="border rounded p-2 w-full" />
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setExpanded(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
                    ยกเลิก
                  </button>
                  <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60">
                    {loading ? "กำลังโพสต์..." : "โพสต์"}
                  </button>
                </div>
              </form>
            )}
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
              const favBusy = !!favLoading[post.id];                   // ★ Favorite
              const isFull =
                feedType === "student"
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
                      <p>
                        💸 ราคา: {Number(post.meta?.price || 0).toFixed(2)} บาท/ชม.
                      </p>
                      <p className="md:col-span-2">☎️ ติดต่อ: {post.meta?.contact_info}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between pt-3">
                    {/* ซ้าย: แท็กสถานะ + จำนวนคน/นัด */}
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
                        <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                          โพสต์รับสอน
                        </span>
                      )}
                    </div>

                    {/* ขวา: ปุ่มถูกใจ + ปุ่ม Join/อื่นๆ */}
                    <div className="flex items-center gap-2">
                      {/* ★ Favorite button */}
                      <button
                        disabled={favBusy}
                        onClick={() => toggleFavorite(post)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition
                          ${post.favorited ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600'}
                          disabled:opacity-60`}
                        title={post.favorited ? 'นำออกจากที่สนใจ' : 'เพิ่มในที่สนใจ'}
                      >
                        {/* heart icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={post.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span className="text-sm">{Number(post.fav_count || 0)}</span>
                      </button>

                      {post.post_type === "student" ? (
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
                            className={`px-4 py-2 rounded-xl text-white disabled:opacity-60 ${
                              isFull ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {isFull ? "เต็มแล้ว" : busy ? "กำลังส่งคำขอ..." : "Join"}
                          </button>
                        )
                      ) : (
                        isOwner && (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                            โพสต์ของฉัน
                          </span>
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
