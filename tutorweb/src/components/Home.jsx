import React, { useMemo, useState, useEffect } from "react";
import { Heart, MapPin, Calendar, Search, Star, BookOpen, Users, ChevronRight } from "lucide-react";
 
/**
 * หน้าโฮมตัวอย่างสำหรับแพลตฟอร์มติวเตอร์/คอร์สเรียน
 * - เพิ่มส่วน "โพสต์ของนักเรียน" + "โพสต์ของติวเตอร์" ในโมดัล
 */
 
// ---------------------- Mock Data ----------------------
const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:5000";
 
const CATEGORIES = [
  { id: "math", label: "คณิตศาสตร์", icon: <BookOpen className="h-4 w-4" /> },
  { id: "sci", label: "วิทยาศาสตร์", icon: <BookOpen className="h-4 w-4" /> },
  { id: "eng", label: "ภาษาอังกฤษ", icon: <BookOpen className="h-4 w-4" /> },
  { id: "thai", label: "ภาษาไทย", icon: <BookOpen className="h-4 w-4" /> },
  { id: "code", label: "เขียนโปรแกรม", icon: <BookOpen className="h-4 w-4" /> },
  { id: "art", label: "ศิลปะ/ดีไซน์", icon: <BookOpen className="h-4 w-4" /> },
];
 
const TUTORS = [
  {
    id: "t1",
    dbTutorId: 1, // 👈 แก้ให้ตรง user_id ของติวเตอร์ใน DB
    name: "ครูโบว์",
    subject: "คณิตศาสตร์ ม.ปลาย",
    rating: 4.9,
    reviews: 128,
    price: 450,
    city: "Bangkok",
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?q=80&w=800&auto=format&fit=crop",
    nextSlot: "พฤหัส 18:30",
  },
  {
    id: "t2",
    dbTutorId: 2, // 👈 แก้เลขตาม DB
    name: "พี่มอส",
    subject: "ภาษาอังกฤษ Conversation",
    rating: 4.7,
    reviews: 89,
    price: 390,
    city: "Chiang Mai",
    image:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=800&auto=format&fit=crop",
    nextSlot: "ศุกร์ 19:00",
  },
  {
    id: "t3",
    dbTutorId: 3,
    name: "อ.อาร์ม",
    subject: "Python เบื้องต้น",
    rating: 4.8,
    reviews: 203,
    price: 520,
    city: "Bangkok",
    image:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop",
    nextSlot: "อาทิตย์ 10:30",
  },
  {
    id: "t4",
    dbTutorId: 4,
    name: "ครูมะนาว",
    subject: "วิทย์ ม.ต้น",
    rating: 4.6,
    reviews: 67,
    price: 350,
    city: "Khon Kaen",
    image:
      "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=800&auto=format&fit=crop",
    nextSlot: "เสาร์ 14:00",
  },
  {
    id: "t5",
    dbTutorId: 5,
    name: "พี่มิกซ์",
    subject: "React & Frontend",
    rating: 4.9,
    reviews: 311,
    price: 650,
    city: "Bangkok",
    image:
      "https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=800&auto=format&fit=crop",
    nextSlot: "วันนี้ 20:30",
  },
  {
    id: "t6",
    dbTutorId: 6,
    name: "ครูแอน",
    subject: "ภาษาไทย O-NET",
    rating: 4.5,
    reviews: 52,
    price: 300,
    city: "Udon Thani",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop",
    nextSlot: "จันทร์ 17:30",
  },
];
 
const SUBJECTS = [
  {
    id: "s1",
    dbKey: "Math 1", // ต้องตรงกับ subject ในตาราง student_posts
    title: "คณิตศาสตร์",
    tutors: 241,
    cover:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "s2",
    dbKey: "English Communication",
    title: "ภาษาอังกฤษเพื่อการสื่อสาร",
    tutors: 198,
    cover:
      "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "s3",
    dbKey: "Physics 1",
    title: "Physics ม.ปลาย",
    tutors: 121,
    cover:
      "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "s4",
    dbKey: "Python Beginner",
    title: "เขียนโปรแกรมด้วย Python",
    tutors: 302,
    cover:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "s5",
    dbKey: "UIUX",
    title: "ออกแบบ UI/UX",
    tutors: 74,
    cover:
      "https://images.unsplash.com/photo-1529336953121-a0ce99a0b2f1?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "s6",
    dbKey: "Biology 1",
    title: "ชีววิทยา ม.ปลาย",
    tutors: 97,
    cover:
      "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?q=80&w=1200&auto=format&fit=crop",
  },
];
 
// ---------------------- Utilities ----------------------
const priceText = (p) => new Intl.NumberFormat("th-TH").format(p);
 
// ---------------------- UI Subcomponents ----------------------
function SectionHeader({ title, subtitle, actionLabel = "ดูทั้งหมด", onAction }) {
  return (
    <div className="flex items-end justify-between mb-4 md:mb-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {actionLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
 
function CategoryPill({ label, icon, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition shadow-sm ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
 
function TutorCard({ item, onOpen, onToggleSave }) {
  const [liked, setLiked] = useState(false);
  const toggle = () => {
    setLiked((v) => !v);
    onToggleSave?.(item);
  };
 
  return (
    <div className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="relative h-40 md:h-44 w-full overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="object-cover w-full h-full group-hover:scale-[1.02] transition"
          loading="lazy"
        />
        <button
          onClick={toggle}
          aria-label="save"
          className={`absolute top-3 right-3 inline-flex items-center justify-center h-9 w-9 rounded-full backdrop-blur bg-white/80 border ${
            liked ? "text-rose-500" : "text-gray-500"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
        </button>
      </div>
 
      <div className="p-4">
        <div className="flex items-center gap-2 text-amber-500">
          <Star className="h-4 w-4" />
          <span className="text-sm font-medium">{item.rating.toFixed(1)}</span>
          <span className="text-xs text-gray-500">({item.reviews} รีวิว)</span>
        </div>
 
        <h3 className="mt-1 font-semibold text-lg leading-tight">{item.name}</h3>
        <p className="text-gray-600 text-sm line-clamp-1">{item.subject}</p>
 
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
          <MapPin className="h-4 w-4" /> {item.city}
        </div>
 
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-700 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>คิวถัดไป: {item.nextSlot}</span>
          </div>
          <div className="font-semibold">฿{priceText(item.price)}/ชม.</div>
        </div>
 
        <button
          onClick={() => onOpen?.(item)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white py-2.5 text-sm hover:bg-black"
        >
          ดูรายละเอียด
        </button>
      </div>
    </div>
  );
}
 
function SubjectCard({ item, onOpen }) {
  return (
    <div className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="relative h-36 md:h-40 w-full overflow-hidden">
        <img
          src={item.cover}
          alt={item.title}
          className="object-cover w-full h-full group-hover:scale-[1.02] transition"
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg leading-tight line-clamp-1">{item.title}</h3>
        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{item.tutors} ติวเตอร์</span>
        </div>
        <button
          onClick={() => onOpen?.(item)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 border py-2.5 text-sm hover:bg-gray-50"
        >
          ค้นหาคอร์สในวิชานี้
        </button>
      </div>
    </div>
  );
}
 
function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="px-2 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-100">
              ปิด
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
 
/* ---------------------- โพสต์ของนักเรียน (ดึงจาก Backend) ---------------------- */
function StudentPosts({ subjectKey }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
 
  const key = subjectKey?.trim();
 
  useEffect(() => {
    let ignore = false;
 
    async function load(p = 1, append = false) {
      if (!key) { setPosts([]); setHasMore(false); setLoading(false); return; }
      try {
        setLoading(true);
        const url = `http://localhost:5000/api/subjects/${encodeURIComponent(key)}/posts?page=${p}&limit=5`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          setPosts(prev => (append ? [...prev, ...(data.items || [])] : (data.items || [])));
          setHasMore(data.pagination?.hasMore || false);
          setPage(p);
        }
      } catch (e) {
        if (!ignore) setError(e.message || "โหลดโพสต์ไม่สำเร็จ");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
 
    setError(""); setPosts([]); setHasMore(false);
    load(1, false);
    return () => { ignore = true; };
  }, [key]);
 
  const loadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    try {
      setLoading(true);
      const url = `http://localhost:5000/api/subjects/${encodeURIComponent(key)}/posts?page=${next}&limit=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(prev => [...prev, ...(data.items || [])]);
      setHasMore(data.pagination?.hasMore || false);
      setPage(next);
    } catch (e) {
      setError(e.message || "โหลดเพิ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold">โพสต์ของนักเรียน</h5>
        {posts.length > 0 && <span className="text-xs text-gray-500">ทั้งหมด ~{posts.length}{hasMore ? "+" : ""}</span>}
      </div>
 
      {error && <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
 
      {loading && posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">กำลังโหลดโพสต์...</div>
      ) : posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">ยังไม่มีโพสต์จากนักเรียน</div>
      ) : (
        <ul className="mt-4 space-y-3 max-h-[340px] overflow-auto pr-1">
          {posts.map((p) => (
            <li key={p._id} className="border rounded-xl p-3">
              <div className="flex items-center gap-3">
                <img
                  src={p.authorId?.avatarUrl || "https://via.placeholder.com/40"}
                  alt="avatar"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.authorId?.name || "นักเรียน"}</div>
                  <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                </div>
              </div>
 
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{p.content}</p>
 
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 text-xs text-gray-600 mt-2">
                <div>📅 {p.meta?.preferred_days}</div>
                <div>⏰ {p.meta?.preferred_time}</div>
                <div>📍 {p.meta?.location}</div>
                <div>👥 {p.meta?.group_size}</div>
                <div>💸 ฿{Number(p.meta?.budget || 0).toFixed(2)}</div>
              </div>
 
              {Array.isArray(p.images) && p.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {p.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="rounded-md aspect-square object-cover" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
 
      <div className="mt-3 flex justify-center">
        {hasMore && (
          <button onClick={loadMore} disabled={loading} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">
            {loading ? "กำลังโหลด..." : "โหลดเพิ่ม"}
          </button>
        )}
      </div>
    </div>
  );
}
 
/* ---------------------- โพสต์ของติวเตอร์ (ดึงจาก Backend) ---------------------- */
function TutorPosts({ tutorId }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
 
  useEffect(() => {
    let ignore = false;
    async function load(p = 1, append = false) {
      if (!tutorId) { setPosts([]); setHasMore(false); setLoading(false); return; }
      try {
        setLoading(true);
        const url = `http://localhost:5000/api/tutors/${encodeURIComponent(tutorId)}/posts?page=${p}&limit=5`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          setPosts(prev => (append ? [...prev, ...(data.items || [])] : (data.items || [])));
          setHasMore(data.pagination?.hasMore || false);
          setPage(p);
        }
      } catch (e) {
        if (!ignore) setError(e.message || "โหลดโพสต์ไม่สำเร็จ");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    setError(""); setPosts([]); setHasMore(false);
    load(1, false);
    return () => { ignore = true; };
  }, [tutorId]);
 
  const loadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    try {
      setLoading(true);
      const url = `http://localhost:5000/api/tutors/${encodeURIComponent(tutorId)}/posts?page=${next}&limit=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(prev => [...prev, ...(data.items || [])]);
      setHasMore(data.pagination?.hasMore || false);
      setPage(next);
    } catch (e) {
      setError(e.message || "โหลดเพิ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold">โพสต์จากติวเตอร์</h5>
        {posts.length > 0 && <span className="text-xs text-gray-500">ทั้งหมด ~{posts.length}{hasMore ? "+" : ""}</span>}
      </div>
 
      {error && <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}
 
      {loading && posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">กำลังโหลดโพสต์...</div>
      ) : posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">ยังไม่มีโพสต์จากติวเตอร์</div>
      ) : (
        <ul className="mt-4 space-y-3 max-h-[340px] overflow-auto pr-1">
          {posts.map((p) => (
            <li key={p._id} className="border rounded-xl p-3">
              <div className="text-sm font-medium">อัปเดตจากติวเตอร์</div>
              <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{p.content}</p>
              {Array.isArray(p.images) && p.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {p.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="rounded-md aspect-square object-cover" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
 
      <div className="mt-3 flex justify-center">
        {hasMore && (
          <button onClick={loadMore} disabled={loading} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">
            {loading ? "กำลังโหลด..." : "โหลดเพิ่ม"}
          </button>
        )}
      </div>
    </div>
  );
}
 
// ---------------------- Main Component ----------------------
function Home() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(null);
  const [preview, setPreview] = useState(null); // tutor or subject
  const [previewType, setPreviewType] = useState(null); // "tutor" | "subject"
 
  const filteredTutors = useMemo(() => {
    return TUTORS.filter((t) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.city.toLowerCase().includes(q);
      const matchCat =
        !activeCat ||
        (activeCat === "code" && /python|react|program|code/i.test(t.subject)) ||
        (activeCat === "eng" && /eng|english/i.test(t.subject)) ||
        (activeCat === "math" && /คณิต|math/i.test(t.subject)) ||
        (activeCat === "sci" && /phys|วิทย/i.test(t.subject)) ||
        (activeCat === "thai" && /ไทย/i.test(t.subject));
      return matchQ && matchCat;
    });
  }, [query, activeCat]);
 
  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUBJECTS.filter((s) => !q || s.title.toLowerCase().includes(q));
  }, [query]);
 
  const openTutor = (item) => { setPreview(item); setPreviewType("tutor"); };
  const openSubject = (item) => { setPreview(item); setPreviewType("subject"); };
 
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-16">
        {/* Hero / Search */}
        <div className="pt-8 md:pt-12">
          <div className="bg-white rounded-3xl border shadow-sm p-5 md:p-8 relative overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 mb-3">
                  <Star className="h-3.5 w-3.5" /> คัดมาให้สำหรับคุณ
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
                  หา <span className="underline decoration-gray-900 decoration-4 underline-offset-4">ติวเตอร์</span> ที่ใช่
                  สำหรับคุณได้ง่าย ๆ
                </h1>
                <p className="text-gray-600 mt-3 max-w-prose">
                  ค้นหาติวเตอร์มืออาชีพและคอร์สเรียนยอดนิยม ครอบคลุมทุกวิชา
                  ทั้งออนไลน์และตัวต่อตัว
                </p>
 
                <div className="mt-5 flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="ค้นหาชื่อติวเตอร์ วิชา เมือง..."
                      className="w-full pl-10 pr-3 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <button className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-black">
                    ค้นหา
                  </button>
                </div>
 
                {/* Categories */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <CategoryPill
                      key={c.id}
                      label={c.label}
                      icon={c.icon}
                      active={activeCat === c.id}
                      onClick={() => setActiveCat((v) => (v === c.id ? null : c.id))}
                    />
                  ))}
                </div>
              </div>
 
              {/* Hero Illustration */}
              <div className="hidden md:block">
                <div className="relative aspect-[4/3] rounded-3xl bg-gray-100 border overflow-hidden">
                  <img
                    alt="hero"
                    className="object-cover w-full h-full"
                    src="https://images.unsplash.com/photo-1584697964157-844c76d4d3ae?q=80&w=1600&auto=format&fit=crop"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
 
        {/* Featured Tutors */}
        <section className="mt-10 md:mt-14">
          <SectionHeader
            title="ติวเตอร์แนะนำ"
            subtitle="คะแนนรีวิวสูงและจองบ่อยในสัปดาห์นี้"
            onAction={() => alert("ไปหน้ารวมติวเตอร์ (ตัวอย่าง)")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredTutors.map((t) => (
              <TutorCard key={t.id} item={t} onOpen={openTutor} />
            ))}
            {filteredTutors.length === 0 && <EmptyState label="ไม่พบติวเตอร์ตามคำค้นหา" />}
          </div>
        </section>
 
        {/* Popular Subjects */}
        <section className="mt-12 md:mt-16">
          <SectionHeader
            title="วิชาแนะนำ"
            subtitle="หัวข้อที่มีผู้เรียนสนใจมากที่สุด"
            onAction={() => alert("ไปหน้ารายวิชา (ตัวอย่าง)")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredSubjects.map((s) => (
              <SubjectCard key={s.id} item={s} onOpen={openSubject} />
            ))}
            {filteredSubjects.length === 0 && <EmptyState label="ไม่พบวิชาตามคำค้นหา" />}
          </div>
        </section>
 
        {/* CTA Banner */}
        <section className="mt-14 md:mt-20">
          <div className="rounded-3xl bg-gray-900 text-white p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end justify-between shadow-lg">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold leading-tight">เริ่มต้นเรียนกับติวเตอร์ที่เหมาะกับคุณ</h3>
              <p className="text-gray-300 mt-2 max-w-prose">
                สร้างบัญชีภายใน 1 นาที เลือกวิชา เวลา และงบประมาณได้ตามต้องการ
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <button className="px-5 py-3 rounded-xl bg-white text-gray-900 font-medium hover:bg-gray-100">
                สมัครบัญชีผู้เรียน
              </button>
              <button className="px-5 py-3 rounded-xl bg-transparent border border-white/30 text-white font-medium hover:bg-white/10">
                สมัครเป็นติวเตอร์
              </button>
            </div>
          </div>
        </section>
      </div>
 
      {/* Quick Preview Modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={previewType === "tutor" ? "รายละเอียดติวเตอร์" : "รายละเอียดวิชา"}
      >
        {preview && previewType === "tutor" && (
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2 rounded-xl overflow-hidden border">
              <img src={preview.image} alt={preview.name} className="w-full h-full object-cover" />
            </div>
            <div className="md:col-span-3">
              <h4 className="text-xl font-bold">{preview.name}</h4>
              <p className="text-gray-600">{preview.subject}</p>
              <div className="mt-2 flex items-center gap-2 text-amber-500">
                <Star className="h-4 w-4" /> {preview.rating.toFixed(1)}
                <span className="text-xs text-gray-500">({preview.reviews} รีวิว)</span>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {preview.city}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> คิวถัดไป: {preview.nextSlot}
                </div>
              </div>
              <div className="mt-4 font-semibold">อัตราค่าเรียน ฿{priceText(preview.price)}/ชม.</div>
              <div className="mt-5 flex gap-3">
                <button className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">จองเวลาเรียน</button>
                <button className="px-4 py-2 rounded-lg border hover:bg-gray-50">คุยกับติวเตอร์</button>
              </div>
 
              {/* ✅ โพสต์จากติวเตอร์ */}
              <TutorPosts tutorId={preview.dbTutorId} />
            </div>
          </div>
        )}
 
        {preview && previewType === "subject" && (
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2 rounded-xl overflow-hidden border">
              <img src={preview.cover} alt={preview.title} className="w-full h-full object-cover" />
            </div>
            <div className="md:col-span-3">
              <h4 className="text-xl font-bold">{preview.title}</h4>
              <p className="text-gray-600 mt-1">มีติวเตอร์ {preview.tutors}+ คนให้เลือก</p>
              <ul className="list-disc pl-5 mt-4 text-sm text-gray-700 space-y-1">
                <li>หลักสูตรแนะนำ / Roadmap การเรียน</li>
                <li>ตัวอย่างหัวข้อที่สอน และโจทย์ฝึก</li>
                <li>ระดับชั้น: เริ่มต้น – ขั้นสูง</li>
              </ul>
 
              {/* ✅ โพสต์ของนักเรียน */}
              <StudentPosts subjectKey={preview.dbKey} />
 
              <div className="mt-5 flex gap-3">
                <button className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">ดูติวเตอร์ในวิชานี้</button>
                <button className="px-4 py-2 rounded-lg border hover:bg-gray-50">เพิ่มลงรายการที่สนใจ</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
 
function EmptyState({ label }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border">
      <Search className="h-6 w-6 text-gray-400" />
      <p className="mt-2 text-gray-600 text-sm">{label}</p>
    </div>
  );
}
export default Home;