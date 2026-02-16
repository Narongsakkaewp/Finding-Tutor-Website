import { useState, useEffect } from 'react';
import ReactCalendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import Login from '../pages/Login';

import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import logo from "../assets/logo/FindingTutor_Logo.png";

// Import Icons
import {
  Star, CheckCircle, Users, BookOpen, ChevronRight, Menu, X,
  MapPin, Clock, Calendar, Mail, Phone, GraduationCap, Briefcase, PlusCircle, Search, Sparkles
} from "lucide-react";
import SmartSearch from './SmartSearch';

const API_BASE = "http://localhost:5000";
const priceText = (p) => new Intl.NumberFormat("th-TH").format(p || 0);
const formatDateLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ... (ReviewCard, SectionHeader คงเดิม) ...
function ReviewCard({ review }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1">
      <div className="flex items-center mb-4 text-amber-400">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-current' : 'text-gray-400 opacity-30'}`} />
        ))}
      </div>
      <p className="text-indigo-50 flex-grow leading-relaxed font-medium">"{review.comment}"</p>
      <div className="mt-6 flex items-center gap-4 pt-4 border-t border-white/10">
        <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-400" />
        <div>
          <h4 className="font-bold text-white text-sm">{review.name}</h4>
          <p className="text-xs text-indigo-300 font-medium">{review.role}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, light = false }) {
  return (
    <div className="text-center mb-12 max-w-2xl mx-auto px-4">
      <h2 className={`text-4xl md:text-5xl font-black mb-4 tracking-tight ${light ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      <p className={`text-lg leading-relaxed font-medium ${light ? 'text-indigo-100/80' : 'text-gray-500'}`}>{subtitle}</p>
    </div>
  );
}

// ... (TutorCard คงเดิม) ...
function TutorCard({ item, onOpen }) {
  return (
    <div
      className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col"
      onClick={() => onOpen?.(item)}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={item.image || "/../blank_avatar.jpg"}
          alt={item.name}
          className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-60"></div>
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl text-xs font-black text-gray-800 shadow-xl flex items-center gap-1.5 border border-white/20">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> {Number(item.rating || 0).toFixed(1)}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 backdrop-blur-md text-white text-[10px] uppercase font-black rounded-lg border border-indigo-400/50 shadow-lg">
            <MapPin size={12} /> {item.city || "ไม่ระบุสถานที่"}
          </span>
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <h3 className="font-black text-xl text-gray-900 truncate group-hover:text-indigo-600 transition-colors leading-tight">
          {item.name}
        </h3>
        {item.nickname && <p className="text-gray-400 text-sm font-bold mt-0.5">({item.nickname})</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {(item.subject || "ไม่ระบุวิชา").split(',').slice(0, 2).map((s, idx) => (
            <span key={idx} className="px-2.5 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-100">
              {s.trim()}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">เรตติ้ง</span>
            <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
              <Users size={12} className="text-indigo-500" /> {item.reviews || 0} รีวิว
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ... (HighlightPostCard คงเดิม) ...
function HighlightPostCard({ post, onRegister }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all duration-300 group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={post.user?.profile_image || "/default-avatar.png"}
            alt="tutor"
            className="w-12 h-12 rounded-full border-2 border-indigo-400/50 object-cover"
          />
          <div>
            <h4 className="text-white font-bold text-lg leading-tight line-clamp-1">{post.subject}</h4>
            <p className="text-indigo-200 text-xs font-medium">{post.user?.first_name} {post.user?.last_name}</p>
          </div>
        </div>
        <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-indigo-500/30">
          {post.meta?.target_student_level || 'ทั่วไป'}
        </span>
      </div>

      <p className="text-gray-300 text-sm mb-6 line-clamp-3 leading-relaxed flex-grow">
        {post.content || "ไม่มีรายละเอียด"}
      </p>

      <div className="space-y-3 mt-auto">
        <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium">
          <MapPin size={14} className="text-indigo-400" />
          <span className="truncate">{post.meta?.location || "ออนไลน์"}</span>
        </div>
        <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium">
          <Clock size={14} className="text-indigo-400" />
          <span className="truncate">{post.meta?.teaching_days || "-"} {post.meta?.teaching_time}</span>
        </div>

        {/* Contact Info (Hidden/Blurred) */}
        <div className="relative mt-4 pt-4 border-t border-white/10">
          <div className="filter blur-[4px] select-none opacity-50">
            <p className="text-white text-xs">ติดต่อ: 08x-xxx-xxxx</p>
            <p className="text-white text-xs">Line: xxxxxxx</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={onRegister}
              className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
            >
              ล็อกอินเพื่อดูข้อมูล
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ NEW: Student Request Card (ฉบับ UI สวยพรีเมียม ✨)
function StudentRequestCard({ post, onRegister }) {
  return (
    <div className="group bg-white rounded-3xl p-1 border border-orange-100 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full flex flex-col relative overflow-hidden">
      {/* Gradient Top Border */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400"></div>

      <div className="p-6 flex flex-col h-full relative z-10">
        {/* Header with Avatar & Subject */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative">
            <img
              src={post.user?.profile_image || "/default-avatar.png"}
              alt="student"
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-orange-100 group-hover:ring-orange-400 transition-all"
            />
            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full p-1 border-2 border-white">
              <BookOpen size={10} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-gray-900 text-lg leading-tight line-clamp-1 group-hover:text-orange-600 transition-colors">
              {post.subject}
            </h4>
            <p className="text-xs text-gray-400 mt-1 font-medium flex items-center gap-1">
              หาครู <span className="w-1 h-1 rounded-full bg-gray-300"></span> {post.grade_level || 'ไม่ระบุชั้น'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-orange-50/50 rounded-2xl p-4 mb-4 flex-grow">
          <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed font-medium">
            "{post.description || "ต้องการหาติวเตอร์ที่มีประสบการณ์..."}"
          </p>
        </div>

        {/* Meta Info */}
        <div className="space-y-3 mt-auto">
          <div className="flex justify-between items-center text-xs font-bold text-gray-500">
            <span className="flex items-center gap-1.5 truncate max-w-[60%]">
              <MapPin size={14} className="text-orange-400" />
              <span className="truncate">{post.location || "ออนไลน์"}</span>
            </span>
            <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
              งบ {priceText(post.budget)} บ.
            </span>
          </div>

          <button
            onClick={onRegister}
            className="w-full py-3 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all shadow-lg flex items-center justify-center gap-2 group-hover:shadow-orange-500/30"
          >
            <Briefcase size={16} /> สมัครเป็นติวเตอร์
          </button>
        </div>
      </div>
    </div>
  );
}

// ... (TutorDetailModal คงเดิม) ...
function TutorDetailModal({ tutor, onClose, onSignUp }) {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!tutor?.dbTutorId) return;
    fetch(`${API_BASE}/api/calendar/${tutor.dbTutorId}`)
      .then(res => res.ok ? res.json() : { items: [] })
      .then(data => setEvents(data.items || []))
      .catch(err => console.error("Calendar Error:", err));
  }, [tutor]);

  const isDayActive = (date) => {
    const dStr = formatDateLocal(date);
    return events.some(e => (e.event_date || e.start_date || e.date) === dStr);
  };

  const activeEvents = events.filter(e => {
    const dStr = formatDateLocal(selectedDate);
    return (e.event_date || e.start_date || e.date) === dStr;
  });

  const education = Array.isArray(tutor.education) ? tutor.education : [];
  const experience = Array.isArray(tutor.teaching_experience) ? tutor.teaching_experience : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-zoom-in max-h-[90vh] flex flex-col md:flex-row">

        {/* Left Side: Avatar & Basic Info */}
        <div className="md:w-1/3 bg-gray-900 text-white p-8 flex flex-col">
          <button onClick={onClose} className="md:hidden absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <X size={20} />
          </button>

          <div className="relative mx-auto w-48 h-48 mb-6 group">
            <img
              src={tutor.image || "/../blank_avatar.jpg"}
              className="w-full h-full rounded-[2.5rem] object-cover ring-4 ring-indigo-500/30 group-hover:ring-indigo-500 transition-all duration-500"
              alt={tutor.name}
            />
            <div className="absolute -bottom-2 -right-2 bg-indigo-600 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg">
              TUTOR
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black mb-1">{tutor.name}</h2>
            {tutor.nickname && <p className="text-indigo-400 font-bold mb-4 text-xl">({tutor.nickname})</p>}

            <div className="flex justify-center gap-4 text-sm font-bold">
              <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/10 w-24">
                <Star className="text-amber-400 mb-1 fill-amber-400" size={18} />
                <span className="text-lg">{Number(tutor.rating || 0).toFixed(1)}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/10 w-24">
                <Users className="text-indigo-400 mb-1" size={18} />
                <span className="text-lg">{tutor.reviews || 0}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-auto">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
              <h4 className="flex items-center gap-2 font-black text-xs uppercase tracking-widest mb-3 text-indigo-100">สนใจเรียนกับติวเตอร์?</h4>
              <button onClick={onSignUp} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-50 transition-colors">
                สมัครสมาชิกเพื่อจองเรียน
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Info & Calendar */}
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50 custom-scrollbar">
          <button onClick={onClose} className="hidden md:flex absolute top-6 right-6 p-2 bg-gray-200 text-gray-500 rounded-full hover:bg-gray-300 transition">
            <X size={20} />
          </button>

          <div className="space-y-10">
            {/* Section: About */}
            <section>
              <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
                เกี่ยวกับติวเตอร์
              </h3>
              <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-line bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                {tutor.about_me || "ยังไม่ได้ระบุข้อมูลแนะนำตัว"}
              </p>
            </section>

            {/* Section: Education & Experience */}
            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <GraduationCap className="text-indigo-600" size={24} /> ประวัติการศึกษา
                </h3>
                <div className="space-y-4">
                  {education.length > 0 ? education.map((edu, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                      <p className="font-black text-gray-900">{edu.degree}</p>
                      <p className="text-sm text-gray-500 font-bold">{edu.institution} {edu.year && `(${edu.year})`}</p>
                    </div>
                  )) : <p className="text-gray-400 font-medium">ไม่ระบุ</p>}
                </div>
              </section>
              <section>
                <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase className="text-indigo-600" size={24} /> ประสบการณ์สอน
                </h3>
                <div className="space-y-4">
                  {experience.length > 0 ? experience.map((exp, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                      <p className="font-black text-gray-900">{exp.title}</p>
                      <p className="text-sm text-indigo-500 font-bold">{exp.duration}</p>
                      <p className="text-sm text-gray-500 mt-2 font-medium">{exp.description}</p>
                    </div>
                  )) : <p className="text-gray-400 font-medium">ไม่ระบุ</p>}
                </div>
              </section>
            </div>

            {/* Section: Availability Calendar */}
            <section>
              <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={24} /> ตารางสอน
              </h3>
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-lg flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/2">
                  <ReactCalendar
                    className="!w-full !border-none !font-sans rounded-3xl"
                    onChange={setSelectedDate}
                    value={selectedDate}
                    calendarType="gregory"
                    tileClassName={({ date }) =>
                      isDayActive(date)
                        ? "calendar-dot-highlight"
                        : "!rounded-xl !font-bold"
                    }
                    locale="th-TH"
                  />
                </div>
                <div className="flex-1 bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-500" />
                    ตารางงานวันที่ {selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="space-y-3">
                    {activeEvents.length > 0 ? activeEvents.map((evt, idx) => (
                      <div key={idx} className="p-4 bg-white rounded-2xl border-l-[6px] border-indigo-600 shadow-sm flex flex-col gap-1 transform hover:translate-x-1 transition-transform">
                        <p className="font-black text-gray-900 text-sm">{evt.title}</p>
                        <p className="text-xs text-indigo-600 font-black">
                          {evt.event_time || evt.start_time || 'ไม่ระบุเวลา'}
                          {evt.end_time ? ` - ${evt.end_time}` : ''}
                        </p>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-gray-400 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="font-bold">ไม่มีกิจกรรมในวันนี้</p>
                        <p className="text-xs">ติวเตอร์อาจจะว่างให้คุณจองเรียนได้!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

function Index({ setIsAuthenticated, onLoginSuccess }) {
  const [showLogin, setShowLogin] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);

  const [tutors, setTutors] = useState([]);
  const [tutorPosts, setTutorPosts] = useState([]);
  const [studentPosts, setStudentPosts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  // Pagination for Tutors
  const [tutorPage, setTutorPage] = useState(1);
  const [hasMoreTutors, setHasMoreTutors] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ✅ New Search State
  const [searchResults, setSearchResults] = useState({ tutors: [], students: [] });
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ... (fetchTutors, fetchPosts, fetchStudentPosts same as before) 
  // ...

  // ✅ Manual Search Handler (Modified)
  const handleManualSearch = async (query) => {
    if (!query || !query.trim()) {
      setIsSearchActive(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      setSearchResults({
        tutors: data.tutors || [],
        students: data.students || []
      });
      setIsSearchActive(true);

      // Scroll slightly to reveal results if needed, but stay near top
      // window.scrollTo({ top: 400, behavior: 'smooth' }); 

    } catch (err) {
      console.error("Search failed:", err);
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch Tutors (Pagination)
  const fetchTutors = async (page = 1) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`${API_BASE}/api/tutors?page=${page}&limit=8`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลติวเตอร์ได้");
      const data = await res.json();

      const newItems = data.items || [];
      if (page === 1) {
        setTutors(newItems);
      } else {
        setTutors(prev => [...prev, ...newItems]);
      }

      setHasMoreTutors(data.pagination.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTutors(1);
  }, []);

  // ✅ Fetch Tutor Posts (Highlight: 8 Items)
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tutor-posts?limit=8`); // 🔥 แก้เป็น 8
        const data = await res.json();
        setTutorPosts(data.items || []);
      } catch (err) {
        console.error("Error fetching highlight posts:", err);
      }
    };
    fetchPosts();
  }, []);

  // ✅ Fetch Student Posts (Students Waiting: 8 Items)
  useEffect(() => {
    const fetchStudentPosts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student_posts`);
        const data = await res.json();
        setStudentPosts((data || []).slice(0, 8));
      } catch (err) {
        console.error("Error fetching student posts:", err);
      }
    };
    fetchStudentPosts();
  }, []);


  const handleLoadMoreTutors = () => {
    const nextPage = tutorPage + 1;
    setTutorPage(nextPage);
    fetchTutors(nextPage);
  };

  const handleClose = () => { setShowLogin(false); setShowRegister(false); setShowForgotPassword(false); setSelectedTutor(null); };
  const handleSwitchToRegister = () => { setShowLogin(false); setShowRegister(true); setShowForgotPassword(false); };
  const handleSwitchToLogin = () => { setShowRegister(false); setShowForgotPassword(false); setShowLogin(true); };
  const handleSwitchToForgotPassword = () => { setShowLogin(false); setShowForgotPassword(true); };

  const openTutorModal = (tutor) => {
    setSelectedTutor(tutor);
  };

  return (
    <div className="bg-white min-h-screen font-sans text-gray-900 selection:bg-indigo-600 selection:text-white">

      {/* --- Navbar --- */}
      <nav className={`fixed top-0 w-full z-[50] transition-all duration-500 ${isScrolled ? 'bg-white/80 backdrop-blur-xl shadow-xl py-3 border-b border-gray-100' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 group-hover:rotate-6 transition-transform">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-gray-900 leading-none">FindingTutor</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setShowLogin(true)}
              className="text-sm font-black text-gray-600 hover:text-indigo-600 transition-colors uppercase tracking-widest"
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => setShowRegister(true)}
              className="text-sm font-black bg-gray-900 text-white px-8 py-3.5 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl hover:shadow-indigo-500/20 active:scale-95 transform translate-y-0"
            >
              ลงทะเบียนฟรี
            </button>
          </div>

          <button className="md:hidden w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-900" onClick={() => setShowLogin(true)}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header className="relative pt-40 lg:pb-16 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[150%] bg-gradient-to-b from-indigo-50 via-white to-white -z-20"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-gradient-to-br from-purple-200/40 to-indigo-100/20 rounded-full blur-[120px] animate-pulse -z-10"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-gradient-to-tr from-blue-200/40 to-indigo-100/20 rounded-full blur-[120px] animate-pulse -z-10" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-white border border-indigo-100 shadow-xl shadow-indigo-100/50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-10 animate-fade-in-up">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></div>
            Best Learning Platform in Thailand
          </div>
          {/* <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 text-gray-900 leading-[0.9] animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            ค้นหาติวเตอร์ที่ใช่ <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-900">เกรดพุ่ง...ไม่มีหยุด</span>
          </h1> */}

          <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mx-auto mb-14 leading-relaxed font-medium animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            แหล่งรวมติวเตอร์คุณภาพระดับท็อป ครบทุกหลักสูตร จองเรียนง่าย <br className="hidden md:block" />
            ออกแบบการเรียนได้ด้วยตัวเอง ทั้งแบบออนไลน์และตัวต่อตัว
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <button
              onClick={() => setShowRegister(true)}
              className="group w-full sm:w-auto px-10 py-5 bg-gray-900 text-white font-black rounded-[2rem] text-xl hover:bg-indigo-600 transition-all shadow-2xl hover:shadow-indigo-500/40 active:scale-95 flex items-center justify-center gap-3"
            >
              เริ่มต้นใช้งานฟรี
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight size={20} />
              </div>
            </button>
            <button
              onClick={() => setShowLogin(true)}
              className="w-full sm:w-auto px-10 py-5 bg-white text-gray-900 font-black rounded-[2rem] text-xl hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-xl hover:shadow-indigo-100"
            >
              สำรวจวิชาเรียน
            </button>
          </div>

          <div className="mt-14 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-8">ครอบคลุมทุกระดับการศึกษา</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
              {['ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'มหาวิทยาลัย', 'IELTS/TOEIC', 'เขียนโปรแกรม'].map((item, i) => (
                <span key={i} className="text-2xl font-black text-gray-900">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ✅ Smart Search Box */}
      <div className="max-w-xl mx-auto mb-14 relative z-50 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <SmartSearch
          userId={null}
          onSelectResult={(item, type) => {
            if (type === 'tutor') {
              openTutorModal(item);
            } else {
              setShowRegister(true);
            }
          }}
          onSearch={handleManualSearch}
        />
      </div>

      {/* --- ✅ SEARCH RESULTS SECTION (Conditional) --- */}
      {isSearchActive && (
        <section className="py-16 bg-gradient-to-b from-white to-indigo-50/30 relative animate-fade-in-up">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-indigo-900 flex items-center gap-3">
                <Search className="text-indigo-600" /> ผลการค้นหา
              </h2>
              <button
                onClick={() => { setIsSearchActive(false); setSearchResults({ tutors: [], students: [] }); }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all text-sm flex items-center gap-2"
              >
                <X size={16} /> ปิดการค้นหา
              </button>
            </div>

            {searchResults.tutors.length === 0 && searchResults.students.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm opacity-60">
                <Search size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-xl font-bold text-gray-400">ไม่พบข้อมูลที่ตรงกัน</p>
                <p className="text-sm text-gray-400 mt-2">ลองค้นหาด้วยคำอื่น หรือดูรายการทั้งหมดด้านล่าง</p>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Results: Tutors */}
                {searchResults.tutors.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <GraduationCap size={20} className="text-indigo-500" /> ติวเตอร์
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                      {searchResults.tutors.map(tutor => (
                        <TutorCard key={tutor.id} item={tutor} onOpen={openTutorModal} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Results: Students */}
                {searchResults.students.length > 0 && (
                  <div>
                    <div className="w-full h-px bg-gray-200 my-8"></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <BookOpen size={20} className="text-orange-500" /> ประกาศหาครู
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {searchResults.students.map(post => (
                        <StudentRequestCard key={post.id} post={post} onRegister={() => setShowRegister(true)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- Tutors Section --- */}
      <section className="pb-24 bg-white relative overflow-hidden" id="tutors-section">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-[100px] -z-10 opacity-50"></div>
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            title="ติวเตอร์ทั้งหมด"
            subtitle="พบกับติวเตอร์คุณภาพมากมาย พร้อมเทคนิคการสอนที่หลากหลายเพื่อคุณ"
          />

          {error && <p className="text-center text-rose-500 bg-rose-50 p-4 rounded-3xl font-bold mb-8">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-[2rem] h-[28rem] animate-pulse border border-gray-100"></div>
              ))
            ) : (
              tutors.map(tutor => (
                <TutorCard key={tutor.id} item={tutor} onOpen={openTutorModal} />
              ))
            )}
          </div>

          {hasMoreTutors && !loading && (
            <div className="mt-12 text-center">
              <button
                onClick={handleLoadMoreTutors}
                disabled={loadingMore}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-2xl transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {loadingMore ? 'กำลังโหลด...' : (
                  <>
                    <PlusCircle size={20} /> ดูเพิ่มเติม
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --- Highlight Section (Tutor Posts) --- */}
      <section className="py-24 bg-gray-900 border-y border-white/5 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 px-4">
            <div className="max-w-2xl text-left">
              <span className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3 block">Highlight</span>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">โพสต์ประกาศสอน (ใหม่) 🔥</h2>
              <p className="text-indigo-100/60 text-lg font-medium leading-relaxed">คอร์สเรียนใหม่ๆ จากติวเตอร์ที่พร้อมให้ความรู้คุณ สมัครเลย!</p>
            </div>
            <button
              onClick={() => setShowLogin(true)}
              className="hidden md:flex items-center gap-3 text-white font-black hover:text-indigo-400 transition-colors uppercase tracking-widest text-sm py-4 border-b-2 border-white/10"
            >
              ดูโพสต์ทั้งหมด <ChevronRight size={20} className="text-indigo-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {tutorPosts.length === 0 ? (
              <p className="col-span-full text-center text-white/40 py-20 font-bold">กำลังโหลดประกาศ...</p>
            ) : (
              tutorPosts.map(post => (
                <HighlightPostCard key={post._id} post={post} onRegister={() => setShowRegister(true)} />
              ))
            )}
          </div>

          <button
            onClick={() => setShowLogin(true)}
            className="md:hidden w-full mt-12 py-5 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl border border-white/10 transition-all uppercase tracking-widest text-sm"
          >
            ดูโพสต์ทั้งหมด
          </button>
        </div>
      </section>

      {/* --- Student Posts Section (นักเรียนที่รอคุณอยู่) --- */}
      <section className="py-24 bg-orange-50/50 border-t border-orange-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHeader
            title="นักเรียนที่กำลังรอคุณอยู่"
            subtitle="โอกาสในการสอนรอคุณอยู่มากมาย สมัครเป็นติวเตอร์วันนี้แล้วเริ่มรับงานได้เลย!"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {studentPosts.length === 0 ? (
              <p className="col-span-full text-center text-gray-400 py-10 font-bold">ยังไม่มีโพสต์นักเรียนใหม่ในขณะนี้</p>
            ) : (
              studentPosts.map(post => (
                <StudentRequestCard key={post.id} post={post} onRegister={() => setShowRegister(true)} />
              ))
            )}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => setShowRegister(true)}
              className="px-10 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg hover:bg-orange-700 transition-all transform hover:-translate-y-1 active:scale-95 inline-flex items-center gap-2"
            >
              <Briefcase size={20} /> สมัครเป็นติวเตอร์เลย
            </button>
          </div>
        </div>
      </section>

      {/* --- CTA Section --- */}
      <section className="py-32 bg-white text-center relative">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-5xl md:text-7xl font-black text-gray-900 mb-8 leading-[0.95]">พร้อมที่จะก้าวสู่ <br className="md:hidden" /> <span className="text-indigo-600 tracking-tighter">ความสำเร็จแล้วหรือยัง?</span></h2>
          <p className="text-xl text-gray-500 mb-14 leading-relaxed font-medium">
            ไม่ว่าเป้าหมายของคุณจะเป็นเกรด 4.00, สอบติดมหาวิทยาลัยที่ฝัน หรือเก่งภาษา <br className="hidden md:block" />
            เรามีติวเตอร์ที่พร้อมจะเคียงข้างคุณไปจนถึงจุดหมาย
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowRegister(true)}
              className="px-12 py-5 bg-indigo-600 text-white font-black rounded-[2rem] text-xl shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-600/50 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              เริ่มต้นหาติวเตอร์ของคุณได้ที่นี่
            </button>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-12 border-t border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 grayscale opacity-60">
            <img src={logo} alt="Logo" className="h-10 w-auto" />
            <span className="font-black text-gray-900">FindingTutor</span>
          </div>
          <div className="flex gap-8 text-sm font-bold text-gray-400 uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">© 2026 FindingTutor Thailand. All rights reserved.</p>
        </div>
      </footer>

      {/* --- Auth Modal --- */}
      {(showLogin || showRegister || showForgotPassword) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md animate-fade-in" onClick={handleClose}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in">
            <button className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition z-[110]" onClick={handleClose}>
              <X size={20} />
            </button>
            <div className="p-2">
              {showLogin && (
                <Login
                  setIsAuthenticated={setIsAuthenticated}
                  onLoginSuccess={onLoginSuccess}
                  onSwitchToRegister={handleSwitchToRegister}
                  onSwitchToForgotPassword={handleSwitchToForgotPassword}
                />
              )}
              {showRegister && (
                <Register
                  onRegisterSuccess={onLoginSuccess}
                  onSwitchToLogin={handleSwitchToLogin}
                />
              )}
              {showForgotPassword && (
                <ForgotPassword
                  onSwitchToLogin={handleSwitchToLogin}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Tutor Detail Modal --- */}
      {selectedTutor && (
        <TutorDetailModal
          tutor={selectedTutor}
          onClose={() => setSelectedTutor(null)}
          onSignUp={handleSwitchToRegister}
        />
      )}

      {/* Global Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes zoom-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin-slow {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes spin-reverse-slow {
            from { transform: translate(-50%, -50%) rotate(360deg); }
            to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-fade-in { animation: fade-in 1s ease both; }
        .animate-zoom-in { animation: zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
        
        .react-calendar { border: none !important; width: 100% !important; background: transparent !important; }
        .react-calendar__navigation button { font-weight: 900; font-family: inherit; font-size: 1.1rem; color: #1a1a1a; }
        .react-calendar__tile { padding: 1em 0.5em !important; }
        .react-calendar__month-view__weekdays__weekday { font-weight: 900; color: #6366f1; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
        .react-calendar__tile--now { background: white !important; border: 2px solid #6366f1 !important; border-radius: 12px; font-weight: 900; color: #111827 !important; }
        .react-calendar__tile--active { background: #4f46e5 !important; border-radius: 12px; color: white !important; }
        .react-calendar__tile:hover { background: #f3f4f6 !important; border-radius: 12px; }
        .calendar-dot-highlight { background: #eef2ff !important; border-radius: 12px; color: #4f46e5 !important; font-weight: 700; }
      `}} />

    </div>
  );
}

export default Index;