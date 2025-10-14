import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { User, MapPin, Mail, Phone, Edit } from "lucide-react";

/* Profile.jsx - หน้าข้อมูลโปรไฟล์ผู้ใช้ (student)*/
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

const fullNameOf = (u) => [u?.name || u?.first_name || "", u?.lastname || u?.last_name || ""].join(" ").trim();

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
  return <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-3">{line}</div>;
}

/* ---------- Main ---------- */

function Profile({ user, setCurrentPage, onEditProfile }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedTutors, setSavedTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = currentUser?.user_id || 0;

        // ✅ 1. แก้ไขค่าเริ่มต้นให้ตรงกับข้อมูลใน localStorage
        let prof = {
          avatarUrl: currentUser?.profile_picture_url || "/default-avatar.png", 
          fullName: fullNameOf(currentUser) || currentUser?.email || "ผู้ใช้",
          nickname: currentUser?.nickname || "",
          gradeLevel: currentUser?.grade_level || "นักเรียน", // ใช้ grade_level
          school: currentUser?.institution || "", // ใช้ institution
          city: currentUser?.address || "", // ใช้ address
          contact: { email: currentUser?.email || "", phone: currentUser?.phone || "" },
          subjects: currentUser?.subjects || [],
        };

        // Fetch ข้อมูลโปรไฟล์ล่าสุดจาก API
        try {
          const pfRes = await fetch(`http://localhost:5000/api/profile/${me}`);
          if (pfRes.ok) {
            const p = await pfRes.json();
            prof = {
              ...prof,
              fullName: fullNameOf(p) || prof.fullName,
              nickname: p.nickname ?? prof.nickname,
              // ✅ 2. จุดแก้ไขสำคัญ: ใช้ p.profile_picture_url แทน p.avatarUrl
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
        } catch {
          // ถ้า fetch ไม่สำเร็จ ก็จะใช้ข้อมูลจาก localStorage แทน
        }

        if (!cancelled) setProfile(prof);

        // โหลดโพสต์ของนักเรียน (เหมือนเดิม)
        const r = await fetch(`http://localhost:5000/api/student_posts?me=${me}&mine=1`);
        const data = await r.json();
        const onlyMine = Array.isArray(data)
          ? data.filter((p) => Number(p.owner_id) === Number(me))
          : [];
        const normalized = onlyMine.map(normalizePost);
        if (!cancelled) setPosts(normalized);

        // mock ติวเตอร์ที่บันทึก (เหมือนเดิม)
        if (!cancelled)
          setSavedTutors([
            // ... (ข้อมูล mock เดิม)
          ]);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.user_id]);

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
                    <span className="text-gray-500 font-medium ml-2">({profile.nickname})</span>
                  )}
                </h1>
                <p className="text-gray-600 mt-1">
                  {profile.gradeLevel || "นักเรียน"} •{" "}
                  {profile.school || "โรงเรียน/มหาวิทยาลัย"}
                </p>
              </div>
            </div>
            <div className="md:ml-auto flex flex-col items-stretch md:items-end gap-3">
              <div>
                <button
                  onClick={onEditProfile}
                  className="flex w-full justify-center md:w-auto items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
                >
                  <Edit size={16} /> แก้ไขโปรไฟล์
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="โพสต์" value={String(posts.length)} />
                <Stat label="ติวเตอร์ที่บันทึก" value={String(savedTutors.length)} />
                <Stat label="วิชาที่สนใจ" value={String(profile.subjects?.length || 0)} />
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
                    tileClassName={({ date, view }) => {
                      if (view === "month") {
                        const day = date.toLocaleDateString("en-US", { weekday: "long" });
                        if (profile.availability?.days?.includes(day)) {
                          return "bg-blue-100 text-blue-800 rounded-lg";
                        }
                        return "text-gray-600";
                      }
                    }}
                  />
                </div>
                <Card title="การติวของฉัน">
                  <div className="flex flex-col h-full">
                    <Empty line="ยังไม่มีการติวในวันนี้" />
                  </div>
                </Card>
              </div>
            </Card>
            <Card title="โพสต์ของฉัน">
              {!posts.length ? (
                <Empty line="ยังไม่มีโพสต์" />
              ) : (
                <div className="space-y-4">
                  {posts.map((p) => (
                    <div key={p._id} className="border rounded-xl p-4 bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <img
                          src={profile.avatarUrl || "/default-avatar.png"}
                          alt="avatar"
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-semibold">{profile.fullName}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(p.createdAt).toLocaleString('th-TH')}
                          </div>
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
                  ))}
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
    </div>
  );
}

export default Profile;