// src/components/MyPostDetails.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";

const API_BASE = "http://localhost:5000";

const ProfileImage = ({ src, alt, className }) => {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
  }, [src]);

  return (
    <img
      src={imageSrc || (process.env.PUBLIC_URL + "/blank_avatar.jpg")}
      alt={alt}
      className={className}
      onError={(e) => {
        // Prevent infinite loop if fallback also fails
        const fallback = process.env.PUBLIC_URL + "/blank_avatar.jpg";
        if (imageSrc !== fallback) {
          setImageSrc(fallback);
        }
      }}
    />
  );
};

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
    profile_image: p.profile_image || (process.env.PUBLIC_URL + "/blank_avatar.jpg"),
  },
});

function pickUserType() {
  try { return (localStorage.getItem("userType") || "").toLowerCase(); } catch { return ""; }
}

/* ---------- helper: map tutor response -> same shape as student ---------- */
function mapTutorToUnified(t = {}) {
  return {
    id: t.id ?? t.tutor_post_id,
    owner_id: t.owner_id ?? t.tutor_id ?? t.user_id,
    createdAt: t.createdAt ?? t.created_at ?? new Date().toISOString(),
    subject: t.subject || "",
    description: t.description || t.content || "",
    // tutor: data อยู่ใน meta เป็นหลัก (แต่กันไว้เผื่อบาง endpoint ส่ง top-level)
    location: t.meta?.location ?? t.location ?? "",
    group_size: Number(t.group_size ?? t.meta?.group_size ?? 0),
    budget: Number(t.meta?.price ?? t.price ?? 0), // ให้ UI ใช้ budget เดิมได้
    preferred_days: t.meta?.teaching_days ?? t.teaching_days ?? "",
    preferred_time: t.meta?.teaching_time ?? t.teaching_time ?? "",
    contact_info: t.meta?.contact_info ?? t.contact_info ?? "",
    join_count: Number(t.join_count ?? 0),
    joined: !!t.joined,
    _isTutor: true,
    user: t.user || {
      first_name: t.name || t.first_name || "",
      last_name: t.lastname || t.last_name || "",
      profile_image: t.profile_picture_url || t.profile_image || (process.env.PUBLIC_URL + "/blank_avatar.jpg"),
    },
  };
}

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
        const isTutorType = String(postType || "").toLowerCase().includes("tutor");

        // ✅ Case 1: Tutor Post
        if (isTutorType) {
          try {
            const rt = await fetch(`${API_BASE}/api/tutor-posts/${postId}`);
            if (rt.ok) {
              const t = await rt.json();
              single = mapTutorToUnified(t);
            }
          } catch (err) {
            console.error("MyPostDetails tutor fetch error:", err);
          }
        }

        // ✅ Case 2: Student Post (Fetch Direct)
        else {
          try {
            // Try direct fetch first (New API)
            const rs = await fetch(`${API_BASE}/api/student-posts/${postId}`);
            if (rs.ok) {
              const s = await rs.json();
              single = normalizePost(s);
            } else {
              // Fallback: If API missing, try legacy feed search (optional, but keeping for safety)
              console.warn("Direct student post fetch failed, falling back to feed search");
              const res = await fetch(`${API_BASE}/api/student_posts?me=${me || 0}`);
              const data = await res.json();
              const list = Array.isArray(data) ? data : (data.items || data.data || []);
              const normalized = list.map(normalizePost);
              single = normalized.find((p) => Number(p.id) === Number(postId));
            }
          } catch (e2) {
            console.error("MyPostDetails student fetch error:", e2);
          }
        }

        // ✅ Case 3: Fallback (If type mismatch or not found)
        if (!single) {
          // If we tried student and failed, maybe it's tutor?
          if (!isTutorType) {
            try {
              const r2 = await fetch(`${API_BASE}/api/tutor-posts/${postId}`);
              if (r2.ok) {
                const t = await r2.json();
                single = mapTutorToUnified(t);
              }
            } catch (e) { }
          }
          // If we tried tutor and failed, maybe it's student?
          else {
            try {
              const rs = await fetch(`${API_BASE}/api/student-posts/${postId}`);
              if (rs.ok) {
                const s = await rs.json();
                single = normalizePost(s);
              }
            } catch (e) { }
          }
        }

        if (single) setPost(single);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, me, postsCache, postType]);

  // ล็อกให้ปุ่มอนุมัติ/ปฏิเสธแสดงเสมอ
  const canModerate = true;

  // เพิ่ม State สำหรับปุ่ม
  const [busy, setBusy] = useState(false);
  const userType = pickUserType();
  const isUserTutor = userType === "tutor"; // คนดูเป็นติวเตอร์ไหม

  const handleJoin = async () => {
    if (isTutorPost) return; // Student posts only for now
    if (isUserTutor) {
      if (!window.confirm("ยืนยันที่จะเสนอสอนให้นักเรียนคนนี้?")) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${postId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: me })
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "Error joining");

      // Update local state
      setPost(p => ({ ...p, joined: true, pending_me: true, join_count: data.join_count }));
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  const handleUnjoin = async () => {
    if (isTutorPost) return;
    if (!window.confirm(isUserTutor ? "ต้องการยกเลิกข้อเสนอ?" : "ต้องการยกเลิกคำขอ?")) return;

    setBusy(true);
    try {
      // Use query param for user_id to match server expectation
      const res = await fetch(`${API_BASE}/api/student_posts/${postId}/join?user_id=${me}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "Error unjoining");

      // Update local state: joined->false
      setPost(p => ({ ...p, joined: false, pending_me: false, join_count: data.join_count }));
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  // tutor?
  const isTutorPost = useMemo(() => {
    return String(postType || "").toLowerCase().includes("tutor") || !!post?._isTutor;
  }, [postType, post]);

  // คำนวณชื่อเจ้าของโพสต์และรูป (รองรับหลายรูปแบบข้อมูลจาก API)
  const ownerName = useMemo(() => {
    if (!post) return "";
    const u = post.user || {};
    if (u.first_name || u.last_name) {
      return `${(u.first_name || "").trim()}${u.last_name ? " " + u.last_name.trim() : ""}`.trim();
    }
    if (u.name) return u.name;
    if (post.authorId?.name) return post.authorId.name;
    return `ผู้ใช้ #${post.owner_id}`;
  }, [post]);

  const ownerAvatar = useMemo(() => {
    return post?.user?.profile_image || post?.authorId?.avatarUrl || (process.env.PUBLIC_URL + "/blank_avatar.jpg");
  }, [post]);

  // ✅ ใช้ค่าที่ "รวมรูปแบบแล้ว" ชุดเดียว (กันแสดงไม่ครบ)
  const locationText = post?.location || post?.meta?.location || "-";
  const dayText = post?.preferred_days || post?.meta?.teaching_days || "-";
  const timeText = post?.preferred_time || post?.meta?.teaching_time || "-";
  const contactText = post?.contact_info || post?.meta?.contact_info || "-";
  const money = Number(post?.budget ?? post?.meta?.price ?? 0) || 0;
  const capacity = Number(post?.group_size ?? post?.meta?.group_size ?? 0) || 0;
  const joinedCount = Number(post?.join_count ?? 0) || 0;

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
          ← ย้อนกลับ
        </button>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          {/* ข้อมูลโพสต์ */}
          <div className="flex items-center gap-3 mb-3">
            <ProfileImage
              src={ownerAvatar}
              alt="avatar"
              className="w-12 h-12 rounded-full"
            />
            {/* <img
              src={ownerAvatar}
              onError={(e) => { e.target.onerror = null; e.target.src = "/blank_avatar.jpg"; }}
              alt="avatar"
              className="w-12 h-12 rounded-full"
            /> */}
            <div>
              <div className="font-semibold">{ownerName}</div>
              <div className="text-xs text-gray-500">
                {new Date(post.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold">{post.subject}</h1>
          <p className="mt-2 whitespace-pre-line">{post.description}</p>

          <div className="grid sm:grid-cols-2 gap-y-1 text-sm text-gray-700 mt-4">
            <div>📍 สถานที่: {locationText}</div>
            <div>👥 จำนวนคน: {capacity ? capacity : "-"}</div>
            <div>💰 งบประมาณ: {money} บาท</div>
            <div>📅 วันสะดวก: {dayText}</div>
            <div>⏰ เวลา: {timeText}</div>
            <div>✉️ ติดต่อ: {contactText}</div>
          </div>

          {/* ✅ แสดงผู้เข้าร่วมเป็น 2/2 ถ้ามีจำนวนคน */}
          <div className="mt-4 text-sm text-gray-600 border-t pt-3">
            {capacity > 0 ? (
              <>
                ผู้เข้าร่วม: <b>{joinedCount + (isTutorPost ? 0 : 1)} / {capacity}</b> คน
                {post.joined ? " • คุณเข้าร่วมแล้ว" : ""}
              </>
            ) : (
              <>
                ผู้เข้าร่วม: <b>{joinedCount + (isTutorPost ? 0 : 1)}</b> คน
                {post.joined ? " • คุณเข้าร่วมแล้ว" : ""}
              </>
            )}
          </div>

          {/* แสดงบล็อคคำขอ */}
          <JoinRequestsManager
            postId={Number(postId)}
            canModerate={canModerate}
            isTutor={isTutorPost}
            onJoinChange={(newCount) => {
              setPost((p) => ({ ...p, join_count: Number(newCount ?? p.join_count) }));
              if (typeof setPostsCache === "function") {
                setPostsCache((arr) =>
                  Array.isArray(arr)
                    ? arr.map((pp) =>
                      pp.id === post.id ? { ...pp, join_count: Number(newCount ?? pp.join_count) } : pp
                    )
                    : arr
                );
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
      const base = isTutor ? "tutor_posts" : "student_posts";
      const url = `${API_BASE}/api/${base}/${postId}/requests`;
      console.log("[JoinRequests] GET", url);

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      console.log("[JoinRequests] rows =", Array.isArray(data) ? data.length : data);
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
      const base = isTutor ? "tutor_posts" : "student_posts";
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/joiners`, { cache: "no-store" });
      const data = await res.json();
      setJoiners(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("load joiners error:", e);
      setJoiners([]);
    } finally {
      setJoinersLoading(false);
    }
  }, [postId, isTutor]);

  useEffect(() => {
    loadRequests();
    loadJoiners();
  }, [loadRequests, loadJoiners]);

  // ✅ pending เท่านั้น (กัน approved โผล่ซ้ำด้านล่าง)
  const pendingRequests = useMemo(() => {
    return (Array.isArray(requests) ? requests : []).filter(
      (r) => (r?.status || "pending") === "pending"
    );
  }, [requests]);

  const approve = async (req) => {
    if (!window.confirm(`ยืนยันอนุมัติให้ ${req.name} ${req.lastname || ""} ?`)) return;

    try {
      const base = isTutor ? "tutor_posts" : "student_posts";
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/requests/${req.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) console.error("approve failed:", res.status, data);

      await loadRequests();
      await loadJoiners();

      if (typeof onJoinChange === "function") {
        if (data && (typeof data.join_count === "number" || typeof data.join_count === "string")) {
          onJoinChange(Number(data.join_count));
        }
      }
    } catch (e) {
      console.error("approve error:", e);
    }
  };

  const reject = async (req) => {
    if (!window.confirm(`ปฏิเสธคำขอของ ${req.name} ${req.lastname || ""} ?`)) return;

    try {
      const base = isTutor ? "tutor_posts" : "student_posts";
      const res = await fetch(`${API_BASE}/api/${base}/${postId}/requests/${req.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("reject failed:", res.status, txt);
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
      {/* =======================
        ผู้เข้าร่วม (Approved)
    ======================= */}
      <h2 className="font-semibold mb-3">ชื่อผู้เข้าร่วม</h2>

      {joinersLoading ? (
        <div className="text-sm text-gray-500">กำลังโหลดผู้เข้าร่วม…</div>
      ) : Array.isArray(joiners) && joiners.length > 0 ? (
        <div className="mb-5 space-y-2">
          {joiners.map((j) => (
            <div
              key={`joined-${j.user_id}`}
              className="flex items-center justify-between border rounded-lg p-3 bg-emerald-50 border-emerald-200"
            >
              <div className="text-sm text-gray-800 font-medium">
                {j.name} {j.lastname}{" "}
                <span className="text-gray-400 text-xs font-normal">#{j.user_id}</span>
              </div>
              <div className="text-xs text-gray-500">
                {j.joined_at ? new Date(j.joined_at).toLocaleDateString() : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 mb-5">ยังไม่มีผู้เข้าร่วม</div>
      )}

      {/* คำขอเข้าร่วม (Pending) */}

      <h2 className="font-semibold mb-3">คำขอเข้าร่วม</h2>

      {pendingRequests.length === 0 ? (
        <div className="text-sm text-gray-500">ยังไม่มีคำขอเข้าร่วม</div>
      ) : (
        <div className="space-y-2">
          {pendingRequests.map((r) => (
            <div
              key={`pending-${r.user_id}`}
              className="flex justify-between items-center border rounded-lg p-3 bg-white"
            >
              <div className="text-sm text-gray-700">
                {r.name} {r.lastname}{" "}
                <span className="text-gray-400 text-xs">#{r.user_id}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  pending
                </span>
              </div>

              {canModerate && (
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
