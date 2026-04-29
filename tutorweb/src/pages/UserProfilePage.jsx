import React, { useEffect, useMemo, useState } from "react";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  Lightbulb,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Star,
  Users,
  X,
} from "lucide-react";
import ReportModal from "../components/ReportModal";
import { API_BASE as API_URL } from "../config";

const formatScheduleTime24 = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text || "-";
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]), 0);
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatScheduleTimesList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => formatScheduleTime24(item))
    .filter(Boolean)
    .join(", ");

const toCalendarKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeCalendarPostType = (value) =>
  String(value || "").toLowerCase().includes("tutor") ? "tutor_post" : "student_post";

const normalizeUserPosts = (studentPosts = [], tutorPosts = []) => {
  const list1 = (Array.isArray(studentPosts) ? studentPosts : []).map((p) => ({
    ...p,
    id: p.id ?? p._id ?? p.student_post_id,
    post_type: "student",
    createdAt: p.createdAt || p.created_at,
  }));

  const list2 = (Array.isArray(tutorPosts) ? tutorPosts : []).map((p) => ({
    ...p,
    id: p.id ?? p._id ?? p.tutor_post_id,
    post_type: "tutor",
    createdAt: p.createdAt || p.created_at,
  }));

  return [...list1, ...list2]
    .filter((p) => p.id != null)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

function UserProfilePage({ userId, onBack, onOpenPost }) {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [userPosts, setUserPosts] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [joinLoading, setJoinLoading] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const viewer = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("user") || "{}");
      const role = String(localStorage.getItem("userType") || raw?.role || raw?.type || "").toLowerCase();
      return {
        userId: Number(raw?.user_id || 0),
        role,
        isTutor: role === "tutor" || role === "teacher",
      };
    } catch {
      return { userId: 0, role: "", isTutor: false };
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void fetchProfileData();
  }, [userId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError("");

      const basicRes = await fetch(`${API_URL}/api/profile/${userId}`);
      if (!basicRes.ok) throw new Error("ไม่พบข้อมูลผู้ใช้งาน");

      let userData = await basicRes.json();
      const realRole = String(userData.type || userData.role || "").toLowerCase();
      const isTutorReal = realRole === "tutor" || realRole === "teacher";

      if (isTutorReal) {
        const tutorRes = await fetch(`${API_URL}/api/tutor-profile/${userId}`);
        if (tutorRes.ok) userData = await tutorRes.json();
        userData.role = "tutor";
      } else {
        userData.role = "student";
      }

      userData.displayName = `${userData.name || userData.first_name || ""} ${userData.lastname || userData.last_name || ""}`.trim();

      if (typeof userData.education === "string") {
        try { userData.education = JSON.parse(userData.education); } catch { /* noop */ }
      }
      if (typeof userData.teaching_experience === "string") {
        try { userData.teaching_experience = JSON.parse(userData.teaching_experience); } catch { /* noop */ }
      }

      const [postsS, postsT, calendarData] = await Promise.all([
        fetch(`${API_URL}/api/student_posts?student_id=${userId}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_URL}/api/tutor-posts?tutorId=${userId}`).then((r) => (r.ok ? r.json().then((j) => j.items) : [])),
        fetch(`${API_URL}/api/calendar/${userId}`).then((r) => (r.ok ? r.json() : { items: [] })),
      ]);

      setUser(userData);
      setUserPosts(normalizeUserPosts(postsS, postsT));
      setCalendarEvents(Array.isArray(calendarData?.items) ? calendarData.items : []);
    } catch (err) {
      console.error(err);
      setError("ไม่พบข้อมูลผู้ใช้งาน");
    } finally {
      setLoading(false);
    }
  };

  const derivedInterests = useMemo(() => {
    if (!user || user.role === "tutor") return [];
    return [...new Set(
      userPosts
        .filter((p) => p.post_type === "student" && p.subject)
        .map((p) => String(p.subject).trim())
        .filter(Boolean)
    )];
  }, [user, userPosts]);

  const memberSince = useMemo(() => {
    if (!user?.created_at) return "-";
    try {
      return new Date(user.created_at).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  }, [user]);

  const latestEducation = useMemo(() => {
    if (!user || user.role !== "tutor" || !Array.isArray(user.education) || user.education.length === 0) return "-";
    const sorted = [...user.education].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    return sorted[0]?.degree || "-";
  }, [user]);

  const profileBio = useMemo(() => {
    const rawBio = String(user?.about_me || user?.about || "").trim();
    if (!rawBio) return "";
    const sanitized = rawBio.replace(/\s+/g, " ").trim();
    return /[A-Za-zก-๙0-9]/.test(sanitized) ? sanitized : "";
  }, [user]);

  const selectedDayKey = useMemo(() => toCalendarKey(selectedDate), [selectedDate]);
  const dayEvents = useMemo(
    () => calendarEvents.filter((ev) => ev.event_date === selectedDayKey),
    [calendarEvents, selectedDayKey]
  );
  const eventDateSet = useMemo(
    () => new Set(calendarEvents.map((ev) => ev.event_date).filter(Boolean)),
    [calendarEvents]
  );

  const openPostDetail = (postId, postType) => {
    if (!postId || !onOpenPost) return;
    onOpenPost(postId, postType);
  };

  const updatePostState = (postId, updater) => {
    setUserPosts((current) => current.map((p) => (p.id === postId ? updater(p) : p)));
  };

  const handleJoinPost = async (e, post) => {
    e.stopPropagation();
    if (!viewer.userId) return alert("กรุณาเข้าสู่ระบบ");

    const postId = post.id || post._id || post.student_post_id || post.tutor_post_id;
    if (!postId) return;

    if (post.post_type === "tutor") {
      if (viewer.isTutor) return alert("บัญชีติวเตอร์ไม่สามารถ Join โพสต์ติวเตอร์ได้");
      if (!window.confirm("ยืนยันที่จะเข้าร่วมคลาสนี้ใช่หรือไม่?")) return;
      setJoinLoading((s) => ({ ...s, [postId]: true }));
      try {
        const res = await fetch(`${API_URL}/api/tutor-posts/${postId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: viewer.userId }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data?.message || "ไม่สามารถเข้าร่วมได้");
        updatePostState(postId, (p) => ({
          ...p,
          joined: !!data.joined,
          pending_me: !!data.pending_me,
          join_count: Number(data.join_count ?? p.join_count ?? 0),
          cancel_requested: false,
        }));
      } finally {
        setJoinLoading((s) => ({ ...s, [postId]: false }));
      }
      return;
    }

    const confirmMessage = viewer.isTutor
      ? "ยืนยันที่จะเสนอการสอนให้กับโพสต์นี้ใช่หรือไม่?"
      : "ยืนยันที่จะเข้าร่วมโพสต์นี้ใช่หรือไม่?";
    if (!window.confirm(confirmMessage)) return;

    setJoinLoading((s) => ({ ...s, [postId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/student_posts/${postId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: viewer.userId }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "ไม่สามารถเข้าร่วมได้");
      updatePostState(postId, (p) => ({
        ...p,
        pending_me: true,
        joined: false,
        join_count: Number(data.join_count ?? p.join_count ?? 0),
        cancel_requested: false,
      }));
    } finally {
      setJoinLoading((s) => ({ ...s, [postId]: false }));
    }
  };

  const handleUnjoinPost = async (e, post) => {
    e.stopPropagation();
    if (!viewer.userId) return alert("กรุณาเข้าสู่ระบบ");

    const postId = post.id || post._id || post.student_post_id || post.tutor_post_id;
    if (!postId) return;

    const cancelMessage = post.pending_me
      ? "ยืนยันที่จะยกเลิกคำขอนี้ใช่หรือไม่?"
      : "ยืนยันที่จะยกเลิกการเข้าร่วมใช่หรือไม่?";
    if (!window.confirm(cancelMessage)) return;

    setJoinLoading((s) => ({ ...s, [postId]: true }));
    try {
      const url = post.post_type === "tutor"
        ? `${API_URL}/api/tutor-posts/${postId}/join?user_id=${viewer.userId}`
        : `${API_URL}/api/student_posts/${postId}/join?user_id=${viewer.userId}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data?.message || "ไม่สามารถยกเลิกได้");

      updatePostState(postId, (p) => {
        if (data.cancel_requested) {
          return { ...p, cancel_requested: true, joined: true };
        }
        return {
          ...p,
          joined: !!data.joined,
          pending_me: !!data.pending_me,
          join_count: Number(data.join_count ?? p.join_count ?? 0),
          cancel_requested: false,
        };
      });
    } finally {
      setJoinLoading((s) => ({ ...s, [postId]: false }));
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">กำลังโหลดข้อมูล...</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">{error}</div>;
  }
  if (!user) return null;

  const isTutor = user.role === "tutor";
  const reviews = user.reviews || [];

  const renderCalendarSection = () => (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="text-indigo-500" />
        ตารางเรียนและนัดหมาย
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-6">
        <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50/60">
          <ReactCalendar
            locale="en-US"
            value={selectedDate}
            onChange={(value) => setSelectedDate(Array.isArray(value) ? value[0] : value)}
            tileContent={({ date, view }) =>
              view === "month" && eventDateSet.has(toCalendarKey(date))
                ? <div className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 mx-auto" />
                : null
            }
          />
        </div>
        <div className="rounded-2xl border border-gray-100 p-4 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">ตารางเรียนของวันที่ {selectedDate.toLocaleDateString("th-TH")}</h4>
            <span className="text-xs text-gray-400">{dayEvents.length} รายการ</span>
          </div>

          {dayEvents.length === 0 ? (
            <div className="rounded-xl bg-gray-50 border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
              ยังไม่มีตารางเรียนในวันนี้
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map((event, index) => {
                const eventPostId = event.post_id || event.related_id;
                const eventPostType = normalizeCalendarPostType(event.post_type);
                return (
                  <button
                    key={`${event.event_id || eventPostId || "event"}-${index}`}
                    type="button"
                    onClick={() => openPostDetail(eventPostId, eventPostType)}
                    className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{event.title || event.subject || "ตารางเรียน"}</div>
                        <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={14} className="text-indigo-400" />
                            {formatScheduleTime24(event.event_time)}
                          </span>
                          {event.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={14} className="text-rose-400" />
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1">
                        {eventPostType === "tutor_post" ? "โพสต์ติวเตอร์" : "โพสต์นักเรียน"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans relative">
      <div className="bg-white shadow-sm sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-lg text-gray-800 truncate">{user.displayName}</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start mb-8">
          <div className="flex-shrink-0 relative group cursor-pointer" onClick={() => setIsImageOpen(true)}>
            <img
              src={user.profile_picture_url || "/../blank_avatar.jpg"}
              className="w-28 h-28 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:brightness-90"
              alt="Profile"
            />
            <span className={`absolute bottom-1 right-1 px-3 py-1 rounded-full text-xs font-bold uppercase text-white shadow-sm ${isTutor ? "bg-indigo-600" : "bg-rose-500"}`}>
              {isTutor ? "Tutor" : "Student"}
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-700 font-bold text-sm">
                  <Star size={16} className="fill-yellow-500 text-yellow-500" />
                  {user.rating || "0.0"} ({reviews.length} รีวิว)
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm">
                  <Users size={16} />
                  มีนักเรียนเคยเรียนแล้ว {Number(user.students_taught_count || 0)} คน
                </div>
              </div>
            )}

            {profileBio ? (
              <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm md:text-base">{profileBio}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock size={16} /> สมาชิกเมื่อ {memberSince}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-sm">
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

          <div className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all ${user.phone ? "hover:border-green-300 hover:shadow-md" : "opacity-80"}`}>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
              <Phone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 font-medium mb-0.5">เบอร์โทรศัพท์</p>
              <div className="flex items-center justify-between">
                {user.phone ? (
                  showPhone ? (
                    <a href={`tel:${user.phone}`} className="text-sm font-semibold text-green-700 hover:underline">{user.phone}</a>
                  ) : (
                    <span className="text-sm font-semibold text-gray-800">{user.phone.substring(0, 3)}XXXXXXX</span>
                  )
                ) : (
                  <p className="text-sm font-semibold text-gray-800">ยังไม่ระบุ</p>
                )}
                {user.phone && (
                  <button onClick={() => setShowPhone((prev) => !prev)} className="p-1 text-gray-400 hover:text-green-600 transition-colors">
                    {showPhone ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all ${user.email ? "hover:border-blue-300 hover:shadow-md" : "opacity-80"}`}>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 font-medium mb-0.5">อีเมล</p>
              <div className="flex items-start justify-between gap-2">
                {user.email ? (
                  showEmail ? (
                    <a href={`mailto:${user.email}`} className="text-sm font-semibold text-blue-700 hover:underline break-all">{user.email}</a>
                  ) : (
                    <span className="text-sm font-semibold text-gray-800 break-all">{user.email.substring(0, 3)}***@***</span>
                  )
                ) : (
                  <p className="text-sm font-semibold text-gray-800">ยังไม่ระบุ</p>
                )}
                {user.email && (
                  <button onClick={() => setShowEmail((prev) => !prev)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors shrink-0">
                    {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
              {isTutor ? <GraduationCap size={18} /> : <BookOpen size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium mb-0.5">{isTutor ? "วุฒิการศึกษาสูงสุด" : "ระดับชั้น"}</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{isTutor ? latestEducation : (user.grade_level || "-")}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
          <div className="flex border-b border-gray-100">
            {["posts", isTutor && "reviews", "about"].filter(Boolean).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === tab ? "border-indigo-600 text-indigo-600 bg-indigo-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
              >
                {tab === "posts" && `โพสต์ประกาศ (${userPosts.length})`}
                {tab === "reviews" && `รีวิว (${reviews.length})`}
                {tab === "about" && "ข้อมูลเพิ่มเติม"}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8 bg-gray-50/30">
            {activeTab === "posts" && (
              <div className="space-y-4">
                {userPosts.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">ยังไม่มีโพสต์ประกาศ</div>
                ) : (
                  userPosts.map((p) => {
                    const subject = p.subject || "-";
                    const date = p.meta?.preferred_days || p.preferred_days || p.meta?.teaching_days || p.teaching_days || "-";
                    const time = formatScheduleTimesList(p.meta?.preferred_time || p.preferred_time || p.meta?.teaching_time || p.teaching_time || "-");
                    const location = p.meta?.location || p.location || "-";
                    const price = p.meta?.budget || p.budget || p.meta?.price || p.price || p.hourly_rate;
                    const groupSize = Number(p.meta?.group_size || p.group_size || 0);
                    const joinedCount = Number(p.join_count || 0);
                    const displayJoinedCount = p.post_type === "student" ? joinedCount + 1 : joinedCount;
                    const spotsLeft = groupSize > 0 ? Math.max(0, groupSize - displayJoinedCount) : 0;
                    const postId = p.id || p._id || p.student_post_id || p.tutor_post_id;
                    const openType = p.post_type === "tutor" ? "tutor_post" : "student_post";
                    const busy = !!joinLoading[postId];
                    const isFull = groupSize > 0 && displayJoinedCount >= groupSize;
                    const isOwnProfile = viewer.userId && viewer.userId === Number(userId);
                    const canJoinStudentPost = !isOwnProfile;
                    const canJoinTutorPost = !viewer.isTutor && !isOwnProfile;

                    return (
                      <div
                        key={postId}
                        onClick={() => openPostDetail(postId, openType)}
                        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                      >
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.post_type === "student" ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"}`}>
                                  {p.post_type === "student" ? "หาครู" : "รับสอน"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                                {user.username && (
                                  <>
                                    <span className="font-medium text-indigo-500">@{user.username}</span>
                                    <span className="text-gray-300">•</span>
                                  </>
                                )}
                                <span className="text-gray-400">{new Date(p.createdAt).toLocaleString("th-TH", { hour12: false })}</span>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50">
                            <MoreVertical size={18} />
                          </button>
                        </div>
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-gray-800 mb-1">{subject}</h3>
                          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{p.description || p.content}</p>
                        </div>
                        {/* section ของรายละเอียดการเรีนย */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4 border-t border-slate-100 pt-6 mt-4">
                          {/* 1. วิชา */}
                          <div className="flex items-start gap-3">
                            <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-violet-50 text-violet-600">
                              <BookOpen size={18} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">วิชา</p>
                              <p className="text-sm font-semibold text-slate-700 truncate">{subject}</p>
                            </div>
                          </div>
                          {/* 2. วันที่เรียน */}
                          <div className="flex items-start gap-3">
                            <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-600">
                              <Calendar size={18} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">วันที่เรียน</p>
                              <p className="text-sm font-semibold text-slate-700 truncate">{date}</p>
                            </div>
                          </div>
                          {/* 3. เวลาเรียน */}
                          <div className="flex items-start gap-3">
                            <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-fuchsia-50 text-fuchsia-600">
                              <Clock size={18} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">เวลาเรียน</p>
                              <p className="text-sm font-semibold text-slate-700 truncate">{time}</p>
                            </div>
                          </div>
                          {/* 4. สถานที่เรียน */}
                          <div className="flex items-start gap-3">
                            <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-amber-50 text-amber-600">
                              <MapPin size={18} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">สถานที่เรียน</p>
                              <p className="text-sm font-semibold text-slate-700 truncate" title={location}>{location}</p>
                            </div>
                          </div>
                          {/* 5. ราคา */}
                          <div className="flex items-start gap-3">
                            <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-cyan-50 text-cyan-600">
                              <span className="text-lg font-bold">฿</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">ราคา</p>
                              <p className="text-sm font-bold text-cyan-600">
                                {price ? `${Number(price).toLocaleString()} บ./ชม.` : "ฟรี"}
                              </p>
                            </div>
                          </div>
                          {/* 6. จำนวนผู้เรียน */}
                          {groupSize > 0 && (
                            <div className="flex items-start gap-3">
                              <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-rose-50 text-rose-600">
                                <Users size={18} strokeWidth={2.5} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">จำนวนรับ</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {displayJoinedCount}/{groupSize}
                                  </p>
                                  {spotsLeft > 0 ? (
                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                                      ว่าง {spotsLeft}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
                                      เต็มแล้ว
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">คลิกเพิ่มดูข้อมูลเพิ่มเติม</span>

                          {p.post_type === "student" ? (
                            canJoinStudentPost ? (
                              p.joined || p.pending_me ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleUnjoinPost(e, p)}
                                  disabled={busy || p.cancel_requested}
                                  className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${p.cancel_requested ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                                >
                                  {p.cancel_requested ? "รออนุมัติยกเลิก" : busy ? "กำลังประมวลผล..." : viewer.isTutor ? "ยกเลิกข้อเสนอสอน" : (p.joined ? "ยกเลิกการเข้าร่วม" : "ยกเลิกคำขอ")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleJoinPost(e, p)}
                                  disabled={busy || (isFull && !viewer.isTutor) || (viewer.isTutor && p.has_tutor)}
                                  className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${(isFull && !viewer.isTutor) || (viewer.isTutor && p.has_tutor) ? "bg-gray-400 cursor-not-allowed" : viewer.isTutor ? "bg-indigo-600 hover:bg-indigo-700" : "bg-purple-600 hover:bg-purple-700"}`}
                                >
                                  {(isFull && !viewer.isTutor) ? "เต็มแล้ว" : (viewer.isTutor && p.has_tutor) ? "ได้ติวเตอร์แล้ว" : busy ? "กำลังประมวลผล..." : viewer.isTutor ? "ต้องการสอน" : "Join"}
                                </button>
                              )
                            ) : (
                              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">โพสต์ของฉัน</span>
                            )
                          ) : canJoinTutorPost ? (
                            p.joined || p.pending_me ? (
                              <button
                                type="button"
                                onClick={(e) => handleUnjoinPost(e, p)}
                                disabled={busy || p.cancel_requested}
                                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${p.cancel_requested ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
                              >
                                {p.cancel_requested ? "รออนุมัติยกเลิก" : busy ? "กำลังประมวลผล..." : (p.joined ? "ยกเลิกการเข้าร่วม" : "ยกเลิกคำขอ")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleJoinPost(e, p)}
                                disabled={busy || isFull}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isFull ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
                              >
                                {isFull ? "เต็มแล้ว" : busy ? "กำลังประมวลผล..." : "Join"}
                              </button>
                            )
                          ) : (
                            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                              {isOwnProfile ? "โพสต์ของฉัน" : "สำหรับนักเรียน"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="grid md:grid-cols-2 gap-5">
                {reviews.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                    <div className="bg-gray-100 p-4 rounded-full mb-3"><Star size={32} className="text-gray-300" /></div>
                    <p>ยังไม่มีรีวิวในขณะนี้</p>
                  </div>
                ) : (
                  reviews.map((r, i) => (
                    <div key={i} className="relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
                      <div className="absolute top-2 right-4 text-9xl text-gray-50 opacity-[0.03] font-serif select-none pointer-events-none">"</div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <img src={r.reviewer?.avatar || "/default-avatar.png"} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" alt="" />
                            <div>
                              <div className="font-bold text-gray-900 text-sm">
                                {r.reviewer?.name || "ผู้ใช้งาน"}
                                {r.reviewer?.username && <span className="text-gray-500 font-normal ml-1">(@{r.reviewer?.username})</span>}
                              </div>
                              <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}</div>
                            </div>
                          </div>
                          {r.subject && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 border border-indigo-100">
                              {r.subject}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 mb-3">
                          {[...Array(5)].map((_, index) => (
                            <Star key={index} size={14} className={index < r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-200"} />
                          ))}
                        </div>

                        <p className="text-sm text-gray-600 leading-relaxed font-medium">"{r.comment}"</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100">
                {isTutor ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><GraduationCap className="text-indigo-500" /> การศึกษา</h3>
                      {Array.isArray(user.education) && user.education.length > 0 ? (
                        user.education.map((e, idx) => (
                          <div key={idx} className="border-b last:border-0 pb-3 last:pb-0 border-gray-100">
                            <div className="font-bold text-gray-800">
                              {e.degree} {e.major && <span className="text-gray-500 font-normal">- {e.major}</span>}
                            </div>
                            <div className="text-sm text-gray-500">{e.institution} {e.year ? `(${e.year})` : ""}</div>
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
                        {(user.subjects || user.can_teach_subjects || "")
                          .split(",")
                          .filter(Boolean)
                          .map((s, i) => (
                            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{s.trim()}</span>
                          ))}
                      </div>
                    </div>
                    {renderCalendarSection()}
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
                    {renderCalendarSection()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isImageOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsImageOpen(false)}>
          <button className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all" onClick={() => setIsImageOpen(false)}>
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
