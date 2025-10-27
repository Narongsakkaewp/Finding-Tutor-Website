import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, MoreVertical, Trash2, EyeOff } from "lucide-react";

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

/* ---------- Main ---------- */

function Profile({ user, setCurrentPage, onEditProfile }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedTutors, setSavedTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]); // calendar events
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyEvents, setDailyEvents] = useState([]);

  // ===== สำหรับเมนู/ซ่อน/ลบ
  const [openMenuFor, setOpenMenuFor] = useState(null);   // id ของการ์ดที่เปิดเมนู
  const [hiddenPostIds, setHiddenPostIds] = useState(new Set()); // id ที่ถูกซ่อน
  const [confirm, setConfirm] = useState({ open: false, id: null });

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
          contact: { email: currentUser?.email || "", phone: currentUser?.phone || "" },
          subjects: currentUser?.subjects || [],
        };

        try {
          const pfRes = await fetch(`http://localhost:5000/api/profile/${me}`);
          if (pfRes.ok) {
            const p = await pfRes.json();
            prof = {
              ...prof,
              fullName: fullNameOf(p) || prof.fullName,
              nickname: p.nickname ?? prof.nickname,
              avatarUrl: p.profile_picture_url || prof.avatarUrl,
              city: p.address ?? prof.city,
              school: p.institution ?? prof.school,
              contact: {
                email: p.email ?? prof.contact.email,
                phone: p.phone ?? prof.contact.phone,
              },
              subjects: p.subjects ?? prof.subjects,
              gradeLevel: p.grade_level ?? prof.gradeLevel,
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
        ไม่พบข้อมูลผู้ใช้ (กรุณาเข้าสู่ระบบ)
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-start gap-5 flex-grow">
              <img
                src={profile.avatarUrl || "/default-avatar.png"}
                alt={profile.fullName}
                className="h-28 w-28 rounded-2xl object-cover ring-4 ring-white shadow-md"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {profile.fullName}
                  {profile.nickname && (
                    <span className="text-gray-500 font-medium ml-2">
                      ({profile.nickname})
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 mt-1">
                  {profile.gradeLevel || "นักเรียน"} •{" "}
                  {profile.school || "โรงเรียน/มหาวิทยาลัย"}
                </p>
              </div>
            </div>
            <div className="md:ml-auto flex flex-col items-stretch md:items-end gap-3">
              <button
                onClick={onEditProfile}
                className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
              >
                <Edit size={16} /> แก้ไขโปรไฟล์
              </button>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="โพสต์ทั้งหมด" value={String(posts.length)} />
                <Stat label="โพสต์ติวเตอร์ที่สนใจ" value={String(savedTutors.length)} />
                <Stat label="โพสต์นักเรียนที่สนใจ" value={String(profile.subjects?.length || 0)} />
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
                    locale="th-TH"
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
            <Card title="ติวเตอร์แนะนำสำหรับคุณ">
              <Empty line="ยังไม่มีข้อมูลติวเตอร์แนะนำ" />
            </Card>
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

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirm.open}
        title="ยืนยันการลบโพสต์"
        desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้"
        onConfirm={doDeletePost}
        onCancel={cancelDelete}
      />
    </div>
  );
}

export default Profile;
