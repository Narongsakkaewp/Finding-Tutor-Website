// src/components/MyPost.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapPin, Calendar, Clock, Users, DollarSign, Heart, BahtSign,
  Filter, Search, Plus, X, ChevronDown, Mail, Phone, User, Star,
  MoreHorizontal, Edit, Trash2, Flag, MessageSquareText, GraduationCap
} from "lucide-react";
import ReportModal from "./ReportModal";
import MyPostForm from "./MyPostForm";
import SmartSearch from "./SmartSearch";
import { API_BASE } from '../config';
import { useScrollRestoration } from '../hooks/useRestoration';

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
  has_tutor: !!p.has_tutor,
  comment_count: Number(p.comment_count ?? 0),
  tutor: p.tutor || null,
  approved_tutor_name: p.approved_tutor_name || null,
  post_type: "student",
  user: p.user || {
    first_name: p.first_name || p.name || "",
    last_name: p.last_name || "",
    profile_image: p.profile_picture_url || "/../blank_avatar.jpg",
    email: p.email || "",
    phone: p.phone || "",
    username: p.username || p.user?.username || "",
  },
  cancel_requested: !!p.cancel_requested,
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
    comment_count: Number(p.comment_count ?? 0),
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

// --- Helper: แสดงผลวันที่และเวลาแบบหลายรายการ ---
const DateTimeDisplay = ({ daysStr, timesStr }) => {
  if (!daysStr) return <span>-</span>;

  const daysArr = daysStr.split(',').map(d => d.trim());
  const timesArr = (timesStr || "").split(',').map(t => t.trim());

  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {daysArr.map((day, idx) => {
        const time = timesArr[idx] || timesArr[0] || "-"; // ถ้าไม่ได้ระบุเวลา ให้ดึงเวลาช่องแรกมาใช้
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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Logic การกรองข้อมูล (อัปเกรด: ค้นหาแบบ Google Style - ยืดหยุ่นและหั่นคำ)
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      // 1. Filter by Level
      let passesLevel = true;
      if (filterLevel !== "all") {
        let levelData = "";
        if (p.post_type === "student") {
          levelData = p.grade_level || "";
        } else {
          levelData = p.meta?.target_student_level || "";
        }
        passesLevel = String(levelData).includes(filterLevel);
      }

      // 2. Filter by Search Query (อัปเกรดใหม่!)
      let passesSearch = true;
      if (searchQuery.trim()) {
        // 🌟 หั่นคำค้นหาด้วยช่องว่าง (Split by spaces)
        const searchWords = searchQuery.toLowerCase().trim().split(/\s+/);

        const subject = String(p.subject || "").toLowerCase();
        const desc = String(p.description || p.content || "").toLowerCase();
        const loc = String(p.location || p.meta?.location || "").toLowerCase();
        const fullContent = `${subject} ${desc} ${loc}`;
        passesSearch = searchWords.some(word => fullContent.includes(word));
      }

      return passesLevel && passesSearch;
    });
  }, [posts, filterLevel, searchQuery]);

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

  // ✅ Scroll Restoration (Automatically saves current position and restores it)
  useScrollRestoration('mypost', [posts]);



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

        {/* Header & Controls Container (Compact Mobile Layout) */}
        <div className="mb-6 space-y-4">

          {/* Top Row: Title & Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">ฟีดโพสต์</h1>

            <div className="inline-flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
              <button
                className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${feedType === 'student' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => { setFeedType('student'); setFilterLevel('all'); }}
              >
                นักเรียน
              </button>
              <button
                className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${feedType === 'tutor' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => { setFeedType('tutor'); setFilterLevel('all'); }}
              >
                ติวเตอร์
              </button>
            </div>
          </div>

          <p className="hidden md:block text-sm text-gray-500 font-medium">
            {feedType === "student" ? "แสดงโพสต์ขอเรียนจากนักเรียนทั้งหมด" : "แสดงประกาศสอนจากติวเตอร์ทั้งหมด"}
          </p>

          {/* Bottom Row: Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 w-full relative z-20">
              <SmartSearch
                userId={meId}
                onSearch={(val) => setSearchQuery(val)}
              />
            </div>

            <div className="w-full sm:w-auto relative shrink-0">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 md:py-3.5 pl-4 pr-10 rounded-full text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">ระดับชั้น: ทั้งหมด</option>
                {postGradeLevelOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm flex items-center gap-2">
            ⚠️ {error}
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
                <MyPostForm
                  feedType={feedType}
                  isTutor={isTutor}
                  meId={meId}
                  tutorId={tutorId}
                  user={user}
                  editMode={editMode}
                  editingPostId={editingPostId}
                  initialData={formData}
                  onClose={() => {
                    setExpanded(false);
                    setEditMode(false);
                    setEditingPostId(null);
                    setFormData(initialFormData);
                  }}
                  onSuccess={() => {
                    fetchPosts();
                    setExpanded(false);
                    setEditMode(false);
                    setEditingPostId(null);
                    setFormData(initialFormData);
                  }}
                />
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

                  {/* 🌟 Post Details นักเรียน */}
                  {/* ========================================== */}
                  {post.post_type === "student" ? (
                    <div className="space-y-3 mt-4 border-t border-gray-100 pt-3">

                      {/* แถวที่ 1: ข้อมูลสรุป (ใช้ Flex Wrap เป็นป้าย Tag) */}
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-100">
                          <GraduationCap size={16} className="shrink-0" />
                          {post.grade_level}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                          <span className="text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center font-black text-xs">
                            ฿
                          </span>
                          {post.budget} บาท/ชั่วโมง
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 text-gray-700 font-medium border border-gray-200">
                          <LocationLink value={post.location} />
                        </span>
                      </div>

                      {/* แถวที่ 2: กล่องวันและเวลาเรียน (แยกให้ชัดเจน) */}
                      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-2 text-sm">
                          <Calendar size={16} /> วันที่และเวลาเรียน:
                        </div>
                        <div className="text-sm ml-1">
                          <DateTimeDisplay daysStr={post.preferred_days} timesStr={post.preferred_time} />
                        </div>
                      </div>

                      {/* แถวที่ 3: ข้อมูลติดต่อ & ติวเตอร์ */}
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                          <Mail size={16} className="text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold text-amber-900">ข้อมูลติดต่อ: </span>
                            <ContactLink value={post.contact_info} />
                          </div>
                        </div>

                        {post.tutor && (
                          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                            <span className="font-bold text-blue-800 shrink-0">👨‍🏫 ติวเตอร์ที่สอน: </span>
                            <span className="text-blue-900 font-semibold">{post.tutor.name} {post.tutor.lastname}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (

                    //  Post Details ติวเตอร์
                    <div className="space-y-3 mt-4 border-t border-gray-100 pt-3">

                      {/* แถวที่ 1: ข้อมูลสรุป (ใช้ Flex Wrap เป็นป้าย Tag) */}
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-100" title={post.meta?.target_student_level}>
                          <GraduationCap size={16} className="shrink-0" />
                          <span className="truncate max-w-[150px]">{post.meta?.target_student_level}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                          <span className="text-emerald-600 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center font-black text-xs">
                            ฿
                          </span>
                          {Number(post.meta?.price || 0).toFixed(0)} บาท/ชั่วโมง
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 text-gray-700 font-medium border border-gray-200">
                          <LocationLink value={post.meta?.location} />
                        </span>
                      </div>

                      {/* แถวที่ 2: กล่องวันและเวลาเรียน (แยกให้ชัดเจนแบบมีพื้นหลัง) */}
                      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-2 text-sm">
                          <Calendar size={16} /> วันที่และเวลาที่สะดวกสอน:
                        </div>
                        <div className="text-sm ml-1">
                          <DateTimeDisplay daysStr={post.meta?.teaching_days} timesStr={post.meta?.teaching_time} />
                        </div>
                      </div>

                      {/* แถวที่ 3: ข้อมูลติดต่อ */}
                      <div className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100 text-sm">
                        <Mail size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold text-amber-900">ช่องทางติดต่อ: </span>
                          <ContactLink value={post.meta?.contact_info} />
                        </div>
                      </div>
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
                      จำนวนผู้เรียน:{" "}
                      <b className="underline text-blue-700">
                        {post.post_type === "tutor" ? (post.join_count || 0) : (post.join_count || 0) + 1} / {post.group_size}
                      </b>{" "}
                      คน
                      <span className="text-gray-500 ml-1 text-xs">
                        ({post.post_type === "student" ? "รวมเจ้าของโพสต์แล้ว, " : ""}ว่างอีก <span className="text-blue-700 font-semibold">{Math.max(0, post.group_size - (post.post_type === "tutor" ? (post.join_count || 0) : (post.join_count || 0) + 1))}</span> คน)
                      </span>
                    </div>


                    <div className="flex items-center gap-2">
                      <button disabled={favBusy} onClick={() => toggleFavorite(post)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition ${post.favorited ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600'} disabled:opacity-60`}>
                        <Heart size={16} fill={post.favorited ? 'currentColor' : 'none'} />
                        <span className="text-sm">{Number(post.fav_count || 0)}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenDetails) {
                            localStorage.setItem("myPostScrollPosition", window.scrollY);
                            onOpenDetails(post.id, 'mypost', post.post_type);
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border bg-white border-gray-200 hover:bg-gray-50 text-gray-600 focus:outline-none transition-colors"
                      >
                        <MessageSquareText size={16} />
                        <span className="text-sm">{Number(post.comment_count || 0)}</span>
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