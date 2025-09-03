import React, { useEffect, useRef, useState } from "react";
// import logo from "../assets/logo/FindingTutor_Logo.png";

const BASE_URL = "http://localhost:5000"; // เปลี่ยนตามพอร์ต backend ของคุณ

// map ชื่อบทบาทหลายแบบ -> ค่ามาตรฐาน
const normalizeUserType = (t) => {
  const x = String(t || "").trim().toLowerCase();
  if (["student", "นักเรียน", "นักศึกษา", "std", "stu"].includes(x)) return "student";
  if (["tutor", "teacher", "ติวเตอร์", "ครู", "อาจารย์"].includes(x)) return "tutor";
  return "";
};

const Navbar = ({ setIsAuthenticated, setCurrentPage, sidebarOpen, setSidebarOpen }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userType, setUserType] = useState("");
  const [displayName, setDisplayName] = useState("User");
  const [avatar, setAvatar] = useState(null);
  const ddRef = useRef(null);

  // ดึงชื่อ/รูป/บทบาทจาก localStorage (และ API เป็นตัวเสริม)
  useEffect(() => {
    try {
      const rawUser =
        localStorage.getItem("user") || localStorage.getItem("username");
      if (rawUser) {
        let u;
        try {
          u = JSON.parse(rawUser);
        } catch {
          u = { name: rawUser };
        }

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
        const ut = normalizeUserType(localStorage.getItem("userType"));
        if (ut) setUserType(ut);
      }
    } catch { }

    const userId = localStorage.getItem("userId");
    fetchUserFromApi(userId);

    const onDown = (e) => e.key === "Escape" && setDropdownOpen(false);
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("keydown", onDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const fetchUserFromApi = (userId) => {
    if (!userId) return;
    fetch(`${BASE_URL}/api/user/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        const u = data?.user ?? data ?? {};

        if (!displayName || displayName === "User") {
          const nameFromApi =
            u.nickname ||
            u.name ||
            [u.firstname, u.lastname].filter(Boolean).join(" ") ||
            (u.email ? u.email.split("@")[0] : null);
          if (nameFromApi) setDisplayName(String(nameFromApi));
        }

        const apiAvatar = u.avatar || u.photo || u.profileImage || u.imageUrl;
        if (apiAvatar) setAvatar(apiAvatar);

        const ut = normalizeUserType(u.userType || u.role || u.type);
        if (ut) {
          setUserType(ut);
          localStorage.setItem("userType", ut);
        }

        try {
          const cached = {
            name: u.name || undefined,
            firstname: u.firstname,
            lastname: u.lastname,
            email: u.email,
            avatar: apiAvatar,
            userType: ut || u.userType,
          };
          localStorage.setItem("user", JSON.stringify(cached));
        } catch { }
      })
      .catch(() => { });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userId");
    localStorage.removeItem("userType");
    localStorage.removeItem("user");
    localStorage.removeItem("username");
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
      {/* Hamburger button (เฉพาะจอเล็ก) */}
      <button
        className="md:hidden mr-2 text-2xl"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <i className="bi bi-list"></i>
      </button>

      {/* Logo */}
      <div>
        {/* <img src={logo} alt="Logo" className="hidden md:flex font-bold text-xl h-16" /> */}
      </div>

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
                  แก้ไขโปรไฟล์
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
