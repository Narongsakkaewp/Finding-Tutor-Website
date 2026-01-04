import React, { useEffect, useState, useCallback, useMemo } from "react";

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

function MyPostDetails({ postId, onBack, me, postsCache = [], setPostsCache, postType = null }) {
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
        let single = null;
          let fromTutor = false;

          // check cache again (in case postsCache was populated after first check)
          const found2 = postsCache.find((p) => Number(p.id) === Number(postId));
          if (found2) {
            single = found2;
          }

          const isTutorType = String(postType || "").toLowerCase().includes("tutor");

          // ถ้า notification บอกว่าเป็นโพสต์ติวเตอร์ ให้ลองดึง tutor postก่อน
          if (!single && isTutorType) {
            try {
              console.debug("MyPostDetails: attempting tutor fetch for id=", postId);
              const rt = await fetch(`${API_BASE}/api/tutor-posts/${postId}`);
              if (rt.ok) {
                const t = await rt.json();
                single = normalizePost({
                  id: t.id ?? t.tutor_post_id,
                  owner_id: t.owner_id ?? t.tutor_id ?? t.user_id,
                  createdAt: t.created_at ?? t.createdAt,
                  subject: t.subject,
                  description: t.description,
                  location: t.location,
                  group_size: Number(t.group_size ?? 0),
                  budget: Number(t.price ?? 0),
                  preferred_days: t.teaching_days || "",
                  preferred_time: t.teaching_time || "",
                  contact_info: t.contact_info || "",
                  join_count: Number(t.join_count ?? 0),
                  joined: !!t.joined,
                  user: {
                    first_name: t.user?.first_name || t.name || "",
                    last_name: t.user?.last_name || t.lastname || "",
                    profile_image: t.user?.profile_image || t.profile_picture_url || "",
                  },
                });
                fromTutor = true;
              }
          } catch (err) {
            console.error("MyPostDetails tutor fetch error:", err);
          }
        }

        // ถ้ายังไม่เจอ ให้ค้นจาก student posts (เดิม)
        if (!single) {
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
            single = normalized.find((p) => Number(p.id) === Number(postId));
          } catch (e2) {
            console.error("MyPostDetails student fetch error:", e2);
          }
        }

        // fallback: ถ้ายังไม่เจอ ให้ลองดึง tutor อีกครั้ง (ในกรณีไม่ได้ลองก่อน)
        if (!single && !isTutorType) {
          try {
            console.debug("MyPostDetails: attempting tutor fallback fetch for id=", postId);
            const r2 = await fetch(`${API_BASE}/api/tutor-posts/${postId}`);
            if (r2.ok) {
              const t = await r2.json();
              single = normalizePost({
                id: t.id ?? t.tutor_post_id,
                owner_id: t.owner_id ?? t.tutor_id ?? t.user_id,
                createdAt: t.created_at ?? t.createdAt,
                subject: t.subject,
                description: t.description,
                location: t.location,
                group_size: Number(t.group_size ?? 0),
                budget: Number(t.price ?? 0),
                preferred_days: t.teaching_days || "",
                preferred_time: t.teaching_time || "",
                contact_info: t.contact_info || "",
                join_count: Number(t.join_count ?? 0),
                joined: !!t.joined,
                user: {
                  first_name: t.user?.first_name || t.name || "",
                  last_name: t.user?.last_name || t.lastname || "",
                  profile_image: t.user?.profile_image || t.profile_picture_url || "",
                },
              });
              fromTutor = true;
            } else {
              console.debug("MyPostDetails fallback tutor fetch returned", r2.status, r2.statusText);
            }
          } catch (err) {
            console.error("MyPostDetails tutor fallback error:", err);
          }
        }

        if (single) {
          if (fromTutor) single._isTutor = true;
          setPost(single);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, me, postsCache, postType]);

  // ล็อกให้ปุ่มอนุมัติ/ปฏิเสธแสดงเสมอ
  const canModerate = true;

  // คำนวณชื่อเจ้าของโพสต์และรูป (รองรับหลายรูปแบบข้อมูลจาก API)
  const ownerName = useMemo(() => {
    if (!post) return "";
    const u = post.user || {};
    // ถ้ามี first/last ให้ใช้
    if (u.first_name || u.last_name) {
      return `${(u.first_name || "").trim()}${u.last_name ? " " + u.last_name.trim() : ""}`.trim();
    }
    // ถ้ามี fullname ในฟิลด์อื่น
    if (u.name) return u.name;
    if (post.authorId?.name) return post.authorId.name;
    // fallback
    return `ผู้ใช้ #${post.owner_id}`;
  }, [post]);

  const ownerAvatar = useMemo(() => {
    return post?.user?.profile_image || post?.authorId?.avatarUrl || "/default-avatar.png";
  }, [post]);

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
              src={ownerAvatar}
              alt="avatar"
              className="w-12 h-12 rounded-full"
            />
            <div>
              <div className="font-semibold">
                {ownerName}
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
            {(String(postType || '').toLowerCase().includes('tutor') || !!post?._isTutor) ? (
              <>ผู้เข้าร่วม: <b>{Number(post.join_count ?? 0)} คน</b>{post.joined ? " • คุณเข้าร่วมแล้ว" : ""}</>
            ) : (
              <>เข้าร่วมแล้ว: <b>{Number(post.join_count ?? 0)}</b> / {post.group_size} คน {post.joined ? "• คุณเข้าร่วมแล้ว" : ""}</>
            )}
          </div>

          {/* แสดงบล็อคคำขอ */}
          <JoinRequestsManager
            postId={post.id}
            canModerate={canModerate}
            isTutor={String(postType || '').toLowerCase().includes('tutor') || !!post?._isTutor}
            onJoinChange={(newCount) => {
              setPost((p) => ({ ...p, join_count: Number(newCount ?? p.join_count) }));
              if (typeof setPostsCache === 'function') {
                setPostsCache((arr) => (Array.isArray(arr) ? arr.map((pp) => (pp.id === post.id ? { ...pp, join_count: Number(newCount ?? pp.join_count) } : pp)) : arr));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JoinRequestsManager
--------------------------------------------------------- */
function JoinRequestsManager({ postId, canModerate, isTutor = false, onJoinChange }) {
  const [requests, setRequests] = useState([]);
  const [joiners, setJoiners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joinersLoading, setJoinersLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const base = isTutor ? 'tutor_posts' : 'student_posts';
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/requests`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("load join requests error:", e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [postId, isTutor]);

  const loadJoiners = useCallback(async () => {
    if (!postId) return;
    setJoinersLoading(true);
    try {
      const base = isTutor ? 'tutor_posts' : 'student_posts';
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/joiners`);
      const data = await res.json();
      setJoiners(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('load joiners error:', e);
      setJoiners([]);
    } finally {
      setJoinersLoading(false);
    }
  }, [postId, isTutor]);

  useEffect(() => {
    loadRequests();
    loadJoiners();
  }, [loadRequests, loadJoiners]);

  const approve = async (req) => {
    if (!window.confirm(`ยืนยันอนุมัติให้ ${req.name} ${req.lastname || ""} ?`))
      return;

    try {
      const base = isTutor ? 'tutor_posts' : 'student_posts';
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/requests/${req.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('approve failed:', res.status, data);
      }

      await loadRequests();
      await loadJoiners();

      if (typeof onJoinChange === 'function') {
        if (data && (typeof data.join_count === 'number' || typeof data.join_count === 'string')) {
          onJoinChange(Number(data.join_count));
        } else {
          // fallback: increment by 1
          onJoinChange((prev) => (typeof prev === 'number' ? prev + 1 : 1));
        }
      }
    } catch (e) {
      console.error("approve error:", e);
    }
  };

  const reject = async (req) => {
    if (!window.confirm(`ปฏิเสธคำขอของ ${req.name} ${req.lastname || ""} ?`))
      return;

    try {
      const base = isTutor ? 'tutor_posts' : 'student_posts';
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/requests/${req.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('reject failed:', res.status, txt);
      }

      await loadRequests();
      await loadJoiners();
    } catch (e) {
      console.error("reject error:", e);
    }
  };


  if (loading && joinersLoading) {
    return (
      <div className="mt-6">
        <h2 className="font-semibold mb-2">คำขอเข้าร่วม</h2>
        <div className="text-sm text-gray-500">กำลังโหลด…</div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t pt-4">
      <h2 className="font-semibold mb-3">คำขอเข้าร่วม</h2>

      {/* Joined users */}
      {joinersLoading ? (
        <div className="text-sm text-gray-500">กำลังโหลดผู้เข้าร่วม…</div>
      ) : joiners && joiners.length > 0 ? (
        <div className="mb-3 space-y-2">
          {joiners.map((j) => (
            <div key={`joined-${j.user_id}`} className="flex items-center justify-between border rounded-lg p-3 bg-white">
              <div className="text-sm text-gray-700">
                {j.name} {j.lastname} <span className="text-gray-400 text-xs">#{j.user_id}</span>
              </div>
              <div className="text-xs text-gray-500">{j.joined_at ? new Date(j.joined_at).toLocaleDateString() : ''}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 mb-3">ยังไม่มีผู้เข้าร่วม</div>
      )}

      {/* Pending requests */}
      {requests.length === 0 ? (
        <div className="text-sm text-gray-500">ยังไม่มีคำขอเข้าร่วม</div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.user_id}
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

              {canModerate && (!r.status || r.status === "pending") && (
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
      )}
    </div>
  );
}


export default MyPostDetails;
