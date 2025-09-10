import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';
import Notification from './components/Notification';
import StudentInfo from './pages/Student_Info';
import TutorInfo from './pages/Tutor_Info';
import Booking from './components/Booking';
import MyPost from './components/MyPost';
import Review from './components/Review';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');

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

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  const goToProfileByRole = (roleLike) => {
    const r = String(roleLike || '').toLowerCase();
    if (r === 'student') setCurrentPage('student_info');
    else if (r === 'tutor') setCurrentPage('tutor_info');
    else alert('ยังไม่ทราบบทบาทผู้ใช้ (student/tutor)...');
  };

  const handleLoginSuccess = (payload = {}) => {
    const role = (payload.userType || payload.role || payload.user?.role || '').toLowerCase();
    setIsAuthenticated(true);
    setUserType(role);
    goToProfileByRole(role);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('home');
    setUserType(null);
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
      case 'mypost':
        return <MyPost />;
      case 'favorite':
        return <Review />;
      default:
        return <Home />;
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
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
            {/* Sidebar (มือถือ + เดสก์ท็อป) */}
            {/* Overlay สำหรับ mobile */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <div
            className={`fixed z-50 top-0 left-0 w-64 bg-white border-r transform 
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              transition-transform duration-300 ease-in-out 
              md:translate-x-0 h-screen md:static md:block`}
            >
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
                  <button
                    onClick={() => setCurrentPage('mypost')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-file-earmark-post font-bold text-2xl"></i>
                    โพสต์ของฉัน
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentPage('favorite')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i class="bi bi-heart-fill font-bold text-2xl"></i> รายการที่สนใจ
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentPage('profile')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-person-circle font-bold text-2xl"></i> โปรไฟล์ของคุณ
                  </button>
                </li>
              </ul>
            </div>
            {/* Content */}
            <div className="flex-1">{renderPage()}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
