import React, { useState } from "react";

const Navbar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div>
      {/* Navbar */}
      <nav className="flex items-center justify-between bg-white p-4 text-black shadow">
        {/* Logo */}
        <div className="font-bold text-xl">Finding Tutor</div>
        {/* Search */}
        <div className="flex-1 mx-4">
          <input
            type="text"
            placeholder="ค้นหาติวเตอร์หรือวิชา..."
            className="w-full px-3 py-2 rounded text-black bg-gray-50"
          />
        </div>
        {/* User Profile */}
        <div className="relative">
          <button
            className="flex items-center gap-2 focus:outline-none"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <img
              src="https://via.placeholder.com/40"
              alt="User"
              className="w-10 h-10 rounded-full border"
            />
            <i className="bi bi-caret-down-fill"></i>
          </button>
          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-50">
              <ul>
                <li>
                  <a href="#" className="block px-4 py-2 hover:bg-gray-100">โปรไฟล์</a>
                </li>
                <li>
                  <a href="#" className="block px-4 py-2 hover:bg-gray-100">ตั้งค่า</a>
                </li>
                <li>
                  <a href="#" className="block px-4 py-2 hover:bg-gray-100">ออกจากระบบ</a>
                </li>
              </ul>
            </div>
          )}
        </div>
        {/* Sidebar Toggle (Mobile) */}
        {/* <button
          className="md:hidden px-3 py-2"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button> */}
      </nav>
    </div>
  );
};

export default Navbar;