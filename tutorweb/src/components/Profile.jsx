// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import Review from "../components/Review";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, MoreVertical, Trash2, EyeOff, Eye, MapPin, Mail, Phone, GraduationCap, AppWindow, Star, X, Archive } from "lucide-react";

/* ---------- Helpers ---------- */

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

function Card({ title, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border p-4 md:p-5">
      {title && <h3 className="text-lg font-bold">{title}</h3>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ line = "ไม่พบข้อมูล" }) {
  return (
    <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-3">
      {line}
    </div>
  );
}

/* ===== เมนูสามจุดบนการ์ดโพสต์ ===== */
function PostActionMenu({ open, onClose, onHide, onDelete }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose}></div>
      <div className="absolute right-2 top-8 z-20 w-40 overflow-hidden rounded-xl border bg-white shadow-xl animate-in fade-in zoom-in duration-100">
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
      </div>
    </>
  );
}

/* ===== กล่องยืนยันลบ ===== */
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

/* ✅ Modal สำหรับจัดการโพสต์ที่ซ่อนไว้ */
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

function Profile({ user, setCurrentPage, onEditProfile }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyEvents, setDailyEvents] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState(null);

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

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = currentUser?.user_id || 0;
        // 1. Profile
        let prof = {
          avatarUrl: currentUser?.profile_picture_url || "/default-avatar.png",
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
        };
        try {
          const pfRes = await fetch(`http://localhost:5000/api/profile/${me}`);
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
            };
          }
        } catch { }
        if (!cancelled) setProfile(prof);

        // 2. Posts
        const r = await fetch(`http://localhost:5000/api/student_posts?me=${me}&mine=1`);
        const data = await r.json();
        const onlyMine = Array.isArray(data) ? data.filter((p) => Number(p.owner_id) === Number(me)) : [];
        if (!cancelled) setPosts(onlyMine.map(normalizePost));

        // 3. Calendar Events
        const evRes = await fetch(`http://localhost:5000/api/calendar/${me}`);
        if (evRes.ok) {
          const evData = await evRes.json();
          if (!cancelled) setEvents(evData.items || []);
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

  // Handlers
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

  const handleAskDelete = (id) => setConfirm({ open: true, id });
  const cancelDelete = () => setConfirm({ open: false, id: null });

  const doDeletePost = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    const before = [...posts];
    const after = posts.filter((p) => (p._id ?? p.id) !== id);
    setPosts(after);
    try {
      const res = await fetch(`http://localhost:5000/api/student_posts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (e) {
      console.error(e);
      setPosts(before);
      alert("เกิดข้อผิดพลาดในการลบโพสต์");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">กำลังโหลดโปรไฟล์...</div>;
  if (!profile) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">ไม่พบข้อมูลผู้ใช้</div>;

  const mockRecommendedTutors = [
    { user_id: 101, profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=S', name: 'สมศักดิ์', lastname: 'เก่งกาจ', can_teach_subjects: 'คณิตศาสตร์ ม.ปลาย, แคลคูลัส' },
    { user_id: 102, profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=A', name: 'อลิสา', lastname: 'ใจดี', can_teach_subjects: 'GAT ภาษาอังกฤษ, TOEIC' },
    { user_id: 103, profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=N', name: 'นนทรี', lastname: 'บีทีเอส', can_teach_subjects: 'ฟิสิกส์ (PAT3), ตะลุยโจทย์' }
  ];

  const hiddenCount = posts.filter(p => hiddenPostIds.has(p._id ?? p.id)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* Header Profile */}
        <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-start gap-5 flex-grow">
              <img
                src={profile.avatarUrl || "/default-avatar.png"}
                alt={profile.fullName}
                className="h-28 w-28 rounded-2xl object-cover ring-4 ring-white shadow-md flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsAvatarModalOpen(true)}
              />
              <div className="flex-grow">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {profile.fullName}
                  {profile.nickname && <span className="text-gray-500 font-medium ml-2">({profile.nickname})</span>}
                </h1>
                <p className="text-gray-600 mt-1">
                  {profile.gradeLevel || "นักเรียน"} {profile.school && ` • ${profile.school}`}
                </p>
                {/* Education */}
                {profile.education && profile.education.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
                      <GraduationCap size={16} /> การศึกษาปัจจุบัน:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {profile.education.map((edu, index) => (
                        <li key={index} className="mt-1">
                          <span className="font-semibold">{edu.degree} ที่ {edu.institution}</span>
                          {edu.faculty && <div className="pl-5 text-gray-500">คณะ {edu.faculty}</div>}
                          {edu.major && <div className="pl-5 text-gray-500">สาขา {edu.major}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h4 className="flex items-center mt-3 border-t pt-3 gap-2 text-sm font-semibold text-gray-700 mb-1">
                    <AppWindow size={16} /> เกี่ยวกับฉัน:
                  </h4>
                  {profile.bio && <p className="pl-5 text-sm text-gray-700 whitespace-pre-line">{profile.bio}</p>}
                </div>
                {/* Contact Info */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <a href={profile.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.city)}` : "#"} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 border rounded-lg p-2 bg-gray-50 transition-colors ${profile.city ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`} onClick={(e) => !profile.city && e.preventDefault()}>
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5"><MapPin size={16} className="text-gray-600" /></div>
                    <span className="text-gray-700 truncate">{profile.city || "ยังไม่ระบุที่อยู่"}</span>
                  </a>
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50 hover:bg-gray-100">
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5"><Phone size={16} className="text-gray-600" /></div>
                    <a href={`tel:${profile.phone}`} className="text-gray-700 truncate hover:text-blue-600 hover:underline">{profile.phone || "ยังไม่ระบุเบอร์"}</a>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50 hover:bg-gray-100">
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5"><Mail size={16} className="text-gray-600" /></div>
                    <a href={`mailto:${profile.email}`} className="text-gray-700 truncate hover:text-blue-600 hover:underline">{profile.email || "ยังไม่ระบุอีเมล"}</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:ml-auto flex flex-col items-stretch md:items-end gap-3 self-start">
              <button onClick={onEditProfile} className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-blue-300 hover:bg-blue-200 text-gray-800 rounded-lg text-sm font-medium">
                <Edit size={16} /> แก้ไขโปรไฟล์
              </button>
              <button onClick={() => {
                setReviewTargetId(25); // เอา Tutor_post_ID มาใส่ เพื่อทำการทดสอบ
                setShowReviewModal(true);
              }} className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-blue-300 hover:bg-blue-200 text-gray-800 rounded-lg text-sm font-medium">
                <Star size={16} /> เขียนรีวิว(Demo)
              </button>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
                <Stat label="โพสต์ทั้งหมด" value={String(posts.length)} />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* ✅ Calendar Section (กู้คืน Layout เดิม: ซ้ายปฏิทิน ขวารายการ) */}
            <Card title="ตารางเวลาของฉัน">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* 1. ส่วนปฏิทิน */}
                <div className="flex justify-center">
                  <ReactCalendar
                    className="border rounded-xl p-4 bg-white shadow-sm w-full max-w-sm"
                    locale="en-US"
                    value={selectedDate}
                    onClickDay={(value) => setSelectedDate(value)}
                    tileClassName={({ date, view }) => {
                      if (view === "month" && events.some(ev => ev.event_date && toLocalYMD(new Date(ev.event_date)) === toLocalYMD(date))) {
                        return "bg-blue-200 text-blue-800 font-semibold rounded-lg";
                      }
                      return null;
                    }}
                  />
                </div>

                {/* 2. ส่วนรายการกิจกรรม (Daily Events) */}
                <div className="bg-gray-50 rounded-xl p-4 border h-full">
                  <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <AppWindow size={18} />
                    การติววันที่ {selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </h4>
                  {!dailyEvents.length ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      ไม่มีการติวในวันนี้
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {dailyEvents.map((ev) => (
                        <li key={ev.event_id} className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition">
                          <div className="font-semibold text-gray-800">{ev.title}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            📘 {ev.subject} — ⏰ {ev.event_time?.slice(0, 5)}<br />
                            📍 {ev.location || "ไม่ระบุสถานที่"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            <Card title="โพสต์ของฉัน">
              {/* ปุ่มเปิดดูรายการที่ซ่อน */}
              {hiddenCount > 0 && (
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={() => setShowHiddenModal(true)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition"
                  >
                    <Archive size={14} /> รายการที่ซ่อนไว้ ({hiddenCount})
                  </button>
                </div>
              )}

              {!posts.length ? <Empty line="ยังไม่มีโพสต์" /> : (
                <div className="space-y-4">
                  {posts.filter((p) => !hiddenPostIds.has(p._id ?? p.id)).map((p) => {
                    const id = p._id ?? p.id;
                    return (
                      <div key={id} className="relative border rounded-xl p-4 bg-white shadow-sm transition hover:shadow-md">
                        <button onClick={() => handleToggleMenu(id)} className="absolute right-2 top-2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <MoreVertical size={18} />
                        </button>
                        <PostActionMenu open={openMenuFor === id} onClose={() => setOpenMenuFor(null)} onHide={() => handleHidePost(id)} onDelete={() => handleAskDelete(id)} />

                        <div className="flex items-center gap-3">
                          <img src={profile.avatarUrl || "/default-avatar.png"} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
                          <div>
                            <div className="text-sm font-semibold">{profile.fullName}</div>
                            <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString("th-TH")}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-gray-800 whitespace-pre-line">{p.content}</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 mt-3">
                          <div>📘 {p.subject || "-"}</div>
                          <div>📅 {p.meta?.preferred_days || "-"}</div>
                          <div>⏰ {p.meta?.preferred_time || "-"}</div>
                          <div>📍 {p.meta?.location || "-"}</div>
                          <div>👥 {p.meta?.group_size || "-"}</div>
                          <div>💸 {p.meta?.budget ? `฿${p.meta.budget}` : "-"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="ติวเตอร์แนะนำสำหรับคุณ">
              {!mockRecommendedTutors.length ? <Empty line="ไม่พบติวเตอร์แนะนำ" /> : (
                <ul className="space-y-3">
                  {mockRecommendedTutors.map((tutor) => (
                    <li key={tutor.user_id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <img src={tutor.profile_picture_url || '/default-avatar.png'} alt={tutor.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="text-sm font-semibold">{tutor.name} {tutor.lastname || ''}</div>
                        <div className="text-xs text-gray-500 truncate" title={tutor.can_teach_subjects}>{tutor.can_teach_subjects || 'ไม่ระบุวิชา'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="วิชาที่สนใจ">
              {!profile.subjects?.length ? <Empty line="ยังไม่มีวิชา" /> : (
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {profile.subjects.map((s, i) => <li key={i}>{s.name}</li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAvatarModalOpen && <AvatarModal src={profile.avatarUrl} alt={profile.fullName} onClose={() => setIsAvatarModalOpen(false)} />}
      <ConfirmDialog open={confirm.open} title="ยืนยันการลบโพสต์" desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้" onConfirm={doDeletePost} onCancel={cancelDelete} />
      {showReviewModal && <Review postId={reviewTargetId} studentId={currentUser?.user_id} onClose={() => setShowReviewModal(false)} />}

      {/* Hidden Posts Modal */}
      <HiddenPostsModal
        open={showHiddenModal}
        onClose={() => setShowHiddenModal(false)}
        posts={posts}
        hiddenIds={hiddenPostIds}
        onRestore={handleRestorePost}
        onRestoreAll={handleRestoreAll}
      />
    </div>
  );
}

export default Profile;