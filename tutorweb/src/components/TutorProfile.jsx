// src/components/TutorProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, Star, MapPin, Phone, Trash2, EyeOff, Mail, GraduationCap, AppWindow, X, Archive, MoreVertical, Eye, Save, Flag } from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';
import ReportModal from "./ReportModal";

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
    return <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-3">{line}</div>;
}

function ReviewCard({ review }) {
    return (
        <div className="border-b last:border-b-0 py-4">
            <div className="flex items-start gap-3">
                <img
                    src={review.reviewer?.avatar || "/default-avatar.png"}
                    alt="student"
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                />
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm text-gray-900">
                            {review.reviewer?.name || "ไม่ระบุชื่อ"}
                        </span>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-bold text-yellow-700">{Number(review.rating).toFixed(1)}</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                    <p className="text-xs text-gray-400 mt-2">
                        {new Date(review.createdAt).toLocaleDateString('th-TH', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* Modal จัดการโพสต์ที่ซ่อน */
function HiddenPostsModal({ open, onClose, posts, hiddenIds, onRestore, onRestoreAll }) {
    if (!open) return null;
    const hiddenPosts = posts.filter(p => hiddenIds.has(p._id));

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
                                <div key={p._id} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800 truncate">{p.subject || "(ไม่มีหัวข้อ)"}</span>
                                            <span className="text-xs text-gray-400">• {new Date(p.createdAt).toLocaleDateString("th-TH")}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-1">{p.content}</p>
                                    </div>
                                    <button onClick={() => onRestore(p._id)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition whitespace-nowrap">
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
                <button onClick={onClose} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-lg hover:bg-gray-200 transition" aria-label="Close">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}

/* ---------- Main TutorProfile Component ---------- */

function TutorProfile({ setCurrentPage, onEditProfile }) {
    const [profile, setProfile] = useState(null);
    const [tutorPosts, setTutorPosts] = useState([]);

    const [reviews, setReviews] = useState([]);
    const [visibleReviews, setVisibleReviews] = useState(3);
    const [averageRating, setAverageRating] = useState(0);
    const [avgPunctuality, setAvgPunctuality] = useState(0);
    const [avgWorth, setAvgWorth] = useState(0);
    const [avgTeaching, setAvgTeaching] = useState(0);

    const [events, setEvents] = useState([]);
    const [dailyEvents, setDailyEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [loading, setLoading] = useState(true);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

    // State สำหรับซ่อน/ลบ/เมนู
    const [openMenuFor, setOpenMenuFor] = useState(null);
    const [showHiddenModal, setShowHiddenModal] = useState(false);
    const [confirm, setConfirm] = useState({ open: false, id: null });

    // ✅ State สำหรับแก้ไขโพสต์
    const [editPost, setEditPost] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [updating, setUpdating] = useState(false);
    const [reportingPost, setReportingPost] = useState(null);

    // โหลด Hidden Posts จาก localStorage
    const [hiddenPostIds, setHiddenPostIds] = useState(() => {
        try {
            const saved = localStorage.getItem("hiddenTutorPosts");
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const currentUser = useMemo(() => {
        try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
    }, []);

    useEffect(() => {
        if (!currentUser?.user_id) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const userId = currentUser.user_id;

                const [profileRes, postsRes, calendarRes, reviewsRes] = await Promise.all([
                    fetch(`http://localhost:5000/api/tutor-profile/${userId}`),
                    fetch(`http://localhost:5000/api/tutor-posts?tutorId=${userId}`),
                    fetch(`http://localhost:5000/api/calendar/${userId}`),
                    fetch(`http://localhost:5000/api/tutors/${userId}/reviews`)
                ]);

                const profileData = await profileRes.json();
                const postsData = await postsRes.json();

                if (calendarRes.ok) {
                    const calData = await calendarRes.json();
                    setEvents(calData.items || []);
                }

                if (reviewsRes.ok) {
                    const reviewsData = await reviewsRes.json();
                    setReviews(reviewsData);
                    setVisibleReviews(3);

                    if (reviewsData.length > 0) {
                        const total = reviewsData.reduce((sum, r) => sum + r.rating, 0);
                        const totalPunc = reviewsData.reduce((sum, r) => sum + (r.rating_punctuality || r.rating), 0);
                        const totalWorth = reviewsData.reduce((sum, r) => sum + (r.rating_worth || r.rating), 0);
                        const totalTeach = reviewsData.reduce((sum, r) => sum + (r.rating_teaching || r.rating), 0);

                        setAverageRating(total / reviewsData.length);
                        setAvgPunctuality(totalPunc / reviewsData.length);
                        setAvgWorth(totalWorth / reviewsData.length);
                        setAvgTeaching(totalTeach / reviewsData.length);
                    } else {
                        setAverageRating(0);
                        setAvgPunctuality(0);
                        setAvgWorth(0);
                        setAvgTeaching(0);
                    }
                }

                setProfile({
                    ...profileData,
                    fullName: fullNameOf(profileData),
                    avatarUrl: profileData.profile_picture_url || "/default-avatar.png",
                    bio: profileData.about_me || "ยังไม่มีข้อมูลแนะนำตัว",
                    educationDisplay: profileData.education?.[0]?.institution || "ยังไม่ระบุสถานศึกษา",
                    address: profileData.address || null,
                    phone: profileData.phone || null,
                    email: profileData.email || null
                });

                setTutorPosts(Array.isArray(postsData.items) ? postsData.items.map(normalizeTutorPost) : []);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    useEffect(() => {
        const selectedDateStr = toLocalYMD(selectedDate);
        const matches = events.filter((ev) => {
            if (!ev.event_date) return false;
            const d = new Date(ev.event_date);
            return toLocalYMD(d) === selectedDateStr;
        });
        setDailyEvents(matches);
    }, [selectedDate, events]);

    const handleToggleReviews = () => {
        if (visibleReviews < reviews.length) {
            setVisibleReviews(prev => prev + 3);
        } else {
            setVisibleReviews(3);
        }
    };

    // Handlers จัดการโพสต์
    const handleToggleMenu = (id) => setOpenMenuFor((prev) => (prev === id ? null : id));

    const handleHidePost = (id) => {
        setHiddenPostIds((prev) => {
            const newSet = new Set(prev).add(id);
            localStorage.setItem("hiddenTutorPosts", JSON.stringify([...newSet]));
            return newSet;
        });
    };

    const handleRestorePost = (id) => {
        setHiddenPostIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            localStorage.setItem("hiddenTutorPosts", JSON.stringify([...newSet]));
            return newSet;
        });
    };

    const handleRestoreAll = () => {
        setHiddenPostIds(new Set());
        localStorage.removeItem("hiddenTutorPosts");
        setShowHiddenModal(false);
    };

    // --- Edit Handlers ---
    const handleEditClick = (post) => {
        setEditPost(post);
        setEditForm({
            subject: post.subject,
            description: post.content,
            teaching_days: post.meta?.teaching_days || "",
            teaching_time: post.meta?.teaching_time || "",
            location: post.meta?.location || "",
            price: post.meta?.price || "",
            target_student_level: "", // Not explicitly in normalizeTutorPost, might be missing in UI
            group_size: "", // Not explicitly in normalizeTutorPost
            contact_info: post.meta?.contact_info || profile?.phone || profile?.email || "",
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
            const res = await fetch(`http://localhost:5000/api/tutor-posts/${editPost._id}`, {
                method: "PUT", // Typo fixed in backend route: /api/tutor-posts/:id
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: editForm.subject,
                    description: editForm.description,
                    teaching_days: editForm.teaching_days,
                    teaching_time: editForm.teaching_time,
                    target_student_level: editForm.target_student_level,
                    location: editForm.location,
                    price: editForm.price,
                    group_size: editForm.group_size,
                    contact_info: editForm.contact_info
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Update failed");

            // Update local state
            setTutorPosts(prev => prev.map(p => {
                if (p._id === editPost._id) {
                    return {
                        ...p,
                        subject: editForm.subject,
                        content: editForm.description,
                        meta: {
                            ...p.meta,
                            teaching_days: editForm.teaching_days,
                            teaching_time: editForm.teaching_time,
                            location: editForm.location,
                            price: editForm.price,
                            contact_info: editForm.contact_info
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

        const before = [...tutorPosts];
        const after = tutorPosts.filter((p) => p._id !== id);
        setTutorPosts(after);

        try {
            const res = await fetch(`http://localhost:5000/api/tutor-posts/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                throw new Error("Failed to delete");
            }
        } catch (e) {
            console.error(e);
            setTutorPosts(before);
            alert("เกิดข้อผิดพลาดในการลบโพสต์");
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">กำลังโหลดโปรไฟล์...</div>;
    if (!profile) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">ไม่พบข้อมูลผู้ใช้</div>;

    const hiddenCount = tutorPosts.filter(p => hiddenPostIds.has(p._id)).length;

    return (<div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
            {/* Header Profile */}
            <div className="bg-white rounded-3xl shadow-sm border p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex items-start gap-5 flex-grow">
                        <img src={profile.avatarUrl} alt={profile.fullName} className="h-28 w-28 rounded-2xl object-cover ring-4 ring-white shadow-md cursor-pointer hover:opacity-80 transition" onClick={() => setIsAvatarModalOpen(true)} />
                        <div>
                            <h1 className="flex items-center text-2xl md:text-3xl font-bold tracking-tight">
                                {profile.fullName}
                                {profile.nickname && <span className="text-gray-500 font-medium ml-2">({profile.nickname})</span>}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {profile.education && profile.education.length > 0 && (
                                    <div className="mt-3 border-t pt-3">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                            <GraduationCap size={16} /> ประวัติการศึกษา:
                                        </h4>
                                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                            {profile.education.map((edu, index) => (
                                                <li key={index}>{edu.degree || 'N/A'} ที่ {edu.institution || 'N/A'} {edu.major && ` (สาขา ${edu.major})`}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </p>
                            <div className="mt-3 border-t pt-3">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2"><AppWindow size={16} /> เกี่ยวกับฉัน:</h4>
                                <p className="text-sm text-gray-700 whitespace-pre-line pl-6">{profile.bio}</p>
                            </div>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                <a href={profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : "#"} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 border rounded-lg p-2 bg-gray-50 transition-colors ${profile.address ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`} onClick={(e) => !profile.address && e.preventDefault()}>
                                    <div className="flex-shrink-0 bg-gray-200 rounded p-1.5"><MapPin size={16} className="text-gray-600" /></div>
                                    <span className="text-gray-700 truncate">{profile.address || "ยังไม่ระบุที่อยู่"}</span>
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
                    <div className="md:ml-auto flex flex-col gap-3 items-end self-end md:self-start">
                        <button onClick={onEditProfile} className="flex w-full justify-center items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium">
                            แก้ไขโปรไฟล์
                        </button>
                        <div className="rounded-xl border bg-white px-3 py-2 text-center w-full">
                            <div className="text-xs text-gray-500">โพสต์ทั้งหมด</div>
                            <div className="text-lg font-semibold">{String(tutorPosts.length)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* 1. ตารางสอน */}
                <div className="lg:col-span-2 w-full">
                    <Card title="ตารางสอนของฉัน">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="flex justify-center">
                                <ReactCalendar
                                    className="border rounded-xl p-4 bg-white shadow-sm w-full max-w-sm"
                                    locale="en-US"
                                    value={selectedDate}
                                    onClickDay={(value) => setSelectedDate(value)}
                                    tileClassName={({ date, view }) => {
                                        if (view === "month") {
                                            const tileDateStr = toLocalYMD(date);
                                            if (events.some((ev) => {
                                                if (!ev.event_date) return false;
                                                const d = new Date(ev.event_date);
                                                return toLocalYMD(d) === tileDateStr;
                                            })) {
                                                return "bg-blue-200 text-blue-800 font-semibold rounded-lg";
                                            }
                                        }
                                        return null;
                                    }}
                                />
                            </div>
                            {/* ✅ ปรับ UI ส่วนนี้ให้เหมือนของนักเรียน (กล่องสีเทา + Header) */}
                            <div className="bg-gray-50 rounded-xl p-4 border h-full">
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <AppWindow size={18} />
                                    ตารางสอนวันที่ {selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                </h4>
                                {!dailyEvents.length ? (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        ไม่มีการติวในวันนี้
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {dailyEvents.map((ev, index) => (
                                            <li key={ev.event_id || index} className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition">
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
                </div>

                {/* 2. รีวิว */}
                <div className="lg:col-span-1 lg:row-span-2 w-full">
                    <Card title="รีวิวจากนักเรียน">
                        <div className="flex items-center gap-3 mb-4 border-b pb-4">
                            <h4 className="text-4xl font-extrabold text-gray-900">{averageRating.toFixed(1)}</h4>
                            <div className="flex flex-1 items-center justify-between">
                                <div className="flex text-yellow-400 gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={`avg-${i}`} size={18} className={i < Math.round(averageRating) ? "fill-current" : "text-gray-300"} />
                                    ))}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">(ทั้งหมด {reviews.length} รีวิว)</span>
                            </div>
                        </div>

                        {/* Detailed Ratings Breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-3 rounded-xl">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">ความตรงต่อเวลา</div>
                                <div className="flex items-center justify-center gap-1 text-yellow-600 font-bold">
                                    <Star size={14} className="fill-yellow-500 text-yellow-500" /> {avgPunctuality.toFixed(1)}
                                </div>
                            </div>
                            <div className="text-center border-l border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">ความคุ้มค่า</div>
                                <div className="flex items-center justify-center gap-1 text-yellow-600 font-bold">
                                    <Star size={14} className="fill-yellow-500 text-yellow-500" /> {avgWorth.toFixed(1)}
                                </div>
                            </div>
                            <div className="text-center border-l border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">เนื้อหาที่สอน</div>
                                <div className="flex items-center justify-center gap-1 text-yellow-600 font-bold">
                                    <Star size={14} className="fill-yellow-500 text-yellow-500" /> {avgTeaching.toFixed(1)}
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {reviews.length > 0 ? (
                                <>
                                    {reviews.slice(0, visibleReviews).map((review) => (
                                        <ReviewCard key={review.id} review={review} />
                                    ))}
                                    {reviews.length > 3 && (
                                        <button
                                            onClick={handleToggleReviews}
                                            className="w-full py-3 mt-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                        >
                                            {visibleReviews < reviews.length
                                                ? `แสดงเพิ่มเติม (${Math.min(3, reviews.length - visibleReviews)} รายการ)`
                                                : "แสดงน้อยลง"}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8 text-gray-500">ยังไม่มีรีวิวในขณะนี้</div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* 3. โพสต์รับสอน */}
                <div className="lg:col-span-2 w-full">
                    <Card title="โพสต์รับสอนของฉัน">
                        {/* ปุ่มเปิดรายการที่ซ่อน */}
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

                        {tutorPosts.length > 0 ? (
                            <div className="space-y-4">
                                {tutorPosts.filter(p => !hiddenPostIds.has(p._id)).map((post) => {
                                    const id = post._id;
                                    return (
                                        <div key={id} className="relative border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">

                                            <button onClick={() => handleToggleMenu(id)} className="absolute right-2 top-2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                                <MoreVertical size={18} />
                                            </button>
                                            <PostActionMenu
                                                open={openMenuFor === id}
                                                onClose={() => setOpenMenuFor(null)}
                                                onEdit={() => handleEditClick(post)}
                                                onHide={() => handleHidePost(id)}
                                                onDelete={() => handleAskDelete(id)}
                                                onReport={() => handleReportClick(post)}
                                                isOwner={true} // As per previous reasoning, TutorProfile is likely "My Profile".
                                            />

                                            <div className="flex items-center gap-3">
                                                <img src={profile.avatarUrl} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
                                                <div>
                                                    <div className="text-sm font-semibold">{profile.fullName}</div>
                                                    <div className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString('th-TH')}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-gray-800 whitespace-pre-line">{post.content}</div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 mt-3">
                                                <div><span className="font-bold">📘 วิชา :</span> {post.subject || "-"}</div>
                                                <div><span className="font-bold">📅 วันที่สอน :</span> {post.meta?.teaching_days || "-"}</div>
                                                <div><span className="font-bold">⏰ เวลา :</span> {post.meta?.teaching_time || "-"}</div>
                                                <div><span className="font-bold">📍 สถานที่ :</span> {post.meta?.location || "-"}</div>
                                                <div><span className="font-bold">💸 ราคา :</span> {post.meta?.price ? `${post.meta.price} บาท/ชม.` : "-"}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <Empty line="คุณยังไม่มีโพสต์รับสอน" />}
                    </Card>
                </div>

            </div>
        </div>

        {/* Modals */}
        {isAvatarModalOpen && <AvatarModal src={profile.avatarUrl} alt={profile.fullName} onClose={() => setIsAvatarModalOpen(false)} />}
        <ConfirmDialog open={confirm.open} title="ยืนยันการลบโพสต์" desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้" onConfirm={doDeletePost} onCancel={cancelDelete} />

        <HiddenPostsModal
            open={showHiddenModal}
            onClose={() => setShowHiddenModal(false)}
            posts={tutorPosts}
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
                        <h3 className="text-xl font-bold text-gray-900">แก้ไขโพสต์รับสอน</h3>
                        <button onClick={() => setEditPost(null)} className="p-1 rounded-full hover:bg-gray-100">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleUpdatePost} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วิชาที่สอน</label>
                            <input type="text" name="subject" value={editForm.subject || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดการสอน / แนะนำตัว</label>
                            <textarea name="description" rows="3" value={editForm.description || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สอน</label>
                                <input type="text" name="teaching_days" placeholder="เช่น จันทร์-ศุกร์" value={editForm.teaching_days || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สอน</label>
                                <input type="text" name="teaching_time" placeholder="เช่น 09:00 - 12:00" value={editForm.teaching_time || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท/ชม.)</label>
                            <input type="number" name="price" min="0" value={editForm.price || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่สอน</label>
                            <LongdoLocationPicker
                                onLocationSelect={handleEditLocationSelect}
                                defaultLocation={editForm.location}
                                showMap={false}
                            />
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
            postId={reportingPost?._id || reportingPost?.tutor_post_id}
            postType="tutor_post"
        />
    </div>
    );
}

export default TutorProfile;