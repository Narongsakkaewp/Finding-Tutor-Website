import React, { useState, useEffect, useCallback } from "react";

/* ---------- normalize helper: รองรับชื่อคอลัมน์หลายแบบ ---------- */
const normalizePost = (p = {}) => ({
  // id/owner
  id: p.id ?? p._id ?? p.student_post_id,            // << สำคัญ
  owner_id: p.owner_id ?? p.student_id ?? p.user_id, // << สำคัญ

  // เวลา
  createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),

  // เนื้อหา
  subject: p.subject || p.title || "",
  description: p.description || p.body || p.details || "",

  // รายละเอียดอื่น ๆ
  location: p.location || p.place || p.location_name || "",
  group_size: Number(p.group_size ?? p.seats ?? p.groupSize ?? 0),
  budget: Number(p.budget ?? p.price ?? p.cost ?? 0),
  preferred_days: p.preferred_days || p.days || p.available_days || "",
  preferred_time: p.preferred_time || p.time || p.available_time || "",
  contact_info: p.contact_info || p.contact || p.email || "",

  // สถานะการ join
  join_count: Number(p.join_count ?? 0),
  joined: !!p.joined,

  // ข้อมูลผู้โพสต์
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
  },
});

function MyPost() {
  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // สำหรับปุ่ม Join/เลิกร่วม
  const [joinLoading, setJoinLoading] = useState({});
  // Modal หลัง Join
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPost, setModalPost] = useState(null);

  const [formData, setFormData] = useState({
    subject: "", description: "", preferred_days: "", preferred_time: "",
    location: "", group_size: "", budget: "", contact_info: ""
  });

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
  })();

  /* ---------- ดึงฟีดจาก API ---------- */
  const fetchPosts = useCallback(async () => {
    try {
      const me = currentUser?.user_id || 0;
      const res = await fetch(`http://localhost:5000/api/student_posts?me=${me}`);
      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
            ? data.data
            : [];

      // แปลงคีย์ให้ตรงรูปแบบที่ UI ใช้
      const normalized = list
        .map(normalizePost)
        .filter(p => p.id != null); // กันกรณี id หาย

      setPosts(normalized);
    } catch (e) {
      console.error("fetchPosts error:", e);
      setPosts([]);
    }
  }, [currentUser?.user_id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  /* ---------- ฟอร์มโพสต์ ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

    for (const k in formData) {
      if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
    }

    try {
      setLoading(true);
      const payload = {
        user_id: currentUser.user_id,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        preferred_days: formData.preferred_days.trim(),
        preferred_time: formData.preferred_time,
        location: formData.location.trim(),
        group_size: Number(formData.group_size),
        budget: Number(formData.budget),
        contact_info: formData.contact_info.trim(),
      };

      const res = await fetch("http://localhost:5000/api/student_posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) return alert(body?.message || "เกิดข้อผิดพลาด");

      // แปลงและเติม user เพื่อให้แสดงผลได้ทันที
      const created = normalizePost({
        ...payload,
        ...body,
        user: {
          first_name: currentUser?.first_name || currentUser?.name || "",
          last_name: currentUser?.last_name || "",
          profile_image: currentUser?.profile_image || "/default-avatar.png",
        },
      });

      setPosts(prev => [created, ...prev]);
      setExpanded(false);
      setFormData({
        subject: "", description: "", preferred_days: "", preferred_time: "",
        location: "", group_size: "", budget: "", contact_info: ""
      });
    } catch (e) {
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Join / Unjoin ---------- */
  const handleJoin = async (post) => {
    if (!currentUser) return alert("กรุณาเข้าสู่ระบบ");
    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`http://localhost:5000/api/student_posts/${post.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.user_id }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "Join ไม่สำเร็จ");

      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, joined: true, join_count: data.join_count } : p));
      setModalPost({ ...post, joined: true, join_count: data.join_count });
      setModalOpen(true);
    } catch (e) {
      alert("Server error");
    } finally {
      setJoinLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  const handleUnjoin = async (post) => {
    if (!currentUser) return alert("กรุณาเข้าสู่ระบบ");
    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`http://localhost:5000/api/student_posts/${post.id}/join?user_id=${currentUser.user_id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "Unjoin ไม่สำเร็จ");
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, joined: false, join_count: data.join_count } : p));
    } catch (e) {
      alert("Server error");
    } finally {
      setJoinLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); alert("คัดลอกแล้ว"); } catch { }
  };

  /* ================== UI ================== */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-4">โพสต์</h1>
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.profile_image || "/default-avatar.png"}
              alt="รูป"
              className="w-10 h-10 rounded-full"
            />
            <div
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
              onClick={() => setExpanded(true)}
            >
              {`สวัสดี, ${currentUser?.name || currentUser?.first_name || ""}`}
            </div>
            
          </div>

          {expanded && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="text" name="subject" placeholder="วิชา"
                value={formData.subject} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <textarea name="description" placeholder="รายละเอียด"
                value={formData.description} onChange={handleChange} required
                className="border rounded p-2 w-full" />
              <input type="text" name="preferred_days" placeholder="วันสะดวก"
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
                <button type="button" onClick={() => setExpanded(false)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
                  ยกเลิก
                </button>
                <button disabled={loading} type="submit"
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60">
                  {loading ? "กำลังโพสต์..." : "โพสต์"}
                </button>
              </div>
            </form>
          )}
        </div>
        {posts.length === 0 ? (
          <div className="text-sm text-gray-500">ยังไม่มีโพสต์</div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const isOwner = currentUser?.user_id === post.owner_id;
              const isFull  = Number(post.join_count) >= Number(post.group_size || 0);
              const busy    = !!joinLoading[post.id];

              return (
                <div key={post.id} className="bg-white border p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <img src={post.user?.profile_image || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-semibold">{post.user?.first_name} {post.user?.last_name}</p>
                      <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold">{post.subject}</h3>
                  <p className="mb-2 whitespace-pre-line">{post.description}</p>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>📍 สถานที่: {post.location}</p>
                    <p>👥 จำนวนคน: {post.group_size} คน</p>
                    <p>💰 งบประมาณ: {post.budget} บาท</p>
                    <p>📅 วันสะดวก: {post.preferred_days}</p>
                    <p>⏰ เวลา: {post.preferred_time}</p>
                    <p>✉️ ข้อมูลติดต่อ: {post.contact_info}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="text-sm text-gray-600">
                      เข้าร่วมแล้ว: <b>{post.join_count}</b> / {post.group_size} คน
                      {post.joined && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">
                          คุณเข้าร่วมแล้ว
                        </span>
                      )}
                    </div>

                    {isOwner ? (
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
                    ) : (
                      <button
                        disabled={busy || isFull}
                        onClick={() => handleJoin(post)}
                        className={`px-4 py-2 rounded-xl text-white disabled:opacity-60 ${isFull ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      >
                        {isFull ? "เต็มแล้ว" : busy ? "กำลังเข้าร่วม..." : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: แสดงผลหลัง Join สำเร็จ */}
      {modalOpen && modalPost && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 shadow-xl">
            <h4 className="text-lg font-bold mb-2">เข้าร่วมสำเร็จ 🎉</h4>
            <p className="text-sm text-gray-600 mb-4">
              คุณได้เข้าร่วมโพสต์ <b>{modalPost.subject}</b> แล้ว
            </p>

            <div className="text-sm text-gray-700 space-y-1 mb-4">
              <p>📍 สถานที่: {modalPost.location}</p>
              <p>📅 วันสะดวก: {modalPost.preferred_days}</p>
              <p>⏰ เวลา: {modalPost.preferred_time}</p>
              <p className="flex items-center gap-2">
                ✉️ ติดต่อ: <span className="font-medium">{modalPost.contact_info}</span>
                <button
                  onClick={() => copy(modalPost.contact_info)}
                  className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                >
                  คัดลอก
                </button>
              </p>
              <p>👥 ผู้เข้าร่วม: {modalPost.join_count} / {modalPost.group_size} คน</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              >
                ปิด
              </button>
              <button
                onClick={() => { setModalOpen(false); }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyPost;
