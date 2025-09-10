import React, { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Users,
  MessageCircle,
  Star,
  Search,
  Filter,
  X,
  Trash2,
  MapPin,
  Clock,
  BookOpen,
} from "lucide-react";

/**
 * Favorite.jsx — หน้า "รายการที่ถูกใจ" (Tutors & Posts)
 *
 * ✅ คุณสมบัติหลัก
 * - แท็บสลับระหว่าง "ติวเตอร์" และ "โพสต์"
 * - ค้นหา, จัดเรียง, และตัวกรองเบื้องต้น
 * - ลบออกจากรายการถูกใจแบบเดี่ยว/ทั้งหมด (optimistic update)
 * - รองรับโหลดข้อมูลจาก API; ถ้า error จะ fallback เป็น mock data + localStorage
 * - UI สวย เรียบ ใช้งานง่าย (Tailwind + lucide-react)
 *
 * 🔌 API แนะนำ (ปรับตาม backend ของคุณได้)
 * GET    /api/favorites           -> { tutors: [...], posts: [...] }
 * DELETE /api/favorites/tutors/:id
 * DELETE /api/favorites/posts/:id
 * DELETE /api/favorites/clear?type=tutors|posts
 */

// --------------------------- Mock Data (fallback) ---------------------------
const MOCK_TUTORS = [
  {
    id: "t1",
    name: "ครูแพร",
    avatarUrl:
      "https://images.unsplash.com/photo-1614436163996-25cee5f86928?q=80&w=300&auto=format&fit=crop",
    rating: 4.8,
    reviews: 126,
    subjects: ["คณิต", "ฟิสิกส์"],
    location: "Bangkok",
    pricePerHour: 350,
    isOnline: true,
    likedAt: Date.now() - 1000 * 60 * 60 * 6, // 6 ชั่วโมงที่แล้ว
  },
  {
    id: "t2",
    name: "ครูต้น",
    avatarUrl:
      "https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=300&auto=format&fit=crop",
    rating: 4.5,
    reviews: 89,
    subjects: ["ภาษาอังกฤษ"],
    location: "Chiang Mai",
    pricePerHour: 300,
    isOnline: false,
    likedAt: Date.now() - 1000 * 60 * 60 * 30, // 30 ชั่วโมงที่แล้ว
  },
];

const MOCK_POSTS = [
  {
    id: "p1",
    author: { name: "คุณดาว", avatarUrl: "https://i.pravatar.cc/80?img=12" },
    title: "เทคนิคจำสูตรคณิตแบบใช้ได้จริง",
    body:
      "แชร์วิธีจำสูตรพื้นที่และปริมาตรด้วยภาพจำ + ตัวอย่างโจทย์ที่พบบ่อยในการสอบ…",
    tags: ["คณิต", "เทคนิคการเรียน"],
    likesCount: 204,
    commentsCount: 17,
    image:
      "https://images.unsplash.com/photo-1529078155058-5d716f45d604?q=80&w=1200&auto=format&fit=crop",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 วันที่แล้ว
    likedAt: Date.now() - 1000 * 60 * 20, // 20 นาทีที่แล้ว
  },
  {
    id: "p2",
    author: { name: "ครูมิน", avatarUrl: "https://i.pravatar.cc/80?img=22" },
    title: "รวม 50 ศัพท์ IELTS ที่ต้องรู้",
    body:
      "สรุปศัพท์พร้อมตัวอย่างประโยค ฝึกออกเสียง และเคล็ดลับจำเร็วให้คะแนนพุ่ง…",
    tags: ["อังกฤษ", "IELTS"],
    likesCount: 153,
    commentsCount: 9,
    image: "",
    createdAt: Date.now() - 1000 * 60 * 60 * 8, // 8 ชั่วโมงที่แล้ว
    likedAt: Date.now() - 1000 * 60 * 60 * 1, // 1 ชั่วโมงที่แล้ว
  },
];

const STORAGE_KEY = "favorites_state_v1";

// --------------------------- Utilities ---------------------------
const formatPrice = (n) => new Intl.NumberFormat("th-TH").format(n);
const formatDate = (ms) =>
  new Date(ms).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function useSafeFavorites() {
  const [data, setData] = useState({ tutors: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) ลองโหลดจาก API จริงก่อน
        const res = await fetch("/api/favorites", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!aborted) {
          setData({
            tutors: json.tutors ?? [],
            posts: json.posts ?? [],
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        }
      } catch (e) {
        // 2) ถ้า API ล้มเหลว -> ลองดึงจาก localStorage
        const cache = localStorage.getItem(STORAGE_KEY);
        if (cache && !aborted) {
          try {
            const parsed = JSON.parse(cache);
            setData({ tutors: parsed.tutors ?? [], posts: parsed.posts ?? [] });
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ ใช้ข้อมูลล่าสุดจากอุปกรณ์");
          } catch (_) {
            // 3) ถ้ายังไม่ได้ -> ใช้ Mock
            setData({ tutors: MOCK_TUTORS, posts: MOCK_POSTS });
            setError("ใช้ข้อมูลตัวอย่างชั่วคราว (mock data)");
          }
        } else if (!aborted) {
          setData({ tutors: MOCK_TUTORS, posts: MOCK_POSTS });
          setError("ใช้ข้อมูลตัวอย่างชั่วคราว (mock data)");
        }
      } finally {
        !aborted && setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const updateLocal = (next) => {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
  };

  return { data, setData: updateLocal, loading, error };
}

// --------------------------- Components ---------------------------
function TabButton({ active, children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition " +
        (active
          ? "bg-gray-900 text-white shadow"
          : "bg-gray-100 hover:bg-gray-200 text-gray-700")
      }
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Toolbar({
  q,
  setQ,
  sort,
  setSort,
  filterOnline,
  setFilterOnline,
  onClearAll,
  disabled,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาในรายการที่ถูกใจ…"
          className="w-full rounded-xl border bg-white pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none rounded-xl border bg-white py-2 pl-3 pr-9 text-sm"
          >
            <option value="recent">เรียง: เพิ่งถูกใจ</option>
            <option value="alpha">เรียง: ก-ฮ/ A-Z</option>
            <option value="rating">(ติวเตอร์) เรตติ้งสูงสุด</option>
            <option value="likes">(โพสต์) ไลก์มากสุด</option>
          </select>
          <Filter className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" size={14} />
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-white">
          <input
            type="checkbox"
            className="accent-black"
            checked={filterOnline}
            onChange={(e) => setFilterOnline(e.target.checked)}
          />
          เรียนออนไลน์ได้
        </label>

        <button
          onClick={onClearAll}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          title="ลบทั้งหมดในแท็บนี้"
        >
          <Trash2 size={16} /> ลบทั้งหมด
        </button>
      </div>
    </div>
  );
}

function RatingStars({ value }) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-1">
      {stars.map((i) => (
        <Star
          key={i}
          size={16}
          className={i <= Math.round(value) ? "fill-yellow-400" : "opacity-30"}
        />
      ))}
      <span className="ml-1 text-xs text-gray-600">{value.toFixed(1)}</span>
    </div>
  );
}

function TutorCard({ t, onUnfav }) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-4">
        <img
          src={t.avatarUrl}
          alt={t.name}
          className="h-16 w-16 rounded-xl object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <a href={`/tutors/${t.id}`} className="truncate font-semibold hover:underline">
              {t.name}
            </a>
            <button
              onClick={() => onUnfav(t.id)}
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
              title="นำออกจากที่ถูกใจ"
            >
              <Heart size={14} className="fill-current" /> นำออก
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <RatingStars value={t.rating} />
            <span>• {t.reviews} รีวิว</span>
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {t.location}
            </span>
            {t.isOnline && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 text-xs">
                เรียนออนไลน์ได้
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {t.subjects?.map((s) => (
              <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              <b>{formatPrice(t.pricePerHour)}</b> บาท/ชม.
            </div>
            <div className="text-xs text-gray-500">ถูกใจเมื่อ {formatDate(t.likedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ p, onUnfav }) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition">
      {p.image && (
        <a href={`/posts/${p.id}`}>
          <img src={p.image} alt="cover" className="mb-3 h-44 w-full rounded-xl object-cover" />
        </a>
      )}
      <div className="flex items-start gap-3">
        <img
          src={p.author?.avatarUrl}
          alt={p.author?.name}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <a href={`/posts/${p.id}`} className="font-semibold hover:underline line-clamp-1">
              {p.title}
            </a>
            <button
              onClick={() => onUnfav(p.id)}
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
              title="นำออกจากที่ถูกใจ"
            >
              <Heart size={14} className="fill-current" /> นำออก
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-700 line-clamp-2">{p.body}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {p.tags?.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                #{t}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1">
                <Heart size={16} className="fill-current" /> {p.likesCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={16} /> {p.commentsCount}
              </span>
            </div>
            <div className="text-xs text-gray-500">ถูกใจเมื่อ {formatDate(p.likedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------- Confirm Dialog ---------------------------
function ConfirmDialog({ open, title = "ยืนยันการลบทั้งหมด", message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
          <button onClick={onConfirm} className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">ยืนยัน</button>
        </div>
      </div>
    </div>
  );
}

// --------------------------- Main Page ---------------------------
export default function Favorite() {
  const { data, setData, loading, error } = useSafeFavorites();
  const [tab, setTab] = useState("tutors"); // "tutors" | "posts"
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [filterOnline, setFilterOnline] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---------- Derived lists ----------
  const filteredTutors = useMemo(() => {
    let list = [...(data.tutors || [])];

    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(s) ||
          t.subjects?.some((x) => String(x).toLowerCase().includes(s)) ||
          t.location?.toLowerCase().includes(s)
      );
    }

    if (filterOnline) list = list.filter((t) => t.isOnline);

    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    else if (sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else list.sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));

    return list;
  }, [data.tutors, q, sort, filterOnline]);

  const filteredPosts = useMemo(() => {
    let list = [...(data.posts || [])];

    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(s) ||
          p.body?.toLowerCase().includes(s) ||
          p.tags?.some((x) => String(x).toLowerCase().includes(s)) ||
          p.author?.name?.toLowerCase().includes(s)
      );
    }

    if (sort === "alpha") list.sort((a, b) => (a.title || "").localeCompare(b.title || "", "th"));
    else if (sort === "likes") list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    else list.sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));

    return list;
  }, [data.posts, q, sort]);

  // ---------- Actions ----------
  const unfavTutor = async (id) => {
    const next = { ...data, tutors: data.tutors.filter((t) => t.id !== id) };
    setData(next);
    try {
      await fetch(`/api/favorites/tutors/${id}`, { method: "DELETE", credentials: "include" });
    } catch (_) {
      // ถ้า error -> ไม่ rollback เพื่อความง่าย (ผู้ใช้ยังเห็นลบไปแล้ว)
    }
  };

  const unfavPost = async (id) => {
    const next = { ...data, posts: data.posts.filter((p) => p.id !== id) };
    setData(next);
    try {
      await fetch(`/api/favorites/posts/${id}`, { method: "DELETE", credentials: "include" });
    } catch (_) {}
  };

  const openClearDialog = () => setConfirmOpen(true);

  const doClearCurrentTab = async () => {
    if (tab === "tutors") {
      setData({ ...data, tutors: [] });
    } else {
      setData({ ...data, posts: [] });
    }
    try {
      await fetch(`/api/favorites/clear?type=${tab}`, { method: "DELETE", credentials: "include" });
    } catch (_) {
      // เงียบไว้เพื่อไม่ให้ขัด UX; ผู้ใช้ยังเห็นว่าถูกลบในฝั่ง client แล้ว
    } finally {
      setConfirmOpen(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">รายการที่สนใจ</h1>
            <p className="mt-1 text-gray-600 text-sm">
              เก็บรวบรวมติวเตอร์และโพสต์ที่คุณชอบไว้ในที่เดียว เพื่อกลับมาดูและติดต่อได้สะดวก
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} /> {data.tutors.length} ติวเตอร์
            <span className="mx-1">•</span>
            <BookOpen size={16} /> {data.posts.length} โพสต์
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <TabButton active={tab === "tutors"} onClick={() => setTab("tutors")} icon={Users}>
            ติวเตอร์ที่ถูกใจ
          </TabButton>
          <TabButton active={tab === "posts"} onClick={() => setTab("posts")} icon={BookOpen}>
            โพสต์ที่ถูกใจ
          </TabButton>
        </div>
      </header>

      <section className="rounded-2xl border bg-gray-50 p-4 md:p-5">
        <Toolbar
          q={q}
          setQ={setQ}
          sort={sort}
          setSort={setSort}
          filterOnline={filterOnline}
          setFilterOnline={setFilterOnline}
          onClearAll={openClearDialog}
          disabled={loading || (tab === "tutors" ? !data.tutors.length : !data.posts.length)}
        />

        {/* Content */}
        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-white border" />
              ))}
            </div>
          ) : tab === "tutors" ? (
            filteredTutors.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTutors.map((t) => (
                  <TutorCard key={t.id} t={t} onUnfav={unfavTutor} />)
                )}
              </div>
            ) : (
              <EmptyState type="tutors" query={q} />
            )
          ) : filteredPosts.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((p) => (
                <PostCard key={p.id} p={p} onUnfav={unfavPost} />
              ))}
            </div>
          ) : (
            <EmptyState type="posts" query={q} />
          )}
        </div>

        {/* Error banner (ถ้ามี) */}
        {error && (
          <div className="mt-5 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            ⚠️ {error}
          </div>
        )}
      </section>

      <footer className="mt-6 text-xs text-gray-500">
        อัปเดตล่าสุด: {formatDate(Date.now())}
      </footer>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        message={`ลบทั้งหมดในแท็บ “${tab === "tutors" ? "ติวเตอร์ที่ถูกใจ" : "โพสต์ที่ถูกใจ"}” ?`}
        onConfirm={doClearCurrentTab}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function EmptyState({ type, query }) {
  const isTutor = type === "tutors";
  return (
    <div className="text-center py-14">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200">
        {isTutor ? <Users /> : <BookOpen />}
      </div>
      <h3 className="text-lg font-semibold">
        {query ? "ไม่พบผลลัพธ์ที่ตรงกับการค้นหา" : isTutor ? "ยังไม่มีติวเตอร์ที่ถูกใจ" : "ยังไม่มีโพสต์ที่ถูกใจ"}
      </h3>
      <p className="mt-1 text-gray-600 text-sm">
        {query
          ? "ลองแก้ไขคำค้นหาหรือลบตัวกรองบางอย่างดูนะ"
          : isTutor
          ? "ค้นหาจากหมวดวิชาแล้วกดหัวใจไว้เพื่อบันทึก"
          : "กดถูกใจโพสต์ที่น่าสนใจเพื่อกลับมาดูอีกครั้ง"}
      </p>
      <div className="mt-4">
        <a
          href={isTutor ? "/tutors" : "/posts"}
          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          {isTutor ? <Users size={16} /> : <BookOpen size={16} />} {isTutor ? "ค้นหาติวเตอร์" : "สำรวจโพสต์"}
        </a>
      </div>
    </div>
  );
}
