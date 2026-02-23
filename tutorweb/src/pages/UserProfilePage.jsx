// tutorweb/src/pages/UserProfilePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Phone, MapPin, Clock, ArrowLeft, Star, Users, DollarSign, User, GraduationCap, BookOpen, Briefcase, Lightbulb, Calendar, MoreVertical, X, Eye, EyeOff, Flag } from 'lucide-react';
import ReportModal from '../components/ReportModal';

const API_BASE = "http://localhost:5000";

function UserProfilePage({ userId, onBack }) {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState("posts");
    const [userPosts, setUserPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // State
    const [isImageOpen, setIsImageOpen] = useState(false);
    const [showPhone, setShowPhone] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        if (!userId) return;
        fetchProfileData();
    }, [userId]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            setError("");

            // 1. Fetch Basic Info
            let res = await fetch(`${API_BASE}/api/profile/${userId}`);
            if (!res.ok) throw new Error("ไม่พบข้อมูลผู้ใช้นี้");

            let userData = await res.json();

            const realRole = (userData.type || userData.role || '').toLowerCase();
            const isTutorReal = realRole === 'tutor' || realRole === 'teacher';

            if (isTutorReal) {
                const resTutor = await fetch(`${API_BASE}/api/tutor-profile/${userId}`);
                if (resTutor.ok) {
                    userData = await resTutor.json();
                }
                userData.role = 'tutor';
            } else {
                userData.role = 'student';
            }

            userData.displayName = `${userData.name || userData.first_name} ${userData.lastname || userData.last_name}`;

            if (typeof userData.education === 'string') {
                try { userData.education = JSON.parse(userData.education); } catch { }
            }
            if (typeof userData.teaching_experience === 'string') {
                try { userData.teaching_experience = JSON.parse(userData.teaching_experience); } catch { }
            }

            setUser(userData);

            const [postsS, postsT] = await Promise.all([
                fetch(`${API_BASE}/api/student_posts?student_id=${userId}`).then(r => r.ok ? r.json() : []),
                fetch(`${API_BASE}/api/tutor-posts?tutorId=${userId}`).then(r => r.ok ? r.json().then(j => j.items) : [])
            ]);

            const list1 = (Array.isArray(postsS) ? postsS : []).map(p => ({ ...p, post_type: 'student', createdAt: p.createdAt || p.created_at }));
            const list2 = (Array.isArray(postsT) ? postsT : []).map(p => ({ ...p, post_type: 'tutor', createdAt: p.createdAt || p.created_at }));

            setUserPosts([...list1, ...list2].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

        } catch (err) {
            console.error(err);
            setError("ไม่พบข้อมูลผู้ใช้งาน");
        } finally {
            setLoading(false);
        }
    };

    // Hooks (useMemo)
    const derivedInterests = useMemo(() => {
        if (!user || user.role === 'tutor') return [];
        const subjects = userPosts
            .filter(p => p.post_type === 'student' && p.subject)
            .map(p => p.subject.trim());
        return [...new Set(subjects)];
    }, [userPosts, user]);

    const memberSince = useMemo(() => {
        if (!user?.created_at) return "-";
        try {
            return new Date(user.created_at).toLocaleDateString("th-TH", {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch { return "-"; }
    }, [user]);

    const latestEducation = useMemo(() => {
        if (!user) return "-";
        const isTutor = user.role === 'tutor';

        if (!isTutor || !Array.isArray(user.education) || user.education.length === 0) return "-";

        // Clone & Sort
        const sortedEdu = [...user.education].sort((a, b) => {
            return Number(b.year || 0) - Number(a.year || 0);
        });

        return sortedEdu[0].degree || "-";
    }, [user]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">กำลังโหลดข้อมูล...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500">{error}</div>;
    if (!user) return null;

    const isTutor = user.role === 'tutor';
    const reviews = user.reviews || [];

    return (
        <div className="min-h-screen bg-gray-50 pb-20 font-sans relative">
            {/* Navbar */}
            <div className="bg-white shadow-sm sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                    <ArrowLeft size={20} />
                </button>
                <span className="font-bold text-lg text-gray-800 truncate">{user.displayName}</span>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-8">

                {/* 1. Header Profile */}
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start mb-8">
                    {/* Image */}
                    <div
                        className="flex-shrink-0 relative group cursor-pointer"
                        onClick={() => setIsImageOpen(true)}
                        title="คลิกเพื่อดูรูปใหญ่"
                    >
                        <img
                            src={user.profile_picture_url || "/../blank_avatar.jpg"}
                            className="w-28 h-28 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:brightness-90"
                            alt="Profile"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/20 p-2 rounded-full backdrop-blur-sm">
                                <Users size={20} className="text-white" />
                            </div>
                        </div>

                        <span className={`absolute bottom-1 right-1 px-3 py-1 rounded-full text-xs font-bold uppercase text-white shadow-sm ${isTutor ? 'bg-indigo-600' : 'bg-rose-500'}`}>
                            {isTutor ? 'Tutor' : 'Student'}
                        </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex flex-wrap items-baseline gap-2">
                                    {user.displayName}
                                    {user.nickname && <span className="text-lg md:text-xl text-gray-500 font-medium">({user.nickname})</span>}
                                </h1>
                                {user.username && <div className="text-gray-500 font-medium text-base md:text-lg">@{user.username}</div>}
                            </div>

                            <button
                                onClick={() => setIsReportOpen(true)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                title="รายงานผู้ใช้"
                            >
                                <Flag size={20} />
                            </button>
                        </div>

                        {isTutor && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-700 font-bold text-sm">
                                <Star size={16} className="fill-yellow-500 text-yellow-500" />
                                {user.rating || "0.0"} ({reviews.length} รีวิว)
                            </div>
                        )}

                        <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm md:text-base">
                            {user.about_me || user.about || "ยังไม่ได้ระบุข้อมูลแนะนำตัว"}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Clock size={16} /> สมาชิกเมื่อ {memberSince}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Contact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-sm">

                    {/* Link: Address */}
                    <a
                        href={user.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(user.address)}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all ${user.address ? "hover:border-indigo-300 hover:shadow-md cursor-pointer" : "cursor-default opacity-80"}`}
                        onClick={(e) => !user.address && e.preventDefault()}
                    >
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                            <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-400 font-medium mb-0.5">ที่อยู่</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{user.address || "ยังไม่ระบุ"}</p>
                        </div>
                    </a>

                    {/* Phone */}
                    <div className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all ${user.phone ? "hover:border-green-300 hover:shadow-md" : "opacity-80"}`}>
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                            <Phone size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-400 font-medium mb-0.5">เบอร์โทรศัพท์</p>
                            <div className="flex items-center justify-between">
                                {user.phone ? (
                                    showPhone ? (
                                        <a href={`tel:${user.phone}`} className="text-sm font-semibold text-green-700 hover:underline">
                                            {user.phone}
                                        </a>
                                    ) : (
                                        <span className="text-sm font-semibold text-gray-800">
                                            {user.phone.substring(0, 3)}XXXXXXX
                                        </span>
                                    )
                                ) : (
                                    <p className="text-sm font-semibold text-gray-800">ยังไม่ระบุ</p>
                                )}

                                {user.phone && (
                                    <button
                                        onClick={() => setShowPhone(!showPhone)}
                                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                        title={showPhone ? "ซ่อนเบอร์โทร" : "ดูเบอร์โทร"}
                                    >
                                        {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all ${user.email ? "hover:border-blue-300 hover:shadow-md" : "opacity-80"}`}>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                            <Mail size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-400 font-medium mb-0.5">อีเมล</p>
                            <div className="flex items-start justify-between gap-2">
                                {user.email ? (
                                    showEmail ? (
                                        <a href={`mailto:${user.email}`} className="text-sm font-semibold text-blue-700 hover:underline break-all">
                                            {user.email}
                                        </a>
                                    ) : (
                                        <span className="text-sm font-semibold text-gray-800 break-all">
                                            {user.email.substring(0, 3)}***@***
                                        </span>
                                    )
                                ) : (
                                    <p className="text-sm font-semibold text-gray-800">ยังไม่ระบุ</p>
                                )}

                                {user.email && (
                                    <button
                                        onClick={() => setShowEmail(!showEmail)}
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                                        title={showEmail ? "ซ่อนอีเมล" : "ดูอีเมล"}
                                    >
                                        {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Education/Grade */}
                    <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                            {isTutor ? <GraduationCap size={18} /> : <BookOpen size={18} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-400 font-medium mb-0.5">
                                {isTutor ? "วุฒิการศึกษาสูงสุด" : "ระดับชั้น"}
                            </p>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {isTutor ? latestEducation : (user.grade_level || "-")}
                            </p>
                        </div>
                    </div>

                </div>

                {/* 3. Tabs & Content */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                    <div className="flex border-b border-gray-100">
                        {['posts', isTutor && 'reviews', 'about'].filter(Boolean).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                {tab === 'posts' && `โพสต์ประกาศ (${userPosts.length})`}
                                {tab === 'reviews' && `รีวิว (${reviews.length})`}
                                {tab === 'about' && 'ข้อมูลเพิ่มเติม'}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 md:p-8 bg-gray-50/30">

                        {/* TAB: POSTS */}
                        {activeTab === 'posts' && (
                            <div className="space-y-4">
                                {userPosts.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400">ยังไม่มีโพสต์ประกาศ</div>
                                ) : (
                                    userPosts.map(p => {
                                        const subject = p.subject;
                                        const date = p.meta?.preferred_days || p.preferred_days || p.meta?.teaching_days || p.teaching_days || "-";
                                        const time = p.meta?.preferred_time || p.preferred_time || p.meta?.teaching_time || p.teaching_time || "-";
                                        const location = p.meta?.location || p.location || "-";
                                        const price = p.meta?.budget || p.budget || p.meta?.price || p.price || p.hourly_rate;
                                        const groupSize = p.meta?.group_size || p.group_size;

                                        return (
                                            <div key={p.id || p._id || p.student_post_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={user.profile_picture_url || "/../blank_avatar.jpg"}
                                                            alt="avatar"
                                                            className="w-10 h-10 rounded-full object-cover border border-gray-100"
                                                        />
                                                        <div className="flex flex-col justify-center">
                                                            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                                                {user.displayName}
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.post_type === 'student' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    {p.post_type === 'student' ? 'หาครู' : 'รับสอน'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                                                                {user.username && (
                                                                    <>
                                                                        <span className="font-medium text-indigo-500">@{user.username}</span>
                                                                        <span className="text-gray-300">•</span>
                                                                    </>
                                                                )}
                                                                <span className="text-gray-400">{new Date(p.createdAt).toLocaleString("th-TH")}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </div>

                                                <div className="mb-4">
                                                    <h3 className="text-lg font-bold text-gray-800 mb-1">{subject}</h3>
                                                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{p.description || p.content}</p>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm text-gray-600 border-t border-gray-50 pt-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-1 h-4 bg-blue-400 rounded-full"></span>
                                                        <span className="font-medium text-gray-500 text-xs">วิชา :</span>
                                                        <span className="text-gray-800 truncate">{subject}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-indigo-400" />
                                                        <span className="font-medium text-gray-500 text-xs">วันที่สอน :</span>
                                                        <span className="text-gray-800">{date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-rose-400" />
                                                        <span className="font-medium text-gray-500 text-xs">เวลา :</span>
                                                        <span className="text-gray-800">{time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={16} className="text-rose-500" />
                                                        <span className="font-medium text-gray-500 text-xs">สถานที่ :</span>
                                                        <span className="text-gray-800 truncate">{location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <DollarSign size={16} className="text-emerald-500" />
                                                        <span className="font-medium text-gray-500 text-xs">ราคา :</span>
                                                        <span className="text-gray-800 font-bold">
                                                            {price ? `${Number(price).toLocaleString()} บาท/ชม.` : "-"}
                                                        </span>
                                                    </div>
                                                    {groupSize && (
                                                        <div className="flex items-center gap-2">
                                                            <Users size={16} className="text-blue-500" />
                                                            <span className="font-medium text-gray-500 text-xs">รับ :</span>
                                                            <span className="text-gray-800">{groupSize} คน</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* TAB: REVIEWS */}
                        {activeTab === 'reviews' && (
                            <div className="grid md:grid-cols-2 gap-5">
                                {reviews.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                                        <div className="bg-gray-100 p-4 rounded-full mb-3"><Star size={32} className="text-gray-300" /></div>
                                        <p>ยังไม่มีรีวิวในขณะนี้</p>
                                    </div>
                                ) : (
                                    reviews.map((r, i) => (
                                        <div key={i} className="relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
                                            {/* Decorative Quote Icon */}
                                            <div className="absolute top-2 right-4 text-9xl text-gray-50 opacity-[0.03] font-serif select-none pointer-events-none">"</div>

                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <img src={r.reviewer?.avatar || "/default-avatar.png"} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" alt="" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-900 text-sm">
                                                                {r.reviewer?.name || "ผู้ใช้งาน"}
                                                                {r.reviewer?.username && <span className="text-gray-500 font-normal ml-1">(@{r.reviewer?.username})</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</div>
                                                        </div>
                                                    </div>

                                                    {/* Subject Badge */}
                                                    {r.subject && (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 border border-indigo-100">
                                                            {r.subject}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1 mb-3">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} size={14} className={`${i < r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-200"}`} />
                                                    ))}
                                                </div>

                                                <p className="text-sm text-gray-600 leading-relaxed font-medium">"{r.comment}"</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB: ABOUT */}
                        {activeTab === 'about' && (
                            <div className="bg-white p-6 rounded-2xl border border-gray-100">
                                {isTutor ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><GraduationCap className="text-indigo-500" /> การศึกษา</h3>
                                            {Array.isArray(user.education) && user.education.length > 0 ? (
                                                user.education.map((e, idx) => (
                                                    <div key={idx} className="border-b last:border-0 pb-3 last:pb-0 border-gray-100">
                                                        <div className="font-bold text-gray-800">
                                                            {e.degree} {e.major && <span className="text-gray-500 font-normal"> - {e.major}</span>}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{e.institution} {e.year ? `(${e.year})` : ''}</div>
                                                    </div>
                                                ))
                                            ) : <p className="text-gray-400 text-sm">ไม่ระบุ</p>}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Briefcase className="text-green-500" /> ประสบการณ์สอน</h3>
                                            {Array.isArray(user.teaching_experience) && user.teaching_experience.length > 0 ? (
                                                user.teaching_experience.map((exp, idx) => (
                                                    <div key={idx} className="mb-3">
                                                        <div className="font-bold text-gray-800">{exp.title}</div>
                                                        <div className="text-sm text-gray-500">{exp.duration}</div>
                                                        <div className="text-sm text-gray-600 mt-1">{exp.description}</div>
                                                    </div>
                                                ))
                                            ) : <p className="text-gray-400 text-sm">ไม่ระบุ</p>}
                                        </div>
                                        <div className="mt-6 pt-4 border-t">
                                            <div className="text-xs text-gray-400 font-bold uppercase mb-2">วิชาที่สอน</div>
                                            <div className="flex flex-wrap gap-2">
                                                {(user.subjects || user.can_teach_subjects || "").split(',').filter(Boolean).map((s, i) => (
                                                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{s.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><GraduationCap className="text-indigo-500" /> ข้อมูลการศึกษา</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase">ระดับชั้น</div>
                                                <div className="text-gray-800">{user.grade_level || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase">โรงเรียน/สถาบัน</div>
                                                <div className="text-gray-800">{user.institution || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase">คณะ</div>
                                                <div className="text-gray-800">{user.faculty || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase">สาขาวิชา</div>
                                                <div className="text-gray-800">{user.major || "-"}</div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t">
                                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Lightbulb className="text-amber-500" /> วิชาที่สนใจ</h3>
                                            {derivedInterests.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {derivedInterests.map((s, i) => (
                                                        <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-sm font-medium">
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลเพียงพอให้วิเคราะห์ความสนใจ</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Image Modal */}
            {isImageOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsImageOpen(false)}
                >
                    <button
                        className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                        onClick={() => setIsImageOpen(false)}
                    >
                        <X size={28} />
                    </button>
                    <img
                        src={user.profile_picture_url || "/../blank_avatar.jpg"}
                        className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl scale-100"
                        alt="Full Size Profile"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Report Modal */}
            <ReportModal
                open={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                postType="profile"
                reportedUserId={user.user_id}
            />

        </div>
    );
}

export default UserProfilePage;