import React from 'react';

function Index() {
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
          <button className="bg-gray-700 text-white font-bold px-4 py-2 rounded">เข้าสู่ระบบ</button>
          <button className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded">ลงทะเบียน</button>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-8 py-10">
        <h1 className="text-5xl font-bold text-center mb-4">ค้นหาติวเตอร์ติวเตอร์</h1>
        <h1 className="text-lg text-center mb-6">สมัครสมาชิกเพื่อค้นหาติวเตอร์ที่คุณต้องการได้เลย</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded border p-8 flex flex-col items-center">
            <div className="bg-gray-100 rounded p-6 mb-6">
              <i className="bi bi-file-earmark-text text-4xl text-gray-500"></i>
            </div>
            <h2 className="font-bold text-xl mb-2">Feature name</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              Laborum mollit enim duis mollit aute elit voluptate laboris nisi. Velit consequat anim officia deserunt excepteur elit.
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
            <h2 className="font-bold text-xl mb-2">Feature name</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              Laborum mollit enim duis mollit aute elit voluptate laboris nisi. Velit consequat anim officia deserunt excepteur elit.
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
            <h2 className="font-bold text-xl mb-2">Feature name</h2>
            <p className="text-gray-500 mb-2">Category</p>
            <p className="text-gray-600 text-sm mb-8 text-center">
              Laborum mollit enim duis mollit aute elit voluptate laboris nisi. Velit consequat anim officia deserunt excepteur elit.
            </p>
            <button className="bg-gray-100 rounded-full p-2">
              <i className="bi bi-arrow-left text-xl text-gray-500"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Index;