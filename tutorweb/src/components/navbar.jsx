import React, { useEffect, useRef, useState } from "react";
import logo from "../assets/logo/FindingTutor_Logo.png";
import { Menu, ChevronDown, Edit, LogOut, Settings, MessageSquareWarning } from "lucide-react"; // ใช้ไอคอนจาก lucide-react เพื่อความสวยงาม

const Navbar = ({
  userType,
  onLogout,
  onEditProfile,
  onSettings,
  onReport,
  setSidebarOpen,
  sidebarOpen,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(null);
  const ddRef = useRef(null);

  useEffect(() => {
    let userId = null;
    let localUser = null;

    // --- 1. ดึงข้อมูลพื้นฐานจาก localStorage ---
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        localUser = JSON.parse(rawUser);
        userId = localUser.user_id;
        const name = localUser.nickname || localUser.name || "User";
        setDisplayName(String(name));
        if (localUser.username) {
          setUsername(localUser.username);
        }

        if (localUser.profile_picture_url) {
          setAvatar(localUser.profile_picture_url);
        }
      }
    } catch { }

    // --- 2. ยิง API ไปถามรูปโปรไฟล์ล่าสุด ---
    if (userId && userType) {
      let profileApiUrl = '';
      if (userType === 'student') {
        profileApiUrl = `http://localhost:5000/api/profile/${userId}`;
      } else if (userType === 'tutor') {
        profileApiUrl = `http://localhost:5000/api/tutor-profile/${userId}`;
      }

      if (profileApiUrl) {
        fetch(profileApiUrl)
          .then(res => res.json())
          .then(profileData => {
            if (profileData && profileData.profile_picture_url) {
              setAvatar(profileData.profile_picture_url);
              if (localUser) {
                localUser.profile_picture_url = profileData.profile_picture_url;
                localStorage.setItem("user", JSON.stringify(localUser));
              }
            }
          })
          .catch(console.error);
      }
    }

    // --- 3. Logic ปิด dropdown ---
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);

  }, [userType]);

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Left Side: Hamburger & Logo */}
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={24} />
            </button>

            <div className="flex-shrink-0 flex items-center">
              <img src={logo} alt="Logo" className="h-10 w-auto md:h-16 object-contain" />
            </div>
          </div>

          {/* Right Side: User Profile & Dropdown */}
          <div className="flex items-center gap-3 sm:gap-6">

            {/* User Role Badge (Hidden on mobile for space) */}
            {userType && (
              <span className={`hidden sm:inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${userType === 'student'
                ? 'bg-blue-50 text-blue-700 border-blue-100'
                : 'bg-purple-50 text-purple-700 border-purple-100'
                }`}>
                {userType === "student" ? "🎓 นักเรียน" : "👨‍🏫 ติวเตอร์"}
              </span>
            )}

            {/* Profile Dropdown */}
            <div className="relative" ref={ddRef}>
              <button
                className="flex items-center gap-3 focus:outline-none group p-1 pr-3 rounded-full hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
                onClick={() => setDropdownOpen((s) => !s)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 ring-2 ring-white shadow-sm flex items-center justify-center">
                    {avatar ? (
                      <img src={avatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-gray-500">
                        {displayName?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  {/* Online status indicator (Optional) */}
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                {/* Name & Arrow */}
                <div className="hidden md:flex items-center gap-2">
                  <div className="flex flex-col items-start">
                    <span className="text-md font-semibold text-gray-700 max-w-[120px] truncate leading-tight">
                      {displayName}
                    </span>
                    {username && (
                      <span className="text-[11px] text-gray-500 font-medium">@{username}</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 transform origin-top-right animate-in fade-in zoom-in-95 duration-100"
                  role="menu"
                >
                  {/* Mobile Role Badge (Shown inside dropdown on mobile) */}
                  <div className="px-4 py-2 border-b border-gray-50 md:hidden">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium justify-end ${userType === 'student' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                      {userType === "student" ? "นักเรียน" : "ติวเตอร์"}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        onEditProfile();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                      role="menuitem"
                    >
                      <Edit size={16} />
                      แก้ไขโปรไฟล์
                    </button>
                    <button
                      onClick={() => {
                        if (onSettings) onSettings();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                    >
                      <Settings size={16} /> ตั้งค่า
                    </button>

                    {/* ✅ 2. แก้ปุ่มรายงานปัญหา ให้เรียก onReport */}
                    <button
                      onClick={() => {
                        if (onReport) onReport(); // เรียกฟังก์ชัน onReport
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-orange-600 flex items-center gap-3 transition-colors"
                    >
                      <MessageSquareWarning size={16} /> รายงานปัญหา
                    </button>
                  </div>

                  <div className="border-t border-gray-100 my-1"></div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        onLogout();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                      role="menuitem"
                    >
                      <LogOut size={16} />
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;