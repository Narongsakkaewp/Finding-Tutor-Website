import React, { useState, useEffect } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false); // เพิ่ม state สำหรับ sidebar

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  return (
    <div>
      {!isAuthenticated ? (
        <Index setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <>
          <Navbar setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
          <div className="flex">
            {/* {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )} */}
            <div
              className={`hidden md:block w-64 bg-white border-r min-h-screen`}>
              <ul className="p-6 space-y-4">
                <li>
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-house-door-fill font-bold text-2xl"></i> หน้าหลัก
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-bell-fill font-bold text-2xl"></i> การแจ้งเตือน
                  </a>
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
                  <a href="#" className="flex items-center text-gray-700 hover:text-blue-600 gap-2">
                    <i className="bi bi-box-arrow-right font-bold text-2xl"></i> ออกจากระบบ
                  </a>
                </li>
              </ul>
            </div>
            {/* Content */}
            <div className="flex-1 px-8 pt-6">
              <Home />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;