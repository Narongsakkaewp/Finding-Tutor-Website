import React, { useMemo, useState, useEffect } from "react";
import {
  Heart, MapPin, Calendar, Search, Star, BookOpen, Users, ChevronRight,
  MessageSquarePlus, CalendarCheck, Sparkles, GraduationCap, Clock,
  MonitorPlay, CheckCircle, Tag, DollarSign, User, Phone, Mail
} from "lucide-react";
import AdminDashboard from './AdminDashboard';
import ManageMyPosts from './ManageMyPosts';
import TutorPostForm from './TutorPostForm';
import TutorSearchList from './TutorSearchList';
import SmartSearch from './SmartSearch';
import RecommendedTutors from './RecommendedTutors';

/** ---------------- Config ---------------- */
const API_BASE = "http://localhost:5000";

/** ---------------- Utils ----------------- */
const priceText = (p) => new Intl.NumberFormat("th-TH").format(p);
const getUserContext = () => {
  const role = (localStorage.getItem("userType") || "").toLowerCase();
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const user_id = user?.user_id || null;
    return { role, user_id };
  } catch {
    return { role, user_id: null };
  }
};

const today = new Date().toISOString().split("T")[0];

/** ---------------- UI Components -------------- */

function Badge({ icon: Icon, text, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[color]}`}>
      {Icon && <Icon size={12} />}
      {text}
    </span>
  );
}

function SectionHeader({ title, subtitle, actionLabel = "ดูทั้งหมด", onAction, icon: Icon }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {Icon && <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Icon size={20} /></div>}
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
        </div>
        {subtitle && <p className="text-base text-gray-500 ml-1">{subtitle}</p>}
      </div>
      {onAction && (
        <button onClick={onAction} className="group inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
          {actionLabel} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );
}

function TutorCard({ item, onOpen, onToggleSave }) {
  const [liked, setLiked] = useState(false);
  const toggle = (e) => { e.stopPropagation(); setLiked((v) => !v); onToggleSave?.(item); };

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer h-full flex flex-col" onClick={() => onOpen?.(item)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img src={item.image} alt={item.name} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
        <button onClick={toggle} className={`absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-md bg-white/30 border border-white/50 transition-colors hover:bg-white ${liked ? "text-rose-500 bg-white" : "text-white"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
        </button>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <div className="font-bold text-lg truncate">{item.name} {item.nickname && `(${item.nickname})`}</div>
          <div className="text-sm text-gray-200 truncate">{item.subject}</div>
        </div>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <Badge icon={Star} text={`${Number(item.rating || 0).toFixed(1)} (${item.reviews || 0})`} color="amber" />
          <div className="text-sm font-semibold text-indigo-600">฿{priceText(item.price)}/ชม.</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MapPin size={14} />
          <span className="truncate">{item.city || "ไม่พบสถานที่"}</span>
        </div>
        <div className="mt-auto pt-2">
          <button className="w-full py-2.5 rounded-xl bg-gray-50 text-gray-900 font-medium text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors">ดูโปรไฟล์</button>
        </div>
      </div>
    </div>
  );
}

function SubjectCard({ item, onOpen }) {
  return (
    <div className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300" onClick={() => onOpen?.(item)}>
      <img src={item.cover} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">{item.title}</h3>
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Users size={14} />
          <span>{item.tutors} ติวเตอร์</span>
        </div>
      </div>
    </div>
  );
}

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <ChevronRight className="rotate-90" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
      <div className="p-4 bg-gray-50 rounded-full mb-3"><Search className="h-8 w-8 text-gray-400" /></div>
      <p className="text-gray-500 font-medium">{label}</p>
    </div>
  );
}

/** ---------------- Logic Components ---------------- */

// ✅ PostList: ตัวกลางดึงข้อมูลโพสต์ (ใช้ร่วมกันเพื่อลด code ซ้ำ)
const EMPTY_FILTERS = {};

function PostList({ type = "student", searchKey, tutorId, onOpen, filters = EMPTY_FILTERS }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem('user')); // ดึง User ID มาใช้
  const userId = user?.user_id || 0;

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        let url = "";
        const filterParams = new URLSearchParams();
        if (filters.minPrice) filterParams.append("minPrice", filters.minPrice);
        if (filters.maxPrice) filterParams.append("maxPrice", filters.maxPrice);
        if (filters.location) filterParams.append("location", filters.location);
        if (filters.rating) filterParams.append("minRating", filters.rating);
        if (filters.gradeLevel) filterParams.append("gradeLevel", filters.gradeLevel);

        const filterStr = filterParams.toString() ? `&${filterParams.toString()}` : "";

        // 1. ดึงโพสต์ติวเตอร์รายคน
        if (type === "tutor_profile" && tutorId) {
          url = `${API_BASE}/api/tutor-posts?tutorId=${tutorId}&limit=10`;
        }
        // 2. ดึงโพสต์ติวเตอร์ทั้งหมด (ค้นหา)
        else if (type === "tutor_search") {
          url = `${API_BASE}/api/tutor-posts?search=${encodeURIComponent(searchKey || "")}&limit=12${filterStr}`;
        }
        // 🔥 3. (เพิ่มใหม่) ดึงโพสต์แนะนำ (Recommendation)
        else if (type === "recommended_courses") {
          url = `${API_BASE}/api/recommendations/courses?user_id=${userId}`;
        }
        // 🔥 4. (เพิ่มใหม่) แนะนำนักเรียนให้ติวเตอร์ (Smart Tutor Recs)
        else if (type === "tutor_recommendation") {
          url = `${API_BASE}/api/recommendations/tutor?user_id=${userId}&_t=${Date.now()}`;
        }
        // 5. ดึงโพสต์นักเรียน (Student)
        else {
          url = `${API_BASE}/api/student_posts?search=${encodeURIComponent(searchKey || "")}&limit=12${filterStr}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);

        if (!ignore) setPosts(items);
      } catch (e) {
        if (!ignore) setError("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [searchKey, type, tutorId, filters]);

  if (loading) return <div className="p-12 text-center text-gray-500"><div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>กำลังโหลด...</div>;
  if (error) return <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-center">{error}</div>;
  if (posts.length === 0) return <EmptyState label="ไม่พบข้อมูลตามเงื่อนไข" />;

  return (
    <div className={`grid grid-cols-1 ${type === 'tutor_profile' ? '' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
      {posts.map(p => {
        const isStudent = (type === "student" || type === "tutor_recommendation" || type === "recommended_courses"); // ✅ Fix logic
        const userImg = p.user?.profile_image || p.authorId?.avatarUrl || p.profile_picture_url || "../blank_avatar.jpg";
        const userName = p.user?.first_name || p.authorId?.name || (p.name ? `${p.name} ${p.lastname || ""}` : "User");
        const date = p.createdAt || p.created_at;
        const subject = p.subject;
        const desc = p.description || p.content;

        const loc = isStudent ? p.location : p.meta?.location;
        const price = isStudent ? p.budget : p.meta?.price;
        const days = isStudent ? p.preferred_days : p.meta?.teaching_days;
        const time = isStudent ? p.preferred_time : p.meta?.teaching_time;

        // Expired Logic
        const isExpired = p.is_expired;

        return (
          <div
            key={p.id || p._id}
            onClick={() => onOpen?.(p)}
            className={`group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full cursor-pointer relative overflow-hidden ${isExpired ? 'grayscale-[0.8] opacity-90 bg-gray-50' : 'hover:border-indigo-100'}`}
          >
            {isExpired && (
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">
                เลยวันเรียนแล้ว
              </div>
            )}

            <div className="flex items-center gap-3 mb-3">
              <img src={userImg} className="w-10 h-10 rounded-full object-cover border" alt="" />
              <div>
                <div className={`text-sm font-bold line-clamp-1 ${isExpired ? 'text-gray-600' : 'text-gray-900'}`}>{userName}</div>
                <div className="text-xs text-gray-500">{new Date(date).toLocaleDateString("th-TH")}</div>
              </div>
              {!isExpired && (
                <span className={`ml-auto text-[10px] px-2 py-1 rounded-full font-bold ${isStudent ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {isStudent ? 'หาครู' : 'รับสอน'}
                </span>
              )}
            </div>

            <h4 className={`font-bold mb-1 line-clamp-1 ${isExpired ? 'text-gray-600' : 'text-gray-800'}`}>{subject}</h4>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">{desc}</p>

            <div className="flex flex-wrap gap-2 mt-auto">
              <Badge icon={MapPin} text={loc || "Online"} color={isExpired ? "gray" : "amber"} />
              {price > 0 && <Badge icon={DollarSign} text={`฿${price}`} color={isExpired ? "gray" : "emerald"} />}
              {/* {days && <Badge icon={Calendar} text={days} color="blue" />} */}
            </div>

            {isExpired ? (
              <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                <span className="text-red-500 text-xs font-bold">ติดต่อติวเตอร์โดยตรง</span>
              </div>
            ) : (
              <>
                {isStudent && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center flex-wrap gap-2 text-xs text-gray-500">
                    <span>เข้าร่วมแล้ว: <b>{(p.join_count || 0) + 1}</b> / {p.group_size || 0} คน</span>
                    {p.has_tutor && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                        ได้ติวเตอร์แล้ว
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  );
}

// ✅ 1. StudentPosts (ใช้ใน Modal)
function StudentPosts({ subjectKey, onOpen }) {
  // ถ้ามีคำค้นหา -> ใช้ type="student" (ค้นหาปกติ)
  // ถ้าไม่มี -> ใช้ type="tutor_recommendation" (Smart AI Recs)
  const type = subjectKey ? "student" : "tutor_recommendation";
  return <PostList type={type} searchKey={subjectKey} onOpen={onOpen} />;
}

// ✅ 2. StudentPostFeed (ตัวใหม่! ที่เคยลืมใส่ - ใช้ในหน้าค้นหา)
function StudentPostFeed({ searchKey, onOpen, filters }) {
  return <PostList type="student" searchKey={searchKey} onOpen={onOpen} filters={filters} />;
}

// ✅ 3. TutorPosts (ใช้ใน Modal ติวเตอร์)
function TutorPosts({ tutorId }) {
  return <PostList type="tutor_profile" tutorId={tutorId} />;
}

// ✅ 4. TutorPostFeed (ใช้ในหน้าค้นหา)
function TutorPostFeed({ searchKey, onOpen, filters }) {
  return <PostList type="tutor_search" searchKey={searchKey} onOpen={onOpen} filters={filters} />;
}

// ✅ 5. TrendingSubjectsList (แก้ไข: เพิ่ม Component ที่หายไป)
function TrendingSubjectsList({ onOpen }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/search/popular`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSubjects(data);
      })
      .catch(err => console.error("Failed to load trending subjects", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>)}</div>;
  if (subjects.length === 0) return null;

  // Icon Mapping (ใช้ icon ที่มีอยู่แล้ว)
  const getIcon = (iconName) => {
    if (iconName === 'Calculator' || iconName === 'Math') return GraduationCap;
    if (iconName === 'Languages') return MessageSquarePlus;
    if (iconName === 'FlaskConical') return Sparkles;
    if (iconName === 'Laptop' || iconName === 'Code') return MonitorPlay;
    return BookOpen; // Default
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {subjects.map((s, i) => {
        const Icon = getIcon(s.icon);
        const colorClass = s.color === 'indigo' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
          s.color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' :
            s.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
              s.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                'bg-amber-50 text-amber-600 border-amber-100'; // Default

        return (
          <div
            key={i}
            onClick={() => onOpen?.(s)}
            className={`p-4 rounded-xl border ${colorClass} cursor-pointer hover:shadow-md transition-all flex items-center justify-between group`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                <Icon size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">{s.name}</div>
                <div className="text-xs opacity-70">{s.count} โพสต์</div>
              </div>
            </div>
            <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        );
      })}
    </div>
  );
}

// ... (Rest of code)

/** ========== STUDENT HOME (Main Page) ========== */
function HomeStudent() {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [recKey, setRecKey] = useState(0);

  const [tutors, setTutors] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ New State: แท็บการค้นหา
  const [searchTab, setSearchTab] = useState("tutors");

  // ✅ New State: Filters
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    location: "",
    rating: "",
    gradeLevel: ""
  });

  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.user_id;

  const handleSearch = async (keyword) => {
    if (typeof keyword !== 'string') return; // Safety check
    setQuery(keyword);
    // Switch to 'courses' tab automatically if searching? Or stick to tutors?
    // User requested improved relevance, usually implies courses/posts.
    setSearchTab("courses");

    // Log history
    if (keyword.trim()) {
      try {
        await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(keyword)}&user_id=${userId || 0}`);
        setRecKey(p => p + 1);
      } catch (err) { console.error("Failed to log search:", err); }
    }
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoadErr("");
        setLoading(true);
        const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";

        // Pass filters to Tutors Tab as well? 
        // The /api/tutors endpoint in server.js doesn't support advanced filters yet (only basic search).
        // Focusing on PostList (Courses) for now as prioritized.

        const res = await fetch(`${API_BASE}/api/tutors?page=1&limit=12${searchParam}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) setTutors(data.items || []);
      } catch (e) {
        if (!ignore) {
          setLoadErr(e.message || "โหลดรายชื่อติวเตอร์ไม่สำเร็จ");
          setTutors([]);
        }
      } finally {
        if (!ignore) { setLoading(false); }
      }
    })();
    return () => { ignore = true; };
  }, [query]);

  // Handlers for Filters
  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-20">

        {/* --- Hero Section --- */}
        <div className="pt-8 md:pt-12 pb-10">
          {/* ... Hero Content ... */}
          <div className="relative bg-white rounded-[3rem] shadow-2xl min-h-[500px] flex items-center border border-gray-100">
            {/* Background Elements (Clipped) */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[3rem]">
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-indigo-100/50 via-purple-100/30 to-white rounded-full blur-3xl -mr-40 -mt-40 opacity-70"></div>
              <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-pink-100/40 via-blue-100/30 to-white rounded-full blur-3xl -ml-32 -mb-32 opacity-70"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
            </div>

            <div className="relative z-10 w-full grid lg:grid-cols-12 gap-8 lg:gap-16 items-center px-8 md:px-14 py-12">
              <div className="lg:col-span-7 space-y-8">
                <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 rounded-full px-5 py-2 text-sm font-semibold text-indigo-600 shadow-sm animate-fade-in-up">
                  <Sparkles size={16} className="text-amber-400 fill-amber-400" />
                  <span>แพลตฟอร์มหาติวเตอร์แบบใหม่</span>
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight text-gray-900">
                  อัพสกิลความรู้<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">ก้าวสู่อนาคต</span>
                </h1>

                {/* ✅ Search Box Container */}
                <div className="relative z-50 max-w-xl w-full">
                  <SmartSearch
                    userId={userId}
                    onSearch={(val) => {
                      handleSearch(val);
                      // Auto scroll to results if search is triggered
                      setTimeout(() => document.getElementById('searchResults')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }}
                  />
                </div>
              </div>

              <div className="hidden lg:col-span-5 lg:flex justify-end relative pointer-events-none">
                <div className="relative">
                  {/* Abstract Shapes */}
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-yellow-300 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                  <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-600 rounded-full blur-3xl opacity-20"></div>

                  <img
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop"
                    alt="Student Learning"
                    className="relative z-10 rounded-[2.5rem] shadow-2xl border-[6px] border-white w-[420px] h-[520px] object-cover transform rotate-2 hover:rotate-0 transition-all duration-700"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 1. Recommended Section (When NOT searching) --- */}
        {!query && (
          // ... (Same as before)
          <div className="space-y-16">
            <section className="mt-10">
              <RecommendedTutors
                userId={userId}
                key={recKey}
                onOpen={(item) => { setPreview(item); setPreviewType("tutor"); }}
              />
            </section>

            <section className="mb-12">
              <SectionHeader title="วิชายอดฮิต" subtitle="อัปเดตตามความนิยมจริงแบบเรียลไทม์" icon={Sparkles} />
              <TrendingSubjectsList onOpen={(item) => handleSearch(item.name || item.id)} />
            </section>


            <section className="mt-12">
              <SectionHeader
                title="ติวเตอร์หน้าใหม่"
                subtitle="ติวเตอร์ที่เพิ่งสมัครเข้ามาใหม่"
                icon={Users}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {tutors.length > 0 ? (
                  tutors.slice(0, 4).map((t) => (
                    <TutorCard
                      key={t.id}
                      item={t}
                      onOpen={(i) => { setPreview(i); setPreviewType("tutor_only"); }}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                    ยังไม่มีติวเตอร์ใหม่ในขณะนี้
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* --- 2. Search Results Section (When Searching) --- */}
        {query && (
          <section className="mt-10 scroll-mt-20" id="searchResults">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-6 gap-4">
              <SectionHeader title={`ผลลัพธ์การค้นหา "${query}"`} subtitle="เลือกดูข้อมูลตามประเภทที่คุณต้องการ" icon={Search} />

              {/* ✅ Tab Switcher */}
              <div className="bg-gray-100 p-1.5 rounded-xl border border-gray-200 inline-flex gap-1">
                <button onClick={() => setSearchTab("tutors")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${searchTab === "tutors" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"}`}><Users size={16} /> ติวเตอร์</button>
                <button onClick={() => setSearchTab("courses")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${searchTab === "courses" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"}`}><BookOpen size={16} /> คอร์สเรียน</button>
                <button onClick={() => setSearchTab("requests")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${searchTab === "requests" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"}`}><GraduationCap size={16} /> ประกาศหาคนสอน</button>
              </div>
            </div>

            {/* 🔥 Filter Bar (Shopee Style Inputs) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm font-bold text-gray-600"><DollarSign size={14} className="inline" /> ราคา:</span>
                <input
                  type="number"
                  placeholder="ต่ำสุด"
                  className="w-20 bg-transparent text-sm focus:outline-none"
                  value={filters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="สูงสุด"
                  className="w-20 bg-transparent text-sm focus:outline-none"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-[150px]">
                <MapPin size={14} className="text-gray-500" />
                <input
                  type="text"
                  placeholder="สถานที่ (เช่น กทม.)"
                  className="w-full bg-transparent text-sm focus:outline-none"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-[130px]">
                <GraduationCap size={14} className="text-gray-500" />
                <input
                  type="text"
                  placeholder="ระดับชั้น (เช่น ม.5)"
                  className="w-full bg-transparent text-sm focus:outline-none"
                  value={filters.gradeLevel}
                  onChange={(e) => handleFilterChange('gradeLevel', e.target.value)}
                />
              </div>

              <select
                className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none cursor-pointer"
                value={filters.rating}
                onChange={(e) => handleFilterChange('rating', e.target.value)}
              >
                <option value="">ทั้งหมด (คะแนนรีวิว)</option>
                <option value="4">4 ดาวขึ้นไป</option>
                <option value="4.5">4.5 ดาวขึ้นไป</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm min-h-[300px]">
              {searchTab === "tutors" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>) :
                    tutors.length > 0 ? tutors.map(t => <TutorCard key={t.id} item={t} onOpen={(i) => { setPreview(i); setPreviewType("tutor_only"); }} />) :
                      <div className="col-span-full"><EmptyState label="ไม่พบติวเตอร์ที่ค้นหา" /></div>}
                </div>
              )}
              {searchTab === "courses" && <TutorPostFeed searchKey={query} onOpen={(i) => { setPreview(i); setPreviewType("tutor"); }} filters={filters} />}
              {searchTab === "requests" && <StudentPostFeed searchKey={query} onOpen={(item) => { setPreview(item); setPreviewType("student_post"); }} filters={filters} />}
            </div>
          </section>
        )}

      </div>

      {/* --- Global Modal --- */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={(previewType === "tutor" || previewType === "tutor_only") ? "รายละเอียดติวเตอร์" : previewType === "student_post" ? "รายละเอียดประกาศนักเรียน" : "รายละเอียดวิชา"}>
        {preview && (previewType === "tutor" || previewType === "tutor_only") && (
          <div className="space-y-8 divide-y divide-gray-100">
            {/* --- SECTION 1: TUTOR POST DETAILS --- */}
            {previewType === "tutor" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge text="ประกาศสอนพิเศษ" color="indigo" />
                  <span className="text-xs text-gray-400">โพสต์เมื่อ: {new Date(preview.createdAt || new Date()).toLocaleDateString("th-TH")}</span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900">{preview.subject}</h3>
                <p className="text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {preview.description || preview.content || preview.post_desc || "ไม่มีรายละเอียดเพิ่มเติมในโพสต์นี้"}
                </p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 border rounded-xl">
                    <div className="text-xs text-gray-500 font-bold mb-1">ระดับชั้นที่สอน</div>
                    <div className="font-semibold">{preview.target_student_level || preview.meta?.target_student_level || "ไม่ระบุ"}</div>
                  </div>
                  <div className="p-3 border rounded-xl">
                    <div className="text-xs text-gray-500 font-bold mb-1">ราคา</div>
                    <div className="font-semibold text-emerald-600">{priceText(preview.price || preview.meta?.price || 0)} บาท/ชม.</div>
                  </div>
                  <div className="p-3 border rounded-xl">
                    <div className="text-xs text-gray-500 font-bold mb-1">สถานที่</div>
                    <div className="font-semibold">{preview.location || preview.meta?.location || "Online"}</div>
                  </div>
                  <div className="p-3 border rounded-xl">
                    <div className="text-xs text-gray-500 font-bold mb-1">วัน/เวลาที่สอน</div>
                    <div className="font-semibold">{preview.teaching_days || preview.meta?.teaching_days || "-"} {preview.teaching_time || preview.meta?.teaching_time}</div>
                  </div>
                  <div className="p-4 border rounded-xl col-span-2 bg-indigo-50/50">
                    <div className="text-xs text-indigo-900/60 font-bold mb-2 uppercase tracking-wide">ข้อมูลติดต่อเพิ่มเติม</div>
                    <div className="font-medium text-indigo-700 whitespace-pre-line leading-relaxed text-base break-words">
                      {preview.contact_info || preview.meta?.contact_info || "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 2: TUTOR PROFILE --- */}
            <div className="pt-8 space-y-6">
              <h4 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <User size={20} className="text-indigo-600" /> ข้อมูลติวเตอร์
              </h4>

              <div className="flex items-start gap-4">
                <img src={preview.image || preview.authorId?.avatarUrl || "/../blank_avatar.jpg"} alt={preview.name || preview.authorId?.name} className="w-20 h-20 rounded-full object-cover border shadow-sm" />
                <div>
                  <h5 className="text-xl font-bold text-gray-900">{preview.name || preview.authorId?.name} {preview.nickname ? `(${preview.nickname})` : ""}</h5>
                  {/* แสดงรีวิวถ้ามี */}
                  {preview.reviews > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-bold"><Star size={12} className="fill-amber-500" /> {Number(preview.rating || 0).toFixed(1)} ({preview.reviews} รีวิว)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Education & Experience via JSON parsing (checking if string/object) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="font-bold text-sm text-gray-700">🎓 การศึกษา</div>
                  <div className="text-sm text-gray-600 bg-white border p-3 rounded-lg">
                    {(() => {
                      try {
                        let edu = preview.education;
                        if (typeof edu === 'string') edu = JSON.parse(edu);

                        return Array.isArray(edu) && edu.length > 0
                          ? edu.map((e, i) => (
                            <div key={i} className="mb-2 last:mb-0 border-b last:border-0 pb-2 last:pb-0 border-gray-100">
                              <div className="font-semibold text-gray-800">{e.degree} {e.major}</div>
                              <div className="text-xs text-gray-500">{e.institution} {e.year ? `(${e.year})` : ''}</div>
                            </div>
                          ))
                          : "ไม่ระบุ";
                      } catch (e) { return "ไม่ระบุ"; }
                    })()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-bold text-sm text-gray-700">💼 ประสบการณ์สอน</div>
                  <div className="text-sm text-gray-600 bg-white border p-3 rounded-lg">
                    {(() => {
                      try {
                        let exp = preview.teaching_experience;
                        if (typeof exp === 'string') exp = JSON.parse(exp);

                        return Array.isArray(exp) && exp.length > 0
                          ? exp.map((e, i) => (
                            <div key={i} className="mb-2 last:mb-0 border-b last:border-0 pb-2 last:pb-0 border-gray-100">
                              <div className="font-semibold text-gray-800">{e.title}</div>
                              <div className="text-xs text-gray-500 mb-1">{e.duration}</div>
                              {e.description && <div className="text-xs text-gray-600">"{e.description}"</div>}
                            </div>
                          ))
                          : "ไม่ระบุ";
                      } catch (e) { return "ไม่ระบุ"; }
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <div className="font-bold text-sm text-indigo-900 mb-2">แนะนำตัว</div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{preview.about_me || preview.profile_bio || "ติวเตอร์ไม่ได้ระบุข้อมูลแนะนำตัว"}</p>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Badge text="ช่องทางติดต่อ" color="emerald" />
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {preview.phone ? (
                    <a href={`tel:${preview.phone}`} className="flex items-center gap-4 p-4 rounded-xl bg-green-50/50 border border-green-100 hover:bg-green-100/50 hover:shadow-md hover:border-green-200 transition-all group cursor-pointer">
                      <div className="p-3 bg-white text-green-600 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <Phone size={24} className="fill-green-100" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-green-600 font-bold uppercase tracking-wider mb-0.5">เบอร์โทรศัพท์</div>
                        <div className="text-lg font-bold text-gray-900 truncate group-hover:text-green-700 transition-colors">{preview.phone}</div>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 opacity-60">
                      <div className="p-3 bg-white text-gray-400 rounded-full shadow-sm">
                        <Phone size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">เบอร์โทรศัพท์</div>
                        <div className="text-sm font-medium text-gray-400">ไม่ระบุ</div>
                      </div>
                    </div>
                  )}

                  {preview.email ? (
                    <a href={`mailto:${preview.email}`} className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100 hover:bg-blue-100/50 hover:shadow-md hover:border-blue-200 transition-all group cursor-pointer">
                      <div className="p-3 bg-white text-blue-600 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <Mail size={24} className="fill-blue-100" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-0.5">อีเมล</div>
                        <div className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{preview.email}</div>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 opacity-60">
                      <div className="p-3 bg-white text-gray-400 rounded-full shadow-sm">
                        <Mail size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">อีเมล</div>
                        <div className="text-sm font-medium text-gray-400">ไม่ระบุ</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {preview && previewType === "student_post" && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <img src={preview.user?.profile_image || preview.authorId?.avatarUrl || preview.profile_picture_url || "/../blank_avatar.jpg"} className="w-16 h-16 rounded-full object-cover border" alt="" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">{preview.user?.first_name || preview.authorId?.name || (preview.name ? `${preview.name} ${preview.lastname || ""}` : "นักเรียน")}</h3>
                <div className="text-sm text-gray-500">ลงประกาศเมื่อ: {new Date(preview.createdAt || preview.created_at).toLocaleDateString("th-TH")}</div>
                <Badge text="กำลังหาครู" color="rose" />
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-2xl space-y-3 border border-gray-100">
              <h4 className="text-lg font-bold text-indigo-700">{preview.subject}</h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{preview.description || preview.content || "-"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">สถานที่</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2"><MapPin size={16} /> {preview.location || "-"}</div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">งบประมาณ</div>
                <div className="font-semibold text-emerald-600 flex items-center gap-2"><DollarSign size={16} /> {preview.budget ? `${preview.budget} ฿` : "-"}</div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">วัน/เวลาที่ต้องการรเรียน</div>
                <div className="font-semibold text-blue-600 flex items-center gap-2"><Calendar size={16} /> {preview.preferred_days || "-"} {preview.preferred_time}</div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">ระดับชั้น</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2"><GraduationCap size={16} /> {preview.grade_level || "-"}</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all" onClick={() => alert("ระบบแชทกำลังพัฒนา")}>
                <MessageSquarePlus className="inline-block mr-2" /> ติดต่อสอบถาม
              </button>
            </div>
          </div>
        )}

        {preview && previewType === "subject" && (
          <div className="space-y-6">
            <div className="relative h-48 rounded-2xl overflow-hidden mb-6">
              <img src={preview.cover} className="w-full h-full object-cover" alt={preview.title} />
              <div className="absolute inset-0 bg-black/40 flex items-end p-6">
                <h2 className="text-3xl font-bold text-white">{preview.title}</h2>
              </div>
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Users size={18} /> ต้องการหาติวเตอร์วิชานี้?</h4>
              <p className="text-indigo-700 text-sm mb-4">ดูประกาศล่าสุดจากนักเรียน หรือลงประกาศเองได้ที่นี่</p>
              <StudentPosts subjectKey={preview.dbKey} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** ---------- DASHBOARD STATS ---------- */
function DashboardStats() {
  const stats = [
    { label: "นักเรียนที่ออนลน์", value: "142", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "ประกาศสอนที่ว่าง", value: "24", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "วิชายอดนิยม", value: "Math", icon: Sparkles, color: "text-yellow-600", bg: "bg-yellow-100" },
    { label: "ติวเตอร์ทั้งหมด", value: "850+", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      {stats.map((s, i) => (
        <div key={i} className="bg-white/60 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg} ${s.color} group-hover:scale-110 transition-transform`}>
              <s.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 leading-tight">{s.value}</div>
              <div className="text-xs text-gray-500 font-medium">{s.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** ========== TUTOR HOME ========== */
function HomeTutor({ setCurrentPage, user }) {
  const { user_id } = getUserContext();
  const [tutors, setTutors] = useState([]);
  const [loadingTutors, setLoadingTutors] = useState(true);
  const [isCreatePostModalOpen, setCreatePostModalOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState(null); // For student posts
  const [previewTutor, setPreviewTutor] = useState(null); // For tutor profiles
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoadingTutors(true);
        const res = await fetch(`${API_BASE}/api/tutors?page=1&limit=8`);
        const data = await res.json();
        setTutors(data.items || []);
      } catch (e) { setTutors([]); } finally { setLoadingTutors(false); }
    };
    fetchTutors();
  }, [refreshKey]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-20">



        {/* --- Tutor Hero: Light/Standard Theme "Find Students" --- */}
        <div className="pt-8 pb-10">
          <div className="relative bg-white rounded-[2rem] shadow-xl p-8 md:p-12 overflow-hidden min-h-[300px] flex items-center border border-gray-100">

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-start text-left">
              <div className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full">
                สำหรับติวเตอร์
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
                ค้นหานักเรียน<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">ที่ต้องการคุณ</span>
              </h1>

              <p className="text-gray-500 text-lg max-w-2xl font-medium mb-8">
                เข้าถึงประกาศหาผู้สอนใหม่ๆ ที่ตรงกับวิชาและความถนัดของคุณ ระบบคัดกรองงานที่ใช่ให้คุณโดยอัตโนมัติ
              </p>
            </div>

            {/* Soft Background Decor */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
          </div>
        </div>

        {/* --- Action Buttons (Large Cards) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Create Post Card */}
          <div
            onClick={() => setCreatePostModalOpen(true)}
            className="cursor-pointer group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 min-h-[160px] flex items-center justify-between shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-white mb-2">สร้างโพสต์รับสอน</h3>
              <p className="text-indigo-100 text-sm font-medium opacity-90">สร้างโปรไฟล์หรือโพสต์งานสอนของคุณ<br />เพื่อให้นักเรียนค้นเจอได้ง่ายขึ้น</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
              <MessageSquarePlus className="text-white w-8 h-8" />
            </div>
            {/* Decorative */}
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Manage Posts Card */}
          <div
            onClick={() => setCurrentPage('manage_posts')}
            className="cursor-pointer group relative overflow-hidden bg-white border border-gray-100 rounded-3xl p-8 min-h-[160px] flex items-center justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">จัดการโพสต์ของฉัน</h3>
              <p className="text-gray-500 text-sm font-medium">ดู แก้ไข หรือลบโพสต์งานสอนของคุณ</p>
            </div>
            <div className="bg-gray-100 p-4 rounded-2xl group-hover:bg-gray-200 transition-colors">
              <BookOpen className="text-gray-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* --- Section: Student Requests (Recommended) --- */}
        <section className="mb-20 scroll-mt-24" id="studentRequests">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600">
              <Sparkles size={24} className="fill-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">นักเรียนที่อาจเหมาะกับคุณ</h2>
              <p className="text-sm text-gray-500">ระบบได้คัดเลือกจากวิชาที่คุณสอนและประวัติการใช้งาน</p>
            </div>
          </div>

          {/* Search & Feed Container */}
          <div className="space-y-6">
            {/* Optional Search Bar for this section (keeping it subtle or removing if purely recommended) */}

            {/* Use StudentPosts but customize to dark theme if user wants, 
                  but the prompt image bottom part is cut off. 
                  Assuming clean cards. Existing PostList cards are clean white cards. 
                  The user said "Main page like this" referring to Hero & Actions mostly.
                  I will use the grid feed directly. 
              */}
            <StudentPosts subjectKey={searchQuery} onOpen={(post) => setPreviewPost(post)} />
          </div>
        </section>
      </div>

      <Modal open={isCreatePostModalOpen} onClose={() => setCreatePostModalOpen(false)} title="ลงประกาศรับสอนพิเศษ">
        <TutorPostForm
          tutorId={user_id}
          onClose={() => setCreatePostModalOpen(false)}
          onSuccess={() => {
            setCreatePostModalOpen(false);
            setRefreshKey(p => p + 1);
            alert("ลงประกาศสำเร็จ!");
          }}
        />
      </Modal>

      {/* Modal shows Student Post Details */}
      <Modal open={!!previewPost} onClose={() => setPreviewPost(null)} title="รายละเอียดประกาศจากนักเรียน">
        {previewPost && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <img
                src={previewPost.user?.profile_image || previewPost.profile_picture_url || "/../blank_avatar.jpg"}
                className="w-16 h-16 rounded-full object-cover border"
                alt=""
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {previewPost.user?.first_name || (previewPost.name ? `${previewPost.name} ${previewPost.lastname || ""}` : "นักเรียน")}
                </h3>
                <div className="text-sm text-gray-500">
                  ลงประกาศเมื่อ: {new Date(previewPost.createdAt || previewPost.created_at).toLocaleDateString("th-TH")}
                </div>
                <Badge text="กำลังหาครู" color="rose" />
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-2xl space-y-3 border border-gray-100">
              <h4 className="text-lg font-bold text-indigo-700">{previewPost.subject}</h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{previewPost.description || "-"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">สถานที่</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin size={16} /> {previewPost.location || "-"}
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">งบประมาณ</div>
                <div className="font-semibold text-emerald-600 flex items-center gap-2">
                  <DollarSign size={16} /> {previewPost.budget ? `${previewPost.budget} ฿` : "-"}
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">วัน/เวลา</div>
                <div className="font-semibold text-blue-600 flex items-center gap-2">
                  <Calendar size={16} /> {previewPost.preferred_days || "-"} {previewPost.preferred_time}
                </div>
              </div>
              <div className="p-3 bg-white border rounded-xl">
                <div className="text-xs text-gray-500 font-bold uppercase">ระดับชั้น</div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <GraduationCap size={16} /> {previewPost.grade_level || "-"}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold text-gray-900 mb-3">ข้อมูลติดต่อจากนักเรียน</h4>
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="text-green-800 font-bold text-lg">
                    {previewPost.contact_info || "ไม่ระบุข้อมูลติดต่อ"}
                  </p>
                  <p className="text-xs text-green-600">
                    ช่องทางติดต่อ (Line ID / เบอร์โทร)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* [NEW] Modal for Tutor Profile (shared logic from HomeStudent) */}
      <Modal open={!!previewTutor} onClose={() => setPreviewTutor(null)} title="รายละเอียดติวเตอร์">
        {previewTutor && (
          <div className="space-y-8 divide-y divide-gray-100">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <img src={previewTutor.image || "/../blank_avatar.jpg"} alt={previewTutor.name} className="w-20 h-20 rounded-full object-cover border shadow-sm" />
                <div>
                  <h5 className="text-xl font-bold text-gray-900">{previewTutor.name} {previewTutor.nickname ? `(${previewTutor.nickname})` : ""}</h5>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-amber-500 font-bold"><Star size={12} className="fill-amber-500" /> {Number(previewTutor.rating || 0).toFixed(1)} ({previewTutor.reviews || 0} รีวิว)</span>
                  </div>
                </div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div className="font-bold text-sm text-indigo-900 mb-1">แนะนำตัว</div>
                <p className="text-sm text-gray-700 lowercase">{previewTutor.about_me || previewTutor.subject || "ติวเตอร์มืออาชีพ"}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** ========== ROUTER ========== */
/** ========== MAIN EXPORT ========== */
export default function Home({ setCurrentPage, user }) { // Receive user prop
  const { role } = getUserContext();

  if (role === "tutor") {
    // Pass user prop to HomeTutor
    return <HomeTutor setCurrentPage={setCurrentPage} user={user} />;
  }

  // Pass user prop to HomeStudent if needed (optional, but good for future)
  return <HomeStudent setCurrentPage={setCurrentPage} user={user} />;
}

function TutorReviewsList({ tutorId, API_BASE }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tutorId) {
      fetchReviews();
    }
  }, [tutorId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/tutors/${tutorId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (e) {
      console.error("Fetch reviews error", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4 text-gray-400">กำลังโหลดรีวิว...</div>;
  if (reviews.length === 0) return <div className="text-center py-4 text-gray-400 border border-dashed rounded-xl">ยังไม่มีรีวิว</div>;

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <div key={r.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
          <img src={r.reviewer?.avatar || "/../blank_avatar.jpg"} alt="reviewer" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900 text-sm">{r.reviewer?.name || "ไม่ระบุชื่อ"}</h4>
              <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("th-TH")}</span>
            </div>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className={i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
              ))}
            </div>
            <p className="text-sm text-gray-600">{r.comment}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

