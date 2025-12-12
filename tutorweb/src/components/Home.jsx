import React, { useMemo, useState, useEffect } from "react";
import {
  Heart, MapPin, Calendar, Search, Star, BookOpen, Users, ChevronRight,
  MessageSquarePlus, CalendarCheck
} from "lucide-react";

/** ---------------- Config ---------------- */
const API_BASE = "http://localhost:5000";

/** ---------------- Mock ------------------ */

const SUBJECTS = [
  { id: "s1", dbKey: "Math 1", title: "คณิตศาสตร์", tutors: 241, cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop" },
  { id: "s2", dbKey: "English", title: "ภาษาอังกฤษเพื่อการสื่อสาร", tutors: 198, cover: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?q=80&w=1200&auto=format&fit=crop" },
  { id: "s3", dbKey: "Physics 1", title: "ฟิสิกส์", tutors: 121, cover: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop" },
  { id: "s4", dbKey: "Python Beginner", title: "เขียนโปรแกรมด้วย", tutors: 302, cover: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop" },
  { id: "s5", dbKey: "Art", title: "ศิลปะ/ดีไซน์", tutors: 74, cover: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop" },
  { id: "s6", dbKey: "Biology 1", title: "ชีววิทยา", tutors: 97, cover: "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?q=80&w=1200&auto=format&fit=crop" },
];

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

/** ---------------- UI parts -------------- */
function SectionHeader({ title, subtitle, actionLabel = "ดูทั้งหมด", onAction }) {
  return (
    <div className="flex items-end justify-between mb-4 md:mb-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {onAction && (
        <button onClick={onAction} className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900">
          {actionLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CategoryPill({ label, icon, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition shadow-sm ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TutorCard({ item, onOpen, onToggleSave }) {
  const [liked, setLiked] = useState(false);
  const toggle = () => { setLiked((v) => !v); onToggleSave?.(item); };

  return (
    <div className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="relative aspect-square w-full overflow-hidden">
        <img src={item.image} alt={item.name} className="object-cover w-full h-full group-hover:scale-105 transition" loading="lazy" />
        <button
          onClick={toggle}
          aria-label="save"
          className={`absolute top-3 right-3 inline-flex items-center justify-center h-9 w-9 rounded-full backdrop-blur bg-white/80 border ${liked ? "text-rose-500" : "text-gray-500"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-amber-500">
          <Star className="h-4 w-4" />
          <span className="text-sm font-medium">{Number(item.rating || 0).toFixed(1)}</span>
          <span className="text-xs text-gray-500">({item.reviews || 0} รีวิว)</span>
        </div>

        <h3 className="mt-1 font-semibold text-lg leading-tight truncate">
          {item.name}
          {item.nickname && <span className="text-gray-500 font-normal ml-2">({item.nickname})</span>}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-1">{item.subject}</p>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-700 flex items-center gap-2">
            {/* <Calendar className="h-4 w-4" /> */}
            {/* <span>คิวถัดไป: {item.nextSlot}</span> */}
          </div>
          <div className="font-semibold">฿{priceText(item.price)}/ชม.</div>
        </div>

        <button onClick={() => onOpen?.(item)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white py-2.5 text-sm hover:bg-black">
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
        <img src={item.cover} alt={item.title} className="object-cover w-full h-full group-hover:scale-[1.02] transition" loading="lazy" />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg leading-tight line-clamp-1">{item.title}</h3>
        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{item.tutors} ติวเตอร์</span>
        </div>
        <button onClick={() => onOpen?.(item)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 border py-2.5 text-sm hover:bg-gray-50">
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
            <button onClick={onClose} className="px-2 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-100">ปิด</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** ---------- Student posts ---------- */
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
        const url = `${API_BASE}/api/subjects/${encodeURIComponent(key)}/posts?page=${p}&limit=5`;
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
      const url = `${API_BASE}/api/subjects/${encodeURIComponent(key)}/posts?page=${next}&limit=5`;
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
                <img src={p.authorId?.avatarUrl || "https://via.placeholder.com/40"} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
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

/** ---------- Tutor posts (ใช้ /api/tutor-posts?tutorId=) ---------- */
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
        const url = `${API_BASE}/api/tutor-posts?tutorId=${encodeURIComponent(tutorId)}&page=${p}&limit=5`;
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
      const url = `${API_BASE}/api/tutor-posts?tutorId=${encodeURIComponent(tutorId)}&page=${next}&limit=5`;
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
        <h5 className="font-semibold">โพสต์จากติวเตอร์ (ของฉัน)</h5>
        {posts.length > 0 && <span className="text-xs text-gray-500">ทั้งหมด ~{posts.length}{hasMore ? "+" : ""}</span>}
      </div>

      {error && <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

      {loading && posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">กำลังโหลดโพสต์...</div>
      ) : posts.length === 0 ? (
        <div className="mt-3 text-sm text-gray-500">ยังไม่มีโพสต์จากฉัน</div>
      ) : (
        <ul className="mt-4 space-y-3 max-h-[340px] overflow-auto pr-1">
          {posts.map((p) => (
            <li key={p._id} className="border rounded-xl p-3">
              <div className="text-sm font-medium">{p.subject || "อัปเดตจากฉัน"}</div>
              <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{p.content}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 text-xs text-gray-600 mt-2">
                <div>📅 {p.meta?.teaching_days}</div>
                <div>⏰ {p.meta?.teaching_time}</div>
                <div>📍 {p.meta?.location}</div>
                {typeof p.meta?.price === "number" && <div>💸 ฿{p.meta.price.toFixed(2)}</div>}
                {p.meta?.contact_info && <div>☎️ {p.meta.contact_info}</div>}
              </div>
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

function TutorPostForm({ tutorId, onSuccess, onClose }) {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    target_student_level: "",
    teaching_days: "",
    teaching_time: "",
    location: "",
    price: "",
    contact_info: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setError("กรุณากรอกวิชาที่สอน");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const payload = { ...formData, tutor_id: tutorId };
      const res = await fetch('/api/tutor-posts', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json(); // <-- บรรทัดนี้คือจุดที่เกิด Error
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาดในการสร้างโพสต์");

      alert("สร้างโพสต์สำเร็จ!");
      onSuccess();
    } catch (err) {
      console.error("Caught error in handleSubmit:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <input type="text" name="subject" placeholder="วิชาที่สอน" value={formData.subject} onChange={handleChange} required className="border rounded p-2 w-full" />

      {/* ✅ 3. เพิ่ม Dropdown สำหรับเลือกระดับชั้น */}
      <select
        name="target_student_level"
        value={formData.target_student_level}
        onChange={handleChange}
        required
        className="border rounded p-2 w-full bg-white"
      >
        <option value="" disabled>-- เลือกระดับชั้นของนักเรียน --</option>
        <option value="ประถมศึกษา">ประถมศึกษา</option>
        <option value="มัธยมต้น">มัธยมศึกษาตอนต้น (ม.1-ม.3)</option>
        <option value="มัธยมปลาย">มัธยมศึกษาตอนปลาย (ม.4-ม.6)</option>
      </select>

      <textarea name="description" placeholder="รายละเอียดเพิ่มเติม" value={formData.description} onChange={handleChange} className="border rounded p-2 w-full" rows="3" />

      <div className="grid grid-cols-2 gap-4">
        <input type="date" name="teaching_days" value={formData.teaching_days} onChange={handleChange} className="border rounded p-2 w-full" />
        <input type="time" name="teaching_time" value={formData.teaching_time} onChange={handleChange} className="border rounded p-2 w-full" />
      </div>

      <input type="text" name="location" placeholder="สถานที่สอน (เช่น ออนไลน์, สยาม)" value={formData.location} onChange={handleChange} className="border rounded p-2 w-full" />
      <input type="number" name="price" placeholder="ราคาต่อชั่วโมง (บาท)" value={formData.price} onChange={handleChange} className="border rounded p-2 w-full" />
      <input type="text" name="contact_info" placeholder="ข้อมูลติดต่อ (เช่น Line ID)" value={formData.contact_info} onChange={handleChange} className="border rounded p-2 w-full" />

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">ยกเลิก</button>
        <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-sm">
          {loading ? "กำลังโพสต์..." : "โพสต์"}
        </button>
      </div>
    </form>
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


/** ========== STUDENT HOME (คงโครงเดิม) ========== */
function HomeStudent() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(null);
  const [preview, setPreview] = useState(null);      // tutor or subject object
  const [previewType, setPreviewType] = useState(null); // "tutor" | "subject"

  const [tutors, setTutors] = useState([]);          // ← ดึงจาก DB
  const [loadErr, setLoadErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoadErr("");
        setLoading(true);
        const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";
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

  const filteredTutors = useMemo(() => {
    const list = tutors || [];
    return list.filter((t) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.city || "").toLowerCase().includes(q);
      const matchCat =
        !activeCat ||
        (activeCat === "code" && /python|react|program|code/i.test(t.subject || "")) ||
        (activeCat === "eng" && /eng|english/i.test(t.subject || "")) ||
        (activeCat === "math" && /คณิต|math/i.test(t.subject || "")) ||
        (activeCat === "sci" && /phys|วิทย/i.test(t.subject || "")) ||
        (activeCat === "thai" && /ไทย/i.test(t.subject || ""));
      return matchQ && matchCat;
    });
  }, [query, activeCat, tutors]);

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUBJECTS.filter((s) => !q || s.title.toLowerCase().includes(q));
  }, [query]);

  const openTutor = (item) => { setPreview(item); setPreviewType("tutor"); };
  const openSubject = (item) => { setPreview(item); setPreviewType("subject"); };

  return (
    <div className="min-h-screen bg-gray-50">
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
                  หา <span className="underline decoration-gray-900 decoration-4 underline-offset-4">ติวเตอร์</span> ที่ใช่ สำหรับคุณได้ง่าย ๆ
                </h1>
                <p className="text-gray-600 mt-3 max-w-prose">
                  ค้นหาติวเตอร์มืออาชีพและคอร์สเรียนยอดนิยม ครอบคลุมทุกวิชา ทั้งออนไลน์และตัวต่อตัว
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
              </div>

              {/* Hero Illustration */}
              <div className="hidden md:block">
                <div className="relative aspect-[4/3] rounded-3xl bg-gray-100 border overflow-hidden">
                  <img alt="hero" className="object-cover w-full h-full" src="https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Tutors */}
        <section className="mt-10 md:mt-14">
          <SectionHeader title="ติวเตอร์แนะนำ" subtitle="ข้อมูลติวเตอร์" onAction={() => { }} />
          {loadErr && <div className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{loadErr}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {loading ? ( // Check loading state first
              <p className="col-span-full text-center text-gray-500">กำลังโหลดติวเตอร์...</p>
            ) : tutors.length > 0 ? ( // Use tutors state directly
              tutors.map((tutor) => (
                <TutorCard key={tutor.id} item={tutor} onOpen={openTutor} />
              ))
            ) : (
              // Use col-span-full on EmptyState's container
              <div className="col-span-full">
                <EmptyState label="ไม่พบติวเตอร์ตามคำค้นหา" />
              </div>
            )}
          </div>
        </section>

        {/* Popular Subjects */}
        <section className="mt-12 md:mt-16">
          <SectionHeader title="วิชาแนะนำ" subtitle="หัวข้อที่มีผู้เรียนสนใจมากที่สุด" onAction={() => { }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {SUBJECTS.map((s) => (
              <SubjectCard key={s.id} item={s} onOpen={openSubject} />
            ))}
            {SUBJECTS.length === 0 && <EmptyState label="ไม่พบวิชาตามคำค้นหา" />}
          </div>
        </section>
      </div>

      {/* Quick Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={previewType === "tutor" ? "รายละเอียดติวเตอร์" : "รายละเอียดวิชา"}>
        {preview && previewType === "tutor" && (
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2 overflow-hidden">
              <img src={preview.image} alt={preview.name} className="w-60 h-60 object-cover border rounded-lg" />
            </div>
            <div className="md:col-span-3">
              <h4 className="text-xl font-bold">{preview.name}</h4>
              <p className="text-gray-600">{preview.subject}</p>
              <div className="mt-2 flex items-center gap-2 text-amber-500">
                <Star className="h-4 w-4" /> {Number(preview.rating || 0).toFixed(1)}
                <span className="text-xs text-gray-500">({preview.reviews || 0} รีวิว)</span>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
                {/* <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {preview.city}</div> */}
                {/* <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> คิวถัดไป: {preview.nextSlot}</div> */}
              </div>
              <div className="mt-4 font-semibold">อัตราค่าเรียน ฿{priceText(preview.price)}/ชม.</div>
              <div className="mt-5 flex gap-3">
                <button className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">จองเวลาเรียน</button>
                {/* <button className="px-4 py-2 rounded-lg border hover:bg-gray-50">คุยกับติวเตอร์</button> */}
              </div>

              {/* โพสต์จากติวเตอร์ */}
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

              {/* โพสต์ของนักเรียน */}
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

/** ========== TUTOR HOME ========== */
function HomeTutor() {
  const { user_id } = getUserContext(); // ใช้ user_id เพื่อความสอดคล้อง
  const [subjectKey, setSubjectKey] = useState(SUBJECTS[0]?.dbKey || "");
  const [query, setQuery] = useState("");

  // ✅ 1. เพิ่ม State สำหรับดึงข้อมูลติวเตอร์มาแสดง
  const [tutors, setTutors] = useState([]);
  const [loadingTutors, setLoadingTutors] = useState(true);
  const [tutorError, setTutorError] = useState("");
  const [isCreatePostModalOpen, setCreatePostModalOpen] = useState(false);

  // ✅ 2. เพิ่ม useEffect สำหรับ Fetch ข้อมูลติวเตอร์
  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoadingTutors(true);
        setTutorError("");
        // ดึงติวเตอร์มา 8 คน เพื่อแบ่งแสดง 2 section
        const res = await fetch(`${API_BASE}/api/tutors?page=1&limit=8`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTutors(data.items || []);
      } catch (e) {
        setTutorError(e.message || "โหลดรายชื่อติวเตอร์ไม่สำเร็จ");
        setTutors([]);
      } finally {
        setLoadingTutors(false);
      }
    };
    fetchTutors();
  }, []);


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-16">
        {/* Hero (ส่วนหัว) */}
        <div className="pt-8 md:pt-12">
          <div className="bg-white rounded-3xl border shadow-sm p-5 md:p-8 relative overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 mb-3">
                  <Star className="h-3.5 w-3.5" /> โอกาสใหม่ ๆ สำหรับติวเตอร์
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
                  จับคู่กับ <span className="underline decoration-gray-900 decoration-4 underline-offset-4">นักเรียนที่ตรงใจ</span> ได้เร็วขึ้น
                </h1>
                <p className="text-gray-600 mt-3 max-w-prose">
                  ดูคำขอเรียนล่าสุด คัดกรองตามวิชา/เวลา/พื้นที่ แล้วส่งข้อเสนอให้ผู้เรียนทันที
                </p>

                {/* Quick actions */}
                <div className="mt-5 flex flex-wrap gap-3">
                  {/* ✅ 2. แก้ไขปุ่มเดิมให้มี onClick */}
                  <button
                    onClick={() => setCreatePostModalOpen(true)} // <--- เพิ่ม onClick ตรงนี้
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> สร้างโพสต์รับสอน
                  </button>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="relative aspect-[4/3] rounded-3xl bg-gray-100 border overflow-hidden">
                  <img alt="hero" className="object-cover w-full h-full" src="https://images.pexels.com/photos/4144923/pexels-photo-4144923.jpeg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ 3. Section ใหม่: ติวเตอร์ใหม่ */}
        <section className="mt-10 md:mt-14">
          <SectionHeader title="ติวเตอร์ใหม่" subtitle="พบกับติวเตอร์หน้าใหม่ล่าสุดบนแพลตฟอร์มของเรา" />
          {tutorError && <div className="mb-4 text-sm text-rose-600">{tutorError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loadingTutors ? (
              <p className="text-sm text-gray-500 col-span-full">กำลังโหลดติวเตอร์...</p>
            ) : (
              tutors.slice(0, 4).map((t) => <TutorCard key={t.id} item={t} />)
            )}
          </div>
        </section>

        {/* ✅ 4. Section ใหม่: ติวเตอร์แนะนำรายสัปดาห์ */}
        <section className="mt-12 md:mt-16">
          <SectionHeader title="ติวเตอร์แนะนำรายสัปดาห์" subtitle="ติวเตอร์ยอดนิยมที่ถูกคัดเลือกมาเพื่อคุณ" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loadingTutors ? (
              <p className="text-sm text-gray-500 col-span-full">กำลังโหลดติวเตอร์...</p>
            ) : (
              tutors.slice(4, 8).map((t) => <TutorCard key={t.id} item={t} />)
            )}
          </div>
        </section>

        {/* Section เดิม: นักเรียนกำลังมองหา */}
        <section className="mt-12 md:mt-16">
          <SectionHeader title="นักเรียนกำลังมองหา" subtitle="คัดกรองคำขอเรียนตามวิชาที่คุณสอน" />
          <div className="bg-white rounded-2xl border p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาคีย์เวิร์ดในคำขอเรียน..."
                  className="w-full pl-10 pr-3 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <select
                  value={subjectKey}
                  onChange={(e) => setSubjectKey(e.target.value)}
                  className="w-full md:w-64 px-3 py-3 rounded-xl border bg-white"
                >
                  {SUBJECTS.map(s => (<option key={s.id} value={s.dbKey}>{s.title}</option>))}
                </select>
              </div>
            </div>
            <StudentPosts subjectKey={subjectKey} />
          </div>
        </section>
      </div>

      <Modal
        open={isCreatePostModalOpen}
        onClose={() => setCreatePostModalOpen(false)}
        title="สร้างโพสต์รับสอน"
      >
        <TutorPostForm
          tutorId={user_id}
          onClose={() => setCreatePostModalOpen(false)}
          onSuccess={() => {
            setCreatePostModalOpen(false); // ปิด Modal เมื่อโพสต์สำเร็จ
            alert("สร้างโพสต์สำเร็จ!");
          }}
        />
      </Modal>
    </div>
  );
}

/** ========== ROUTER (เลือกหน้าตามบทบาท) ========== */
function HomeRouter() {
  const [{ role }, setCtx] = useState(getUserContext());

  useEffect(() => {
    const onStorage = () => setCtx(getUserContext());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (role === "tutor") return <HomeTutor />;
  return <HomeStudent />;
}

export default HomeRouter;