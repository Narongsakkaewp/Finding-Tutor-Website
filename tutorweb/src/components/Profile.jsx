import React, { useEffect, useMemo, useState } from "react";
import Review from "../components/Review";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, MoreVertical, Trash2, EyeOff, MapPin, Mail, Phone, GraduationCap, AppWindow, Star } from "lucide-react";

/* ---------- helpers ---------- */

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
    <div className="absolute right-2 top-8 z-20 w-40 overflow-hidden rounded-xl border bg-white shadow-xl">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
        onClick={() => { onHide(); onClose(); }}
      >
        <EyeOff size={16} /> ซ่อนโพสต์
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={16} /> ลบโพสต์
      </button>
    </div>
  );
}

/* ===== กล่องยืนยันลบ ===== */
function ConfirmDialog({ open, title = "ยืนยันการลบ", desc = "ลบโพสต์นี้ถาวรหรือไม่?", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-[92%] max-w-sm rounded-2xl border bg-white p-5 shadow-xl">
        <h4 className="text-lg font-bold">{title}</h4>
        <p className="mt-2 text-sm text-gray-600">{desc}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            ลบโพสต์
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarModal({ src, alt, onClose }) {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose} // กดที่พื้นหลังเพื่อปิด
    >
      <div
        className="relative max-w-lg w-full max-h-[80vh]"
        onClick={(e) => e.stopPropagation()} // ป้องกันการกดที่รูปแล้วปิด
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain rounded-lg shadow-xl"
        />
        {/* ปุ่มปิด (X) */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-lg hover:bg-gray-200 transition"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ---------- Main ---------- */

function Profile({ user, setCurrentPage, onEditProfile }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedTutors, setSavedTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]); // calendar events
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyEvents, setDailyEvents] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState(null); // เก็บ ID ติวเตอร์ที่จะรีวิว (Mockup ไปก่อนก็ได้)

  // ===== สำหรับเมนู/ซ่อน/ลบ
  const [openMenuFor, setOpenMenuFor] = useState(null);   // id ของการ์ดที่เปิดเมนู
  const [hiddenPostIds, setHiddenPostIds] = useState(new Set()); // id ที่ถูกซ่อน
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  // โหลดโปรไฟล์, โพสต์ และอีเวนต์
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = currentUser?.user_id || 0;

        // ----- โปรไฟล์ -----
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
            // --- ดึงข้อมูลจาก Schema ที่คุณระบุ ---
            const p = await pfRes.json();

            // สร้าง array การศึกษาจากฟิลด์ต่างๆ
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
              city: p.address || null, // ใช้ p.address
              school: p.institution ?? prof.school,
              email: p.email ?? prof.email, // email ที่ join มา
              phone: p.phone || null, // ใช้ p.phone
              subjects: p.subjects ?? prof.subjects,
              gradeLevel: p.grade_level ?? prof.gradeLevel,

              // --- ข้อมูลใหม่ที่ต้องการ ---
              bio: p.about || "", // แมพ 'about' ไปที่ 'bio'
              education: education, // array ที่สร้างขึ้น
            };
          }
        } catch { /* ใช้ข้อมูล localStorage หากโหลดไม่ได้ */ }

        if (!cancelled) setProfile(prof);

        // ----- โหลดโพสต์ -----
        const r = await fetch(`http://localhost:5000/api/student_posts?me=${me}&mine=1`);
        const data = await r.json();
        const onlyMine = Array.isArray(data)
          ? data.filter((p) => Number(p.owner_id) === Number(me))
          : [];
        const normalized = onlyMine.map(normalizePost);
        if (!cancelled) setPosts(normalized);

        // ----- โหลดกิจกรรม (calendar_events) -----
        const evRes = await fetch(`http://localhost:5000/api/calendar/${me}`);
        if (evRes.ok) {
          const evData = await evRes.json();
          if (!cancelled) setEvents(evData.items || []);
        }

        if (!cancelled) setSavedTutors([]);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.user_id]);

  // กรองกิจกรรมตามวันที่เลือก
  useEffect(() => {
    const todayISO = selectedDate.toISOString().slice(0, 10);
    const matches = events.filter((ev) => ev.event_date === todayISO);
    setDailyEvents(matches);
  }, [selectedDate, events]);

  // ===== handlers เมนู/ซ่อน/ลบ =====
  const handleToggleMenu = (id) => {
    setOpenMenuFor((prev) => (prev === id ? null : id));
  };

  const handleHidePost = (id) => {
    setHiddenPostIds((prev) => new Set(prev).add(id));
  };

  const handleAskDelete = (id) => setConfirm({ open: true, id });

  const doDeletePost = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null });

    // optimistic remove
    const before = posts;
    const after = posts.filter((p) => (p._id ?? p.id) !== id);
    setPosts(after);

    try {
      const res = await fetch(`http://localhost:5000/api/student_posts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setPosts(before);
        alert("ลบไม่สำเร็จ (API ลบยังไม่พร้อมหรือเกิดข้อผิดพลาด)");
      }
    } catch (e) {
      setPosts(before);
      alert("ลบไม่สำเร็จ (เครือข่ายผิดพลาด)");
    }
  };

  const cancelDelete = () => setConfirm({ open: false, id: null });

  const restoreAllHidden = () => setHiddenPostIds(new Set());
  const hiddenCount = hiddenPostIds.size;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        กำลังโหลดโปรไฟล์...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        ไม่พบข้อมูลผู้ใช้ (Server อาจไม่พร้อมใช้งาน)
      </div>
    );
  }

  const mockRecommendedTutors = [
    {
      user_id: 101,
      profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=S',
      name: 'สมศักดิ์',
      lastname: 'เก่งกาจ',
      can_teach_subjects: 'คณิตศาสตร์ ม.ปลาย, แคลคูลัส'
    },
    {
      user_id: 102,
      profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=A',
      name: 'อลิสา',
      lastname: 'ใจดี',
      can_teach_subjects: 'GAT ภาษาอังกฤษ, TOEIC'
    },
    {
      user_id: 103,
      profile_picture_url: 'https://placehold.co/40x40/E2E8F0/4A5568?text=N',
      name: 'นนทรี',
      lastname: 'บีทีเอส',
      can_teach_subjects: 'ฟิสิกส์ (PAT3), ตะลุยโจทย์'
    }
  ];

  const recommendLoading = false;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">

            {/* --- ส่วนซ้าย (รูป, ชื่อ, bio, การศึกษา, ติดต่อ) --- */}
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
                  {profile.nickname && (
                    <span className="text-gray-500 font-medium ml-2">
                      ({profile.nickname})
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 mt-1">
                  {profile.gradeLevel || "นักเรียน"}
                  {profile.school && ` • ${profile.school}`}
                </p>

                {/* --- ส่วน "การศึกษา" --- */}
                {profile.education && profile.education.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
                      <GraduationCap size={16} />
                      การศึกษาปัจจุบัน:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {profile.education.map((edu, index) => (
                        <li key={index} className="mt-1">
                          <span className="font-semibold">{edu.degree} ที่ {edu.institution}</span>
                          {edu.faculty && (
                            <div className="pl-5 text-gray-500">
                              คณะ {edu.faculty}
                            </div>
                          )}
                          {edu.major && (
                            <div className="pl-5 text-gray-500">
                              สาขา {edu.major}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* --- ส่วน "Bio" (เกี่ยวกับฉัน) --- */}
                <div>
                  <h4 className="flex items-center mt-3 border-t pt-3 gap-2 text-sm font-semibold text-gray-700 mb-1">
                    <AppWindow size={16} />
                    เกี่ยวกับฉัน:
                  </h4>
                  {profile.bio && (
                    <p className="pl-5 text-sm text-gray-700 whitespace-pre-line">
                      {profile.bio}
                    </p>
                  )}
                </div>


                {/* --- ส่วน "ข้อมูลติดต่อ" --- */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {/* Address */}
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5">
                      <MapPin size={16} className="text-gray-600" />
                    </div>
                    <span className="text-gray-700 truncate">{profile.city || "ยังไม่ระบุที่อยู่"}</span>
                  </div>
                  {/* Phone */}
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5">
                      <Phone size={16} className="text-gray-600" />
                    </div>
                    <a href={`tel:${profile.phone}`} className="text-gray-700 truncate hover:text-blue-600 hover:underline">
                      {profile.phone || "ยังไม่ระบุเบอร์"}
                    </a>
                  </div>
                  {/* Email */}
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5">
                      <Mail size={16} className="text-gray-600" />
                    </div>
                    <a href={`mailto:${profile.email}`} className="text-gray-700 truncate hover:text-blue-600 hover:underline">
                      {profile.email || "ยังไม่ระบุอีเมล"}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* --- ส่วนขวา (ปุ่มแก้ไข, Stats) --- */}
            <div className="md:ml-auto flex flex-col items-stretch md:items-end gap-3 self-start">
              <button
                onClick={onEditProfile}
                className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
              >
                <Edit size={16} /> แก้ไขโปรไฟล์
              </button>
              {/* ปุ่มรีวิว ทดสอบ */}
              <button
                onClick={() => {
                  console.log("Button Clicked!");
                  setReviewTargetId(16); // <--- ใส่เลข postId ของจริงที่มีใน DB เพื่อทดสอบ
                  setShowReviewModal(true);
                }}
                className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium border border-blue-200"
              >
                <Star size={17} /> เขียนรีวิว (Demo)
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
            <Card title="ตารางเวลาของฉัน">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex justify-center">
                  <ReactCalendar
                    className="border rounded-xl p-4 bg-white shadow-sm w-full max-w-sm"
                    locale="en-US"
                    value={selectedDate}
                    onClickDay={(value) => setSelectedDate(value)}
                    tileClassName={({ date, view }) => {
                      if (view === "month") {
                        const iso = date.toISOString().slice(0, 10);
                        if (events.some((ev) => ev.event_date === iso)) {
                          return "bg-blue-200 text-blue-800 font-semibold rounded-lg";
                        }
                      }
                      return null;
                    }}
                  />
                </div>

                <Card title="การติวของฉัน">
                  {!dailyEvents.length ? (
                    <Empty line="ยังไม่มีการติวในวันนี้" />
                  ) : (
                    <ul className="space-y-2">
                      {dailyEvents.map((ev) => (
                        <li
                          key={ev.event_id}
                          className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition"
                        >
                          <div className="font-semibold">{ev.title}</div>
                          <div className="text-sm text-gray-600">
                            📘 {ev.subject} — ⏰ {ev.event_time?.slice(0, 5)}<br />
                            📍 {ev.location || "ไม่ระบุสถานที่"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </Card>

            <Card title="โพสต์ของฉัน">
              {/* ปุ่มยกเลิกซ่อนทั้งหมด */}
              {hiddenCount > 0 && (
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={restoreAllHidden}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50"
                    title="นำโพสต์ที่ซ่อนทั้งหมดกลับมาแสดง"
                  >
                    แสดงโพสต์ที่ซ่อนทั้งหมด ({hiddenCount})
                  </button>
                </div>
              )}

              {!posts.length ? (
                <Empty line="ยังไม่มีโพสต์" />
              ) : (
                <div className="space-y-4">
                  {posts
                    .filter((p) => !hiddenPostIds.has(p._id ?? p.id))
                    .map((p) => {
                      const id = p._id ?? p.id;
                      return (
                        <div key={id} className="relative border rounded-xl p-4 bg-white shadow-sm">
                          {/* เมนูสามจุด */}
                          <button
                            onClick={() => handleToggleMenu(id)}
                            className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-gray-100"
                            aria-label="more"
                          >
                            <MoreVertical size={18} />
                          </button>
                          <PostActionMenu
                            open={openMenuFor === id}
                            onClose={() => setOpenMenuFor(null)}
                            onHide={() => handleHidePost(id)}
                            onDelete={() => handleAskDelete(id)}
                          />

                          {/* เนื้อหาโพสต์ */}
                          <div className="flex items-center gap-3">
                            <img
                              src={profile.avatarUrl || "/default-avatar.png"}
                              alt="avatar"
                              className="w-9 h-9 rounded-full object-cover"
                            />
                            <div>
                              <div className="text-sm font-semibold">{profile.fullName}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(p.createdAt).toLocaleString("th-TH")}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-gray-800 whitespace-pre-line">
                            {p.content}
                          </div>
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

            {/* --- 1. การ์ดติวเตอร์แนะนำ (แสดงผลจาก Mockup) --- */}
            <Card title="ติวเตอร์แนะนำสำหรับคุณ">
              {recommendLoading ? (
                <div className="text-sm text-gray-500">กำลังค้นหา...</div>
              ) : !mockRecommendedTutors.length ? (
                <Empty line="ไม่พบติวเตอร์แนะนำ" />
              ) : (
                <ul className="space-y-3">
                  {mockRecommendedTutors.map((tutor) => (
                    <li key={tutor.user_id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <img
                        src={tutor.profile_picture_url || '/default-avatar.png'}
                        alt={tutor.name || 'tutor'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold">{tutor.name} {tutor.lastname || ''}</div>
                        <div className="text-xs text-gray-500 truncate" title={tutor.can_teach_subjects}>
                          {tutor.can_teach_subjects || 'ไม่ระบุวิชา'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* --- 2. การ์ดวิชาที่สนใจ (แสดงผลจาก profile.subjects) --- */}
            <Card title="วิชาที่สนใจ">
              {!profile.subjects?.length ? (
                <Empty line="ยังไม่มีวิชา" />
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {profile.subjects.map((s, i) => (
                    <li key={i}>{s.name}</li>
                  ))}
                </ul>
              )}
            </Card>

          </div>
        </div>
      </div>

      {isAvatarModalOpen && (
        <AvatarModal
          src={profile.avatarUrl}
          alt={profile.fullName}
          onClose={() => setIsAvatarModalOpen(false)}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirm.open}
        title="ยืนยันการลบโพสต์"
        desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้"
        onConfirm={doDeletePost}
        onCancel={cancelDelete}
      />

      {showReviewModal && (
        <Review
          postId={reviewTargetId}
          studentId={currentUser?.user_id}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  );
}

export default Profile;
