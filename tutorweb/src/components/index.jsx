import { useState, useEffect } from 'react';
import Login from '../pages/Login';
import Register from '../pages/Register';
import logo from "../assets/logo/FindingTutor_Logo.png";

import { Star } from "lucide-react";

const API_BASE = "http://localhost:5000";
const priceText = (p) => new Intl.NumberFormat("th-TH").format(p);

// ✅ 1. เพิ่มโค้ด 2 ส่วนนี้เข้าไปค่ะ
const REVIEWS = [
  {
    name: "สมชาย ใจดี",
    role: "นักเรียนชั้น ม.6",
    rating: 5,
    comment: "เว็บไซต์นี้ดีมากครับ ทำให้ผมหาติวเตอร์วิชาฟิสิกส์ที่ถูกใจได้ง่ายมากๆ ตอนนี้สอบติดคณะวิศวะฯ ที่หวังแล้วครับ!",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop"
  },
  {
    name: "คุณครูสมศรี",
    role: "ติวเตอร์วิชาคณิตศาสตร์",
    rating: 5,
    comment: "เป็นแพลตฟอร์มที่ดีสำหรับติวเตอร์ค่ะ ระบบใช้งานง่าย ช่วยให้เราเข้าถึงนักเรียนได้มากขึ้นจริงๆ ค่ะ",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop"
  },
  {
    name: "มานี รักเรียน",
    role: "ผู้ปกครอง",
    rating: 4,
    comment: "หาติวเตอร์สอนภาษาอังกฤษให้น้องป.6 ได้จากที่นี่เลยค่ะ สะดวกดี มีติวเตอร์ให้เลือกเยอะมาก",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
  }
];

function ReviewCard({ review }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col h-full">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-5 w-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        ))}
      </div>
      <blockquote className="mt-4 text-gray-600 flex-grow">
        "{review.comment}"
      </blockquote>
      <div className="mt-6 flex items-center gap-3">
        <img src={review.avatar} alt={review.name} className="w-12 h-12 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-gray-900">{review.name}</p>
          <p className="text-sm text-gray-500">{review.role}</p>
        </div>
      </div>
    </div>
  );
}

// Component Header ที่นำมาใช้ซ้ำ
function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex items-end justify-between mb-4 md:mb-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// Component TutorCard ที่นำมาใช้ซ้ำ
function TutorCard({ item, onOpen }) {
  return (
    <div className="group bg-white rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="relative aspect-square overflow-hidden">
        <img src={item.image} alt={item.name} className="object-cover w-full h-full group-hover:scale-105 transition" loading="lazy" />
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
          <div></div> {/* Empty div for alignment */}
          <div className="font-semibold">฿{priceText(item.price)}/ชม.</div>
        </div>
        <button onClick={() => onOpen?.(item)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white py-2.5 text-sm hover:bg-black">
          ดูรายละเอียด
        </button>
      </div>
    </div>
  );
}

function Index({ setIsAuthenticated, onLoginSuccess }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // State ใหม่สำหรับดึงข้อมูลติวเตอร์
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleSwitchToLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
  };

  // useEffect สำหรับ Fetch ข้อมูลติวเตอร์เมื่อหน้าเว็บโหลด
  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/tutors?page=1&limit=8`);
        if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลติวเตอร์ได้");
        const data = await res.json();
        setTutors(data.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTutors();
  }, []);

  const handleClose = () => {
    setShowLogin(false);
    setShowRegister(false);
  };

  const handleSwitchToRegister = () => {
    setShowLogin(false); // ซ่อนฟอร์ม Login
    setShowRegister(true);  // แสดงฟอร์ม Register
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Navbar */}
      <div className="flex items-center justify-between px-8 py-4 bg-white shadow-sm">
        <img src={logo} alt="Logo" className="h-16" />
        <div className="flex gap-4 items-center">
          <button
            className="bg-gray-700 text-white font-bold px-4 py-2 rounded"
            onClick={() => setShowLogin(true)}
          >
            เข้าสู่ระบบ
          </button>
          <button
            className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded"
            onClick={() => setShowRegister(true)}
          >
            ลงทะเบียน
          </button>
        </div>
      </div>

      {/* Section ติวเตอร์ใหม่ */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-10 md:py-14">
        <section>
          <SectionHeader title="ติวเตอร์ใหม่ล่าสุด" subtitle="พบกับติวเตอร์หน้าใหม่ที่พร้อมสอนคุณ" />

          {error && <p className="text-center text-red-500">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              <p className="col-span-full text-center text-gray-500">กำลังโหลดติวเตอร์...</p>
            ) : (
              tutors.slice(0, 4).map(tutor => (
                <TutorCard
                  key={tutor.id}
                  item={tutor}
                  onOpen={() => setShowLogin(true)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section ติวเตอร์แนะนำรายสัปดาห์ */}
        <section className="mt-12 md:mt-16">
          <SectionHeader title="ติวเตอร์แนะนำรายสัปดาห์" subtitle="ติวเตอร์ยอดนิยมที่ถูกคัดเลือกมาเพื่อคุณ" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              <p className="col-span-full text-center text-gray-500">กำลังโหลดติวเตอร์...</p>
            ) : (
              tutors.slice(4, 8).map(tutor => (
                <TutorCard key={tutor.id} item={tutor} onOpen={() => setShowLogin(true)} />
              ))
            )}
          </div>
        </section>

        {/* Section รีวิวจากผู้ใช้งาน */}
        <section className="mt-12 md:mt-16">
          <SectionHeader title="เสียงตอบรับจากผู้ใช้งาน" subtitle="สิ่งที่นักเรียนและติวเตอร์พูดถึงเรา" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {REVIEWS.map((review, index) => (
              <ReviewCard key={index} review={review} />
            ))}
          </div>
        </section>
      </div>

      {/* Popup Modal (เหมือนเดิม แต่ส่ง onLoginSuccess เข้าไปด้วย) */}
      {(showLogin || showRegister) && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="relative bg-transparent">
            <button
              className="absolute -top-2 -right-6 text-3xl text-white"
              onClick={handleClose}
            >
              &times;
            </button>
            <div className="bg-white rounded shadow-lg p-0">
              {showLogin && (
                <Login
                  setIsAuthenticated={setIsAuthenticated}
                  onLoginSuccess={onLoginSuccess}
                  onSwitchToRegister={handleSwitchToRegister} // ✅ เพิ่ม prop นี้เข้าไป
                />
              )}
              {showRegister && (
                <Register 
                  onRegisterSuccess={onLoginSuccess}
                  onSwitchToLogin={handleSwitchToLogin} // <--- ส่งฟังก์ชันสลับหน้าไป
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Index;