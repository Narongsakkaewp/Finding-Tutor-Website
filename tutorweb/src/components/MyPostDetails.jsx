import React, { useEffect, useState, useMemo } from "react";

const API_BASE = "http://localhost:5000";

/* ---------- normalizer ---------- */
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

  // โหลดโพสต์ (พยายามใช้ cache ก่อน)
  useEffect(() => {
    const found = postsCache.find((p) => Number(p.id) === Number(postId));
    if (found) {
      setPost(found);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student_posts?me=${me || 0}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
          ? data.data
          : [];
        const normalized = list.map(normalizePost);
        const single = normalized.find((p) => Number(p.id) === Number(postId));
        if (single) setPost(single);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, me, postsCache]);

  // หา user_id ปัจจุบันจาก prop me หรือ localStorage (fallback)
  const myId = useMemo(() => {
    if (Number.isFinite(Number(me))) return Number(me);
    try {
      const saved = JSON.parse(localStorage.getItem("user") || "{}");
      return Number(saved?.user_id ?? saved?.user?.user_id ?? saved?.id ?? 0);
    } catch {
      return 0;
    }
  }, [me]);

  const isOwner = Number(myId) === Number(post?.owner_id);

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
            <button onClick={onBack} className="px-3 py-1 rounded border">
              กลับ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4">
        <button
          onClick={onBack}
          className="mb-4 px-3 py-1 rounded border hover:bg-gray-50"
        >
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
              <div className="font-semibold">
                {post.user?.first_name} {post.user?.last_name}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(post.createdAt).toLocaleString()}
              </div>
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
            เข้าร่วมแล้ว: <b>{post.join_count}</b> / {post.group_size} คน{" "}
            {post.joined ? "• คุณเข้าร่วมแล้ว" : ""}
          </div>

          {/* แสดงบล็อคจัดการคำขอเฉพาะเจ้าของโพสต์ */}
          <JoinRequestsManager postId={post.id} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JoinRequestsManager: โหลด "คำขอแบบ pending" และให้อนุมัติ/ปฏิเสธ
   รองรับทั้ง API แบบใหม่ และ fallback แบบเดิม
--------------------------------------------------------- */
function JoinRequestsManager({ postId, isOwner }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const parseItems = (raw) => {
    if (raw && Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw)) return raw;
    return [];
  };

  const loadRequests = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${postId}/requests`);
      const data = await res.json();
      setRequests(parseItems(data));
    } catch (e) {
      console.error("load join requests error:", e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const optimisticRemove = (predicate) =>
    setRequests((prev) => prev.filter((r) => !predicate(r)));

  const approve = async (req) => {
    if (!window.confirm(`ยืนยันอนุมัติให้ ${req.name} ${req.lastname || ""} ?`)) return;

    optimisticRemove((r) => r.request_id === req.request_id || r.user_id === req.user_id);

    try {
      let ok = false;
      try {
        const r1 = await fetch(
          `${API_BASE}/api/student_posts/${postId}/requests/${req.user_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          }
        );
        ok = r1.ok;
      } catch {}

      if (!ok) {
        await fetch(
          `${API_BASE}/api/student_posts/requests/${req.request_id}/approve`,
          { method: "PUT" }
        );
      }
    } catch (e) {
      console.error("approve error:", e);
      loadRequests();
      alert("อนุมัติไม่สำเร็จ");
    }
  };

  const reject = async (req) => {
    if (!window.confirm(`ปฏิเสธคำขอของ ${req.name} ${req.lastname || ""} ?`)) return;

    optimisticRemove((r) => r.request_id === req.request_id || r.user_id === req.user_id);

    try {
      let ok = false;
      try {
        const r1 = await fetch(
          `${API_BASE}/api/student_posts/${postId}/requests/${req.user_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject" }),
          }
        );
        ok = r1.ok;
      } catch {}

      if (!ok) {
        await fetch(
          `${API_BASE}/api/student_posts/requests/${req.request_id}/reject`,
          { method: "PUT" }
        );
      }
    } catch (e) {
      console.error("reject error:", e);
      loadRequests();
      alert("ปฏิเสธไม่สำเร็จ");
    }
  };

  if (loading) {
    return (
      <div className="mt-6">
        <h2 className="font-semibold mb-2">คำขอเข้าร่วม</h2>
        <div className="text-sm text-gray-500">กำลังโหลด…</div>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <p className="text-sm text-gray-500 mt-6">ยังไม่มีคำขอเข้าร่วม</p>;
  }

  return (
    <div className="mt-6 border-t pt-4">
      <h2 className="font-semibold mb-3">คำขอเข้าร่วม</h2>

      <div className="space-y-2">
        {requests.map((r) => (
          <div
            key={r.request_id || r.user_id}
            className="flex justify-between items-center border rounded-lg p-3 bg-white"
          >
            <div className="text-sm text-gray-700">
              {r.name} {r.lastname}{" "}
              <span className="text-gray-400 text-xs">#{r.user_id}</span>
              {r.status && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100">
                  {r.status}
                </span>
              )}
            </div>

            {/* เจ้าของเท่านั้นที่เห็นปุ่ม */}
            {isOwner && (r.status === "pending" || !r.status) && (
              <div className="flex gap-2">
                <button
                  onClick={() => approve(r)}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  อนุมัติ
                </button>
                <button
                  onClick={() => reject(r)}
                  className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                >
                  ปฏิเสธ
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


export default MyPostDetails;
