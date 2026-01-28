import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';
import Notification from './components/Notification';
import StudentInfo from './pages/Student_Info';
import TutorInfo from './pages/Tutor_Info';
import MyPost from './components/MyPost';
import Favorite from './components/Favorite';
import Profile from './components/Profile';
import TutorProfile from './components/TutorProfile';
import MyPostDetails from './components/MyPostDetails';
import TutorLayout from './components/TutorLayout';
import StudentCalendar from './components/StudentCalendar';
import Settings from './components/Settings';
import ReportIssueModal from './components/ReportIssueModal';
import UserProfilePage from './pages/UserProfilePage'; // [NEW]
import AdminDashboard from './components/AdminDashboard'; // [NEW]

// ✅ 1. Import Icons from lucide-react
import {
  LayoutDashboard,
  Bell,
  FileText,
  Heart,
  User,
  LogOut,
  ShieldAlert
} from "lucide-react";


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'home';
  });

  const [newNotificationCount, setNewNotificationCount] = useState(0);

  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const [userType, setUserType] = useState(() => {
    const raw = localStorage.getItem('userType');
    return raw ? String(raw) : null;
  });

  const [selectedPostId, setSelectedPostId] = useState(() => {
    const saved = localStorage.getItem('selectedPostId');
    return saved ? Number(saved) : null;
  });

  const [selectedPostType, setSelectedPostType] = useState(() => {
    return localStorage.getItem('selectedPostType') || null;
  });

  const [backPage, setBackPage] = useState(() => {
    return localStorage.getItem('backPage') || 'mypost';
  });

  const [viewingUserId, setViewingUserId] = useState(null); // [NEW] For viewing other profiles

  const [postsCache, setPostsCache] = useState([]);

  const [showReportModal, setShowReportModal] = useState(false); // ✅ State ควบคุม Modal

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);

    if (selectedPostId) {
      localStorage.setItem('selectedPostId', selectedPostId);
    } else {
      localStorage.removeItem('selectedPostId');
    }

    if (selectedPostType) {
      localStorage.setItem('selectedPostType', selectedPostType);
    } else {
      localStorage.removeItem('selectedPostType');
    }

    if (backPage) {
      localStorage.setItem('backPage', backPage);
    }
  }, [currentPage, selectedPostId, selectedPostType, backPage]);

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

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

  const handleLoginSuccess = (payload = {}) => {
    const role = (payload.userType || payload.role || payload.user?.role || '').toLowerCase();
    setIsAuthenticated(true);
    if (payload.user) {
      setUser(payload.user);
      localStorage.setItem('user', JSON.stringify(payload.user));
    }
    setUserType(role);
    localStorage.setItem('userType', role);

    // ✅ เช็ค Flag: ถ้าสมัครใหม่ ให้เด้งไปหน้ากรอกประวัติ (Info)
    if (payload.isNewRegistration) {
      if (role === 'tutor') {
        setCurrentPage('tutor_info');
      } else if (role === 'student') {
        setCurrentPage('student_info');
      } else {
        setCurrentPage('home');
      }
    } else {
      // Login ปกติ ไปหน้า Home
      setCurrentPage('home');
    }
  };

  const goToSettings = () => {
    setCurrentPage("settings");
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

    // ล้างค่าหน้าที่จำไว้
    localStorage.removeItem('currentPage');
    localStorage.removeItem('selectedPostId');
    localStorage.removeItem('selectedPostType');
    localStorage.removeItem('backPage');
  };

  const openPostDetails = (postId, from = 'mypost', type = null) => {
    if (!postId) return;
    setSelectedPostId(Number(postId));
    setSelectedPostType(type);
    setBackPage(from);
    setCurrentPage('mypost_details');
  };

  const handleEditProfile = () => {
    if (userType === 'student') {
      setCurrentPage('student_info');
    } else if (userType === 'tutor') {
      setCurrentPage('tutor_info');
    } else {
      alert('ไม่พบประเภทผู้ใช้');
    }
  };

  const handleViewProfile = (userId) => {
    setViewingUserId(userId);
    setBackPage(currentPage);
    setCurrentPage('user_profile');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home />;
      case 'notification':
        return (
          <Notification
            userId={user?.user_id}
            onReadAll={() => setNewNotificationCount(0)}
            onReadOne={() => setNewNotificationCount(prev => Math.max(0, prev - 1))}
            onOpenPost={(id, type, path) => openPostDetails(id, 'notification', type)} // Pass type if needed
          />
        );
      case 'student_info': return <StudentInfo user={user} setCurrentPage={setCurrentPage} />;
      case 'tutor_info': return <TutorInfo user={user} setCurrentPage={setCurrentPage} />;
      case 'mypost':
        return (
          <MyPost
            onOpenDetails={(id) => openPostDetails(id, 'mypost')}
            onViewProfile={handleViewProfile} // [NEW]
            postsCache={postsCache}
            setPostsCache={setPostsCache}
          />
        );
      case 'mypost_details':
        return (
          <MyPostDetails
            postId={selectedPostId}
            postType={selectedPostType}
            me={user?.user_id}
            postsCache={postsCache}
            setPostsCache={setPostsCache}
            onBack={() => setCurrentPage(backPage || 'mypost')}
          />
        );
      case 'favorite': return <Favorite />;
      case 'profile':
        if (userType === 'tutor') {
          return <TutorProfile setCurrentPage={setCurrentPage} onEditProfile={handleEditProfile} />;
        } else {
          return <Profile setCurrentPage={setCurrentPage} user={user} onEditProfile={handleEditProfile} />;
        }
      case 'tutor_layout': return <TutorLayout />;
      case 'student_calendar': return <StudentCalendar />;
      case 'settings': return <Settings />;
      case 'user_profile': // [NEW]
        return (
          <UserProfilePage
            userId={viewingUserId}
            onBack={() => setCurrentPage(backPage || 'home')}
          />
        );
      case 'admin_dashboard': return <AdminDashboard />;
      default: return <Home />;
    }
  };

  // ✅ Helper Component: ปุ่มเมนูใน Sidebar (ออกแบบใหม่)
  const SidebarItem = ({ id, label, icon: Icon, badge }) => {
    const isActive = currentPage === id;
    return (
      <li>
        <button
          onClick={() => {
            setCurrentPage(id);
            setSidebarOpen(false); // ปิด Sidebar บนมือถือเมื่อกดเลือก
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
            ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm' // Active State
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'   // Normal State
            }`}
        >
          <Icon size={22} className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
          <span className="flex-1 text-left text-sm">{label}</span>

          {badge > 0 && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm px-1.5">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {!isAuthenticated ? (
        <Index setIsAuthenticated={setIsAuthenticated} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <Navbar
            setSidebarOpen={setSidebarOpen}
            sidebarOpen={sidebarOpen}
            setCurrentPage={setCurrentPage}
            onLogout={handleLogout}
            onEditProfile={handleEditProfile}
            onSettings={goToSettings}
            userType={userType}
            onReport={() => setShowReportModal(true)}
          />

          <ReportIssueModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            user={user}
          />

          <div className="flex flex-1 relative">

            {/* Mobile Overlay (ฉากหลังดำจางๆ เวลาเปิด Sidebar บนมือถือ) */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* ✅ Sidebar Design ใหม่ */}
            <aside
              className={`fixed md:sticky top-0 md:top-16 left-0 h-screen md:h-[calc(100vh-4rem)] w-72 bg-white border-r border-gray-100 shadow-2xl md:shadow-none z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}
            >
              <div className="flex flex-col h-full overflow-y-auto custom-scrollbar px-4 py-6">

                {/* กลุ่มเมนูหลัก */}
                <div className="mb-6">
                  <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">เมนูหลัก</p>
                  <ul className="space-y-1">
                    <SidebarItem id="home" label="หน้าหลัก" icon={LayoutDashboard} />
                    <SidebarItem id="notification" label="การแจ้งเตือน" icon={Bell} badge={newNotificationCount} />
                    <SidebarItem id="mypost" label="โพสต์" icon={FileText} />
                    {user?.role === 'admin' && (
                      <SidebarItem id="admin_dashboard" label="แอดมิน" icon={ShieldAlert} />
                    )}
                  </ul>
                </div>

                <div className="border-t border-gray-100 my-2 mx-4"></div>

                {/* กลุ่มเมนูส่วนตัว */}
                <div className="mt-4">
                  <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ส่วนตัว</p>
                  <ul className="space-y-1">
                    <SidebarItem id="profile" label="โปรไฟล์ของฉัน" icon={User} />

                    {userType === 'student' && (
                      <SidebarItem id="favorite" label="รายการที่สนใจ" icon={Heart} />
                    )}
                  </ul>
                </div>

                {/* ปุ่ม Logout (แสดงเฉพาะบนมือถือ) */}
                <div className="mt-auto md:hidden pt-6 border-t border-gray-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors font-medium text-sm"
                  >
                    <LogOut size={20} />
                    ออกจากระบบ
                  </button>
                </div>

              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 w-full md:w-auto p-4 md:p-6 overflow-x-hidden">
              {renderPage()}
            </main>
          </div>
        </>
      )}
    </div>
  );
}

export default App;