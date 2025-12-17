import React, { useMemo, useState, useEffect } from "react";
import {
  Heart, MapPin, Calendar, Search, Star, BookOpen, Users, ChevronRight,
  MessageSquarePlus, CalendarCheck, Sparkles, GraduationCap, Clock
} from "lucide-react";

/** ---------------- Config ---------------- */
const API_BASE = "http://localhost:5000";

/** ---------------- Mock ------------------ */
const SUBJECTS = [
  { id: "s1", dbKey: "Math 1", title: "คณิตศาสตร์", tutors: 241, cover: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1200&auto=format&fit=crop" },
  { id: "s2", dbKey: "English", title: "ภาษาอังกฤษ", tutors: 198, cover: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=1200&auto=format&fit=crop" },
  { id: "s3", dbKey: "Physics 1", title: "ฟิสิกส์", tutors: 121, cover: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=1200&auto=format&fit=crop" },
  { id: "s4", dbKey: "Python Beginner", title: "เขียนโปรแกรม", tutors: 302, cover: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1200&auto=format&fit=crop" },
  { id: "s5", dbKey: "Art", title: "ศิลปะ & ดีไซน์", tutors: 74, cover: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1200&auto=format&fit=crop" },
  { id: "s6", dbKey: "Biology 1", title: "ชีววิทยา", tutors: 97, cover: "https://images.unsplash.com/photo-1530210124550-912dc1381cb8?q=80&w=1200&auto=format&fit=crop" },
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

/** ---------------- UI Components -------------- */

// Badge Component
function Badge({ icon: Icon, text, color = "blue" }) {
    const colors = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        rose: "bg-rose-50 text-rose-700 border-rose-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
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
        <button 
            onClick={onAction} 
            className="group inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );
}

function TutorCard({ item, onOpen, onToggleSave }) {
  const [liked, setLiked] = useState(false);
  const toggle = (e) => { e.stopPropagation(); setLiked((v) => !v); onToggleSave?.(item); };

  return (
    <div 
        className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer"
        onClick={() => onOpen?.(item)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img src={item.image} alt={item.name} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
        
        <button
          onClick={toggle}
          className={`absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-md bg-white/30 border border-white/50 transition-colors hover:bg-white ${liked ? "text-rose-500 bg-white" : "text-white"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500" : ""}`} />
        </button>

        <div className="absolute bottom-3 left-3 right-3 text-white">
             <div className="font-bold text-lg truncate">{item.name} {item.nickname && `(${item.nickname})`}</div>
             <div className="text-sm text-gray-200 truncate">{item.subject}</div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
            <Badge icon={Star} text={`${Number(item.rating || 0).toFixed(1)} (${item.reviews || 0})`} color="amber" />
            <div className="text-sm font-semibold text-indigo-600">฿{priceText(item.price)}/ชม.</div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
             <MapPin size={14} />
             <span className="truncate">{item.city || "ออนไลน์"}</span>
        </div>

        <button className="w-full mt-2 py-2.5 rounded-xl bg-gray-50 text-gray-900 font-medium text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
          ดูรายละเอียด
        </button>
      </div>
    </div>
  );
}

function SubjectCard({ item, onOpen }) {
  return (
    <div 
        className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
        onClick={() => onOpen?.(item)}
    >
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

// ... (Modal, TutorPostForm, EmptyState components remain similar but with updated styling if needed) ...

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
          <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {children}
          </div>
        </div>
      </div>
    );
  }

// ... (StudentPosts, TutorPosts, TutorPostForm logic remains the same, just updated classNames for better UI) ...

/** ---------- Student posts ---------- */
function StudentPosts({ subjectKey }) {
    // ... logic same as yours ...
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
  
    const key = subjectKey?.trim();
  
    useEffect(() => {
        // ... fetching logic ...
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
        // ... loadMore logic ...
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
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h5 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-indigo-500" /> โพสต์หาติวเตอร์ล่าสุด
          </h5>
          {posts.length > 0 && <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-md text-gray-600">รวม {posts.length}{hasMore ? "+" : ""} รายการ</span>}
        </div>
  
        {error && <div className="p-4 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">{error}</div>}
  
        {loading && posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">กำลังโหลดข้อมูล...</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">ยังไม่มีโพสต์หาติวเตอร์ในวิชานี้</div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {posts.map((p) => (
              <div key={p._id} className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                    <img src={p.authorId?.avatarUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div>
                        <div className="text-sm font-bold text-gray-900">{p.authorId?.name || "นักเรียน"}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={10} /> {new Date(p.createdAt).toLocaleDateString("th-TH")}
                        </div>
                    </div>
                    </div>
                    {/* <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg">ใหม่</span> */}
                </div>
  
                <p className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50/50 p-3 rounded-xl border border-gray-50">
                    {p.content}
                </p>
  
                <div className="flex flex-wrap gap-2 mt-4">
                     <Badge icon={Calendar} text={p.meta?.preferred_days || "-"} color="blue" />
                     <Badge icon={Clock} text={p.meta?.preferred_time || "-"} color="rose" />
                     <Badge icon={MapPin} text={p.meta?.location || "-"} color="amber" />
                     <Badge icon={Users} text={`${p.meta?.group_size || "-"} คน`} color="emerald" />
                     {p.meta?.budget && <Badge text={`งบ ฿${p.meta.budget}`} color="blue" />}
                </div>
              </div>
            ))}
          </div>
        )}
  
        {hasMore && (
          <button onClick={loadMore} disabled={loading} className="w-full mt-4 py-3 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
            {loading ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
          </button>
        )}
      </div>
    );
}

// ... (TutorPosts & TutorPostForm UI updates similar to StudentPosts - cleaner, better spacing, badges) ...

// ** Simplified TutorPosts for UI consistency **
function TutorPosts({ tutorId }) {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    // ... (logic fetch) ...
    useEffect(() => {
        let ignore = false;
        async function load() {
            if(!tutorId) return;
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE}/api/tutor-posts?tutorId=${tutorId}&limit=5`);
                const data = await res.json();
                if(!ignore) setPosts(data.items || []);
            } catch(e) {} finally { if(!ignore) setLoading(false); }
        }
        load();
        return () => { ignore = true; };
    }, [tutorId]);

    if(loading) return <div className="p-4 text-center text-sm text-gray-500">กำลังโหลดโพสต์...</div>;
    if(!posts.length) return <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl">ยังไม่มีโพสต์อัปเดต</div>;

    return (
        <div className="mt-6 space-y-4">
            <h5 className="font-bold text-gray-800">📌 อัปเดตจากติวเตอร์</h5>
            {posts.map(p => (
                <div key={p._id} className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h6 className="font-bold text-indigo-600">{p.subject}</h6>
                        <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{p.content}</p>
                    <div className="flex flex-wrap gap-2">
                        <Badge text={p.meta?.teaching_days} color="blue" />
                        <Badge text={p.meta?.teaching_time} color="rose" />
                        <Badge text={p.meta?.location} color="amber" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function EmptyState({ label }) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
        <div className="p-4 bg-gray-50 rounded-full mb-3">
             <Search className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-500 font-medium">{label}</p>
      </div>
    );
}

function TutorPostForm({ tutorId, onSuccess, onClose }) {
    // ... (logic from your code) ...
    const [formData, setFormData] = useState({ subject: "", description: "", target_student_level: "", teaching_days: "", teaching_time: "", location: "", price: "", contact_info: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        // ... (validation & fetch logic) ...
        setLoading(true);
        try {
            const res = await fetch('/api/tutor-posts', {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, tutor_id: tutorId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            onSuccess();
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{error}</div>}
            
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">วิชาที่เปิดสอน</label>
                <input type="text" placeholder="เช่น คณิตศาสตร์ ม.ปลาย, ภาษาอังกฤษเพื่อการทำงาน" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" required />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">ระดับชั้นผู้เรียน</label>
                    <select value={formData.target_student_level} onChange={e => setFormData({...formData, target_student_level: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-indigo-500 outline-none" required>
                        <option value="" disabled>-- เลือก --</option>
                        <option value="ประถมศึกษา">ประถมศึกษา</option>
                        <option value="มัธยมต้น">มัธยมศึกษาตอนต้น (ม.1-3)</option>
                        <option value="มัธยมปลาย">มัธยมศึกษาตอนปลาย (ม.4-6)</option>
                    </select>
                </div>
                <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">ค่าเรียน (บาท/ชม.)</label>
                     <input type="number" placeholder="เช่น 300" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" required />
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">รายละเอียดคอร์ส</label>
                <textarea rows="4" placeholder="อธิบายแนวการสอน เนื้อหาที่จะได้เรียน..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" />
            </div>

            <div className="p-4 bg-gray-50 rounded-xl space-y-4 border border-gray-100">
                <h6 className="font-semibold text-gray-700 text-sm flex items-center gap-2"><CalendarCheck size={16}/> ข้อมูลการสอน</h6>
                <div className="grid md:grid-cols-2 gap-4">
                    <input type="date" placeholder="วันสอน (เช่น ส-อา)" value={formData.teaching_days} onChange={e => setFormData({...formData, teaching_days: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-indigo-500 outline-none" />
                    <input type="time" placeholder="เวลา (เช่น 09:00-12:00)" value={formData.teaching_time} onChange={e => setFormData({...formData, teaching_time: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-indigo-500 outline-none" />
                    <input type="text" placeholder="สถานที่ (เช่น Zoom, สยาม)" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-indigo-500 outline-none" />
                    <input type="text" placeholder="ช่องทางติดต่อ (Line ID)" value={formData.contact_info} onChange={e => setFormData({...formData, contact_info: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-indigo-500 outline-none" />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition-colors">ยกเลิก</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50">
                    {loading ? "กำลังบันทึก..." : "ลงประกาศ"}
                </button>
            </div>
        </form>
    );
}

/** ========== STUDENT HOME ========== */
function HomeStudent() {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);       // tutor or subject object
  const [previewType, setPreviewType] = useState(null); // "tutor" | "subject"

  const [tutors, setTutors] = useState([]);
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-20">
        
        {/* --- Hero Section --- */}
        <div className="pt-8 md:pt-12 pb-10">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] shadow-xl p-8 md:p-12 relative overflow-hidden text-white">
            {/* Decoration Circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>

            <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-sm font-medium text-white shadow-sm">
                  <Sparkles size={14} className="text-yellow-300" /> แพลตฟอร์มเรียนพิเศษยุคใหม่
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
                  ค้นหาติวเตอร์ที่ใช่<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-400">อัพเกรดเกรดพุ่ง!</span>
                </h1>
                
                <p className="text-indigo-100 text-lg md:text-xl font-light max-w-lg leading-relaxed">
                  แหล่งรวมติวเตอร์คุณภาพกว่า 1,000 คน ครบทุกวิชา ทั้งออนไลน์และตัวต่อตัว เริ่มต้นเรียนรู้ได้ทันที
                </p>

                {/* Search Box */}
                <div className="mt-8 p-2 bg-white rounded-2xl shadow-lg flex flex-col md:flex-row gap-2 max-w-xl">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ค้นหาวิชา, ชื่อติวเตอร์..." 
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent outline-none text-gray-800 placeholder-gray-400"
                        />
                    </div>
                    <button className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-md">
                        ค้นหา
                    </button>
                </div>

                <div className="pt-4 flex items-center gap-4 text-indigo-100 text-sm font-medium">
                    <div className="flex -space-x-2">
                        <img className="w-8 h-8 rounded-full border-2 border-indigo-600" src="https://i.pravatar.cc/100?img=1" alt=""/>
                        <img className="w-8 h-8 rounded-full border-2 border-indigo-600" src="https://i.pravatar.cc/100?img=2" alt=""/>
                        <img className="w-8 h-8 rounded-full border-2 border-indigo-600" src="https://i.pravatar.cc/100?img=3" alt=""/>
                    </div>
                    <p>มีนักเรียนใช้งานแล้วกว่า 10,000+ คน</p>
                </div>
              </div>

              <div className="hidden lg:block relative">
                 <img 
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop" 
                    alt="Student" 
                    className="rounded-3xl shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500 border-4 border-white/20"
                 />
                 {/* Floating Cards */}
                 <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce-slow">
                    <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CalendarCheck /></div>
                    <div>
                        <div className="text-xs text-gray-500">ติวเตอร์ยืนยันแล้ว</div>
                        <div className="font-bold text-gray-800">พร้อมสอน 24 ชม.</div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Tutors */}
        <section className="mt-10">
          <SectionHeader 
            title="ติวเตอร์แนะนำ" 
            subtitle="ติวเตอร์ยอดนิยม รีวิวดี การันตีคุณภาพ" 
            icon={Star}
            onAction={() => { }} 
          />
          
          {loadErr && <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center gap-2"><div className="w-2 h-2 bg-rose-500 rounded-full"></div>{loadErr}</div>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
               [...Array(4)].map((_, i) => (
                   <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
                       <div className="bg-gray-200 h-48 w-full rounded-xl mb-4"></div>
                       <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                       <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                   </div>
               ))
            ) : tutors.length > 0 ? (
              tutors.map((tutor) => (
                <TutorCard 
                    key={tutor.id} 
                    item={tutor} 
                    onOpen={(item) => { setPreview(item); setPreviewType("tutor"); }} 
                />
              ))
            ) : (
              <div className="col-span-full">
                <EmptyState label="ไม่พบติวเตอร์ที่คุณค้นหา ลองเปลี่ยนคำค้นดูนะ" />
              </div>
            )}
          </div>
        </section>

        {/* Popular Subjects */}
        <section className="mt-20">
          <SectionHeader 
            title="วิชายอดฮิต" 
            subtitle="เลือกเรียนตามวิชาที่คุณสนใจ" 
            icon={BookOpen}
            onAction={() => { }} 
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SUBJECTS.map((s) => (
              <SubjectCard 
                key={s.id} 
                item={s} 
                onOpen={(item) => { setPreview(item); setPreviewType("subject"); }} 
              />
            ))}
          </div>
        </section>

      </div>

      {/* --- Global Modal --- */}
      <Modal 
        open={!!preview} 
        onClose={() => setPreview(null)} 
        title={previewType === "tutor" ? "รายละเอียดติวเตอร์" : "รายละเอียดวิชา"}
      >
        {preview && previewType === "tutor" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
               <img src={preview.image} alt={preview.name} className="w-32 h-32 md:w-48 md:h-48 rounded-2xl object-cover shadow-lg" />
               <div className="flex-1 space-y-2">
                   <h3 className="text-2xl font-bold text-gray-900">{preview.name}</h3>
                   <Badge text={preview.subject} color="blue" />
                   <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                       <span className="flex items-center gap-1"><Star size={14} className="text-amber-500 fill-amber-500"/> {Number(preview.rating).toFixed(1)}</span>
                       <span className="flex items-center gap-1"><MapPin size={14} /> {preview.city || "Online"}</span>
                   </div>
                   <p className="text-gray-600 mt-3 line-clamp-3">
                       ติวเตอร์ใจดี สอนสนุก เน้นความเข้าใจ ประสบการณ์สอนกว่า 5 ปี... (ข้อมูลจำลอง)
                   </p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl text-center border border-gray-100">
                    <div className="text-gray-500 text-xs uppercase font-bold tracking-wide">ค่าเรียน</div>
                    <div className="text-xl font-bold text-indigo-600">฿{priceText(preview.price)}<span className="text-sm text-gray-400 font-normal">/ชม.</span></div>
                </div>
                <button className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-lg shadow-gray-200">
                    <MessageSquarePlus size={18} /> จองเวลาเรียน
                </button>
            </div>

            <div className="border-t border-gray-100 pt-6">
                 <TutorPosts tutorId={preview.dbTutorId} />
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
                     <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Users size={18}/> ต้องการหาติวเตอร์วิชานี้?</h4>
                     <p className="text-indigo-700 text-sm mb-4">
                         โพสต์ความต้องการของคุณ เพื่อให้ติวเตอร์ติดต่อกลับ หรือค้นหาติวเตอร์ที่มีอยู่แล้ว
                     </p>
                     <StudentPosts subjectKey={preview.dbKey} />
                 </div>
            </div>
        )}
      </Modal>
    </div>
  );
}

/** ========== TUTOR HOME ========== */
function HomeTutor() {
  const { user_id } = getUserContext();
  const [tutors, setTutors] = useState([]);
  const [loadingTutors, setLoadingTutors] = useState(true);
  const [isCreatePostModalOpen, setCreatePostModalOpen] = useState(false);

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
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-20">
        
        {/* Tutor Hero */}
        <div className="pt-8 md:pt-12 pb-10">
            <div className="bg-gray-900 rounded-[2.5rem] shadow-xl p-8 md:p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-20 -mt-20"></div>
                <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="inline-block px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-bold mb-4">
                            สำหรับติวเตอร์
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                            เปลี่ยนความรู้ <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">เป็นรายได้เสริม</span>
                        </h1>
                        <p className="text-gray-400 text-lg mb-8 max-w-md">
                            เชื่อมต่อกับนักเรียนที่กำลังมองหาคุณ จัดการตารางสอนง่ายๆ และสร้างรายได้จากสิ่งที่คุณถนัด
                        </p>
                        <button 
                            onClick={() => setCreatePostModalOpen(true)}
                            className="bg-white text-gray-900 px-8 py-3.5 rounded-xl font-bold hover:bg-gray-100 transition-colors inline-flex items-center gap-2 shadow-lg shadow-white/10"
                        >
                            <MessageSquarePlus size={20}/> ลงประกาศรับสอน
                        </button>
                    </div>
                    <div className="hidden md:block relative">
                         <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-2xl border-4 border-gray-700/50 rotate-3 hover:rotate-0 transition-transform duration-500" alt="Tutor" />
                    </div>
                </div>
            </div>
        </div>

        {/* New Tutors Section */}
        <section className="mt-10">
             <SectionHeader title="เพื่อนร่วมงานใหม่" subtitle="ติวเตอร์ที่เพิ่งเข้าร่วมแพลตฟอร์ม" icon={Users} />
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingTutors ? <p className="col-span-full text-center py-10 text-gray-400">กำลังโหลด...</p> : 
                 tutors.slice(0, 4).map(t => <TutorCard key={t.id} item={t} />)
                }
             </div>
        </section>

        {/* Student Requests */}
        <section className="mt-16">
            <SectionHeader title="นักเรียนที่กำลังรอคุณ" subtitle="ค้นหาประกาศหาติวเตอร์ล่าสุด" icon={Search} />
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="mb-6 flex gap-4">
                    <input type="text" placeholder="ค้นหาประกาศ (เช่น คณิต ม.5)" className="flex-1 bg-gray-50 border-0 rounded-xl px-5 py-3 focus:ring-2 focus:ring-indigo-100 outline-none" />
                    <button className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors">ค้นหา</button>
                </div>
                <StudentPosts subjectKey="" />
            </div>
        </section>

      </div>

      <Modal 
        open={isCreatePostModalOpen} 
        onClose={() => setCreatePostModalOpen(false)} 
        title="ลงประกาศรับสอนพิเศษ"
      >
        <TutorPostForm 
          tutorId={user_id} 
          onClose={() => setCreatePostModalOpen(false)}
          onSuccess={() => { setCreatePostModalOpen(false); alert("ลงประกาศสำเร็จ!"); }} 
        />
      </Modal>
    </div>
  );
}

/** ========== ROUTER ========== */
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