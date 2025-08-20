import React, { useState, useEffect } from "react";

const Navbar = ({ setIsAuthenticated, setCurrentPage }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userType, setUserType] = useState('');

  useEffect(() => {
    // ดึง userId จาก localStorage หลัง login
    const userId = localStorage.getItem('userId');
    if (userId) {
      fetch(`http://localhost:3001/api/user/${userId}`)
        .then(res => res.json())
        .then(data => {
          console.log('API response:', data);
          setUserType(data.userType); // API ต้องส่ง { userType: 'student' } หรือ 'tutor'
        })
        .catch(() => setUserType(''));
    }
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    localStorage.removeItem('userType');
  };

  const handleProfileClick = () => {
    if (userType === 'student') {
      setCurrentPage('student_info');
    } else if (userType === 'tutor') {
      setCurrentPage('tutor_info');
    }
    setDropdownOpen(false);
  };

  return (
    <div>
      <nav className="flex items-center justify-between bg-white p-4 text-black shadow">
        {/* Logo */}
        <div className="font-bold text-xl">Finding Tutor</div>
        {/* Search */}
        <div className="flex-1 mx-4 flex items-center gap-4">
          <input
            type="text"
            placeholder="ค้นหาติวเตอร์หรือวิชา..."
            className="w-full px-3 py-2 rounded text-black bg-gray-50"
          />
          {/* แสดง userType จาก API */}
          <span className="text-gray-600 font-semibold">
            {userType === 'student' ? 'นักเรียน' : userType === 'tutor' ? 'ติวเตอร์' : ''}
          </span>
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
                  <button
                    onClick={handleProfileClick}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    โปรไฟล์
                  </button>
                </li>
                <li>
                  <a href="#" className="block px-4 py-2 hover:bg-gray-100">ตั้งค่า</a>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    ออกจากระบบ
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
        {/* Sidebar Toggle (Mobile) */}
        {/* ...hamburger button... */}
      </nav>
    </div>
  );
};

export default Navbar;