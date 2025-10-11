import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';
import Notification from './components/Notification';
import StudentInfo from './pages/Student_Info';
import TutorInfo from './pages/Tutor_Info';
import Booking from './components/Booking';
import MyPost from './components/MyPost';
import Favorite from './components/Favorite';
import Profile from './components/Profile';
import MyPostDetails from './components/MyPostDetails';
import TutorLayout from './components/TutorLayout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [newNotificationCount, setNewNotificationCount] = useState(0);

  // ผู้ใช้ปัจจุบัน
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  // บทบาทผู้ใช้ (student / tutor)
  const [userType, setUserType] = useState(() => {
    const raw = localStorage.getItem('userType');
    return raw ? String(raw) : null;
  });

  // โพสต์ที่ต้องเปิดดูรายละเอียด + cache โพสต์
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [postsCache, setPostsCache] = useState([]);

  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  // เก็บ "หน้าต้นทาง" เพื่อให้ปุ่ม Back ใน MyPostDetails กลับได้ถูกหน้า
  const [backPage, setBackPage] = useState('mypost');
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  // ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  useEffect(() => {
    if (!user?.user_id) return;
    fetch(`http://localhost:5000/api/notifications/${user.user_id}`)
      .then(res => res.json())
      .then(data => {
        const newOnes = Array.isArray(data) ? data.filter(n => !n.is_read) : [];
        setNewNotificationCount(newOnes.length);
      })
      .catch(console.error);
  }, [user]);

  const goToProfileByRole = (roleLike) => {
    const r = String(roleLike || '').toLowerCase();
    if (r === 'student') setCurrentPage('student_info');
    else if (r === 'tutor') setCurrentPage('tutor_info');
    else setCurrentPage('home');
  };

  const handleLoginSuccess = (payload = {}) => {
    const role = (payload.userType || payload.role || payload.user?.role || '').toLowerCase();

    setIsAuthenticated(true);

    if (payload.user) {
      setUser(payload.user);
      localStorage.setItem('user', JSON.stringify(payload.user));
    }

    setUserType(role);
    localStorage.setItem('userType', role);

    goToProfileByRole(role);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('home');
    setUser(null);
    setUserType(null);
    setSelectedPostId(null);
    setPostsCache([]);
    setBackPage('mypost');

    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userType');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // เปิดรายละเอียดโพสต์ + จำว่ามาจากหน้าไหน
  const openPostDetails = (postId, from = 'mypost') => {
    if (!postId) return;
    setSelectedPostId(Number(postId));
    setBackPage(from);                 // << จำหน้าต้นทางไว้
    setCurrentPage('mypost_details');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;

      case 'notification':
        return (
          <Notification
            userId={user?.user_id}
            onReadAll={() => setNewNotificationCount(0)}
            // บอก App ว่าเปิดรายละเอียดมาจาก "notification"
            onOpenPost={(id) => openPostDetails(id, 'notification')}
          />
        );

      case 'student_info':
        return <StudentInfo user={user} />;

      case 'tutor_info':
        return <TutorInfo user={user} />;

      case 'booking':
        return <Booking />;

      case 'mypost':
        return (
          <MyPost
            // บอก App ว่าเปิดรายละเอียดมาจาก "mypost"
            onOpenDetails={(id) => openPostDetails(id, 'mypost')}
            postsCache={postsCache}
            setPostsCache={setPostsCache}
          />
        );

      case 'mypost_details':
        return (
          <MyPostDetails
            postId={selectedPostId}
            me={user?.user_id}
            postsCache={postsCache}
            // กลับไปยังหน้าต้นทางที่บันทึกไว้ (default = 'mypost')
            onBack={() => setCurrentPage(backPage || 'mypost')}
          />
        );

      case 'favorite':
        return <Favorite />;

      case 'profile':
        return <Profile setCurrentPage={setCurrentPage} userType={userType} />;

      case 'tutor_layout':
        return <TutorLayout />;

      default:
        return <Home />;
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        <Index
          setIsAuthenticated={setIsAuthenticated}
          onLoginSuccess={handleLoginSuccess}
        />
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
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
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
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2 relative"
                  >
                    <i className="bi bi-bell-fill font-bold text-2xl"></i>
                    การแจ้งเตือน
                    {newNotificationCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {newNotificationCount}
                      </span>
                    )}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentPage('mypost')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-file-earmark-post font-bold text-2xl"></i>
                    โพสต์
                  </button>
                </li>
                {userType !== 'tutor' && (
                  <li>
                    <button
                      onClick={() => setCurrentPage('favorite')}
                      className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                    >
                      <i className="bi bi-heart-fill font-bold text-2xl"></i> รายการที่สนใจ
                    </button>
                  </li>
                )}


                <li>
                  <button
                    onClick={() => setCurrentPage('profile')}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-person-circle font-bold text-2xl"></i> โปรไฟล์ของฉัน
                  </button>
                </li>
              </ul>
            </div>

            {/* Main */}
            <div className="flex-1">{renderPage()}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
