// Index.jsx
import React, { useState } from 'react';
import Login from '../pages/Login';
import Register from '../pages/Register';

function Index({ setIsAuthenticated }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleClose = () => {
    setShowLogin(false);
    setShowRegister(false);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Navbar */}
      <div className="flex items-center justify-between px-8 py-4 bg-white">
        {/* Logo */}
        <img src="https://via.placeholder.com/120x50?text=LOGO" alt="Logo" className="h-12" />
        {/* Menu */}
        <div className="flex gap-4 items-center">
          <a href="#" className="font-bold text-black hover:text-blue-600">หน้าหลัก</a>
          <a href="#" className="font-bold text-black hover:text-blue-600">เกี่ยวกับ</a>
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

      {/* Features Section */}
      <div className="px-8 py-10">
        <h1 className="text-5xl font-bold text-center mb-4">ค้นหาติวเตอร์</h1>
        <h1 className="text-lg text-center mb-6">สมัครสมาชิกเพื่อค้นหาติวเตอร์ที่คุณต้องการได้เลย</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded border p-8 flex flex-col items-center">
            <div className="bg-gray-100 rounded p-6 mb-6">
              <i className="bi bi-file-earmark-text text-4xl text-gray-500"></i>
            </div>
            <h2 className="font-bold text-xl mb-2">นักเรียนค้นหาติวเตอร์</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              ค้นหาติวเตอร์ที่ตรงกับความต้องการของคุณได้อย่างง่ายดาย ไม่ว่าจะเป็นวิชาไหนก็มีให้เลือกมากมาย
            </p>
            <button className="bg-gray-100 rounded-full p-2">
              <i className="bi bi-arrow-left text-xl text-gray-500"></i>
            </button>
          </div>
          {/* Card 2 */}
          <div className="bg-white rounded border p-8 flex flex-col items-center">
            <div className="bg-gray-100 rounded p-6 mb-6">
              <i className="bi bi-grid text-4xl text-gray-500"></i>
            </div>
            <h2 className="font-bold text-xl mb-2">ติวเตอร์ค้นหานักเรียน</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              ค้นหานักเรียนที่ตรงกับวิชาที่คุณสอนได้อย่างง่ายดาย รวดเร็ว และฟรี
            </p>
            <button className="bg-gray-100 rounded-full p-2">
              <i className="bi bi-arrow-left text-xl text-gray-500"></i>
            </button>
          </div>
          {/* Card 3 */}
          <div className="bg-white rounded border p-8 flex flex-col items-center">
            <div className="bg-gray-100 rounded p-6 mb-6">
              <i className="bi bi-people text-4xl text-gray-500"></i>
            </div>
            <h2 className="font-bold text-xl mb-2">การติวแบบกลุ่ม</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              การติวแบบกลุ่มช่วยให้คุณสามารถเรียนรู้ร่วมกับเพื่อนๆ ได้อย่างมีประสิทธิภาพ
            </p>
            <button className="bg-gray-100 rounded-full p-2">
              <i className="bi bi-arrow-left text-xl text-gray-500"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Popup Modal */}
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
              {showLogin && <Login setIsAuthenticated={setIsAuthenticated} />}
              {showRegister && <Register setIsAuthenticated={setIsAuthenticated} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Index;