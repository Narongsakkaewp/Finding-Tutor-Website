import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';
import Notification from './components/Notification';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // state สำหรับเลือกหน้า

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'notification':
        return <Notification />;
      default:
        return <Home />;
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        <Index setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <>
          <Navbar 
            setSidebarOpen={setSidebarOpen} 
            sidebarOpen={sidebarOpen} 
            setIsAuthenticated={setIsAuthenticated} // ✅ ส่ง prop มาให้ Navbar
          />
          <div className="flex">
            <div
              className={`hidden md:block w-64 bg-white border-r min-h-screen`}
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
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-table font-bold text-2xl"></i> ตารางการติว
                  </a>
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
                <li className="pt-10">
                  <button
                    onClick={() => setIsAuthenticated(false)}
                    className="flex items-center text-gray-700 hover:text-blue-600 gap-2"
                  >
                    <i className="bi bi-box-arrow-right font-bold text-2xl"></i> ออกจากระบบ
                  </button>
                </li>
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
