// src/components/MyPost.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "http://localhost:5000";

/* ---------- helpers ---------- */
function pickUser() {
  try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
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
  // join_count จะเป็นจำนวนที่อนุมัติแล้ว (approved) จาก API
  join_count: Number(p.join_count ?? 0),
  joined: !!p.joined,         // อนุมัติแล้ว
  pending_me: !!p.pending_me, // คำขอของฉันกำลังรอ
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
  },
});

const normalizeTutorPost = (p = {}) => ({
  id: p.id ?? p._id ?? p.tutor_post_id,
  owner_id: p.tutor_id ?? p.user_id ?? p.owner_id,
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
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
  },
});

/* ---------- component ---------- */
function MyPost({
  role = "student",          // "student" | "tutor"
  setPostsCache,            // optional: ยกไป cache ที่ App
}) {
  const user = pickUser();
  const meId = user.user_id || 0;
  const tutorId = useMemo(() => pickTutorId(), []);

  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState({});
  const [error, setError] = useState("");

  const [formData, setFormData] = useState(
    role === "student"
      ? { subject:"", description:"", preferred_days:"", preferred_time:"", location:"", group_size:"", budget:"", contact_info:"" }
      : { subject:"", description:"", teaching_days:"", teaching_time:"", location:"ออนไลน์", price:"", contact_info:"" }
  );

  /* ---------- fetch posts ---------- */
  const fetchPosts = useCallback(async () => {
    try {
      setError("");

      if (role === "student") {
        const res = await fetch(`${API_BASE}/api/student_posts?me=${meId}`);
        const data = await res.json();
        const list = extractList(data);
        const normalized = list.map(normalizeStudentPost).filter(p => p.id != null);
        setPosts(normalized);
        setPostsCache?.(normalized);
      } else {
        if (!tutorId) {
          setError("ไม่พบ tutorId (ตรวจสอบ localStorage.tutorId หรือ user.tutor_id)");
          setPosts([]); setPostsCache?.([]); return;
        }

        // ลองหลายพารามิเตอร์ให้ครอบคลุม backend ของคุณ
        const candidates = [
          `${API_BASE}/api/tutor-posts?tutorId=${encodeURIComponent(tutorId)}&page=1&limit=10`,
          `${API_BASE}/api/tutor-posts?tutor_id=${encodeURIComponent(tutorId)}&page=1&limit=10`,
          `${API_BASE}/api/tutor-posts?user_id=${encodeURIComponent(tutorId)}&page=1&limit=10`,
        ];
        let got = null;
        for (const url of candidates) {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = extractList(data);
            got = list.map(normalizeTutorPost).filter(p => p.id != null);
            if (got) break;
          } catch { /* try next */ }
        }
        if (!got) {
          setError("โหลดโพสต์ติวเตอร์ไม่สำเร็จ");
          setPosts([]); setPostsCache?.([]); return;
        }
        setPosts(got);
        setPostsCache?.(got);
      }
    } catch (e) {
      console.error("fetchPosts error:", e);
      setError("โหลดโพสต์ไม่สำเร็จ");
      setPosts([]); setPostsCache?.([]);
    }
  }, [role, meId, tutorId, setPostsCache]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  /* ---------- form ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.user_id) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");
    for (const k in formData) {
      if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
    }

    try {
      setLoading(true);

      if (role === "student") {
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
        setFormData({ subject:"", description:"", preferred_days:"", preferred_time:"", location:"", group_size:"", budget:"", contact_info:"" });
      } else {
        const tId = tutorId;
        const payload = {
          tutorId: tId,
          tutor_id: tId, // เผื่อ backend ใช้ชื่อนี้
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
        setFormData({ subject:"", description:"", teaching_days:"", teaching_time:"", location:"ออนไลน์", price:"", contact_info:"" });
      }
    } catch {
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- join / unjoin (student only) ---------- */
  const handleJoin = async (post) => {
    if (role !== "student") return;
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
    if (role !== "student") return;
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

  const currentUserName = user?.name || user?.first_name || "";

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-1">
          {role === "student" ? "โพสต์" : "โพสต์ของฉัน"}
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          {role === "student" ? "คำขอเรียนจากนักเรียน" : "ประกาศรับสอนและอัปเดตล่าสุด"}
        </p>

        {error && (
          <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* compose box */}
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
              {`สวัสดี, ${currentUserName}`}
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
                placeholder={
                  role === "student"
                    ? "รายละเอียดความต้องการเรียน"
                    : "รายละเอียดคอร์ส/แนวทางการสอน"
                }
                value={formData.description}
                onChange={handleChange}
                required
                className="border rounded p-2 w-full"
              />

              {role === "student" ? (
                <>
                  <input
                    type="text"
                    name="preferred_days"
                    placeholder="วันสะดวก (เช่น จ-พ หรือ 10 ตุลาคม 2568)"
                    value={formData.preferred_days}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                  <input
                    type="time"
                    name="preferred_time"
                    value={formData.preferred_time}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                  <input
                    type="text"
                    name="location"
                    placeholder="สถานที่"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                  <input
                    type="number"
                    name="group_size"
                    placeholder="จำนวนคน"
                    value={formData.group_size}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                  <input
                    type="number"
                    name="budget"
                    placeholder="งบประมาณ (บาท)"
                    value={formData.budget}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                  <input
                    type="text"
                    name="contact_info"
                    placeholder="ข้อมูลติดต่อ"
                    value={formData.contact_info}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                </>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="teaching_days"
                      placeholder="วันที่สอน (เช่น เสาร์-อาทิตย์)"
                      value={formData.teaching_days}
                      onChange={handleChange}
                      required
                      className="border rounded p-2 w-full"
                    />
                    <input
                      type="text"
                      name="teaching_time"
                      placeholder="ช่วงเวลา (เช่น 18:00-20:00)"
                      value={formData.teaching_time}
                      onChange={handleChange}
                      required
                      className="border rounded p-2 w-full"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="location"
                      placeholder="สถานที่ (ออนไลน์/ออนไซต์)"
                      value={formData.location}
                      onChange={handleChange}
                      required
                      className="border rounded p-2 w-full"
                    />
                    <input
                      type="number"
                      name="price"
                      placeholder="ราคา (บาท/ชม.)"
                      value={formData.price}
                      onChange={handleChange}
                      required
                      className="border rounded p-2 w-full"
                    />
                  </div>
                  <input
                    type="text"
                    name="contact_info"
                    placeholder="ช่องทางติดต่อ (LINE/เบอร์/อีเมล)"
                    value={formData.contact_info}
                    onChange={handleChange}
                    required
                    className="border rounded p-2 w-full"
                  />
                </>
              )}

=======
              <input type="text" name="subject" placeholder="วิชา"
                value={formData.subject} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <textarea name="description" placeholder="รายละเอียด"
                value={formData.description} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="date" name="preferred_days" placeholder="วันสะดวก"
                value={formData.preferred_days} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="time" name="preferred_time"
                value={formData.preferred_time} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="text" name="location" placeholder="สถานที่"
                value={formData.location} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="number" name="group_size" placeholder="จำนวนคน"
                value={formData.group_size} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="number" name="budget" placeholder="งบประมาณ"
                value={formData.budget} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="text" name="contact_info" placeholder="ข้อมูลติดต่อ"
                value={formData.contact_info} onChange={handleChange} required
                className="border rounded p-2 w-full" />
                
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={loading}
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  {loading ? "กำลังโพสต์..." : "โพสต์"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* list */}
        {posts.length === 0 ? (
          <div className="text-sm text-gray-500">ยังไม่มีโพสต์</div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const isOwner = meId === post.owner_id;
              const busy = !!joinLoading[post.id];
              const isFull =
                role === "student"
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

                  {role === "student" ? (
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
                        💸 ราคา:{" "}
                        {typeof post.meta?.price === "number"
                          ? post.meta.price.toFixed(2)
                          : post.meta?.price}{" "}
                        บาท/ชม.
                      </p>
                      <p className="md:col-span-2">☎️ ติดต่อ: {post.meta?.contact_info}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-top pt-3">
                    <div className="text-sm text-gray-600">
                      {role === "student" ? (
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

                    {role === "student" ? (
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyPost;
