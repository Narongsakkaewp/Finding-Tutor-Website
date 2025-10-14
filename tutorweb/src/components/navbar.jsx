import React, { useEffect, useRef, useState } from "react";
import logo from "../assets/logo/FindingTutor_Logo.png";

const Navbar = ({
  userType, // รับ userType มาจาก App.js โดยตรง
  onLogout,
  onEditProfile,
  setSidebarOpen,
  sidebarOpen,
  setCurrentPage
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [avatar, setAvatar] = useState(null);
  const ddRef = useRef(null);

  useEffect(() => {
    let userId = null;
    let localUser = null;

    // --- 1. ดึงข้อมูลพื้นฐานจาก localStorage ก่อน ---
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        localUser = JSON.parse(rawUser);
        userId = localUser.user_id;
        const name = localUser.nickname || localUser.name || "User";
        setDisplayName(String(name));

        // ลองตั้งค่ารูปภาพจาก localStorage ก่อน ถ้ามี
        if (localUser.profile_picture_url) {
          setAvatar(localUser.profile_picture_url);
        }
      }
    } catch { }

    // --- 2. ยิง API ไปถามรูปโปรไฟล์ล่าสุด (ส่วนสำคัญอยู่ตรงนี้) ---
    // เช็คให้แน่ใจว่าเรารู้ ID และ ประเภท ของผู้ใช้แล้ว
    if (userId && userType) {
      let profileApiUrl = '';
      if (userType === 'student') {
        profileApiUrl = `http://localhost:5000/api/profile/${userId}`;
      } else if (userType === 'tutor') {
        profileApiUrl = `http://localhost:5000/api/tutor-profile/${userId}`;
      }

      // ถ้ารู้ URL ที่จะยิง API แล้ว ก็เริ่ม fetch ข้อมูล
      if (profileApiUrl) {
        fetch(profileApiUrl)
          .then(res => res.json())
          .then(profileData => {
            // ถ้าเจอ URL รูปภาพในข้อมูลที่ได้กลับมา
            if (profileData && profileData.profile_picture_url) {
              // อัปเดต State `avatar` เพื่อให้รูปแสดงผลทันที
              setAvatar(profileData.profile_picture_url);

              // (Optional but recommended) อัปเดต localStorage ให้มีรูปภาพล่าสุดด้วย
              // เพื่อให้ครั้งต่อไปโหลดเร็วขึ้น
              if (localUser) {
                localUser.profile_picture_url = profileData.profile_picture_url;
                localStorage.setItem("user", JSON.stringify(localUser));
              }
            }
          })
          .catch(console.error); // ถ้า fetch ไม่สำเร็จ ก็จะแสดง error ใน console แต่แอปไม่พัง
      }
    }

    // --- 3. Logic สำหรับปิด dropdown (เหมือนเดิม) ---
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);

  }, [userType]); // ให้ useEffect ทำงานใหม่ทุกครั้งที่ userType เปลี่ยนแปลง

  return (
    <nav className="flex items-center justify-between bg-white p-4 text-black shadow border-b">
      <button
        className="md:hidden mr-2 text-2xl"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <i className="bi bi-list"></i>
      </button>

      <div>
        <img src={logo} alt="Logo" className="hidden md:flex font-bold text-xl h-16" />
      </div>

      <div className="flex-1 mx-4 flex items-center gap-4 ">
        <div className="ml-auto">
          {userType && (
            <span className="text-gray-600 font-semibold whitespace-nowrap">
              คุณคือ: {userType === "student" ? "นักเรียน" : "ติวเตอร์"}
            </span>
          )}
        </div>
      </div>

      <div className="relative" ref={ddRef}>
        <button
          className="flex items-center gap-2 focus:outline-none"
          onClick={() => setDropdownOpen((s) => !s)}
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
        >
          <div className="w-10 h-10 rounded-full border overflow-hidden bg-gray-200 flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt="User" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium">
                {displayName?.[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <span className="hidden sm:block max-w-[160px] truncate">{displayName}</span>
          <i className="bi bi-caret-down-fill" />
        </button>

        {dropdownOpen && (
          <div
            className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg z-50"
            role="menu"
          >
            <ul>
              <li>
                <button
                  onClick={() => {
                    onEditProfile();
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  role="menuitem"
                >
                  แก้ไขโปรไฟล์
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onLogout();
                    setDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  role="menuitem"
                >
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;