import React, { useEffect, useMemo, useState } from "react";
import {
  User, MapPin, Calendar, Clock, Coins, BookOpen, Link2, Mail,
  Phone, MessageSquare, Star, Heart, ChevronRight
} from "lucide-react";

/* ---------- helpers ---------- */

// แปลงโพสต์ฝั่ง server -> รูปแบบที่การ์ดในหน้านี้ใช้
const normalizePost = (p = {}) => ({
  _id: p._id ?? p.id ?? p.student_post_id,
  subject: p.subject || "",
  content: p.content || p.description || p.details || "",
  createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
  meta: {
    preferred_days: p.meta?.preferred_days ?? p.preferred_days ?? "",
    preferred_time: p.meta?.preferred_time ?? p.preferred_time ?? "",
    location:       p.meta?.location       ?? p.location       ?? "",
    group_size:     p.meta?.group_size     ?? p.group_size     ?? "",
    budget:         p.meta?.budget         ?? p.budget         ?? "",
  },
});

// ประกอบชื่อเต็มจากข้อมูลผู้ใช้
const fullNameOf = (u) =>
  [u?.name || u?.first_name || "", u?.lastname || u?.last_name || ""].join(" ").trim();

/* ---------- Subcomponents ---------- */

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border p-4 md:p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-3">
      <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium truncate">{value || "-"}</div>
      </div>
    </div>
  );
}

function LinkItem({ icon, label, value }) {
  const href = value?.startsWith("http") ? value : undefined;
  return (
    <a
      href={href || "#"}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      className="flex items-center gap-3 rounded-xl border p-3 hover:bg-gray-50"
      title={value}
    >
      <div className="h-8 w-8 rounded-lg bg-gray-50 border flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium truncate">{value || "-"}</div>
      </div>
    </a>
  );
}

function Empty({ line = "ไม่พบข้อมูล" }) {
  return <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-3">{line}</div>;
}

/* ---------- Main ---------- */

function Profile() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedTutors, setSavedTutors] = useState([]); // เผื่อใช้ในอนาคต
  const [loading, setLoading] = useState(true);

  // ผู้ใช้ที่ล็อกอิน (เก็บตอนล็อกอินไว้ใน localStorage key: "user")
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const me = currentUser?.user_id || currentUser?.id || 0;

        // 1) ดึงโพสต์ของนักเรียนจาก backend (ใช้ API ที่คุณมีอยู่แล้ว)
        //    GET /api/student_posts?me=<user_id>
        const postRes = await fetch(`http://localhost:5000/api/student_posts?me=${me}`);
        const postJson = await postRes.json();
        const list = Array.isArray(postJson)
          ? postJson
          : Array.isArray(postJson.items) ? postJson.items
          : Array.isArray(postJson.data)  ? postJson.data
          : [];
        setPosts(list.map(normalizePost));

        // 2) โปรไฟล์:
        //    ถ้ายังไม่มี /api/profile/:id ให้ประกอบจากข้อมูลที่ล็อกอินก่อน
        let baseProfile = {
          avatarUrl: currentUser?.profile_image || "/default-avatar.png",
          fullName: fullNameOf(currentUser) || currentUser?.email || "ผู้ใช้",
          nickname: currentUser?.nickname || "",
          gradeLevel: currentUser?.grade || "",
          school: currentUser?.school || "",
          city: currentUser?.city || "",
          bio: currentUser?.bio || "",
          tags: currentUser?.tags || [],
          contact: { email: currentUser?.email || "", phone: currentUser?.phone || "" },
          links: currentUser?.links || {},
          goals: currentUser?.goals || [],
          subjects: currentUser?.subjects || [],
          availability: currentUser?.availability || {},
          budget: currentUser?.budget || null,
          preferences: currentUser?.preferences || {},
        };

        // ถ้ามี endpoint โปรไฟล์ก็ลองโหลดทับ
        if (me) {
          try {
            const pfRes = await fetch(`http://localhost:5000/api/profile/${me}`);
            if (pfRes.ok) {
              const p = await pfRes.json();
              // map minimal fields ให้ชื่อแสดงตรงกับ DB
              baseProfile = {
                ...baseProfile,
                fullName: fullNameOf(p) || baseProfile.fullName,
                nickname: p.nickname || baseProfile.nickname,
                avatarUrl: p.avatarUrl || baseProfile.avatarUrl,
                city: p.city || baseProfile.city,
                school: p.school || baseProfile.school,
                contact: {
                  email: p.email || baseProfile.contact.email,
                  phone: p.phone || baseProfile.contact.phone,
                },
                availability: p.availability || baseProfile.availability,
                budget: p.budget || baseProfile.budget,
                preferences: p.preferences || baseProfile.preferences,
                tags: p.tags || baseProfile.tags,
                goals: p.goals || baseProfile.goals,
                subjects: p.subjects || baseProfile.subjects,
                links: p.links || baseProfile.links,
                bio: p.bio || baseProfile.bio,
              };
            }
          } catch { /* ถ้าไม่มี route ก็ใช้ข้อมูลที่มี */ }
        }

        setProfile(baseProfile);
        // saved tutors mock นิดหน่อย (คุณค่อยเปลี่ยนมาจาก backend ได้)
        setSavedTutors([
          {
            id: "t1",
            name: "ครูโบว์",
            subject: "คณิตศาสตร์ ม.ปลาย",
            rating: 4.9,
            reviews: 128,
            image:
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop"
          },
          {
            id: "t2",
            name: "พี่มอส",
            subject: "Physics ม.ปลาย",
            rating: 4.7,
            reviews: 89,
            image:
              "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop"
          }
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [currentUser]);

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
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">

        {/* Header card */}
        <div className="bg-white rounded-3xl shadow-sm border p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            <div className="flex items-end gap-4">
              <img
                src={profile.avatarUrl || "/default-avatar.png"}
                alt={`รูปโปรไฟล์ของ ${profile.fullName}`}
                className="h-28 w-28 md:h-32 md:w-32 rounded-2xl object-cover ring-4 ring-white shadow-md"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {profile.fullName}{" "}
                  {profile.nickname ? (
                    <span className="text-gray-500 font-medium">({profile.nickname})</span>
                  ) : null}
                </h1>
                <p className="text-gray-600 mt-1">
                  {profile.gradeLevel || "นักเรียน"} • {profile.school || "โรงเรียน/มหาวิทยาลัย"} • {profile.city || "เมือง"}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.tags || []).map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 border">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:ml-auto grid grid-cols-2 md:grid-cols-3 gap-2">
              <Stat label="ติวเตอร์ที่บันทึก" value={String(savedTutors.length)} />
              <Stat label="วิชาที่สนใจ" value={String(profile.subjects?.length || 0)} />
              <Stat label="โพสต์" value={String(posts.length)} />
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-4 text-gray-700 leading-relaxed">{profile.bio}</div>
          )}

          {/* Quick info */}
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoRow icon={<MapPin className="h-4 w-4" />}
              label="พื้นที่เรียน"
              value={
                profile.preferences?.mode === "in-person"
                  ? `${profile.city || "พื้นที่"} (${profile.preferences?.maxDistance || 5} กม.)`
                  : profile.preferences?.mode === "online"
                    ? "ออนไลน์"
                    : "ออนไลน์/นัดพบ"
              } />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="วันสะดวก" value={(profile.availability?.days || []).join(", ")} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="เวลาสะดวก" value={profile.availability?.time} />
            <InfoRow icon={<Coins className="h-4 w-4" />} label="งบประมาณ"
              value={
                profile.budget ? `฿${profile.budget.min} - ฿${profile.budget.max}/${profile.budget.unit}` : "-"
              } />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="อีเมล" value={profile.contact?.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="เบอร์โทร" value={profile.contact?.phone} />
          </div>
        </div>

        {/* Main sections */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Goals */}
            <Card title="เป้าหมายการเรียน">
              {!profile.goals?.length ? (
                <Empty line="ยังไม่ได้เพิ่มเป้าหมายการเรียน" />
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {profile.goals.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              )}
            </Card>

            {/* Subjects */}
            <Card title="วิชาที่สนใจ">
              {!profile.subjects?.length ? (
                <Empty line="ยังไม่มีรายการวิชา" />
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {profile.subjects.map((s, i) => (
                    <div key={i} className="border rounded-xl p-3 flex items-start gap-3">
                      <div className="shrink-0 h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          ระดับ: {s.level || "-"} • สถานะ: {s.status || "กำลังมองหาติวเตอร์"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Posts */}
            <Card title="โพสต์ของนักเรียน">
              {!posts.length ? (
                <Empty line="ยังไม่มีโพสต์" />
              ) : (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div key={p._id} className="border rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={profile.avatarUrl || "/default-avatar.png"}
                          alt="avatar"
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{profile.fullName} {profile.nickname ? `(${profile.nickname})` : ""}</div>
                          <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-line">
                        {p.content}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 text-xs text-gray-600 mt-2">
                        <div>📘 {p.subject || "-"}</div>
                        <div>📅 {p.meta?.preferred_days || "-"}</div>
                        <div>⏰ {p.meta?.preferred_time || "-"}</div>
                        <div>📍 {p.meta?.location || "-"}</div>
                        <div>👥 {p.meta?.group_size ?? "-"}</div>
                        <div>💸 {p.meta?.budget ? `฿${Number(p.meta.budget).toFixed(2)}` : "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Social links */}
            <Card title="ลิงก์/ติดต่อเพิ่มเติม">
              <div className="flex flex-col gap-2">
                {profile.links?.website && <LinkItem icon={<Link2 className="h-4 w-4" />} label="เว็บไซต์" value={profile.links.website} />}
                {profile.links?.line && <LinkItem icon={<MessageSquare className="h-4 w-4" />} label="LINE" value={profile.links.line} />}
                {profile.links?.facebook && <LinkItem icon={<User className="h-4 w-4" />} label="Facebook" value={profile.links.facebook} />}
              </div>
            </Card>

            {/* Saved tutors */}
            <Card title="ติวเตอร์ที่บันทึกไว้">
              {!savedTutors.length ? (
                <Empty line="ยังไม่มีติวเตอร์ที่บันทึก" />
              ) : (
                <div className="space-y-3">
                  {savedTutors.map((t) => (
                    <button key={t.id} className="w-full text-left border rounded-xl p-3 hover:bg-gray-50 transition">
                      <div className="flex gap-3">
                        <img src={t.image} alt={t.name} className="h-12 w-12 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{t.name}</div>
                          <div className="text-xs text-gray-600 truncate">{t.subject}</div>
                          <div className="flex items-center gap-2 text-xs text-amber-600 mt-1">
                            <Star className="h-3.5 w-3.5" />
                            {t.rating.toFixed(1)} <span className="text-gray-400">({t.reviews})</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 text-gray-500">
                          <Heart className="h-4 w-4" />
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Profile;