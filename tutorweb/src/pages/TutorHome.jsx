import React, { useState, useEffect } from "react";
import {
  Search, Star, BookOpen, Users, MapPin, Calendar, Clock, DollarSign,
  MessageSquarePlus, CalendarCheck, Sparkles, CheckCircle
} from "lucide-react";
import SmartSearch from "../components/SmartSearch";

// Config
const API_BASE = "http://localhost:5000";

// --- Helper Components (เอามาไว้ในนี้เลยจะได้ไม่ error) ---
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

function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {Icon && <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Icon size={20} /></div>}
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
        </div>
        {subtitle && <p className="text-base text-gray-500 ml-1">{subtitle}</p>}
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

// --- Logic Components ---

// 1. รายการโพสต์นักเรียน (Student Requests)
function StudentPostsList({ searchKey }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // [NEW] Handle Offer Click
  const handleOffer = async (postId) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return alert("กรุณาเข้าสู่ระบบก่อน");

    if (!window.confirm("ยืนยันการเสนอสอน?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/student_posts/${postId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      alert("ส่งข้อเสนอเรียบร้อย!");
      // Update local state to reflect change (optimistic or re-fetch)
      setPosts(prev => prev.map(p =>
        p.id === postId || p.student_post_id === postId
          ? { ...p, pending_me: true }
          : p
      ));

    } catch (e) {
      alert("เกิดข้อผิดพลาด: " + e.message);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        let url = "";

        // ถ้าไม่มีคำค้นหา -> ใช้ระบบแนะนำ (Recommendation)
        if (!searchKey) {
          const user = JSON.parse(localStorage.getItem("user"));
          url = `${API_BASE}/api/recommendations/tutor?user_id=${user?.user_id || 0}`;
        } else {
          // ถ้ามีคำค้นหา -> ค้นหาปกติ
          // Need to pass user_id to search as well to check ownership/offer status if supported, 
          // but currently searchController doesn't seem to take user_id for `student_posts` query directly in some versions.
          // However based on server.js logging, GET /api/student_posts DOES use user_id from query if standard route.
          // Wait, the standard route is /api/student_posts?user_id=... for the join check to work?
          // Let's assume we need to attach user_id.
          const user = JSON.parse(localStorage.getItem("user"));
          url = `${API_BASE}/api/student_posts?search=${encodeURIComponent(searchKey)}&limit=12&user_id=${user?.user_id || 0}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);

        if (!ignore) setPosts(items);
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [searchKey]);

  if (loading) return <div className="p-12 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;
  if (posts.length === 0) return <EmptyState label="ไม่พบรายการที่คุณค้นหา" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map(p => {
        const isTaken = p.has_tutor;
        const isOffered = p.pending_me;
        const isApproved = p.joined; // If I am the joined one? server logic says `joined` set if status='approved' for me.

        let btnText = "เสนอสอน";
        let btnDisabled = false;
        let btnClass = "bg-indigo-600 hover:bg-indigo-700 text-white";

        if (isApproved) {
          btnText = "คุณได้รับเลือกแล้ว";
          btnDisabled = true;
          btnClass = "bg-green-600 text-white cursor-default";
        } else if (isTaken) {
          btnText = "ได้ติวเตอร์แล้ว";
          btnDisabled = true;
          btnClass = "bg-gray-300 text-gray-500 cursor-not-allowed";
        } else if (isOffered) {
          btnText = "ส่งข้อเสนอแล้ว";
          btnDisabled = true;
          btnClass = "bg-gray-100 text-gray-500 border border-gray-200 cursor-default";
        }

        return (
          <div key={p.id || p.student_post_id} className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <img src={p.user?.profile_image || p.authorId?.avatarUrl || "/default-avatar.png"} className="w-10 h-10 rounded-full object-cover border" alt="" />
              <div>
                <div className="text-sm font-bold text-gray-900 line-clamp-1">{p.user?.first_name || p.authorId?.name || "นักเรียน"}</div>
                <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString("th-TH")}</div>
              </div>
              {p.grade_level && <span className="ml-auto text-[10px] px-2 py-1 rounded-full font-bold bg-rose-100 text-rose-600">{p.grade_level}</span>}
            </div>
            <h4 className="font-bold text-gray-800 mb-1 line-clamp-1">{p.subject}</h4>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">{p.description}</p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Badge icon={MapPin} text={p.location || "Online"} color="amber" />
              <Badge icon={DollarSign} text={`งบ ${p.budget || 0}`} color="emerald" />
              <Badge icon={Calendar} text={p.preferred_days || "-"} color="blue" />
            </div>

            {/* [NEW] Join Count & Tutor Badge */}
            <div className="mt-3 text-xs text-gray-500 flex items-center flex-wrap gap-2">
              <span>เข้าร่วมแล้ว: <b>{p.join_count || 0}</b> / {p.group_size || 0} คน</span>
              {isTaken && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                  ได้ติวเตอร์แล้ว
                </span>
              )}
            </div>

            <button
              onClick={() => handleOffer(p.id || p.student_post_id)}
              disabled={btnDisabled}
              className={`mt-4 w-full py-2 rounded-lg text-sm font-bold transition-colors ${btnClass}`}
            >
              {btnText}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// 2. รายการโพสต์ของฉัน (My Posts)
function MyTutorPosts({ tutorId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!tutorId) return;
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/tutor-posts?tutorId=${tutorId}&limit=10`);
        const data = await res.json();
        setPosts(data.items || []);
      } finally { setLoading(false); }
    }
    load();
  }, [tutorId]);

  if (loading) return <div className="text-center py-4 text-gray-500">กำลังโหลด...</div>;
  if (!posts.length) return <EmptyState label="คุณยังไม่มีประกาศรับสอน" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {posts.map(p => (
        <div key={p._id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <h6 className="font-bold text-indigo-600">{p.subject}</h6>
            <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-700 mb-3 line-clamp-2">{p.description || p.content}</p>
          <div className="flex flex-wrap gap-2">
            <Badge text={p.meta?.teaching_days} color="blue" />
            <Badge text={p.meta?.teaching_time} color="rose" />
            <Badge text={p.meta?.location} color="amber" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Page Component ---
export default function TutorHome() {
  const [query, setQuery] = useState("");
  const user = JSON.parse(localStorage.getItem("user"));
  const user_id = user?.user_id || 0;

  // รับค่าจาก SmartSearch
  const handleSearch = (val) => {
    setQuery(val);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pb-20">

        {/* --- Hero Section (ปรับดีไซน์ใหม่) --- */}
        <div className="pt-8 md:pt-12 pb-10">
          <div className="relative bg-gray-900 rounded-[2.5rem] shadow-xl p-8 md:p-12 text-white overflow-hidden min-h-[400px] flex items-center">
            {/* Background Effect */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>

            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center w-full">
              <div className="space-y-6">
                <div className="inline-block px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-bold">
                  พื้นที่สำหรับติวเตอร์
                </div>
                <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                  เปลี่ยนความรู้ <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">เป็นรายได้เสริม</span>
                </h1>
                <p className="text-gray-400 text-lg max-w-md">
                  ค้นหานักเรียนที่กำลังมองหาคุณ จัดการตารางสอน และสร้างรายได้จากสิ่งที่คุณถนัด
                </p>

                {/* Unified Search */}
                <div className="relative z-50 max-w-lg">
                  <div className="bg-white p-1.5 rounded-2xl shadow-xl flex items-center">
                    <div className="flex-1">
                      <SmartSearch userId={user_id} onSearch={handleSearch} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/50">
                    <MessageSquarePlus size={20} /> ลงประกาศรับสอน
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Section 1: Student Requests (งานสอน) --- */}
        <section className="mt-12">
          <SectionHeader
            title={query ? `ผลการค้นหานักเรียน: "${query}"` : "นักเรียนที่กำลังรอคุณ"}
            subtitle={query ? "" : "ระบบคัดเลือกนักเรียนที่วิชาและงบประมาณตรงกับคุณมาให้แล้ว"}
            icon={Users}
          />
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm min-h-[300px]">
            {/* ส่ง query ไปให้ StudentPostsList ทำงาน */}
            <StudentPostsList searchKey={query} />
          </div>
        </section>

        {/* --- Section 2: My Posts --- */}
        <section className="mt-12">
          <SectionHeader title="ประกาศรับสอนของคุณ" subtitle="จัดการโพสต์และอัปเดตข้อมูล" icon={BookOpen} />
          <MyTutorPosts tutorId={user_id} />
        </section>

      </div>
    </div>
  );
}