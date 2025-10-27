// src/components/TutorProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, Star, MapPin, Phone, Mail } from "lucide-react";

/* ---------- Helpers (สำหรับ Tutor) ---------- */

const normalizeTutorPost = (p = {}) => ({
    _id: p._id ?? p.tutor_post_id,
    subject: p.subject || "ไม่มีชื่อวิชา",
    content: p.content || p.description || "",
    createdAt: p.createdAt || p.created_at || new Date().toISOString(),
    meta: p.meta || {
        teaching_days: p.teaching_days || "",
        teaching_time: p.teaching_time || "",
        location: p.location || "",
        price: p.price || 0,
        contact_info: p.contact_info || ""
    }
});

const fullNameOf = (u) => [u?.name || "", u?.lastname || ""].join(" ").trim();

/* ---------- Subcomponents (นำมาจาก Profile.jsx เดิม) ---------- */

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

function ReviewCard({ review }) {
    return (
        <div className="border-b last:border-b-0 py-3">
            <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm">{review.studentName}</span>
                <div className="flex items-center text-xs text-gray-500">
                    <Star size={14} className="text-yellow-400 fill-current mr-1" />
                    <span>{review.rating.toFixed(1)}</span>
                </div>
            </div>
            <p className="text-sm text-gray-600">{review.comment}</p>
            <p className="text-xs text-gray-400 mt-1">{review.date}</p>
        </div>
    );
}

/* ---------- Main TutorProfile Component ---------- */

function TutorProfile({ setCurrentPage, onEditProfile }) {
    const [profile, setProfile] = useState(null);
    const [tutorPosts, setTutorPosts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!currentUser?.user_id) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const userId = currentUser.user_id;

                const [profileRes, postsRes] = await Promise.all([
                    fetch(`http://localhost:5000/api/tutor-profile/${userId}`),
                    fetch(`http://localhost:5000/api/tutor-posts?tutorId=${userId}`)
                ]);

                const profileData = await profileRes.json();
                const postsData = await postsRes.json();

                // Mock data สำหรับรีวิวและตารางการจอง
                const mockReviews = [
                    { studentName: "Yasin Warat", rating: 5, comment: "", date: "1 วันที่แล้ว" },
                    { studentName: "Narongsak Kw", rating: 4.5, comment: "", date: "5 วันที่แล้ว" },
                ];
                const mockBookings = [
                    { time: "10:30 - 13:00", subject: "English for Conversation", location: "Esplanade Ratchada" },
                    { time: "18:00 - 20:00", subject: "เริ่มต้น React", location: "ICT KMUTNB" },
                ];

                setProfile({
                    ...profileData, // เก็บข้อมูลดิบทั้งหมดที่ได้จาก API ไว้ด้วย
                    fullName: fullNameOf(profileData),
                    avatarUrl: profileData.profile_picture_url || "/default-avatar.png",
                    bio: profileData.about_me || "ยังไม่มีข้อมูลแนะนำตัว",
                    educationDisplay: profileData.education?.[0]?.institution || "ยังไม่ระบุสถานศึกษา", // สำหรับแสดงผลสั้นๆ
                    // เก็บข้อมูลติดต่อแยกไว้เพื่อให้เข้าถึงง่าย
                    address: profileData.address || null,
                    phone: profileData.phone || null,
                    email: profileData.email || null // email มาจาก join ตาราง register
                });

                setTutorPosts(Array.isArray(postsData.items) ? postsData.items.map(normalizeTutorPost) : []);
                setReviews(mockReviews);
                setBookings(mockBookings);
            } catch (err) { /* ... */ }
            finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">กำลังโหลดโปรไฟล์...</div>;
    }
    if (!profile) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">ไม่พบข้อมูลผู้ใช้ (กรุณาเข้าสู่ระบบ)</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
                <div className="bg-white rounded-3xl shadow-sm border p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex items-start gap-5 flex-grow">
                            <img
                                src={profile.avatarUrl}
                                alt={profile.fullName}
                                className="h-28 w-28 rounded-2xl object-cover ring-4 ring-white shadow-md"
                            />
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                    {profile.fullName}
                                    {profile.nickname && (
                                        <span className="text-gray-500 font-medium ml-2">({profile.nickname})</span>
                                    )}
                                </h1>
                                <p className="text-gray-600 mt-1">{profile.education && profile.education.length > 0 && (
                                    <div className="mt-3 border-t pt-3">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-1">ประวัติการศึกษา:</h4>
                                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                            {profile.education.map((edu, index) => (
                                                <li key={index}>
                                                    {edu.degree || 'N/A'} ที่ {edu.institution || 'N/A'}
                                                    {edu.major && ` (สาขา ${edu.major})`}
                                                    {edu.year && ` - ปี ${edu.year}`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}</p>
                                <p className="text-gray-600 mt-1">{profile.teaching_experience && profile.teaching_experience.length > 0 && (
                                    <div className="mt-3 border-t pt-3">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-1">ประสบการณ์ด้านการสอน:</h4>
                                        <ul className="space-y-2 text-sm text-gray-600">
                                            {profile.teaching_experience.map((exp, index) => (
                                                <li key={index}>
                                                    <p className="font-medium">{exp.title || 'N/A'} {exp.duration && `(${exp.duration})`}</p>
                                                    {exp.description && <p className="text-sm text-gray-700 pl-4">{exp.description}</p>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}</p>
                                <p className="mt-3 border-t pt-3 text-sm text-gray-700">{profile.bio}</p>
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    {/* Address */}
                                    <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
                                        <div className="flex-shrink-0 bg-gray-200 rounded p-1.5">
                                            <MapPin size={16} className="text-gray-600" />
                                        </div>
                                        <span className="text-gray-700 truncate">{profile.address || "ยังไม่ระบุที่อยู่"}</span>
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

                        <div className="md:ml-auto grid grid-cols items-end gap-3">
                            <button
                                onClick={onEditProfile}
                                className="flex w-full justify-center items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
                            >
                                <Edit size={16} /> แก้ไขโปรไฟล์
                            </button>
                            <div className="rounded-xl border bg-white px-3 py-2 text-center">
                                <div className="text-xs text-gray-500">โพสต์ทั้งหมด</div>
                                <div className="text-lg font-semibold">{String(tutorPosts.length)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content (ใช้ Layout เดิมของ Profile.jsx) */}
                <div className="mt-6 grid lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* ✅ Section: ตารางเวลาของฉัน (รวมปฏิทินและตารางการจองไว้ด้วยกัน) */}
                        <Card title="ตารางเวลาของฉัน">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                {/* Left: Calendar */}
                                {/* Left: Calendar */}
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
                                {/* Right: Booking List */}
                                <Card title="การติวของคุณ">
                                    <div className="flex flex-col h-full">
                                        {bookings.length > 0 ? (
                                            <div className="space-y-3">
                                                {bookings.map((booking, index) => (
                                                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                                        <p className="font-semibold text-red-800">{booking.time}</p>
                                                        <p className="text-sm text-gray-600">{booking.subject}</p>
                                                        <p className="text-xs text-gray-500">📍 {booking.location}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <Empty line="ยังไม่มีการจองในวันนี้" />
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </Card>

                        {/* Section: โพสต์ของฉัน */}
                        <Card title="โพสต์ของฉัน">
                            {tutorPosts.length > 0 ? (
                                <div className="space-y-4">
                                    {tutorPosts.map((post) => (
                                        <div key={post._id} className="border rounded-xl p-4 bg-white shadow-sm">
                                            {/* ส่วน Header ของโพสต์ (เหมือนเดิม) */}
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={profile.avatarUrl}
                                                    alt="avatar"
                                                    className="w-9 h-9 rounded-full object-cover"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold">{profile.fullName}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {/* ✅ ปรับ Format วันที่ให้เหมือนของนักเรียน */}
                                                        {new Date(post.createdAt).toLocaleString('th-TH')}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ส่วนเนื้อหา (เอาชื่อวิชาออกไปรวมกับ metadata ด้านล่าง) */}
                                            <div className="mt-2 text-gray-800 whitespace-pre-line">
                                                {post.content}
                                            </div>

                                            {/* ✅ ส่วน Metadata (ใช้ Layout แบบ grid เหมือนของนักเรียน) */}
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 mt-3">
                                                <div>📘 {post.subject || "-"}</div>
                                                <div>📅 {post.meta?.teaching_days || "-"}</div>
                                                <div>⏰ {post.meta?.teaching_time || "-"}</div>
                                                <div>📍 {post.meta?.location || "-"}</div>
                                                <div>💸 {post.meta?.price ? `${post.meta.price} บาท/ชม.` : "-"}</div>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            ) : <Empty line="คุณยังไม่มีโพสต์" />}
                        </Card>
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="space-y-6">
                        <Card title="รีวิวจากนักเรียน">
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-2xl font-bold">4.8</h4>
                                <div className="flex text-yellow-400">
                                    {[...Array(5)].map((_, i) => <Star key={`f-${i}`} size={18} className="fill-current" />)}
                                </div>
                                <span className="text-sm text-gray-500">({reviews.length} รีวิว)</span>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {reviews.map((review, index) => (
                                    <ReviewCard key={index} review={review} />
                                ))}
                            </div>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default TutorProfile;