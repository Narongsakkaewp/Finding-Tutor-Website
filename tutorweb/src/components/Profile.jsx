import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, MoreVertical, Trash2, EyeOff, Eye, MapPin, Mail, Phone, GraduationCap, AppWindow, Star, X, Archive, Sparkles, User, Users, Flag, History, BookOpen, UserCheck, Clock, Calendar } from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';
import ReportModal from "./ReportModal";
import { API_BASE } from '../config';

const postGradeLevelOptions = [
  { value: "ประถมศึกษา", label: "ประถมศึกษา" },
  { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
  { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

const normalizePost = (p = {}) => ({
  _id: p._id ?? p.id ?? p.student_post_id,
  subject: p.subject || "",
  content: p.content || p.description || p.details || "",
  createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
  meta: {
    preferred_days: p.meta?.preferred_days ?? p.preferred_days ?? "",
    preferred_time: p.meta?.preferred_time ?? p.preferred_time ?? "",
    location: p.meta?.location ?? p.location ?? "",
    group_size: p.meta?.group_size ?? p.group_size ?? "",
    budget: p.meta?.budget ?? p.budget ?? "",
  },
});

const fullNameOf = (u) =>
  [u?.name || u?.first_name || "", u?.lastname || u?.last_name || ""].join(" ").trim();

const toLocalYMD = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ---------- Subcomponents ---------- */

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children, icon: Icon, className = "", rightAction }) {
  return (
    <section className={`bg-white rounded-[2.5rem] border border-gray-100 p-6 shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Icon size={20} />
              </div>
            )}
            <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>
          </div>
          {rightAction}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Empty({ line = "ไม่พบข้อมูล" }) {
  return (
    <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-3 text-center">
      {line}
    </div>
  );
}

/* ===== เมนูสามจุดบนการ์ดโพสต์ ===== */
function PostActionMenu({ open, onClose, onEdit, onHide, onDelete, onReport, isOwner }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose}></div>
      <div className="absolute right-2 top-8 z-20 w-40 overflow-hidden rounded-xl border bg-white shadow-xl animate-in fade-in zoom-in duration-100">
        {isOwner ? (
          <>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
              onClick={() => { onEdit(); onClose(); }}
            >
              <Edit size={16} className="text-gray-500" /> แก้ไขโพสต์
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
              onClick={() => { onHide(); onClose(); }}
            >
              <EyeOff size={16} className="text-gray-500" /> ซ่อนโพสต์
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => { onDelete(); onClose(); }}
            >
              <Trash2 size={16} /> ลบโพสต์
            </button>
          </>
        ) : (
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => { onReport(); onClose(); }}
          >
            <Flag size={16} /> รายงานโพสต์
          </button>
        )}
      </div>
    </>
  );
}

function ConfirmDialog({ open, title = "ยืนยันการลบ", desc = "ลบโพสต์นี้ถาวรหรือไม่?", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border bg-white p-5 shadow-xl animate-in fade-in zoom-in duration-200">
        <h4 className="text-lg font-bold text-gray-900">{title}</h4>
        <p className="mt-2 text-sm text-gray-600">{desc}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition">ยกเลิก</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition">ลบโพสต์</button>
        </div>
      </div>
    </div>
  );
}

function AvatarModal({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-lg w-full max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="w-full h-full object-contain rounded-lg shadow-xl" />
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-lg hover:bg-gray-200 transition">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

function HiddenPostsModal({ open, onClose, posts, hiddenIds, onRestore, onRestoreAll }) {
  if (!open) return null;
  const hiddenPosts = posts.filter(p => hiddenIds.has(p._id ?? p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Archive className="text-gray-500" size={20} />
            <h3 className="font-bold text-lg text-gray-800">รายการที่ซ่อนไว้ ({hiddenPosts.length})</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {hiddenPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Archive size={48} className="mb-3 opacity-20" />
              <p>ไม่มีโพสต์ที่ซ่อนไว้</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hiddenPosts.map(p => (
                <div key={p._id ?? p.id} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800 truncate">{p.subject || "(ไม่มีหัวข้อ)"}</span>
                      <span className="text-xs text-gray-400">• {new Date(p.createdAt).toLocaleDateString("th-TH")}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{p.content}</p>
                  </div>
                  <button onClick={() => onRestore(p._id ?? p.id)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition whitespace-nowrap">
                    <Eye size={16} /> เลิกซ่อน
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {hiddenPosts.length > 0 && (
          <div className="p-4 border-t bg-white flex justify-end">
            <button onClick={onRestoreAll} className="text-sm text-gray-600 hover:text-blue-600 font-medium px-4 py-2 hover:bg-gray-50 rounded-lg transition">เลิกซ่อนทั้งหมด</button>
            <button onClick={onClose} className="ml-2 bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition">ปิดหน้าต่าง</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */

function Profile({ setCurrentPage, user: currentUser, onEditProfile, onOpenPost, onViewProfile }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyEvents, setDailyEvents] = useState([]);

  // ✅ Tabs State
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'history'

  const [editPost, setEditPost] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [updating, setUpdating] = useState(false);
  const [reportingPost, setReportingPost] = useState(null);

  const [recommendedTutors, setRecommendedTutors] = useState([]);
  const [recsBasedOn, setRecsBasedOn] = useState("");
  const [buddies, setBuddies] = useState([]);

  const [openMenuFor, setOpenMenuFor] = useState(null);
  const [showHiddenModal, setShowHiddenModal] = useState(false);

  const [hiddenPostIds, setHiddenPostIds] = useState(() => {
    try {
      const saved = localStorage.getItem("hiddenStudentPosts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);



  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = currentUser?.user_id || 0;

        // 1. Profile
        let prof = {
          avatarUrl: currentUser?.profile_picture_url || "/../blank_avatar.jpg",
          fullName: fullNameOf(currentUser) || currentUser?.email || "ผู้ใช้",
          nickname: currentUser?.nickname || "",
          gradeLevel: currentUser?.grade_level || "นักเรียน",
          school: currentUser?.institution || "",
          city: currentUser?.address || "",
          email: currentUser?.email || "",
          phone: currentUser?.phone || "",
          subjects: currentUser?.subjects || [],
          bio: "",
          education: [],
          username: currentUser?.username || "",
        };
        try {
          const pfRes = await fetch(`${API_BASE}/api/profile/${me}`);
          if (pfRes.ok) {
            const p = await pfRes.json();
            const education = [];
            if (p.institution) {
              education.push({
                degree: p.grade_level || 'N/A',
                institution: p.institution,
                faculty: p.faculty || null,
                major: p.major || null,
              });
            }
            prof = {
              ...prof,
              fullName: fullNameOf(p) || prof.fullName,
              nickname: p.nickname ?? prof.nickname,
              avatarUrl: p.profile_picture_url || prof.avatarUrl,
              city: p.address || null,
              school: p.institution ?? prof.school,
              email: p.email ?? prof.email,
              phone: p.phone || null,
              subjects: p.subjects ?? prof.subjects,
              gradeLevel: p.grade_level ?? prof.gradeLevel,
              bio: p.about || "",
              education: education,
              username: p.username || prof.username,
            };
          }
        } catch { }
        if (!cancelled) setProfile(prof);

        // 2. Posts
        const r = await fetch(`${API_BASE}/api/student_posts?me=${me}&mine=1`);
        const data = await r.json();
        const onlyMine = Array.isArray(data) ? data.filter((p) => Number(p.owner_id) === Number(me)) : [];
        if (!cancelled) setPosts(onlyMine.map(normalizePost));

        // 3. Calendar Events (Used for History)
        const evRes = await fetch(`${API_BASE}/api/calendar/${me}`);
        if (evRes.ok) {
          const evData = await evRes.json();
          if (!cancelled) setEvents(evData.items || []);
        }

        // 4. Fetch Recommended Tutors
        const recRes = await fetch(`${API_BASE}/api/recommendations?user_id=${me}`);
        if (recRes.ok) {
          const recData = await recRes.json();
          if (!cancelled) {
            if (Array.isArray(recData)) {
              setRecommendedTutors(recData);
            } else {
              setRecommendedTutors(recData.items || []);
              setRecsBasedOn(recData.based_on || "");
            }
          }
        }

        // 5. Fetch Study Buddies
        const budRes = await fetch(`${API_BASE}/api/recommendations/friends?user_id=${me}`);
        if (budRes.ok) {
          const budData = await budRes.json();
          if (!cancelled) setBuddies(budData);
        }

      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.user_id]);

  useEffect(() => {
    const selectedDateStr = toLocalYMD(selectedDate);
    const matches = events.filter((ev) => {
      if (!ev.event_date) return false;
      const eventDateObj = new Date(ev.event_date);
      const evDateStr = toLocalYMD(eventDateObj);
      return evDateStr === selectedDateStr;
    });
    setDailyEvents(matches);
  }, [selectedDate, events]);

  // ✅ Process History from Events
  const studyHistory = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // นำนับรวมของวันนี้ด้วย

    return events.filter(ev => {
      const evDate = ev.event_date ? new Date(ev.event_date.split('T')[0] + 'T12:00:00Z') : (ev.created_at ? new Date(ev.created_at) : new Date(0));
      if (evDate > today) return false; // กรองอนาคตออก

      // ดึงประวัติการเรียนทั้งหมด ทั้งที่เคยเข้าร่วม โพสต์ตัวเอง และปฏิทิน
      return ev.source === 'student_post_joined' ||
        ev.source === 'tutor_post_joined' ||
        ev.source === 'tutor_offer_accepted' ||
        ev.source === 'student_post_owner' ||
        (ev.source === 'calendar' && (ev.title?.startsWith('เรียน') || ev.title?.startsWith('ติว') || ev.title?.includes('นัด')));
    }).map(ev => {
      const isSelfPost = ev.source === 'student_post_owner' || (ev.source === 'calendar' && ev.title?.includes('โพสต์ของคุณ'));
      return {
        ...ev,
        // แปลง Source เป็นข้อความที่อ่านง่าย
        typeLabel: isSelfPost ? 'โพสต์หาผู้สอน (ของคุณ)' :
          ev.source === 'tutor_post_joined' ? 'เรียนกับติวเตอร์' :
            ev.source === 'student_post_joined' ? 'เข้ากลุ่มติว' : 'ติวเตอร์มาสอน',
        icon: ev.source.includes('tutor') ? GraduationCap : Users
      };
    }).sort((a, b) => {
      const dateA = new Date(a.event_date || a.created_at);
      const dateB = new Date(b.event_date || b.created_at);
      return dateB - dateA; // เรียงจากใหม่ไปเก่า
    });
  }, [events]);

  const handleToggleMenu = (id) => setOpenMenuFor((prev) => (prev === id ? null : id));

  const handleHidePost = (id) => {
    setHiddenPostIds((prev) => {
      const newSet = new Set(prev).add(id);
      localStorage.setItem("hiddenStudentPosts", JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const handleRestorePost = (id) => {
    setHiddenPostIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      localStorage.setItem("hiddenStudentPosts", JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const handleRestoreAll = () => {
    setHiddenPostIds(new Set());
    localStorage.removeItem("hiddenStudentPosts");
    setShowHiddenModal(false);
  };

  // --- Edit Handlers ---
  const handleEditClick = (post) => {
    setEditPost(post);
    setEditForm({
      subject: post.subject,
      description: post.content,
      preferred_days: post.meta?.preferred_days || "",
      preferred_time: post.meta?.preferred_time || "",
      grade_level: profile?.gradeLevel || "",
      location: post.meta?.location || "",
      group_size: post.meta?.group_size || "",
      budget: post.meta?.budget || "",
      contact_info: profile?.phone || profile?.email || "",
    });
    setOpenMenuFor(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditLocationSelect = (address) => {
    setEditForm(prev => ({ ...prev, location: address }));
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editPost) return;

    try {
      setUpdating(true);
      const res = await fetch(`${API_BASE}/api/student_posts/${editPost._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editForm.subject,
          description: editForm.description,
          preferred_days: editForm.preferred_days,
          preferred_time: editForm.preferred_time,
          grade_level: editForm.grade_level,
          location: editForm.location,
          group_size: editForm.group_size,
          budget: editForm.budget,
          contact_info: editForm.contact_info
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");

      // Update local state
      setPosts(prev => prev.map(p => {
        if ((p._id ?? p.id) === editPost._id) {
          return {
            ...p,
            subject: editForm.subject,
            content: editForm.description,
            meta: {
              ...p.meta,
              preferred_days: editForm.preferred_days,
              preferred_time: editForm.preferred_time,
              location: editForm.location,
              group_size: editForm.group_size,
              budget: editForm.budget
            }
          };
        }
        return p;
      }));

      setEditPost(null);
      alert("แก้ไขโพสต์เรียบร้อยแล้ว");

    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReportClick = (post) => {
    setReportingPost(post);
    setOpenMenuFor(null);
  };

  const handleAskDelete = (id) => setConfirm({ open: true, id });
  const cancelDelete = () => setConfirm({ open: false, id: null });

  const doDeletePost = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    const before = [...posts];
    setPosts(prev => prev.filter(p => (p._id ?? p.id) !== id));

    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser?.user_id })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "ลบไม่สำเร็จ");
      }
    } catch (err) {
      alert(err.message);
      setPosts(before);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const hiddenCount = hiddenPostIds.size;

  return (
    <div className="min-h-screen bg-white">
      {/* --- Premium Header Section (Synced with Tutor Design) --- */}
      <div className="relative overflow-hidden bg-white border-b">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-50/50 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Avatar Section */}
            <div className="relative shrink-0 group">
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />
              <div className="relative">
                <img
                  src={profile.avatarUrl || "/../blank_avatar.jpg"}
                  alt={profile.fullName}
                  className="h-40 w-40 rounded-[2.2rem] object-cover ring-4 ring-white shadow-2xl cursor-pointer hover:scale-[1.02] transition-all duration-300"
                  onClick={() => setIsAvatarModalOpen(true)}
                />
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-grow space-y-6">
              <div className="space-y-2">
                <div className="flex flex-col items-start gap-3">
                  <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    {profile.fullName}
                    {profile.nickname && (
                      <span className="text-gray-900 font-medium ml-3 text-2xl">
                        ({profile.nickname})
                      </span>
                    )}
                  </h1>

                  {/* username */}
                  {profile.username && (
                    <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 shadow-sm">
                      <span className="text-indigo-600 font-medium text-md">
                        @{profile.username}
                      </span>
                    </div>
                  )}
                </div>

                {profile.education && profile.education.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.education.map((edu, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                        <GraduationCap size={14} className="text-indigo-500" />
                        <span className="font-medium text-gray-700">{edu.institution}</span>
                        <span className="text-gray-400">•</span>
                        <span>{edu.degree}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="max-w-2xl">
                <p className="text-gray-600 leading-relaxed text-lg">
                  "{profile.bio || "สวัสดีครับ ผมกำลังมองหาติวเตอร์ที่ช่วยเสริมทักษะในวิชาต่างๆ สนใจติวทักมาคุยกันได้เลยครับ!"}"
                </p>
              </div>

              {/* Contact Chips */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors group cursor-pointer">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <MapPin size={16} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{profile.city || "ยังไม่ได้ระบุที่อยู่"}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors group cursor-pointer">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Phone size={16} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{profile.phone || "0xx-xxx-xxxx"}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors group cursor-pointer">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Mail size={16} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{profile.email || "contact@student.com"}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 min-w-[200px] w-full lg:w-auto">
              <button
                onClick={onEditProfile}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200"
              >
                <Edit size={18} />
                แก้ไขโปรไฟล์
              </button>
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">โพสต์ทั้งหมด</div>
                  <div className="text-xl font-black text-gray-900">{posts.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* --- Main Content --- */}
          <div className="lg:col-span-8 space-y-8">
            {/* Tab Switcher */}
            <div className="flex p-1.5 bg-white border border-gray-200 rounded-[2rem] shadow-sm max-w-md">
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex items-center justify-center gap-2 flex-1 py-3 px-6 rounded-[1.6rem] text-sm font-bold transition-all duration-300 ${activeTab === 'posts' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                <BookOpen size={18} />
                โพสต์ของฉัน ({posts.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center justify-center gap-2 flex-1 py-3 px-6 rounded-[1.6rem] text-sm font-bold transition-all duration-300 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                <History size={18} />
                ประวัติการเรียน
              </button>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
              {activeTab === 'posts' ? (
                <Card title="โพสต์ของฉัน">
                  {hiddenCount > 0 && (
                    <div className="mb-4 flex justify-end">
                      <button onClick={() => setShowHiddenModal(true)} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition shadow-sm">
                        <Archive size={14} /> รายการที่ซ่อนไว้ ({hiddenCount})
                      </button>
                    </div>
                  )}

                  {!posts.length ? <Empty line="ยังไม่มีโพสต์หาติวเตอร์ในขณะนี้" /> : (
                    <div className="space-y-4">
                      {posts.filter((p) => !hiddenPostIds.has(p._id ?? p.id)).map((p) => {
                        const id = p._id ?? p.id;
                        return (
                          <div key={id} className="bg-white border border-gray-100 rounded-[2rem] p-8 relative overflow-hidden shadow-sm">
                            {/* Decorative Highlight */}
                            <div className="absolute top-0 left-0 w-1.5 h-full" />

                            {/* Post Header */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <img src={profile.avatarUrl || "/../blank_avatar.jpg"} alt="avatar" className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-50" />
                                </div>
                                <div>
                                  <div className="text-lg font-black text-gray-900 tracking-tight">{profile.fullName}</div>
                                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold">
                                    <Clock size={12} />
                                    {new Date(p.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                                  </div>
                                </div>
                              </div>
                              <div className="relative">
                                <button
                                  onClick={() => handleToggleMenu(id)}
                                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-50"
                                >
                                  <MoreVertical size={20} />
                                </button>
                                <PostActionMenu
                                  open={openMenuFor === id}
                                  onClose={() => setOpenMenuFor(null)}
                                  onEdit={() => handleEditClick(p)}
                                  onHide={() => handleHidePost(id)}
                                  onDelete={() => handleAskDelete(id)}
                                  onReport={() => handleReportClick(p)}
                                  isOwner={true}
                                />
                              </div>
                            </div>

                            {/* Post Body */}
                            <div className="space-y-4">
                              <div className="inline-flex px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-sm font-bold">
                                วิชา: {p.subject}
                              </div>
                              <p className="text-gray-600 leading-relaxed max-w-2xl text-[15px]">
                                {p.content}
                              </p>

                              {/* Post Meta Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-transparent">
                                  <div className="text-indigo-500"><Calendar size={18} /></div>
                                  <span className="text-xs font-bold text-gray-700">{p.meta?.preferred_days || "-"}</span>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-transparent">
                                  <div className="text-purple-500"><Clock size={18} /></div>
                                  <span className="text-xs font-bold text-gray-700">{p.meta?.preferred_time || "-"}</span>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-transparent">
                                  <div className="text-blue-500"><MapPin size={18} /></div>
                                  <span className="text-xs font-bold text-gray-700 truncate">{p.meta?.location || "ออนไลน์"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Post Footer */}
                            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">งบประมาณ</div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl font-black text-indigo-600">฿{p.meta?.budget || "0"}</span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">/ชม.</span>
                                </div>
                              </div>
                              <button className="px-5 py-2 bg-[#111827] text-white rounded-xl text-xs font-bold hover:bg-black transition-colors">
                                ดูรายละเอียด
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ) : (
                <Card title="ประวัติการเรียน (ที่เสร็จสิ้น/ยอมรับแล้ว)">
                  {studyHistory.length === 0 ? (
                    <Empty line="ยังไม่มีประวัติการเรียนในขณะนี้" />
                  ) : (
                    <div className="space-y-6">
                      {studyHistory.map((item, idx) => (
                        <div key={idx} className="group bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-16 h-16 shrink-0 rounded-[1.4rem] bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                              <item.icon size={28} />
                            </div>

                            <div className="flex-grow">
                              <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                                <div>
                                  <h4 className="text-xl font-black text-gray-900 mb-1">{item.title}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                      {item.typeLabel}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                                      {item.event_date ? new Date(item.event_date.split('T')[0] + 'T12:00:00Z').toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' }) : (item.created_at ? new Date(item.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' }) : "")}
                                    </span>
                                  </div>
                                </div>
                                <button className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-600 hover:text-white transition-all">
                                  รายละเอียด
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:text-indigo-500 transition-colors"><BookOpen size={16} /></div>
                                  <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">วิชา</div>
                                    <div className="text-sm font-bold text-gray-700">{item.subject}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:text-purple-500 transition-colors"><MapPin size={16} /></div>
                                  <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">สถานที่</div>
                                    <div className="text-sm font-bold text-gray-700">{item.location || "ไม่ระบุ (ออนไลน์)"}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>

          {/* --- Sidebar (Right) --- */}
          <div className="lg:col-span-4 space-y-8">
            {/* 1. Calendar */}
            <Card title="ตารางเวลาของฉัน">
              <div className="space-y-6">
                <div className="flex justify-center">
                  <ReactCalendar
                    className="border-0 rounded-2xl p-4 bg-gray-50/50 w-full"
                    locale="en-US"
                    value={selectedDate}
                    onClickDay={(value) => setSelectedDate(value)}
                    tileClassName={({ date, view }) => {
                      if (view === "month" && events.some(ev => ev.event_date && toLocalYMD(new Date(ev.event_date)) === toLocalYMD(date))) {
                        return "calendar-dot-highlight";
                      }
                      return null;
                    }}
                  />
                </div>
                <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2 text-sm">
                    <Clock size={18} />
                    ตารางสำหรับวันที่ {selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </h4>
                  {!dailyEvents.length ? (
                    <div className="text-center py-6 text-indigo-300 text-xs">
                      ไม่มีนัดติวในวันนี้
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {dailyEvents.map((ev, index) => (
                        <li
                          key={ev.event_id || index}
                          onClick={() => onOpenPost && onOpenPost(ev.post_id)}
                          className="group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-1 bg-indigo-500 rounded-full h-8" />
                            <div className="flex-grow">
                              <div className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{ev.title}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                  <Clock size={10} /> {ev.event_time?.slice(0, 5)}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                  <BookOpen size={10} /> {ev.subject}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            {/* 2. Recommended Tutors */}
            <Card title="ติวเตอร์แนะนำ" icon={Sparkles}>
              {recsBasedOn && (
                <div className="mb-4 px-3 py-1.5 bg-yellow-50 text-yellow-800 text-[10px] items-center gap-1.5 rounded-lg border border-yellow-100 inline-flex font-bold">
                  💡 จาก: {recsBasedOn}
                </div>
              )}

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {!recommendedTutors.length ? <Empty line="ยังไม่มีติวเตอร์ที่เหมาะสม" /> : (
                  recommendedTutors.map((tutor) => (
                    <div
                      key={tutor.tutor_post_id}
                      className="group flex flex-col gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-100 cursor-pointer transition-all shadow-sm hover:shadow-md"
                      onClick={() => onOpenPost && onOpenPost(tutor.tutor_post_id, 'tutor_post')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={tutor.profile_picture_url || '/../blank_avatar.jpg'} alt={tutor.subject} className="w-10 h-10 rounded-xl object-cover border border-gray-50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-gray-900 truncate uppercase group-hover:text-indigo-600 transition-colors">{tutor.subject}</div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase truncate">{tutor.name} {tutor.lastname || ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-black ">฿{tutor.price} <span className="text-[9px] font-normal not-">/ชม.</span></span>
                        {tutor.relevance_score && <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-tight">Match {tutor.relevance_score}%</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* 3. Study Buddies */}
            {/* <Card title="เพื่อนติวที่แนะนำ" icon={Users}>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {!buddies.length ? <Empty line="ยังไม่พบเพื่อนที่ถูกใจ" /> : (
                  buddies.map((friend) => (
                    <div
                      key={friend.user_id}
                      className="group p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-100 cursor-pointer transition-all shadow-sm hover:shadow-md"
                      onClick={() => onViewProfile && onViewProfile(friend.user_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={friend.profile_picture_url || '/../blank_avatar.jpg'} alt={friend.name} className="w-10 h-10 rounded-xl object-cover border border-gray-50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-gray-900 truncate uppercase group-hover:text-orange-600 transition-colors">{friend.name} {friend.lastname}</div>
                          <div className="text-[10px] text-gray-400 font-bold truncate">
                            {friend.looking_for || "กำลังมองหาเพื่อนติว"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                        {friend.match_score > 0 && (
                          <div className="flex items-center gap-1">
                            <Sparkles size={10} className="text-orange-400" />
                            <span className="text-[10px] text-orange-500 font-black uppercase tracking-tight">
                              Match {friend.match_score}%
                            </span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfile && onViewProfile(friend.user_id);
                          }}
                          className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black hover:bg-orange-600 hover:text-white transition-all uppercase"
                        >
                          ติดต่อ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card> */}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAvatarModalOpen && <AvatarModal src={profile.avatarUrl} alt={profile.fullName} onClose={() => setIsAvatarModalOpen(false)} />}
      <ConfirmDialog open={confirm.open} title="ยืนยันการลบโพสต์" desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้" onConfirm={doDeletePost} onCancel={cancelDelete} />

      {/* Hidden Posts Modal */}
      <HiddenPostsModal
        open={showHiddenModal}
        onClose={() => setShowHiddenModal(false)}
        posts={posts}
        hiddenIds={hiddenPostIds}
        onRestore={handleRestorePost}
        onRestoreAll={handleRestoreAll}
      />
      {/* Edit Modal */}
      {editPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditPost(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">แก้ไขโพสต์</h3>
              <button onClick={() => setEditPost(null)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วิชา / หัวข้อ</label>
                <input type="text" name="subject" value={editForm.subject || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เนื้อหาที่ต้องการเรียน</label>
                <textarea name="description" rows="3" value={editForm.description || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สะดวก</label>
                  <input type="date" name="preferred_days" value={editForm.preferred_days || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สะดวก</label>
                  <input type="time" name="preferred_time" value={editForm.preferred_time || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้นของผู้เรียน</label>
                <select name="grade_level" value={editForm.grade_level || ""} onChange={handleEditChange} className="w-full border rounded-lg p-2.5 outline-none bg-white">
                  <option value="">-- ไม่ระบุ --</option>
                  {postGradeLevelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่เรียน</label>
                <LongdoLocationPicker
                  onLocationSelect={handleEditLocationSelect}
                  defaultLocation={editForm.location}
                  showMap={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                  <input type="number" name="group_size" min="1" value={editForm.group_size || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">งบประมาณ (บาท)</label>
                  <input type="number" name="budget" min="0" value={editForm.budget || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ</label>
                <input type="text" name="contact_info" value={editForm.contact_info || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setEditPost(null)} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">ยกเลิก</button>
                <button disabled={updating} type="submit" className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm disabled:opacity-70">
                  {updating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ReportModal
        open={!!reportingPost}
        onClose={() => setReportingPost(null)}
        postId={reportingPost?._id || reportingPost?.id}
        postType="student_post"
      />
    </div>
  );
}

export default Profile;