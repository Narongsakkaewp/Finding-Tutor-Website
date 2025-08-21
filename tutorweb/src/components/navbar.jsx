import React, { useEffect, useRef, useState } from "react";

const BASE_URL = "http://localhost:5000"; // ให้ตรงกับ backend

const normalizeUserType = (t) => {
  const x = String(t || "").trim().toLowerCase();
  if (["student", "นักเรียน", "นักศึกษา", "std", "stu"].includes(x)) return "student";
  if (["tutor", "teacher", "ติวเตอร์", "ครู", "อาจารย์"].includes(x)) return "tutor";
  return "";
};

const Navbar = ({ setIsAuthenticated, setCurrentPage }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userType, setUserType] = useState("");
  const [displayName, setDisplayName] = useState("User");
  const [avatar, setAvatar] = useState(null);

  const ddRef = useRef(null);

  useEffect(() => {
    // 1) โหลดจาก localStorage ก่อน (เร็วสุด)
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const name =
          u.nickname ||
          u.name ||
          [u.firstname, u.lastname].filter(Boolean).join(" ") ||
          (u.email ? u.email.split("@")[0] : null) ||
          "User";
        setDisplayName(String(name));
        setAvatar(u.avatar || u.photo || u.profileImage || u.imageUrl || null);

        const ut =
          normalizeUserType(u.userType) ||
          normalizeUserType(u.role) ||
          normalizeUserType(u.type) ||
          normalizeUserType(localStorage.getItem("userType"));
        if (ut) setUserType(ut);
      } else {
        // ถ้าไม่มี user แต่มี userType แยก
        const ut = normalizeUserType(localStorage.getItem("userType"));
        if (ut) setUserType(ut);
      }
    } catch {}

    // 2) ถ้ายังไม่รู้ userType ให้ fallback ไปถาม API ด้วย userId
    const userId = localStorage.getItem("userId");
    if (userId && !userType) {
      fetch(`${BASE_URL}/api/user/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          const ut = normalizeUserType(data.userType);
          if (ut) {
            setUserType(ut);
            localStorage.setItem("userType", ut); // cache ไว้
          }
        })
        .catch(() => {});
    }

    // ปิด dropdown เมื่อคลิกนอก/กด ESC
    const onDown = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("keydown", onDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userId");
    localStorage.removeItem("userType");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setDropdownOpen(false);
    setCurrentPage("home");
  };

  const handleProfileClick = () => {
    const r = normalizeUserType(userType);
    if (r === "student") setCurrentPage("student_info");
    else if (r === "tutor") setCurrentPage("tutor_info");
    else alert("ยังไม่ทราบบทบาทผู้ใช้ (student/tutor)...");
    setDropdownOpen(false);
  };

  return (
    <nav className="flex items-center justify-between bg-white p-4 text-black shadow">
      {/* Logo */}
      <div className="font-bold text-xl">Finding Tutor</div>

      {/* Search + role badge */}
      <div className="flex-1 mx-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="ค้นหาติวเตอร์หรือวิชา..."
          className="w-full px-3 py-2 rounded text-black bg-gray-50"
        />
        {userType && (
          <span className="text-gray-600 font-semibold whitespace-nowrap">
            {userType === "student" ? "นักเรียน" : "ติวเตอร์"}
          </span>
        )}
      </div>

      {/* User area */}
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

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg z-50"
            role="menu"
          >
            <ul>
              <li>
                <button
                  onClick={handleProfileClick}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  role="menuitem"
                >
                  โปรไฟล์
                </button>
              </li>
              <li>
                <a href="#" className="block px-4 py-2 hover:bg-gray-100" role="menuitem">
                  ตั้งค่า
                </a>
              </li>
              <li>
                <button
                  onClick={handleLogout}
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