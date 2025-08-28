import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';
import Notification from './components/Notification';
import StudentInfo from './pages/Student_Info';
import TutorInfo from './pages/Tutor_Info';
import Booking from './components/Booking';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');

  // เก็บ userType ไว้ใน state เพื่อใช้ซ้ำ
  const [userType, setUserType] = useState(() => {
    const raw = localStorage.getItem('userType');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : String(raw);
    } catch {
      return String(raw);
    }
  });

  // sync isAuthenticated -> localStorage
  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  // helper: เปลี่ยนหน้าโปรไฟล์ตามบทบาท
  const goToProfileByRole = (roleLike) => {
    const r = String(roleLike || '').toLowerCase();
    if (r === 'student') setCurrentPage('student_info');
    else if (r === 'tutor') setCurrentPage('tutor_info');
    else alert('ยังไม่ทราบบทบาทผู้ใช้ (student/tutor)...');
  };

  // ถูกเรียกจากหน้า Login เมื่อสำเร็จ
  const handleLoginSuccess = (payload = {}) => {
    const role = (payload.userType || payload.role || payload.user?.role || '').toLowerCase();
    setIsAuthenticated(true);
    setUserType(role);
    // เผื่ออยากไปหน้าโปรไฟล์ทันที:
    goToProfileByRole(role);
  };

  // logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('home');
    setUserType(null);
    // ล้างค่าใน storage ที่เกี่ยวข้อง
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userType');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'notification':
        return <Notification />;
      case 'student_info':
        return <StudentInfo />;
      case 'tutor_info':
        return <TutorInfo />;
      case 'booking':
        return <Booking />;
      default:
        return <Home />;
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        // ส่ง callback ให้หน้าล็อกอิน
        <Index setIsAuthenticated={setIsAuthenticated} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <Navbar
            setSidebarOpen={setSidebarOpen}
            sidebarOpen={sidebarOpen}
            setIsAuthenticated={setIsAuthenticated}
            setCurrentPage={setCurrentPage}
            onLogout={handleLogout}
          />
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden md:block w-64 bg-white border-r min-h-screen">
              <ul className="p-6 space-y-4">
                <li>
                  <button
                    onClick={() => setCurrentPage('home')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-house-door-fill font-bold text-2xl"></i>
                    หน้าหลัก
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentPage('notification')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-bell-fill font-bold text-2xl"></i>
                    การแจ้งเตือน
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentPage('booking')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-table font-bold text-2xl"></i>
                    การติวของฉัน
                  </button>
                </li>
                <li>
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-file-earmark-post font-bold text-2xl"></i> โพสต์ของฉัน
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-star-fill font-bold text-2xl"></i> การรีวิว
                  </a>
                </li>
                {/* <li className="pt-24">
                  <button
                    onClick={handleLogout}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-box-arrow-right font-bold text-2xl"></i> ออกจากระบบ
                  </button>
                </li> */}
              </ul>
            </div>
            {/* Content */}
            <div className="flex-1 px-8 pt-6">{renderPage()}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
