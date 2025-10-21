import React, { useEffect, useState } from "react";

const normalizePost = (p = {}) => ({
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
  join_count: Number(p.join_count ?? 0),
  joined: !!p.joined,
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_image || "/default-avatar.png",
  },
});

function MyPostDetails({ postId, onBack, me, postsCache = [] }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  // หาโพสต์จาก cache ก่อน
  useEffect(() => {
    const found = postsCache.find(p => Number(p.id) === Number(postId));
    if (found) {
      setPost(found);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/student_posts?me=${me || 0}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
          ? data.data
          : [];
        const normalized = list.map(normalizePost);
        const single = normalized.find(p => Number(p.id) === Number(postId));
        if (single) setPost(single);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, me, postsCache]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        กำลังโหลดรายละเอียดโพสต์...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white border rounded-xl p-4">
          ไม่พบโพสต์นี้
          <div className="mt-2">
            <button onClick={onBack} className="px-3 py-1 rounded border">กลับ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4">
        <button onClick={onBack} className="mb-4 px-3 py-1 rounded border hover:bg-gray-50">
          ← กลับไปการแจ้งเตือน
        </button>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          {/* ข้อมูลโพสต์ */}
          <div className="flex items-center gap-3 mb-3">
            <img
              src={post.user?.profile_image || "/default-avatar.png"}
              alt="avatar"
              className="w-12 h-12 rounded-full"
            />
            <div>
              <div className="font-semibold">{post.user?.first_name} {post.user?.last_name}</div>
              <div className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold">{post.subject}</h1>
          <p className="mt-2 whitespace-pre-line">{post.description}</p>

          <div className="grid sm:grid-cols-2 gap-y-1 text-sm text-gray-700 mt-4">
            <div>📍 สถานที่: {post.location}</div>
            <div>👥 จำนวนคน: {post.group_size}</div>
            <div>💰 งบประมาณ: {post.budget} บาท</div>
            <div>📅 วันสะดวก: {post.preferred_days}</div>
            <div>⏰ เวลา: {post.preferred_time}</div>
            <div>✉️ ติดต่อ: {post.contact_info}</div>
          </div>

          <div className="mt-4 text-sm text-gray-600 border-t pt-3">
            เข้าร่วมแล้ว: <b>{post.join_count}</b> / {post.group_size} คน {post.joined ? "• คุณเข้าร่วมแล้ว" : ""}
          </div>

          {/* ✅ แสดงคำขอเข้าร่วม (ไม่มี “จัดการคำขอ” ด้านบนอีกต่อไป) */}
          <JoinRequests postId={post.id} />
        </div>
      </div>
    </div>
  );
}

function JoinRequests({ postId }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!postId) return;
    fetch(`http://localhost:5000/api/student_posts/${postId}/requests`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setRequests(data) : [])
      .catch((e) => console.error("load join requests error:", e));
  }, [postId]);

  const handleAction = async (reqId, action) => {
    const confirmMsg = action === "approve" ? "ยืนยันการอนุมัติ?" : "ยืนยันการปฏิเสธ?";
    if (!window.confirm(confirmMsg)) return;
    try {
      await fetch(`http://localhost:5000/api/student_posts/requests/${reqId}/${action}`, {
        method: "PUT",
      });
      setRequests((prev) => prev.filter((r) => r.request_id !== reqId));
    } catch (err) {
      console.error("update request error:", err);
      alert("เกิดข้อผิดพลาด");
    }
  };

  if (requests.length === 0)
    return <p className="text-sm text-gray-500 mt-6">ยังไม่มีคำขอเข้าร่วม</p>;

  return (
    <div className="mt-6 border-t pt-4">
      <h2 className="font-semibold mb-3">คำขอเข้าร่วม</h2>
      {requests.map((r) => (
        <div key={r.request_id} className="flex justify-between items-center border rounded-lg p-2 bg-white mb-2">
          <div className="text-sm text-gray-700">
            {r.name} {r.lastname} <span className="text-gray-400 text-xs">#{r.user_id}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction(r.request_id, "approve")}
              className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
            >
              อนุมัติ
            </button>
            <button
              onClick={() => handleAction(r.request_id, "reject")}
              className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            >
              ปฏิเสธ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default MyPostDetails;
