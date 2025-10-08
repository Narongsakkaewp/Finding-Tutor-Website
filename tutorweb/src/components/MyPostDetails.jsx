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

  // หาใน cache ก่อน
  useEffect(() => {
    const found = postsCache.find(p => Number(p.id) === Number(postId));
    if (found) {
      setPost(found);
      setLoading(false);
      return;
    }

    // ถ้าไม่เจอ cache ให้ดึงฟีดแล้วคัด
    (async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/student_posts?me=${me || 0}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data
          : Array.isArray(data.items) ? data.items
          : Array.isArray(data.data) ? data.data
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

  if (!postId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border rounded-xl p-4">
          ไม่พบรหัสโพสต์
          <div className="mt-2">
            <button onClick={onBack} className="px-3 py-1 rounded border">กลับ</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        กำลังโหลดรายละเอียดโพสต์...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
          <div className="flex items-center gap-3 mb-3">
            <img src={post.user?.profile_image || "/default-avatar.png"} alt="avatar" className="w-12 h-12 rounded-full" />
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
        </div>
      </div>
    </div>
  );
}

export default MyPostDetails;
