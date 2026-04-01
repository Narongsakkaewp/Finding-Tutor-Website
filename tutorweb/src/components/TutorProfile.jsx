// src/components/TutorProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Edit, Star, MapPin, Phone, Trash2, EyeOff, Mail, GraduationCap, AppWindow, X, Archive, MoreVertical, Eye, Save, Flag, History, BookOpen, Clock, Calendar, Briefcase, Award, ChevronDown, ChevronUp } from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';
import ReportModal from "./ReportModal";
import { API_BASE } from '../config';
import { useTabRestoration, useScrollRestoration } from '../hooks/useRestoration';

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

const postGradeLevelOptions = [
    { value: "ประถมศึกษา", label: "ประถมศึกษา" },
    { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
    { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
    { value: "ปริญญาตรี", label: "ปริญญาตรี" },
    { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

const DateTimeDisplay = ({ daysStr, timesStr }) => {
    const days = daysStr ? daysStr.split(',').map(d => d.trim()) : [];
    return (
        <div className="flex flex-col gap-1.5">
            {days.length > 0 ? (
                days.map((day, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span className="font-semibold">{day}</span>
                        <span className="text-indigo-300">|</span>
                        <span>{timesStr || "ไม่ระบุเวลา"}</span>
                    </div>
                ))
            ) : (
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    <span>ไม่ระบุกำหนดการ</span>
                </div>
            )}
        </div>
    );
};

const ContactLink = ({ value }) => {
    if (!value) return <span className="text-gray-400 italic">ไม่ระบุ</span>;
    if (value.startsWith('http')) return <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline font-medium break-all">{value}</a>;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return <a href={`mailto:${value}`} className="text-indigo-600 hover:text-indigo-800 underline font-medium break-all">{value}</a>;
    if (/^[\d\s-]{9,15}$/.test(value)) return <a href={`tel:${value.replace(/[\s-]/g, '')}`} className="text-indigo-600 hover:text-indigo-800 underline font-medium">{value}</a>;
    return <span className="text-gray-800 break-all">{value}</span>;
};

const LocationLink = ({ value }) => {
    if (!value || value.trim() === '') return <span>ไม่ระบุ</span>;
    if (/ออนไลน์|online/i.test(value)) return <span>{value}</span>;
    return <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-teal-800 transition-colors" title="ดูแผนที่">{value}</a>;
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
                    src={review.reviewer?.avatar || "/../blank_avatar.jpg"}
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
            <div className="absolute right-2 top-8 z-20 w-40 overflow-hidden rounded-xl border bg-white shadow-xl animate-in fade-in zoom-in duration-100" onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                    <>
                        <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onEdit(); onClose(); }}
                        >
                            <Edit size={16} className="text-gray-500" /> แก้ไขโพสต์
                        </button>
                        <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onHide(); onClose(); }}
                        >
                            <EyeOff size={16} className="text-gray-500" /> ซ่อนโพสต์
                        </button>
                        <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                        >
                            <Trash2 size={16} /> ลบโพสต์
                        </button>
                    </>
                ) : (
                    <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onReport(); onClose(); }}
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

function TutorProfile({ setCurrentPage, onEditProfile, user, onOpenPost, onViewProfile }) {
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

    // ✅ Tabs State (Preserved)
    const [activeTab, setActiveTab] = useTabRestoration('tutor_profile', 'posts'); // 'posts' | 'history'

    // ✅ Scroll Restoration
    useScrollRestoration('tutor_profile', [tutorPosts, events, loading]);

    // ✅ Interactive Chips State
    const [expandedEdu, setExpandedEdu] = useState(new Set());
    const [expandedExp, setExpandedExp] = useState(new Set());

    const toggleEdu = (idx) => {
        setExpandedEdu(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleExp = (idx) => {
        setExpandedExp(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

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
                    fetch(`${API_BASE}/api/tutor-profile/${userId}`),
                    fetch(`${API_BASE}/api/tutor-posts?tutorId=${userId}`),
                    fetch(`${API_BASE}/api/calendar/${userId}`),
                    fetch(`${API_BASE}/api/tutors/${userId}/reviews`)
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
                    avatarUrl: profileData.profile_picture_url || "/../blank_avatar.jpg",
                    bio: profileData.about_me || "ยังไม่มีข้อมูลแนะนำตัว",
                    educationDisplay: profileData.education?.[0]?.institution || "ยังไม่ระบุสถานศึกษา",
                    address: profileData.address || null,
                    phone: profileData.phone || null,
                    email: profileData.email || null,
                    username: profileData.username || ""
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

    // ✅ Process Teaching History from Events
    const teachingHistory = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        return events.filter(ev => {
            const evDate = ev.event_date ? new Date(ev.event_date.split('T')[0] + 'T12:00:00Z') : (ev.created_at ? new Date(ev.created_at) : new Date(0));
            if (evDate > today) return false;

            return ev.source === 'tutor_offer_accepted' ||
                ev.source === 'tutor_teaching_self_post' ||
                ev.source === 'tutor_post_owner' ||
                (ev.source === 'calendar' && (ev.title?.startsWith('สอน') || ev.title?.startsWith('ติว')));
        }).map(ev => {
            const isSelfPost = ev.source === 'tutor_teaching_self_post' || ev.source === 'tutor_post_owner' || (ev.source === 'calendar' && ev.title?.toLowerCase().includes('สอนพิเศษ (ของคุณ)'));
            return {
                ...ev,
                typeLabel: isSelfPost ? 'สอนพิเศษ (ประกาศของคุณ)' : 'สอนพิเศษ (ยื่นข้อเสนอ)',
                icon: isSelfPost ? BookOpen : GraduationCap
            };
        }).sort((a, b) => {
            const dateA = new Date(a.event_date || a.created_at);
            const dateB = new Date(b.event_date || b.created_at);
            return dateB - dateA;
        });
    }, [events]);

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
            const res = await fetch(`${API_BASE}/api/tutor-posts/${editPost._id}`, {
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
        // อัปเดต UI ก่อนเพื่อความลื่นไหล (Optimistic Update)
        const after = tutorPosts.filter((p) => p._id !== id);
        setTutorPosts(after);

        try {
            const res = await fetch(`${API_BASE}/api/tutor-posts/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                // 🔥 แก้ตรงนี้: ส่ง user_id ไปด้วย เพื่อให้หลังบ้านยอมให้ลบ
                body: JSON.stringify({ user_id: currentUser.user_id })
            });

            if (!res.ok) {
                // ถ้าลบไม่สำเร็จ ให้เอาข้อมูลเดิมกลับมา และแจ้งเตือน
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to delete");
            }
        } catch (e) {
            console.error(e);
            setTutorPosts(before); // คืนค่าเดิมถ้า Error
            alert(`เกิดข้อผิดพลาด: ${e.message}`);
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">กำลังโหลดโปรไฟล์...</div>;
    if (!profile) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">ไม่พบข้อมูลผู้ใช้</div>;

    const hiddenCount = tutorPosts.filter(p => hiddenPostIds.has(p._id)).length;

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* --- Premium Header Section --- */}
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
                                    src={profile.avatarUrl}
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
                                        {profile.education.map((edu, idx) => {
                                            const isExpanded = expandedEdu.has(idx);
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => toggleEdu(idx)}
                                                    className={`flex flex-col gap-1 px-3 py-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${isExpanded ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-indigo-100 text-gray-600'}`}
                                                >
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Award size={14} className={isExpanded ? 'text-indigo-600' : 'text-indigo-500'} />
                                                        <span className={`font-black tracking-tight ${isExpanded ? 'text-indigo-900' : 'text-gray-700'}`}>{edu.institution}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span className={isExpanded ? 'text-indigo-700' : ''}>{edu.degree}</span>
                                                        {isExpanded ? <ChevronUp size={12} className="ml-1 text-indigo-400" /> : <ChevronDown size={12} className="ml-1 text-gray-400" />}
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 pl-6 pb-1">
                                                            {(edu.major || edu.faculty) && (
                                                                <div className="text-[12px] text-blue-800 font-bold">
                                                                    {edu.faculty && `${edu.faculty}`}
                                                                    {edu.faculty && edu.major && " • "}
                                                                    {edu.major && `${edu.major}`}
                                                                </div>
                                                            )}
                                                            {edu.year && (
                                                                <div className="text-[12px] font-medium text-blue-800 mt-0.5">
                                                                    Graduation Year: {edu.year}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {profile.teaching_experience && profile.teaching_experience.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {profile.teaching_experience.map((exp, idx) => {
                                            const isExpanded = expandedExp.has(idx);
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => toggleExp(idx)}
                                                    className={`flex flex-col gap-1 px-3 py-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${isExpanded ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-purple-50/40 border-purple-100/50 hover:border-purple-200 text-gray-600'}`}
                                                >
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Briefcase size={14} className={isExpanded ? 'text-purple-600' : 'text-purple-500'} />
                                                        <span className={`font-black tracking-tight ${isExpanded ? 'text-purple-900' : 'text-gray-700'}`}>{exp.title}</span>
                                                        {exp.duration && (
                                                            <>
                                                                <span className="text-gray-400">•</span>
                                                                <span className={`text-xs font-black ${isExpanded ? 'text-purple-700' : 'text-purple-500/80'}`}>{exp.duration}</span>
                                                            </>
                                                        )}
                                                        {isExpanded ? <ChevronUp size={12} className="ml-1 text-purple-400" /> : <ChevronDown size={12} className="ml-1 text-purple-300" />}
                                                    </div>
                                                    {isExpanded && exp.description && (
                                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 pl-6 pb-1 max-w-md">
                                                            <p className="text-xs text-purple-700/80 leading-relaxed font-medium">
                                                                {exp.description}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="max-w-2xl">
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    "{profile.bio}"
                                </p>
                            </div>

                            {/* Contact Chips */}
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors group cursor-pointer">
                                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <MapPin size={16} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-600">{profile.address || "กรุงเทพมหานคร"}</span>
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
                                    <span className="text-sm font-medium text-gray-600">{profile.email || "contact@tutor.com"}</span>
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
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">โพสต์</div>
                                    <div className="text-xl font-black text-gray-900">{tutorPosts.length}</div>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">เรตติ้ง</div>
                                    <div className="text-xl font-black text-gray-900">{averageRating.toFixed(1)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Main Content Area --- */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Column: Posts & History */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Tab Switcher */}
                        <div className="flex p-1.5 bg-white border border-gray-200 rounded-[2rem] shadow-sm max-w-md">
                            <button
                                onClick={() => setActiveTab('posts')}
                                className={`flex items-center justify-center gap-2 flex-1 py-3 px-6 rounded-[1.6rem] text-sm font-bold transition-all duration-300 ${activeTab === 'posts' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <BookOpen size={18} />
                                โพสต์ของฉัน ({tutorPosts.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center justify-center gap-2 flex-1 py-3 px-6 rounded-[1.6rem] text-sm font-bold transition-all duration-300 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <History size={18} />
                                ประวัติการสอน
                            </button>
                        </div>

                        {/* Content Tab */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-2">
                            {activeTab === 'posts' ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">โพสต์ของฉัน</h2>
                                        {hiddenCount > 0 && (
                                            <button
                                                onClick={() => setShowHiddenModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                                            >
                                                <Archive size={14} />
                                                โพสต์ที่ซ่อนไว้ ({hiddenCount})
                                            </button>
                                        )}
                                    </div>

                                    {tutorPosts.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-6">
                                            {tutorPosts.filter(p => !hiddenPostIds.has(p._id)).map((post) => (
                                                <div
                                                    key={post._id}
                                                    className="bg-white border border-gray-100 p-5 sm:p-6 rounded-[1.5rem] shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col relative group"
                                                    onClick={() => {
                                                        if (onOpenPost) onOpenPost(post._id, 'tutor');
                                                    }}
                                                >
                                                    {/* Decorative Highlight */}
                                                    <div className="absolute top-0 left-0 w-1.5 h-full" />

                                                    {/* Post Header */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            {profile?.avatarUrl && profile.avatarUrl !== "/../blank_avatar.jpg" ? (
                                                                <img src={profile.avatarUrl} alt="avatar" className="w-12 h-12 rounded-[1rem] object-cover shrink-0 border border-gray-100 group-hover:border-indigo-500 transition-colors" />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                                                                    {profile?.fullName ? profile.fullName.substring(0, 2).toUpperCase() : "U"}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="text-[15px] font-bold text-gray-900 group-hover:text-indigo-600 group-hover:underline transition-colors">{profile.fullName}</div>
                                                                {profile?.username && <div className="text-xs text-indigo-500 font-medium -mt-0.5 mb-0.5">@{profile.username}</div>}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-700">ติวเตอร์</span>
                                                                    <span className="text-xs text-gray-400">•</span>
                                                                    <span className="text-xs text-gray-500 font-medium">
                                                                        {new Date(post.createdAt).toLocaleString('th-TH')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleMenu(post._id);
                                                                }}
                                                                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors hover:text-gray-600"
                                                            >
                                                                <MoreVertical size={20} />
                                                            </button>
                                                            <PostActionMenu
                                                                open={openMenuFor === post._id}
                                                                onClose={() => setOpenMenuFor(null)}
                                                                onEdit={() => handleEditClick(post)}
                                                                onHide={() => handleHidePost(post._id)}
                                                                onDelete={() => handleAskDelete(post._id)}
                                                                onReport={() => handleReportClick(post)}
                                                                isOwner={true}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Post Body */}
                                                    <h3 className="text-xl font-black text-gray-900 mb-1">{post.subject}</h3>
                                                    <p className="mb-4 text-gray-700 whitespace-pre-line leading-relaxed text-[15px]">{post.content}</p>

                                                    <div className="space-y-3 mt-4 border-t border-gray-100 pt-4">
                                                        <div className="flex flex-wrap gap-2 text-sm mb-4">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/50 text-emerald-700 font-bold border border-emerald-100">
                                                                <span className="text-emerald-500 bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center font-black text-xs">฿</span>
                                                                {post.meta?.price || "0"} บาท/ชั่วโมง
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50/50 text-teal-700 font-bold border border-teal-100">
                                                                <MapPin size={16} className="shrink-0 text-teal-500" />
                                                                <LocationLink value={post.meta?.location} />
                                                            </span>
                                                        </div>

                                                        <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100/60 mb-3 text-sm">
                                                            <div className="flex items-center gap-2 font-bold text-indigo-900 mb-2">
                                                                <Calendar size={16} className="text-indigo-600" /> วันที่และเวลาสอน:
                                                            </div>
                                                            <div className="ml-6 text-indigo-800 font-medium">
                                                                <DateTimeDisplay daysStr={post.meta?.teaching_days} timesStr={post.meta?.teaching_time} />
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-2 text-sm">
                                                            <div className="flex items-center gap-2 bg-amber-50/40 p-3.5 rounded-xl border border-amber-100/60 text-sm">
                                                                <Mail size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                                                <div className="font-medium text-amber-900">
                                                                    <span className="font-bold">ข้อมูลติดต่อ: </span>
                                                                    <div onClick={(e) => e.stopPropagation()} className="inline-block"><ContactLink value={post.meta?.contact_info || profile?.phone || profile?.email} /></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expanding Space */}
                                                    <div className="flex-grow"></div>

                                                    {/* Post Footer */}
                                                    <div className="mt-6 flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-gray-50">
                                                        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-700 text-gray-500 font-bold shadow-sm transition-colors focus:outline-none">
                                                            ดูรายละเอียด
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white border-2 border-dashed border-gray-100 rounded-[3rem] py-20">
                                            <Empty line="คุณยังไม่มีโพสต์รับสอนในขณะนี้" />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">ประวัติการสอน</h2>
                                    {teachingHistory.length === 0 ? (
                                        <div className="bg-white border-2 border-dashed border-gray-100 rounded-[3rem] py-20">
                                            <Empty line="ยังไม่มีประวัติการสอนย้อนหลัง" />
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {teachingHistory.map((item, idx) => {
                                                const evtDate = item.event_date ? new Date(item.event_date.split('T')[0] + 'T12:00:00Z').toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' }) : (item.created_at ? new Date(item.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' }) : "");
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="bg-white border border-gray-100 p-5 sm:p-6 rounded-[1.5rem] shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col relative group"
                                                        onClick={() => {
                                                            if (onOpenPost && item.post_id) {
                                                                const type = item.post_type || (item.source?.includes('tutor_post') || item.source === 'tutor_self_teaching' || item.source === 'calendar_tutor' ? 'tutor_post' : 'student_post');
                                                                onOpenPost(item.post_id, type);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                {profile?.avatarUrl && profile.avatarUrl !== "/../blank_avatar.jpg" ? (
                                                                    <img src={profile.avatarUrl} alt="profile" className="w-12 h-12 rounded-[1rem] object-cover shrink-0 border border-gray-100 group-hover:border-indigo-500 transition-colors" />
                                                                ) : (
                                                                    <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                                                                        {profile?.fullName ? profile.fullName.substring(0, 2).toUpperCase() : "U"}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-bold text-gray-900 text-[15px] group-hover:text-indigo-600 group-hover:underline transition-colors">{profile?.fullName || "ผู้ใช้"}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-700">{item.typeLabel}</span>
                                                                        <span className="text-xs text-gray-400">•</span>
                                                                        <span className="text-xs text-gray-500 font-medium">
                                                                            {item.created_at ? new Date(item.created_at).toLocaleString("th-TH") : evtDate}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <h3 className="text-xl font-black text-gray-900 mb-1">{item.title}</h3>
                                                        <p className="mb-4 text-gray-700 whitespace-pre-line leading-relaxed text-[15px]">วิชา: {item.subject || "-"}</p>

                                                        <div className="space-y-3 mt-4 border-t border-gray-100 pt-4">
                                                            <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100/60 mb-3 text-sm">
                                                                <div className="flex items-center gap-2 font-bold text-indigo-900 mb-2">
                                                                    <Calendar size={16} className="text-indigo-600" /> วันที่และเวลาสอน:
                                                                </div>
                                                                <div className="ml-6 text-indigo-800 font-medium">
                                                                    <DateTimeDisplay daysStr={evtDate} timesStr={item.event_time ? item.event_time.substring(0, 5) : null} />
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-2 text-sm">
                                                                <div className="flex items-center gap-2 bg-teal-50/40 p-3.5 rounded-xl border border-teal-100/60 text-sm">
                                                                    <MapPin size={16} className="text-teal-600 mt-0.5 shrink-0" />
                                                                    <div className="font-medium text-teal-900">
                                                                        <span className="font-bold">สถานที่: </span>
                                                                        <div onClick={(e) => e.stopPropagation()} className="inline-block"><LocationLink value={item.location || "ออนไลน์"} /></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-grow"></div>

                                                        <div className="mt-6 flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-gray-50">
                                                            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-700 text-gray-500 font-bold shadow-sm transition-colors focus:outline-none">
                                                                ดูรายละเอียด
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Calendar Card */}
                        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm sticky top-6">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">ตารางสอน</h3>
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Calendar size={20} />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="calendar-container">
                                    <ReactCalendar
                                        className="border-none w-full !font-sans"
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
                                                    return "calendar-dot-highlight";
                                                }
                                            }
                                            return null;
                                        }}
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-[2rem] p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-indigo-600 font-black shadow-sm">
                                            {selectedDate.getDate()}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">กำหนดการ</div>
                                            <div className="text-sm font-black text-gray-900">
                                                {selectedDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>

                                    {!dailyEvents.length ? (
                                        <div className="py-10 text-center space-y-2">
                                            <div className="text-gray-300 flex justify-center"><Clock size={32} /></div>
                                            <p className="text-xs font-bold text-gray-400 ">ไม่มีกิจกรรมในวันนี้</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {dailyEvents.map((ev, index) => (
                                                <div key={ev.event_id || index} className="group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-all cursor-pointer"
                                                  onClick={() => {
                                                    if (onOpenPost && ev.post_id) {
                                                      const type = ev.post_type || (ev.source?.includes('tutor_post') || ev.source === 'tutor_self_teaching' || ev.source === 'calendar_tutor' ? 'tutor_post' : 'student_post');
                                                      onOpenPost(ev.post_id, type);
                                                    }
                                                  }}
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
                                                                    <MapPin size={10} /> {ev.location || "Online"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Reviews Card */}
                        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">รีวิวของคุณ</h3>
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                    <Star size={20} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-6 p-6 bg-amber-50/50 rounded-[2rem] border border-amber-100/50">
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-gray-900">{averageRating.toFixed(1)}</div>
                                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">Rating</div>
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex text-amber-400 mb-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={`avg-${i}`} size={16} className={i < Math.round(averageRating) ? "fill-current" : "text-gray-200"} />
                                            ))}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">จาก {reviews.length} รีวิว</div>
                                    </div>
                                </div>

                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {reviews.length > 0 ? (
                                        <>
                                            {reviews.slice(0, visibleReviews).map((review) => (
                                                <ReviewCard key={review.id} review={review} />
                                            ))}
                                            {reviews.length > 3 && (
                                                <button
                                                    onClick={handleToggleReviews}
                                                    className="w-full py-4 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-[1.4rem] transition-all duration-300"
                                                >
                                                    {visibleReviews < reviews.length ? "แสดงรีวิวทั้งหมด" : "ย่อการแสดงผล"}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-sm font-bold text-gray-400 ">ยังไม่มีรีวิวจากนักเรียน</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isAvatarModalOpen && <AvatarModal src={profile.avatarUrl} alt={profile.fullName} onClose={() => setIsAvatarModalOpen(false)} />}

            <ConfirmDialog
                open={confirm.open}
                title="ยืนยันการลบโพสต์"
                desc="เมื่อยืนยันแล้วจะไม่สามารถกู้คืนโพสต์นี้ได้"
                onConfirm={doDeletePost}
                onCancel={cancelDelete}
            />

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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้นที่สอน</label>
                                <select
                                    name="target_student_level"
                                    value={editForm.target_student_level || ""}
                                    onChange={handleEditChange}
                                    className="w-full border rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- ระบุระดับชั้น --</option>
                                    {postGradeLevelOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สอน</label>
                                    <input type="date" name="teaching_days" value={editForm.teaching_days || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่สอน</label>
                                    <input type="time" name="teaching_time" value={editForm.teaching_time || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท/ชม.)</label>
                                    <input type="number" name="price" min="0" value={editForm.price || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียนที่รับ (คน)</label>
                                    <input type="number" name="group_size" min="1" placeholder="1 = ตัวต่อตัว" value={editForm.group_size || ""} onChange={handleEditChange} required className="w-full border rounded-lg p-2.5 outline-none" />
                                </div>
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
