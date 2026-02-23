// src/components/MyPost.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapPin, Calendar, Clock, Users, DollarSign, Heart,
  Filter, Search, Plus, X, ChevronDown, Mail, Phone, User, Star,
  MoreHorizontal, Edit, Trash2, Flag
} from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';
import ReportModal from "./ReportModal";

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
  grade_level: p.grade_level || (p.meta && p.meta.grade_level) || "ไม่ระบุ",
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
  has_tutor: !!p.has_tutor, // [NEW]
  post_type: "student",
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_picture_url || "/../blank_avatar.jpg",
    email: p.email || "",
    phone: p.phone || "",
    username: p.username || p.user?.username || "",
  },
  cancel_requested: !!p.cancel_requested, // [NEW]
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

  const targetLevel = p.target_student_level || (p.meta && p.meta.target_student_level) || (p.meta && p.meta.level) || "ไม่ระบุ";

  return {
    id: p.id ?? p._id ?? p.tutor_post_id,
    owner_id: p.tutor_id ?? p.user_id ?? p.owner_id ?? p.authorId?.id,
    createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
    subject: p.subject || p.title || "",
    description: p.content || p.description || "",
    meta: {
      target_student_level: targetLevel,
      teaching_days: p.meta?.teaching_days ?? p.teaching_days ?? "",
      teaching_time: p.meta?.teaching_time ?? p.teaching_time ?? "",
      location: p.meta?.location ?? p.location ?? "",
      price: typeof (p.meta?.price ?? p.price) === "number" ? (p.meta?.price ?? p.price) : Number(p.meta?.price ?? p.price ?? 0),
      contact_info: p.meta?.contact_info ?? p.contact_info ?? "",
    },
    fav_count: Number(p.fav_count ?? 0),
    favorited: !!p.favorited,
    join_count: Number(p.join_count ?? 0),
    joined: !!p.joined,
    pending_me: !!p.pending_me,
    group_size: Number(p.group_size ?? p.meta?.group_size ?? 0),
    post_type: "tutor",
    user: p.user || {
      first_name: first,
      last_name: last,
      profile_image: p.profile_image || p.authorId?.avatarUrl || "/../blank_avatar.jpg",
      email: p.email || "",
      phone: p.phone || "",
      username: p.username || p.user?.username || "",
    },
    cancel_requested: !!p.cancel_requested, // [NEW]
  };
};

const postGradeLevelOptions = [
  { value: "ประถมศึกษา", label: "ประถมศึกษา" },
  { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
  { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

const today = new Date().toISOString().split("T")[0];

// --- Helper: ลิงก์สถานที่ไป Google Maps ---
const LocationLink = ({ value }) => {
  if (!value) return <span>-</span>;

  // ✅ เช็คว่าถ้าขึ้นต้นด้วยคำว่า "Online" หรือ "ออนไลน์" ให้แสดงเป็น Badge สีเขียว
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

  // ถ้าเป็นสถานที่จริง ค่อยทำเป็นลิงก์ Google Maps
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline hover:text-blue-800 break-words font-medium flex items-center gap-1"
      title="เปิดใน Google Maps"
    >
      <MapPin size={14} className="shrink-0" />
      {value}
    </a>
  );
};

// --- Helper: ลิงก์ติดต่อ (โทร, อีเมล, ไลน์) ---
const ContactLink = ({ value }) => {
  if (!value) return <span>-</span>;
  const text = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(text)) {
    return <a href={`mailto:${text}`} className="text-indigo-600 hover:underline">{text}</a>;
  }
  const cleanNumber = text.replace(/[- \(\)]/g, '');
  if (/^0\d{8,9}$/.test(cleanNumber)) {
    return <a href={`tel:${cleanNumber}`} className="text-emerald-600 hover:underline">{text}</a>;
  }
  const lineMatch = text.match(/^(?:line|id|line\s*id)\s*[:\.]?\s*(.+)/i);
  if (lineMatch) {
    const lineId = lineMatch[1];
    return (
      <a
        href={`https://line.me/ti/p/~${lineId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-600 hover:underline font-medium"
        title="เปิดใน Line"
      >
        {text}
      </a>
    );
  }
  return <span>{text}</span>;
};

/* ---------- UI Components ---------- */
function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-base text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

function PostActionMenu({ isOpen, onClose, isOwner, onEdit, onDelete, onReport }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
        {isOwner ? (
          <>
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
            >
              <Edit size={18} />
              <span>แก้ไขโพสต์</span>
            </button>
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
            >
              <Trash2 size={18} />
              <span>ลบโพสต์</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              onReport();
              onClose();
            }}
            className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
          >
            <Flag size={18} />
            <span>รายงานโพสต์</span>
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Main Component ---------- */
function MyPost({ setPostsCache, onViewProfile, onOpenDetails }) {
  const user = pickUser();
  const userType = pickUserType();
  const isTutor = userType === "tutor";
  const meId = user.user_id || 0;
  const tutorId = useMemo(() => pickTutorId(), []);

  const [feedType, setFeedType] = useState(() => {
    return localStorage.getItem("myPostFeedType") || "student";
  });
  const [filterLevel, setFilterLevel] = useState(() => {
    return localStorage.getItem("myPostFilterLevel") || "all";
  });

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("myPostFeedType", feedType);
  }, [feedType]);

  useEffect(() => {
    localStorage.setItem("myPostFilterLevel", filterLevel);
  }, [filterLevel]);

  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [reportingPost, setReportingPost] = useState(null);

  // ✅ New State for Online/Onsite
  const [teachingMode, setTeachingMode] = useState("onsite"); // onsite | online
  const [platform, setPlatform] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");

  const platformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Discord", "Line Call", "Other"];

  // [NEW] Edit Mode State
  const [editMode, setEditMode] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState({});
  const [favLoading, setFavLoading] = useState({});
  const [error, setError] = useState("");

  const initialFormData = {
    subject: "",
    description: "",
    preferred_days: "",
    preferred_time: "",
    grade_level: "",
    location: "",
    group_size: "",
    budget: "",
    contact_info: "",
    target_student_level: [],
    teaching_days: "",
    teaching_time: "",
    price: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  // Logic การกรองข้อมูล
  const filteredPosts = useMemo(() => {
    if (filterLevel === "all") return posts;
    return posts.filter(p => {
      let levelData = "";
      if (p.post_type === "student") {
        levelData = p.grade_level || "";
      } else {
        levelData = p.meta?.target_student_level || "";
      }
      return String(levelData).includes(filterLevel);
    });
  }, [posts, filterLevel]);

  // ✅ Initialize Online/Onsite state when editing
  useEffect(() => {
    if (expanded && formData.location) {
      if (formData.location.startsWith("Online:") || formData.location === "Online" || formData.location === "ออนไลน์") {
        setTeachingMode("online");
        const parts = formData.location.split("Online:");
        const p = parts[1]?.trim() || "";
        if (platformOptions.includes(p)) {
          setPlatform(p);
          setCustomPlatform("");
        } else if (p) {
          setPlatform("Other");
          setCustomPlatform(p);
        } else {
          setPlatform("Google Meet"); // Default
        }
      } else {
        setTeachingMode("onsite");
      }
    }
  }, [expanded, formData.id]); // Run only when opening modal or changing post

  const fetchPosts = useCallback(async () => {
    try {
      setError("");
      if (feedType === "student") {
        const res = await fetch(`${API_BASE}/api/student_posts?me=${meId}&limit=100`);
        const data = await res.json();
        const list = extractList(data);
        const normalized = list.map(normalizeStudentPost).filter(p => p.id != null);
        setPosts(normalized);
        setPostsCache?.(normalized);
      } else {
        const url = `${API_BASE}/api/tutor-posts?page=1&limit=100&me=${meId}`;
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
    fetchPosts();
  }, [fetchPosts]);

  // ✅ Restore Scroll Position after posts are loaded
  useEffect(() => {
    if (posts.length > 0) {
      const savedScroll = localStorage.getItem("myPostScrollPosition");
      if (savedScroll) {
        // Delay to ensure the DOM has painted the list of posts
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
          localStorage.removeItem("myPostScrollPosition");
        }, 150);
      }
    }
  }, [posts]);

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

  const handleLocationSelect = (address, locationObj) => {
    setFormData(prev => ({
      ...prev,
      location: address
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.user_id) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

    try {
      setLoading(true);
      setError("");

      const method = editMode ? "PUT" : "POST";
      const idPart = editMode ? `/${editingPostId}` : "";

      if (feedType === "student") {
        const required = ["subject", "description", "preferred_days", "preferred_time", "group_size", "budget", "contact_info", "grade_level"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");

        // Validate Location (Online vs Onsite)
        if (teachingMode === "onsite" && !formData.location.trim()) {
          return alert("กรุณาระบุสถานที่");
        }
        if (teachingMode === "online" && !platform) {
          return alert("กรุณาระบุแพลตฟอร์ม");
        }
        if (teachingMode === "online" && platform === "Other" && !customPlatform.trim()) {
          return alert("กรุณาระบุชื่อแพลตฟอร์ม");
        }

        const payload = {
          user_id: meId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          preferred_days: formData.preferred_days,
          preferred_time: formData.preferred_time,
          grade_level: formData.grade_level,
          location: teachingMode === 'online'
            ? `Online: ${platform === 'Other' ? customPlatform : platform}`
            : formData.location.trim(),
          group_size: Number(formData.group_size),
          budget: Number(formData.budget),
          contact_info: formData.contact_info.trim(),
        };
        const res = await fetch(`${API_BASE}/api/student_posts${idPart}`, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("เกิดข้อผิดพลาด");

      } else {
        const required = ["subject", "description", "teaching_days", "teaching_time", "price", "contact_info"];
        for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");

        // Validate Location (Online vs Onsite)
        if (teachingMode === "onsite" && !formData.location.trim()) {
          return alert("กรุณาระบุสถานที่");
        }
        if (teachingMode === "online" && !platform) return alert("กรุณาระบุแพลตฟอร์ม");

        if (formData.target_student_level.length === 0) {
          return alert("กรุณาเลือกระดับชั้นที่สอนอย่างน้อย 1 ระดับ");
        }
        if (userType !== "tutor") {
          throw new Error("เฉพาะติวเตอร์เท่านั้นที่โพสต์ฝั่งติวเตอร์ได้");
        }

        const payload = {
          tutor_id: tutorId,
          subject: formData.subject.trim(),
          description: formData.description.trim(),
          target_student_level: formData.target_student_level.join(','),
          teaching_days: formData.teaching_days,
          teaching_time: formData.teaching_time,
          teaching_days: formData.teaching_days,
          location: teachingMode === 'online'
            ? `Online: ${platform === 'Other' ? customPlatform : platform}`
            : formData.location.trim(),
          group_size: Number(formData.group_size) || 1,
          price: Number(formData.price),
          contact_info: formData.contact_info.trim(),
        };

        const res = await fetch(`${API_BASE}/api/tutor-posts${idPart}`, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body?.message || "เกิดข้อผิดพลาดในการสร้าง/แก้ไขโพสต์ (tutor)");
        }
      }

      await fetchPosts();
      setExpanded(false);
      setFormData(initialFormData);
      setEditMode(false);
      setEditingPostId(null);

    } catch (err) {
      alert(err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (post) => {
    if (feedType !== "student") return;
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    if (isTutor) {
      if (!window.confirm("ยืนยันที่จะเสนอสอนให้นักเรียนคนนี้?")) return;
    }

    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${post.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: meId }) });
      const data = await res.json();
      if (!res.ok) return alert(data?.message);

      // อัปเดต state: ถ้ากด Join สำเร็จ สถานะจะเป็น pending_me (รออนุมัติ / ส่งข้อเสนอแล้ว)
      const updater = (arr) => arr.map(p => p.id === post.id ? { ...p, pending_me: true, joined: false, join_count: data.join_count } : p);
      setPosts(updater);
    } finally { setJoinLoading(s => ({ ...s, [post.id]: false })); }
  };

  const handleUnjoin = async (post) => {
    if (!window.confirm("ยืนยันที่จะยกเลิก?")) return;
    console.log("handleUnjoin clicked", post.id, "Type:", feedType);
    if (feedType !== "student") {
      console.warn("handleUnjoin aborted: feedType mismatch", feedType);
      return;
    }
    setJoinLoading(s => ({ ...s, [post.id]: true }));
    try {
      console.log("Sending DELETE request...");
      const res = await fetch(`${API_BASE}/api/student_posts/${post.id}/join?user_id=${meId}`, { method: "DELETE" });
      const data = await res.json();
      console.log("DELETE response:", res.status, data);

      if (!res.ok) return alert(data?.message);

      // อัปเดต state
      // อัปเดต state
      setPosts(arr => arr.map(p => {
        if (p.id === post.id) {
          if (data.cancel_requested) {
            return { ...p, cancel_requested: true, joined: true }; // Keep joined=true
          }
          // Normal unjoin
          return { ...p, joined: false, pending_me: false, join_count: Number(data.join_count ?? 0), cancel_requested: false };
        }
        return p;
      }));

      if (data.cancel_requested) {
        alert(data.message || "ส่งคำขอยกเลิกแล้ว รอการอนุมัติ");
      } else {
        alert("ยกเลิกการเข้าร่วมเรียบร้อยแล้ว");
      }
    } catch (e) {
      console.error("handleUnjoin error:", e);
      alert(e.message);
    } finally { setJoinLoading(s => ({ ...s, [post.id]: false })); }
  };

  const handleJoinTutor = async (post) => {
    if (feedType !== "tutor") return;
    if (isTutor) return alert("บัญชีติวเตอร์ไม่สามารถ Join ได้");
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");
    setJoinLoading((s) => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${post.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: meId }) });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPosts(arr => arr.map(p => p.id === post.id ? { ...p, joined: !!data.joined, pending_me: !!data.pending_me, join_count: data.join_count ?? (p.join_count + 1) } : p));
    } catch { alert("Error"); } finally { setJoinLoading((s) => ({ ...s, [post.id]: false })); }
  };

  const handleUnjoinTutor = async (post) => {
    if (feedType !== "tutor") return;
    setJoinLoading((s) => ({ ...s, [post.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${post.id}/join?user_id=${meId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }
      setPosts(arr => arr.map(p => {
        if (p.id === post.id) {
          if (data.cancel_requested) {
            return { ...p, cancel_requested: true, joined: true }; // Keep joined=true
          }
          return { ...p, joined: !!data.joined, pending_me: !!data.pending_me, join_count: data.join_count ?? (p.join_count - 1), cancel_requested: false };
        }
        return p;
      }));

      if (data.cancel_requested) {
        alert(data.message || "ส่งคำขอยกเลิกแล้ว รอการอนุมัติ");
      } else {
        alert("ยกเลิกการเข้าร่วมเรียบร้อยแล้ว");
      }
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally { setJoinLoading((s) => ({ ...s, [post.id]: false })); }
  };

  const toggleFavorite = async (post) => {
    if (!meId) return alert("กรุณาเข้าสู่ระบบ");

    const postType = post.post_type || (feedType === "student" ? "student" : "tutor");

    setPosts(currentPosts => currentPosts.map(p => {
      if (p.id === post.id) {
        const isFav = !p.favorited;
        return {
          ...p,
          favorited: isFav,
          fav_count: isFav ? p.fav_count + 1 : p.fav_count - 1
        };
      }
      return p;
    }));

    setFavLoading(s => ({ ...s, [post.id]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: meId,
          post_id: post.id,
          post_type: postType
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPosts(arr => arr.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              fav_count: data.fav_count
            };
          }
          return p;
        }));
      } else {
        throw new Error("Server returned unsuccessful");
      }

    } catch (err) {
      console.error("Fav Error:", err);
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === post.id) {
          const isFav = !p.favorited;
          return {
            ...p,
            favorited: isFav,
            fav_count: isFav ? p.fav_count + 1 : p.fav_count - 1
          };
        }
        return p;
      }));
      alert("เกิดข้อผิดพลาด ไม่สามารถกดถูกใจได้");
    } finally {
      setFavLoading(s => ({ ...s, [post.id]: false }));
    }
  };

  // --- Report Handler ---
  const handleReportClick = (post, type) => {
    setReportingPost({ ...post, post_type: type });
    setMenuOpenId(null);
  };

  // Placeholder for edit/delete handlers (if needed later)
  // Placeholder for edit/delete handlers (if needed later)
  const handleEditClick = (post, type) => {
    // Populate form data
    if (type === "student") {
      setFormData({
        subject: post.subject || "",
        description: post.description || "",
        preferred_days: post.preferred_days || "",
        preferred_time: post.preferred_time || "",
        grade_level: post.grade_level || "",
        location: post.location || "",
        group_size: post.group_size || "",
        budget: post.budget || "",
        contact_info: post.contact_info || "",
        target_student_level: [],
        teaching_days: "",
        teaching_time: "",
        price: ""
      });
      setFeedType("student");
    } else {
      // Tutor
      setFormData({
        subject: post.subject || "",
        description: post.description || "",
        preferred_days: "",
        preferred_time: "",
        grade_level: "",
        location: post.meta?.location || "",
        group_size: post.group_size || "",
        budget: "",
        contact_info: post.meta?.contact_info || "",
        target_student_level: (post.meta?.target_student_level || "").split(',').filter(x => x),
        teaching_days: post.meta?.teaching_days || "",
        teaching_time: post.meta?.teaching_time || "",
        price: post.meta?.price || ""
      });
      setFeedType("tutor");
    }

    setEditMode(true);
    setEditingPostId(post.id);
    setExpanded(true); // Open Modal
    setMenuOpenId(null);
  };

  const handleDeleteClick = async (postId, type) => {
    if (!window.confirm("คุณต้องการลบโพสต์นี้ใช่หรือไม่?")) return;

    try {
      setLoading(true);
      const endpoint = type === "student"
        ? `${API_BASE}/api/student_posts/${postId}`
        : `${API_BASE}/api/tutor-posts/${postId}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: meId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ลบโพสต์ไม่สำเร็จ");

      alert("ลบโพสต์เรียบร้อยแล้ว");
      await fetchPosts(); // Refresh list
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
      setMenuOpenId(null);
    }
  };

  const currentUserName = user?.name || user?.first_name || "User";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold">ฟีดโพสต์</h1>

          <div className="inline-flex rounded-xl border overflow-hidden">
            <button
              className={`px-4 py-2 text-sm ${feedType === 'student' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => { setFeedType('student'); setFilterLevel('all'); }}
            >
              นักเรียน
            </button>
            <button
              className={`px-4 py-2 text-sm ${feedType === 'tutor' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => { setFeedType('tutor'); setFilterLevel('all'); }}
            >
              ติวเตอร์
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {feedType === "student" ? "แสดงโพสต์ของนักเรียน" : "แสดงโพสต์ของติวเตอร์"}
        </p>

        {/* Dropdown Filter */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="text-sm text-gray-600 font-medium">กรองระดับชั้น:</span>
          <div className="relative">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="appearance-none bg-white border border-gray-300 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">แสดงทั้งหมด</option>
              {postGradeLevelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Compose Box */}
        {(
          (feedType === "student" && !isTutor) ||
          (feedType === "tutor" && isTutor)
        ) && (
            <div className="bg-white rounded-xl shadow p-4 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src={user?.profile_picture_url || user?.profile_image || "/../blank_avatar.jpg"}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
                  onClick={() => setExpanded(true)}
                >
                  {`สวัสดี, ${currentUserName} — ${feedType === 'student' ? 'สร้างโพสต์...' : 'สร้างโพสต์รับสอน...'}`}
                </div>
              </div>

              <Modal
                open={expanded}
                onClose={() => {
                  setExpanded(false);
                  setEditMode(false);
                  setEditingPostId(null);
                  setFormData(initialFormData);
                }}
                title={
                  editMode
                    ? (feedType === "student" ? "แก้ไขโพสต์นักเรียน" : "แก้ไขโพสต์ติวเตอร์")
                    : (feedType === "student" ? "นักเรียนสร้างโพสต์" : "ติวเตอร์สร้างโพสต์")
                }
              >
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* วิชา/หัวข้อ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">วิชา / หัวข้อ</label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                  </div>

                  {/* รายละเอียด */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เนื้อหาที่ต้องการเรียน</label>
                    <textarea name="description" rows="3" value={formData.description} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>

                  {feedType === "student" ? (
                    <>
                      {/* วันและเวลาที่สะดวก */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สะดวก</label>
                          <input type="date" name="preferred_days" value={formData.preferred_days} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" min={today} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สะดวก</label>
                          <input type="time" name="preferred_time" value={formData.preferred_time} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      {/* ระดับชั้น */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้นของผู้เรียน</label>
                        <select name="grade_level" value={formData.grade_level} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                          <option value="">-- กรุณาเลือก --</option>
                          {postGradeLevelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>

                      {/* สถานที่ (With Toggle) */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-3">รูปแบบการเรียน</label>
                        <div className="flex gap-4 mb-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="teaching_mode"
                              value="onsite"
                              checked={teachingMode === "onsite"}
                              onChange={() => setTeachingMode("onsite")}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-900">เรียนที่สถานที่ (On-site)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="teaching_mode"
                              value="online"
                              checked={teachingMode === "online"}
                              onChange={() => {
                                setTeachingMode("online");
                                if (!platform) setPlatform("Google Meet"); // Default
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-900">เรียนออนไลน์ (Online)</span>
                          </label>
                        </div>

                        {teachingMode === "onsite" ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดสถานที่</label>
                            <LongdoLocationPicker
                              onLocationSelect={handleLocationSelect}
                              defaultLocation={formData.location?.startsWith("Online:") ? "" : formData.location}
                              showMap={false}
                            />
                          </div>
                        ) : (
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์มที่ใช้</label>
                              <select
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            {platform === "Other" && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ระบุแพลตฟอร์มอื่น ๆ</label>
                                <input
                                  type="text"
                                  value={customPlatform}
                                  onChange={(e) => setCustomPlatform(e.target.value)}
                                  className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="เช่น Skype"
                                  required
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* จำนวนคนและงบประมาณ */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                          <input type="number" name="group_size" min="1" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">งบประมาณ (ราคาต่อชั่วโมง)</label>
                          <input type="number" name="budget" min="0" value={formData.budget} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      {/* ข้อมูลติดต่อ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ (เช่น Line ID, เบอร์โทร)</label>
                        <input type="text" name="contact_info" value={formData.contact_info} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ส่วนของ Tutor */}
                      <div className="border rounded-xl p-4">
                        <label className="block text-sm font-bold text-gray-800 mb-3">ระดับชั้นที่รับสอน (เลือกได้มากกว่า 1)</label>
                        <div className="flex flex-wrap gap-3">
                          {postGradeLevelOptions.map(option => (
                            <label
                              key={option.value}
                              className="flex items-center space-x-2 cursor-pointer px-3 py-2 bg-white hover:bg-blue-50 border border-gray-200 rounded-lg transition-all shadow-sm select-none">
                              <input
                                id={`level-${option.value}`}
                                type="checkbox"
                                value={option.value}
                                checked={(formData.target_student_level || []).includes(option.value)}
                                onChange={() => handleLevelChange(option.value)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-sm text-gray-700 whitespace-nowrap">{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สะดวกสอน</label>
                          <input type="date" name="teaching_days" value={formData.teaching_days} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" min={today} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สะดวกสอน</label>
                          <input type="time" name="teaching_time" value={formData.teaching_time} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                          <input type="number" name="group_size" min="0" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <label className="block text-sm font-bold text-gray-700 mb-3">รูปแบบการสอน</label>
                          <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="tutor_teaching_mode"
                                value="onsite"
                                checked={teachingMode === "onsite"}
                                onChange={() => setTeachingMode("onsite")}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-900">สอนที่สถานที่ (On-site)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="tutor_teaching_mode"
                                value="online"
                                checked={teachingMode === "online"}
                                onChange={() => {
                                  setTeachingMode("online");
                                  if (!platform) setPlatform("Google Meet");
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-900">สอนออนไลน์ (Online)</span>
                            </label>
                          </div>

                          {teachingMode === "onsite" ? (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดสถานที่</label>
                              <LongdoLocationPicker
                                onLocationSelect={handleLocationSelect}
                                defaultLocation={formData.location?.startsWith("Online:") ? "" : formData.location}
                                showMap={false}
                              />
                            </div>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์มที่ใช้</label>
                                <select
                                  value={platform}
                                  onChange={(e) => setPlatform(e.target.value)}
                                  className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              {platform === "Other" && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">ระบุแพลตฟอร์มอื่น ๆ</label>
                                  <input
                                    type="text"
                                    value={customPlatform}
                                    onChange={(e) => setCustomPlatform(e.target.value)}
                                    className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="เช่น Skype"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อชั่วโมง (บาท)</label>
                          <input type="number" name="price" min="0" value={formData.price} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ</label>
                          <input type="text" name="contact_info" value={formData.contact_info} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                    <button type="button" onClick={() => {
                      setExpanded(false);
                      setEditMode(false);
                      setEditingPostId(null);
                      setFormData(initialFormData);
                    }} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors">ยกเลิก</button>
                    <button disabled={loading} type="submit" className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          กำลังโพสต์...
                        </span>
                      ) : (editMode ? "บันทึกการแก้ไข" : "สร้างโพสต์")}
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

        {/* List */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-10 text-gray-500 border rounded-lg border-dashed">
            <p>ไม่พบโพสต์ที่ตรงกับตัวกรอง</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map((post) => {
              const isOwner = meId === post.owner_id;
              const busy = !!joinLoading[post.id];
              const favBusy = !!favLoading[post.id];
              const cap = Number(post.group_size || 0);
              const joinedCount = Number(post.join_count || 0);
              const isFull = cap > 0 && (post.post_type === 'student' ? (joinedCount + 1) : joinedCount) >= cap;


              //เงื่อนไขที่ถ้าเลยวันที่โพสต์แล้ว จะไม่สามารถกด Join ได้
              let isExpired = false;
              try {
                // ดึงวันที่และเวลาตามประเภทโพสต์
                let dateStr = "";
                let timeStr = "";

                if (post.post_type === "student") {
                  dateStr = post.preferred_days; // รูปแบบ YYYY-MM-DD
                  timeStr = post.preferred_time; // รูปแบบ HH:mm
                } else {
                  dateStr = post.meta?.teaching_days;
                  timeStr = post.meta?.teaching_time;
                }

                if (dateStr) {
                  const targetDateTimeStr = timeStr
                    ? `${dateStr}T${timeStr}`
                    : `${dateStr}T23:59:59`;

                  const targetDate = new Date(targetDateTimeStr);
                  const now = new Date();

                  if (now > targetDate) {
                    isExpired = true;
                  }
                }
              } catch (e) {
                console.error("Date check error", e);
              }

              return (
                <div key={post.id} className="bg-white border p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => {
                        // Use onViewProfile if available
                        if (onViewProfile) {
                          // Prefer owner_id for fetching profile
                          onViewProfile(post.owner_id);
                        }
                      }}
                    >
                      <img
                        src={post.user?.profile_image}
                        alt="profile"
                        className="w-10 h-10 rounded-full object-cover mr-3 shrink-0 border group-hover:border-indigo-500 transition-colors"
                      />
                      <div>
                        <p className="font-semibold group-hover:text-indigo-600 group-hover:underline transition-colors">
                          {post.user?.first_name} {post.user?.last_name}
                        </p>
                        {post.user?.username && <div className="text-xs text-indigo-500 font-medium -mt-0.5">@{post.user.username}</div>}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${post.post_type === 'student'
                            ? 'bg-rose-200 text-rose-700'
                            : 'bg-green-200 text-green-700'
                            }`}>
                            {post.post_type === 'student' ? 'นักเรียน' : 'ติวเตอร์'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {new Date(post.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Menu Trigger */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === post.id ? null : post.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                      <PostActionMenu
                        isOpen={menuOpenId === post.id}
                        onClose={() => setMenuOpenId(null)}
                        isOwner={isOwner}
                        onEdit={() => handleEditClick(post, post.post_type)}
                        onDelete={() => handleDeleteClick(post.id, post.post_type)}
                        onReport={() => handleReportClick(post, post.post_type)}
                      />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold">{post.subject}</h3>
                  <p className="mb-2 whitespace-pre-line">{post.description}</p>

                  {/* Post Details */}
                  {post.post_type === "student" ? (
                    <div className="text-sm text-gray-600 grid md:grid-cols-2 gap-y-1">
                      <p><span className="font-bold text-red-500">📚 ระดับชั้น: </span> {post.grade_level}</p>

                      {/* ✅ แก้ไข: ใช้ LocationLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">📍 สถานที่: </span>
                        <LocationLink value={post.location} />
                      </p>

                      <p><span className="font-bold">👥 จำนวนคน: </span> {post.group_size} คน</p>
                      <p><span className="font-bold">💰 งบประมาณ: </span> {post.budget} บาท</p>
                      <p><span className="font-bold">📅 วันสะดวก: </span> {post.preferred_days}</p>
                      <p><span className="font-bold">⏰ เวลา: </span> {post.preferred_time}</p>

                      {/* ✅ แก้ไข: ใช้ ContactLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">✉️ ข้อมูลติดต่อ: </span>
                        <ContactLink value={post.contact_info} />
                      </p>

                      {/* แสดงชื่อติวเตอร์ที่สอน (ถ้ามี) */}
                      {post.tutor && (
                        <p className="md:col-span-2 flex items-start gap-1 mt-1 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                          <span className="font-bold text-blue-800 shrink-0">👨‍🏫 ติวเตอร์ที่สอน: </span>
                          <span className="text-blue-900 font-semibold">{post.tutor.name} {post.tutor.lastname}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 grid md:grid-cols-2 gap-y-1">
                      <p>📚 ระดับชั้นที่สอน: {post.meta?.target_student_level}</p>
                      <p>📅 วันที่สอน: {post.meta?.teaching_days}</p>
                      <p>⏰ ช่วงเวลา: {post.meta?.teaching_time}</p>

                      {/* ✅ แก้ไข: ใช้ LocationLink */}
                      <p className="flex items-start gap-1">
                        <span className="font-bold shrink-0">📍 สถานที่: </span>
                        <LocationLink value={post.meta?.location} />
                      </p>

                      {typeof post.group_size === 'number' && post.group_size > 0 ? (
                        <p>👥 จำนวนคน: {post.group_size} คน</p>
                      ) : null}
                      <p>💸 ราคา: {Number(post.meta?.price || 0).toFixed(2)} บาท/ชม.</p>

                      {/* ✅ แก้ไข: ใช้ ContactLink */}
                      <p className="md:col-span-2 flex items-start gap-1">
                        <span className="font-bold shrink-0">☎️ ติดต่อ: </span>
                        <ContactLink value={post.meta?.contact_info} />
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between pt-3">
                    <div
                      className="text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                      onClick={() => {
                        if (onOpenDetails) {
                          localStorage.setItem("myPostScrollPosition", window.scrollY);
                          onOpenDetails(post.id, 'mypost', post.post_type);
                        }
                      }}
                    >
                      เข้าร่วมแล้ว :{" "}
                      <b className="underline">
                        {post.post_type === "tutor" ? (post.join_count || 0) : (post.join_count || 0) + 1} / {post.group_size}
                      </b>{" "}
                      คน
                    </div>


                    <div className="flex items-center gap-2">
                      <button disabled={favBusy} onClick={() => toggleFavorite(post)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition ${post.favorited ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600'} disabled:opacity-60`}>
                        <Heart size={16} fill={post.favorited ? 'currentColor' : 'none'} />
                        <span className="text-sm">{Number(post.fav_count || 0)}</span>
                      </button>

                      {/* Action Buttons (Join/Unjoin) - LOGIC ที่แก้ไขให้ถูกต้อง */}
                      {post.post_type === "student" ? (
                        // === Student Post ===
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">คุณเป็นเจ้าของโพสต์</span>
                        ) : (
                          // ถ้าไม่ใช่เจ้าของ (เป็นคนอื่นมาดู)
                          (post.joined || post.pending_me) ? (
                            // 1. ถ้าเคยกดไปแล้ว (ไม่ว่า Joined หรือ Pending) ให้แสดงปุ่มยกเลิก
                            <button
                              disabled={busy || post.cancel_requested}
                              onClick={() => handleUnjoin(post)}
                              className={`px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 ${post.cancel_requested ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                            >
                              {post.cancel_requested ? "รออนุมัติยกเลิก" : (busy ? "..." : (isTutor ? "ยกเลิกข้อเสนอ" : (post.joined ? "ยกเลิกการเข้าร่วม" : "ยกเลิกคำขอ")))}
                            </button>
                          ) : (
                            // 2. ถ้ายังไม่เคยกด
                            <button
                              disabled={busy || isExpired || (isFull && !isTutor) || (isTutor && post.has_tutor)}
                              onClick={() => handleJoin(post)}
                              className={`px-4 py-2 rounded-xl text-white ${isExpired ? "bg-gray-400 cursor-not-allowed" :
                                (isFull && !isTutor) ? "bg-gray-400 cursor-not-allowed" :
                                  (isTutor && post.has_tutor) ? "bg-indigo-300 cursor-not-allowed" : // สีจางๆ เมื่อมีติวเตอร์แล้ว
                                    isTutor ? "bg-indigo-600 hover:bg-indigo-700" : // สีครามสำหรับติวเตอร์
                                      "bg-purple-600 hover:bg-purple-700"
                                }`}
                            >
                              {isExpired ? "หมดเวลา" :
                                (isFull && !isTutor) ? "เต็มแล้ว" :
                                  (isTutor && post.has_tutor) ? "ได้ติวเตอร์แล้ว" :
                                    busy ? "..." :
                                      (isTutor ? "ต้องการสอน" : "Join")}
                            </button>
                          )
                        )
                      ) : (
                        // === Tutor Post (คงเดิม) ===
                        isOwner ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">โพสต์ของฉัน</span>
                        ) : isTutor ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">สำหรับนักเรียน</span>
                        ) : (post.joined || post.pending_me) ? (
                          <button disabled={busy || post.cancel_requested} onClick={() => handleUnjoinTutor(post)} className={`px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50 ${post.cancel_requested ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}>
                            {post.cancel_requested ? "รออนุมัติยกเลิก" : (busy ? "..." : (post.joined ? "ยกเลิกการเข้าร่วม" : "ยกเลิกคำขอ"))}
                          </button>
                        ) : (
                          <button
                            disabled={busy || isExpired || isFull}
                            onClick={() => handleJoinTutor(post)}
                            className={`px-4 py-2 rounded-xl text-white ${(isExpired || isFull) ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                              }`}
                          >
                            {isExpired ? "หมดเวลา" : isFull ? "เต็มแล้ว" : busy ? "..." : "Join"}
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
      {/* Report Modal */}
      <ReportModal
        open={!!reportingPost}
        onClose={() => setReportingPost(null)}
        postId={reportingPost?.id}
        postType={reportingPost?.post_type}
      />
    </div>
  );
}

export default MyPost;