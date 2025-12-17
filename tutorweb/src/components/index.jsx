import { useState, useEffect } from 'react';
import Login from '../pages/Login';
import Register from '../pages/Register';
import logo from "../assets/logo/FindingTutor_Logo.png";

// Import Icons
import { Star, CheckCircle, Users, BookOpen, ChevronRight, Menu, X } from "lucide-react";

const API_BASE = "http://localhost:5000";
const priceText = (p) => new Intl.NumberFormat("th-TH").format(p);

// Mock Data: รีวิว
const REVIEWS = [
  {
    name: "สมชาย ใจดี",
    role: "นักเรียนชั้น ม.6",
    rating: 5,
    comment: "เว็บไซต์นี้ดีมากครับ ทำให้ผมหาติวเตอร์วิชาฟิสิกส์ที่ถูกใจได้ง่ายมากๆ ตอนนี้สอบติดคณะวิศวะฯ ที่หวังแล้วครับ!",
    avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=200&auto=format&fit=crop"
  },
  {
    name: "คุณครูสมศรี",
    role: "ติวเตอร์วิชาคณิตศาสตร์",
    rating: 5,
    comment: "เป็นแพลตฟอร์มที่ดีสำหรับติวเตอร์ค่ะ ระบบใช้งานง่าย ช่วยให้เราเข้าถึงนักเรียนได้มากขึ้นจริงๆ ค่ะ",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop"
  },
  {
    name: "มานี รักเรียน",
    role: "ผู้ปกครอง",
    rating: 4,
    comment: "หาติวเตอร์สอนภาษาอังกฤษให้น้องป.6 ได้จากที่นี่เลยค่ะ สะดวกดี มีติวเตอร์ให้เลือกเยอะมาก",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop"
  }
];

// --- Sub-components ---

function ReviewCard({ review }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
      <div className="flex items-center mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
        ))}
      </div>
      <p className="text-gray-600 italic flex-grow leading-relaxed">"{review.comment}"</p>
      <div className="mt-6 flex items-center gap-4 pt-4 border-t border-gray-50">
        <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-50" />
        <div>
          <h4 className="font-bold text-gray-900 text-sm">{review.name}</h4>
          <p className="text-xs text-indigo-600 font-medium">{review.role}</p>
        </div>
      </div>
    </div>
  );
}

function TutorCard({ item, onOpen }) {
  return (
    <div 
        className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        onClick={() => onOpen?.(item)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img 
            src={item.image || "https://via.placeholder.com/300"} 
            alt={item.name} 
            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700" 
            loading="lazy" 
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {Number(item.rating || 0).toFixed(1)}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
          {item.name} {item.nickname && <span className="text-gray-500 font-normal text-base">({item.nickname})</span>}
        </h3>
        <p className="text-gray-500 text-sm mt-1 mb-4 truncate">{item.subject || "ไม่ระบุวิชา"}</p>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
            {item.city || "ออนไลน์"}
          </span>
          <span className="text-lg font-bold text-indigo-600">
            ฿{priceText(item.price)}<span className="text-xs font-normal text-gray-400">/ชม.</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="text-center mb-12 max-w-2xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">{title}</h2>
      <p className="text-lg text-gray-500 leading-relaxed">{subtitle}</p>
    </div>
  );
}

// --- Main Component ---

function Index({ setIsAuthenticated, onLoginSuccess }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  // Navbar Scroll Effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Tutors
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

  const handleClose = () => { setShowLogin(false); setShowRegister(false); };
  const handleSwitchToRegister = () => { setShowLogin(false); setShowRegister(true); };
  const handleSwitchToLogin = () => { setShowRegister(false); setShowLogin(true); };

  return (
    <div className="bg-white min-h-screen font-sans text-gray-900">
      
      {/* --- Navbar --- */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
             <img src={logo} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
             {/* <span className="font-bold text-xl md:text-2xl tracking-tighter text-indigo-900">FindingTutor</span> */}
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <button 
                onClick={() => setShowLogin(true)}
                className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors px-4 py-2"
            >
                เข้าสู่ระบบ
            </button>
            <button 
                onClick={() => setShowRegister(true)}
                className="text-sm font-bold bg-indigo-600 text-white px-5 py-2.5 rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5"
            >
                ลงทะเบียนฟรี
            </button>
          </div>
          
          {/* Mobile Menu Button (Optional) */}
          <button className="md:hidden p-2 text-gray-600" onClick={() => setShowLogin(true)}>
             <Menu />
          </button>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-indigo-50 to-white -z-20"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 -z-10"></div>

        <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold mb-6 animate-fade-in-up">
                <Star className="h-4 w-4 fill-indigo-700" /> แพลตฟอร์มเรียนพิเศษอันดับ 1
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-gray-900 leading-tight">
                ค้นหาติวเตอร์ที่ใช่ <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">อัพเกรดอนาคตของคุณ</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                แหล่งรวมติวเตอร์คุณภาพกว่า 10,000 คน ครบทุกวิชา ทั้งออนไลน์และตัวต่อตัว 
                เริ่มต้นเรียนรู้และพัฒนาทักษะใหม่ๆ ได้ตั้งแต่วันนี้
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button 
                    onClick={() => setShowRegister(true)}
                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white font-bold rounded-full text-lg hover:bg-black transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2"
                >
                    เริ่มต้นใช้งานฟรี <ChevronRight size={20} />
                </button>
                <button 
                    onClick={() => setShowLogin(true)}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 font-bold rounded-full text-lg hover:bg-gray-50 transition-all"
                >
                    เข้าสู่ระบบ
                </button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto border-t border-gray-200 pt-8">
                {[
                    { label: "ผู้ใช้งาน", value: "10k+", icon: Users },
                    { label: "ติวเตอร์", value: "500+", icon: CheckCircle },
                    { label: "วิชาเรียน", value: "50+", icon: BookOpen },
                    { label: "ความพึงพอใจ", value: "4.8/5", icon: Star },
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <stat.icon className="h-6 w-6 text-indigo-600 mb-2" />
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                        <div className="text-sm text-gray-500">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
      </header>

      {/* --- New Tutors Section --- */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader 
            title="ติวเตอร์หน้าใหม่ ไฟแรง" 
            subtitle="พบกับติวเตอร์รุ่นใหม่ที่มีเทคนิคการสอนที่ทันสมัย เข้าใจง่าย" 
          />

          {error && <p className="text-center text-rose-500 bg-rose-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading ? (
                [...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-100 rounded-2xl h-80 animate-pulse"></div>
                ))
            ) : (
              tutors.slice(0, 4).map(tutor => (
                <TutorCard key={tutor.id} item={tutor} onOpen={() => setShowLogin(true)} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- Recommend Section (Highlight) --- */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-10">
             <div className="max-w-2xl">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">ติวเตอร์ยอดนิยมประจำสัปดาห์ 🔥</h2>
                <p className="text-gray-500">ติวเตอร์ที่ได้รับคะแนนรีวิวสูงสุดและการจองเรียนมากที่สุด</p>
             </div>
             <button 
                onClick={() => setShowLogin(true)}
                className="hidden md:flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
             >
                ดูทั้งหมด <ChevronRight size={18} />
             </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading ? (
                <p className="col-span-full text-center text-gray-400">กำลังโหลด...</p>
            ) : (
              tutors.slice(4, 8).map(tutor => (
                <TutorCard key={tutor.id} item={tutor} onOpen={() => setShowLogin(true)} />
              ))
            )}
          </div>
          
          <button 
            onClick={() => setShowLogin(true)}
            className="md:hidden w-full mt-8 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl"
          >
            ดูทั้งหมด
          </button>
        </div>
      </section>

      {/* --- Reviews Section --- */}
      <section className="py-24 bg-indigo-900 text-white overflow-hidden relative">
        {/* Decorative BG */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">เสียงตอบรับจากผู้ใช้งานจริง</h2>
            <p className="text-indigo-200 text-lg">ความประทับใจจากนักเรียนและติวเตอร์ที่ใช้งานแพลตฟอร์มของเรา</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {REVIEWS.map((review, index) => (
              <ReviewCard key={index} review={review} />
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA Section (Footer) --- */}
      <section className="py-20 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">พร้อมที่จะเริ่มเรียนรู้แล้วหรือยัง?</h2>
            <p className="text-gray-500 mb-10 text-lg">
                ไม่ว่าคุณจะเป็นนักเรียนที่ต้องการพัฒนาตนเอง หรือติวเตอร์ที่ต้องการแบ่งปันความรู้ 
                เรามีพื้นที่สำหรับคุณ ลงทะเบียนเลยวันนี้ ฟรี!
            </p>
            <button 
                onClick={() => setShowRegister(true)}
                className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-full text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
                สมัครสมาชิกฟรี
            </button>
        </div>
      </section>

      {/* --- Popup Modal --- */}
      {(showLogin || showRegister) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={handleClose}
          ></div>
          
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            <button
              className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition z-10"
              onClick={handleClose}
            >
              <X size={20} />
            </button>
            
            <div className="p-1">
              {showLogin && (
                <Login
                  setIsAuthenticated={setIsAuthenticated}
                  onLoginSuccess={onLoginSuccess}
                  onSwitchToRegister={handleSwitchToRegister}
                />
              )}
              {showRegister && (
                <Register 
                  onRegisterSuccess={onLoginSuccess}
                  onSwitchToLogin={handleSwitchToLogin}
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