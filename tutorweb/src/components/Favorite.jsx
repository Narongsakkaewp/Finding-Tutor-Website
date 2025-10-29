import React, { useEffect, useMemo, useState } from "react";
import {Heart,Users,MessageCircle,Star,Search,Filter,X,Trash2,MapPin,BookOpen,} from "lucide-react";

/**
 * Favorite.jsx — รายการที่สนใจ (ดึงจาก /api/favorites/user/:user_id)
 * ใช้คู่กับ backend ที่มีตาราง posts_favorites และ route:
 *   GET  /api/favorites/user/:user_id   -> { success, items:[{ post_type, post_id, subject, description, author, created_at }]}
 *   POST /api/favorites/toggle          -> { success, action, fav_count }
 */

const API_BASE = "http://localhost:5000";
const STORAGE_KEY = "favorites_state_v2";

// --------------------------- Utilities ---------------------------
const formatPrice = (n) => new Intl.NumberFormat("th-TH").format(n);
const formatDate = (ms) =>
  new Date(ms).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function getMe() {
  try {
    const u = JSON.parse(localStorage.getItem("user"));
    return u || {};
  } catch {
    return {};
  }
}

/** ดึงรายการที่สนใจจาก backend แล้วแยกเป็น student/tutor */
function useFavorites() {
  const me = getMe();
  const [data, setData] = useState({ student: [], tutor: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (!me?.user_id) throw new Error("NO_USER");

        const res = await fetch(`${API_BASE}/api/favorites/user/${me.user_id}`);
        const json = await res.json();

        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }

        // แปลงข้อมูลจาก backend -> front
        const student = [];
        const tutor = [];
        for (const it of json.items || []) {
          const normalized = {
            id: `${it.post_type}-${it.post_id}`,
            post_type: it.post_type, // 'student' | 'tutor'
            post_id: it.post_id,
            title: it.subject || "(ไม่มีหัวข้อ)",
            body: it.description || "",
            authorName: it.author || "",
            likedAt: new Date(it.created_at).getTime(),
          };
          if (it.post_type === "student") student.push(normalized);
          else tutor.push(normalized);
        }

        if (!aborted) {
          const next = { student, tutor };
          setData(next);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch (_) {
        // fallback: localStorage
        const cache = localStorage.getItem(STORAGE_KEY);
        if (cache && !aborted) {
          try {
            const parsed = JSON.parse(cache);
            setData({
              student: parsed.student || [],
              tutor: parsed.tutor || [],
            });
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ ใช้ข้อมูลล่าสุดจากอุปกรณ์");
          } catch {
            setData({ student: [], tutor: [] });
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ และไม่พบข้อมูลในเครื่อง");
          }
        } else if (!aborted) {
          setData({ student: [], tutor: [] });
          setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
        }
      } finally {
        !aborted && setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [me?.user_id]);

  const updateLocal = (updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return { me, data, setData: updateLocal, loading, error };
}

// --------------------------- Small UI bits ---------------------------
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

function Toolbar({ q, setQ, sort, setSort, onClearAll, disabled }) {
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
          </select>
          <Filter className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" size={14} />
        </div>

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

function PostCardSimple({ item, onUnfav }) {
  return (
    <div className="group rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
          {item.post_type === "student" ? "นักเรียน" : "ติวเตอร์"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold line-clamp-1">
              {item.title}
            </div>
            <button
              onClick={() => onUnfav(item)}
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
              title="นำออกจากที่สนใจ"
            >
              <Heart size={14} className="fill-current" /> นำออก
            </button>
          </div>

          <div className="mt-1 text-sm text-gray-700 line-clamp-2">
            {item.body}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            โดย {item.authorName || "-"} • ถูกใจเมื่อ {formatDate(item.likedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label, query }) {
  return (
    <div className="text-center py-14">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200">
        <BookOpen />
      </div>
      <h3 className="text-lg font-semibold">
        {query ? "ไม่พบผลลัพธ์ที่ตรงกับการค้นหา" : `ยังไม่มี${label}ที่ถูกใจ`}
      </h3>
      <p className="mt-1 text-gray-600 text-sm">
        {query ? "ลองแก้ไขคำค้นหาหรือลบตัวกรองบางอย่างดูนะ" : "กดหัวใจจากหน้าโพสต์เพื่อบันทึกไว้ที่นี่"}
      </p>
    </div>
  );
}

// --------------------------- Main Page ---------------------------
function Favorite() {
  const { me, data, setData, loading, error } = useFavorites();
  const [tab, setTab] = useState("student"); // 'student' | 'tutor'
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---------- Derived lists ----------
  const list = useMemo(() => {
    let arr = [...(tab === "student" ? data.student : data.tutor)];
    if (q) {
      const s = q.toLowerCase();
      arr = arr.filter(
        (x) =>
          x.title?.toLowerCase().includes(s) ||
          x.body?.toLowerCase().includes(s) ||
          x.authorName?.toLowerCase().includes(s)
      );
    }
    if (sort === "alpha") {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || "", "th"));
    } else {
      arr.sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
    }
    return arr;
  }, [tab, data, q, sort]);

  // ---------- Actions ----------
  const unfav = async (item) => {
    // optimistic
    setData((prev) => {
      const next = {
        student: prev.student.filter((x) => !(x.post_type === item.post_type && x.post_id === item.post_id)),
        tutor: prev.tutor.filter((x) => !(x.post_type === item.post_type && x.post_id === item.post_id)),
      };
      return next;
    });

    try {
      await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: me.user_id,
          post_id: item.post_id,
          post_type: item.post_type,
        }),
      });
    } catch (e) {
      // ไม่ rollback เพื่อให้ UX ลื่น; หากต้อง rollback ให้ดึงใหม่จาก API
      console.error("unfav error:", e);
    }
  };

  const clearCurrentTab = async () => {
    const items = tab === "student" ? data.student : data.tutor;

    // optimistic clear
    setData((prev) => ({
      student: tab === "student" ? [] : prev.student,
      tutor: tab === "tutor" ? [] : prev.tutor,
    }));
    setConfirmOpen(false);

    // ยิง toggle ทีละรายการ (ถ้าอยากเร็วขึ้นค่อยทำ batch ที่ backend)
    try {
      await Promise.all(
        items.map((it) =>
          fetch(`${API_BASE}/api/favorites/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: me.user_id,
              post_id: it.post_id,
              post_type: it.post_type,
            }),
          })
        )
      );
    } catch (e) {
      console.error("bulk clear error:", e);
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
              เก็บโพสต์ที่คุณชอบไว้ในที่เดียว เพื่อกลับมาดูและติดต่อได้สะดวก
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} /> {data.tutor.length + data.student.length} รายการ
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <TabButton active={tab === "student"} onClick={() => setTab("student")} icon={BookOpen}>
            โพสต์ของนักเรียน
          </TabButton>
          <TabButton active={tab === "tutor"} onClick={() => setTab("tutor")} icon={Users}>
            โพสต์ของติวเตอร์
          </TabButton>
        </div>
      </header>

      <section className="rounded-2xl border bg-gray-50 p-4 md:p-5">
        <Toolbar
          q={q}
          setQ={setQ}
          sort={sort}
          setSort={setSort}
          onClearAll={() => setConfirmOpen(true)}
          disabled={loading || list.length === 0}
        />

        {/* Content */}
        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-white border" />
              ))}
            </div>
          ) : list.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((it) => (
                <PostCardSimple key={`${it.post_type}-${it.post_id}`} item={it} onUnfav={unfav} />
              ))}
            </div>
          ) : (
            <EmptyState label={tab === "student" ? "โพสต์ของนักเรียน" : "โพสต์ของติวเตอร์"} query={q} />
          )}
        </div>

        {/* Error banner (ถ้ามี) */}
        {error && (
          <div className="mt-5 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            ⚠️ {error}
          </div>
        )}
      </section>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">ยืนยันการลบทั้งหมด</h3>
            <p className="mt-2 text-sm text-gray-600">
              ลบทั้งหมดในแท็บ “{tab === "student" ? "โพสต์ของนักเรียน" : "โพสต์ของติวเตอร์"}” ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={clearCurrentTab} className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Favorite;