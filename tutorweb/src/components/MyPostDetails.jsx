import React, { useEffect, useState, useCallback, useMemo } from "react";
import { API_BASE } from '../config';
import CommentSection from './CommentSection';
import { GraduationCap, DollarSign, MapPin, Calendar, Mail, Clock } from "lucide-react";


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

// --- Helper Components สำหรับตกแต่ง UI ---
const LocationLink = ({ value }) => {
  if (!value) return <span>-</span>;
  const lowerValue = value.toLowerCase();
  if (lowerValue.includes("online") || lowerValue.includes("ออนไลน์")) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-green-100 text-green-800 border border-green-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        {value}
      </span>
    );
  }
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 break-words font-medium flex items-center gap-1" title="เปิดใน Google Maps">
      <MapPin size={14} className="shrink-0" />
      {value}
    </a>
  );
};

const ContactLink = ({ value }) => {
  if (!value) return <span>-</span>;
  const text = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(text)) return <a href={`mailto:${text}`} className="text-indigo-600 hover:underline">{text}</a>;
  const cleanNumber = text.replace(/[- \(\)]/g, '');
  if (/^0\d{8,9}$/.test(cleanNumber)) return <a href={`tel:${cleanNumber}`} className="text-emerald-600 hover:underline">{text}</a>;
  const lineMatch = text.match(/^(?:line|id|line\s*id)\s*[:\.]?\s*(.+)/i);
  if (lineMatch) {
    return <a href={`https://line.me/ti/p/~${lineMatch[1]}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-medium" title="เปิดใน Line">{text}</a>;
  }
  return <span>{text}</span>;
};

const DateTimeDisplay = ({ daysStr, timesStr }) => {
  if (!daysStr) return <span>-</span>;
  const daysArr = daysStr.split(',').map(d => d.trim());
  const timesArr = (timesStr || "").split(',').map(t => t.trim());
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {daysArr.map((day, idx) => {
        const time = timesArr[idx] || timesArr[0] || "-";
        const formattedDate = new Date(day).toLocaleDateString("th-TH");
        return (
          <li key={idx} className="text-gray-700">
            {formattedDate} <span className="text-blue-600 font-medium ml-1">({time})</span>
          </li>
        );
      })}
    </ul>
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
  tutor: p.tutor || null,
  has_tutor: !!p.has_tutor,
  approved_tutor_name: p.approved_tutor_name || null,
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

function MyPostDetails({ postId, onBack, me, postsCache = [], setPostsCache, postType = null, onViewProfile }) {
  const backLabel =
    (localStorage.getItem("backPage") === "notification")
      ? "← กลับไปการแจ้งเตือน"
      : "← กลับหน้าโพสต์"
    ;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [postId, postType]);

  // โหลดโพสต์ (พยายามใช้ cache ก่อน)
  useEffect(() => {
    const found = postsCache.find((p) => {
      if (Number(p.id) !== Number(postId)) return false;
      if (!postType) return true;
      const cacheType = String(p.post_type || p.type || "").toLowerCase();
      const wantedType = String(postType || "").toLowerCase().replace("_post", "");
      return cacheType ? cacheType.includes(wantedType) : true;
    });
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
            const rs = await fetch(`${API_BASE}/api/student_posts/${postId}`);
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
        if (single) {
          single.post_type = isTutorType ? "tutor_post" : "student_post";
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

  // ✅ จำนวนคนเข้าร่วม: 
  // - ถ้าเป็น Student Post: นับเจ้าของ (1) + คนที่เข้าร่วมแล้ว
  // - ถ้าเป็น Tutor Post: นับเฉพาะนักเรียนที่เข้าร่วม (ไม่นับติวเตอร์)
  const joinedCount = isTutorPost
    ? (Number(post?.join_count ?? 0) || 0)
    : (Number(post?.join_count ?? 0) || 0) + 1;

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
    <div className="min-h-screen bg-gray-50 py-6">
      {/* 🌟 1. ปรับ Container เป็น max-w-4xl และใช้ flex-col เพื่อบังคับให้ทุกกล่องกว้างเท่ากันเป๊ะๆ */}
      <div className="max-w-4xl mx-auto px-4 flex flex-col gap-6">

        {/* ปุ่มกลับ */}
        <div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-colors"
          >
            {backLabel}
          </button>
        </div>

        {/* 🌟 2. กล่องรายละเอียดโพสต์ (ใส่ w-full เพื่อให้ขยายเต็มพื้นที่ Container) */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          {/* ข้อมูล Header โพสต์ */}
          <div className="flex items-center gap-4 mb-5">
            <ProfileImage
              src={ownerAvatar}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm"
            />
            <div>
              <div className="text-lg font-bold text-gray-900">{ownerName}</div>
              <div className="text-sm text-gray-500">
                {new Date(post.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-3">{post.subject}</h1>
          <p className="text-gray-700 whitespace-pre-line text-base leading-relaxed mb-6">{post.description}</p>

          {/* ========================================== */}
          {/* 🌟 Post Details (Layout ใหม่ + ไอคอนเงินบาท) */}
          {/* ========================================== */}
          <div className="space-y-4 border-t border-gray-100 pt-6">

            {/* แถวที่ 1: ป้าย Tag สรุปข้อมูลหลัก */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-100">
                <GraduationCap size={16} className="shrink-0" />
                {post.grade_level || post.meta?.target_student_level || "ไม่ระบุ"}
              </span>

              {/* 🌟 เปลี่ยนไอคอนดอลลาร์ เป็นสัญลักษณ์ ฿ (Baht) สไตล์คนไทย */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-sm">
                <span className="text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center font-black text-xs">
                  ฿
                </span>
                {money} บาท/ชั่วโมง
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 font-medium border border-gray-200">
                <LocationLink value={locationText} />
              </span>
            </div>

            {/* แถวที่ 2: กล่องวันและเวลา */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2 font-bold text-indigo-900 mb-2 text-sm">
                <Calendar size={18} className="text-indigo-600" />
                {isTutorPost ? "วันที่และเวลาที่สะดวกสอน:" : "วันที่และเวลาเรียน:"}
              </div>
              <div className="text-sm ml-6">
                <DateTimeDisplay daysStr={dayText} timesStr={timeText} />
              </div>
            </div>

            {/* แถวที่ 3: กล่องข้อมูลติดต่อ */}
            <div className="flex items-start gap-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-sm">
              <Mail size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-amber-900">ช่องทางการติดต่อ: </span>
                <ContactLink value={contactText} />
              </div>
            </div>

          </div>
          {/* ========================================== */}

          {/* ✅ แสดงผู้เข้าร่วม (คลิกเพื่อเลื่อนลงไปดูได้) */}
          <div
            className="mt-6 text-sm text-gray-600 border-t border-gray-100 pt-5 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => {
              const el = document.getElementById("joiners-section");
              if (!el) return;
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              el.classList.add("bg-yellow-100");
              setTimeout(() => {
                el.classList.remove("bg-yellow-100");
              }, 800);
            }}
          >
            {capacity > 0 ? (
              <>
                จำนวนผู้เรียน:{" "}
                <b className="underline text-blue-700">
                  {joinedCount} / {capacity}
                </b>{" "}
                คน
                <span className="text-gray-500 ml-1">
                  ({!isTutorPost ? "รวมเจ้าของโพสต์แล้ว, " : ""}ว่างอีก <span className="text-green-600 font-semibold">{Math.max(0, capacity - joinedCount)}</span> คน)
                </span>
                {post.joined && (
                  <span className="ml-2 text-emerald-600 font-medium">
                    • คุณเข้าร่วมแล้ว
                  </span>
                )}
              </>
            ) : (
              <>
                จำนวนผู้เรียน:{" "}
                <b className="underline text-blue-700">{joinedCount}</b> คน
                {!isTutorPost && <span className="text-gray-500 ml-1">(รวมเจ้าของโพสต์แล้ว)</span>}
                {post.joined && (
                  <span className="ml-2 text-emerald-600 font-medium">
                    • คุณเข้าร่วมแล้ว
                  </span>
                )}
              </>
            )}
          </div>

          {/* แสดงผู้เข้าร่วมและคำขอ */}
          <JoinRequestsManager
            postId={Number(postId)}
            canModerate={canModerate}
            isTutor={isTutorPost}
            me={me}
            postOwnerId={post.owner_id}
            ownerName={ownerName}
            ownerProfile={post.user}
            tutor={post.tutor}
            approvedTutorName={post.approved_tutor_name}
            onViewProfile={onViewProfile}
            onJoinChange={(newCount, approvedTutor) => {
              setPost((p) => {
                const updated = { ...p, join_count: Number(newCount ?? p.join_count) };
                if (approvedTutor) {
                  updated.has_tutor = true;
                  updated.approved_tutor_name = approvedTutor.name;
                  updated.tutor = approvedTutor;
                }
                return updated;
              });
              if (typeof setPostsCache === "function") {
                setPostsCache((arr) =>
                  Array.isArray(arr)
                    ? arr.map((pp) => {
                      if (pp.id === post.id && String(pp.post_type || "").toLowerCase() === String(post.post_type || "").toLowerCase()) {
                        const updated = { ...pp, join_count: Number(newCount ?? pp.join_count) };
                        if (approvedTutor) {
                          updated.has_tutor = true;
                          updated.approved_tutor_name = approvedTutor.name;
                          updated.tutor = approvedTutor;
                        }
                        return updated;
                      }
                      return pp;
                    })
                    : arr
                );
              }
            }}
          />
        </div>

        {/* 🌟 3. ส่วนความคิดเห็น (จับมาอยู่ใน Grid หลัก เพื่อให้ขยายกว้างเท่ากับโพสต์ด้านบนเป๊ะ 100%) */}
        <div className="w-full">
          <CommentSection
            postId={postId}
            postType={String(postType || "").toLowerCase().includes("tutor") ? "tutor" : "student"}
            postOwnerId={post.owner_id || post.student_id || post.user_id}
            currentUser={{
              user_id: me,
              profile_picture_url: JSON.parse(localStorage.getItem("user") || "{}")?.profile_picture_url || JSON.parse(localStorage.getItem("user") || "{}")?.profile_image
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
function JoinRequestsManager({ postId, postOwnerId, ownerName, ownerProfile, me, canModerate, isTutor = false, tutor, approvedTutorName, onJoinChange, onViewProfile }) {
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
      let loadedJoiners = [];
      const base = isTutor ? "tutor_posts" : "student_posts";

      // ลอง route joiners ก่อน
      let res = await fetch(`${API_BASE}/api/${base}/${postId}/joiners`);

      if (res.ok) {
        const data = await res.json();
        console.log("JOINERS via /joiners:", data);
        loadedJoiners = Array.isArray(data) ? data : [];
      } else {
        // fallback → route หลัก
        res = await fetch(`${API_BASE}/api/${base}/${postId}`);
        if (res.ok) {
          const data = await res.json();
          console.log("JOINERS via post:", data.joiners);
          loadedJoiners = Array.isArray(data.joiners) ? data.joiners : [];
        }
      }

      // If it's a student post, add the owner to the joiners list
      if (!isTutor && postOwnerId && ownerName) {
        const owner = {
          user_id: postOwnerId,
          name: ownerName.split(' ')[0], // Assuming first name
          lastname: ownerName.split(' ').slice(1).join(' '), // Assuming rest is last name
          username: ownerProfile?.username || '',
          profile_picture_url: ownerProfile?.profile_image || '',
          joined_at: new Date().toISOString(), // Or a more appropriate date if available
          is_owner: true, // Custom flag to identify the owner
        };
        // Prepend owner to the list
        loadedJoiners = [owner, ...loadedJoiners];
      }

      setJoiners(loadedJoiners);

    } catch (e) {
      console.error("load joiners error:", e);
      setJoiners([]);
    } finally {
      setJoinersLoading(false);
    }
  }, [postId, isTutor, postOwnerId, ownerName]);


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
          const approvedTutor = (!isTutor && req.request_type === 'tutor') ? {
            id: req.user_id,
            name: req.name,
            lastname: req.lastname,
            username: req.username,
            profile_picture_url: req.profile_picture_url
          } : undefined;

          onJoinChange(Number(data.join_count), approvedTutor);
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

      {/* ผู้เข้าร่วม */}
      <h2
        id="joiners-section"
        className="font-semibold mb-3 scroll-mt-20 transition-colors"
      >
        ชื่อผู้เข้าร่วมในการติว
      </h2>

      {joinersLoading ? (
        <div className="text-sm text-gray-500">กำลังโหลดผู้เข้าร่วม…</div>
      ) : (Array.isArray(joiners) && joiners.length > 0) || tutor || approvedTutorName ? (
        <div className="mb-5 space-y-2">
          {/* ✅ แสดงติวเตอร์ที่ได้รับการอนุมัติให้อยู่บนสุด */}
          {!isTutor && (tutor || approvedTutorName) && (
            <div className="flex items-center justify-between border rounded-lg p-3 bg-purple-50 border-purple-200 shadow-sm">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => tutor?.user_id || tutor?.id ? onViewProfile?.(tutor.user_id || tutor.id) : null}
              >
                <img
                  src={tutor?.profile_picture_url || "/../blank_avatar.jpg"}
                  alt="Tutor"
                  className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
                  onError={(e) => { e.target.onerror = null; e.target.src = "/blank_avatar.jpg"; }}
                />
                <div className="text-sm font-medium group-hover:text-purple-700 transition-colors">
                  {tutor?.name ? `${tutor.name} ${tutor.lastname || ''}`.trim() : approvedTutorName}
                  <span className="text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-xs ml-2 font-bold select-none">ติวเตอร์</span>
                  {tutor?.username && (
                    <span className="text-gray-400 text-xs ml-2 font-normal select-none relative top-[1px]">
                      @{tutor.username}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {joiners.map((j) => (
            <div
              key={`joined-${j.user_id}`}
              className="flex items-center justify-between border rounded-lg p-3 bg-emerald-50 border-emerald-200"
            >
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => (!j.is_owner || j.user_id) ? onViewProfile?.(j.user_id) : null}
              >
                <img
                  src={j.profile_picture_url || "/../blank_avatar.jpg"}
                  alt="Joiner"
                  className="w-8 h-8 rounded-full object-cover border-2 border-emerald-100"
                  onError={(e) => { e.target.onerror = null; e.target.src = "/blank_avatar.jpg"; }}
                />
                <div className="text-sm font-medium group-hover:text-emerald-700 transition-colors">
                  {j.name} {j.lastname}
                  {j.is_owner && (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-xs ml-2 font-bold select-none">เจ้าของโพสต์</span>
                  )}
                  {!j.is_owner && (
                    <span className="text-gray-400 text-xs ml-2 font-normal select-none relative top-[1px]">
                      {j.username ? `@${j.username}` : `#${j.user_id}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                {j.joined_at
                  ? new Date(j.joined_at).toLocaleDateString()
                  : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 mb-5">
          ยังไม่มีผู้เข้าร่วม
        </div>
      )}

      {/* คำขอเข้าร่วม — เฉพาะเจ้าของโพสต์ */}
      {Number(me) === Number(postOwnerId) && (
        <>
          <h2 className="font-semibold mb-3">คำขอเข้าร่วม</h2>

          {pendingRequests.length === 0 ? (
            <div className="text-sm text-gray-500">
              ยังไม่มีคำขอเข้าร่วม
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((r) => (
                <div
                  key={`pending-${r.user_id}`}
                  className="flex justify-between items-center border rounded-lg p-3 bg-white"
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => onViewProfile?.(r.user_id)}
                  >
                    <img
                      src={r.profile_picture_url || "/../blank_avatar.jpg"}
                      alt="Requester"
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      onError={(e) => { e.target.onerror = null; e.target.src = "/blank_avatar.jpg"; }}
                    />
                    <div className="text-sm font-medium group-hover:text-blue-600 transition-colors flex items-center gap-2">
                      <span>{r.name} {r.lastname}</span>
                      {r.request_type === 'tutor' && (
                        <span className="text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[10px] font-bold select-none">ติวเตอร์เสนอสอนคุณ</span>
                      )}
                      {r.request_type === 'student' && (
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold select-none">ขอเข้าร่วมกลุ่ม</span>
                      )}
                      <span className="text-gray-400 text-xs font-normal select-none relative top-[1px]">
                        {r.username ? `@${r.username}` : `#${r.user_id}`}
                      </span>
                    </div>
                  </div>

                  {canModerate && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approve(r)}
                        className="px-3 py-1.5 rounded bg-emerald-600 text-white"
                      >
                        อนุมัติ
                      </button>

                      <button
                        onClick={() => reject(r)}
                        className="px-3 py-1.5 rounded border"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MyPostDetails;
