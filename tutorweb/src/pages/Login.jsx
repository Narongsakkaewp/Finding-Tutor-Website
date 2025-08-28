// Login.jsx
import React, { useState } from 'react';

const BASE_URL = 'http://localhost:5000';

const normalizeUserType = (t) => {
  const x = String(t || '').trim().toLowerCase();
  if (['student', 'นักเรียน', 'นักศึกษา', 'std', 'stu'].includes(x)) return 'student';
  if (['tutor', 'teacher', 'ติวเตอร์', 'ครู', 'อาจารย์'].includes(x)) return 'tutor';
  return '';
};

function Login(props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }

      // ---- ดึง userObj + role จาก payload หลายรูปแบบ ----
      const userObj =
        data.user ??
        data.profile ??
        data.account ??
        data.data ??
        {};

      const roleRaw =
        data.userType ??
        data.role ??
        userObj.userType ??
        userObj.role ??
        userObj.type ??
        '';

      const role = normalizeUserType(roleRaw);
      if (!role) {
        alert('API ไม่ได้ส่งบทบาทผู้ใช้กลับมา (student/tutor). โปรดตรวจสอบ backend');
        return;
      }

      // ---- คำนวณชื่อที่จะแสดง + avatar เผื่อไว้ ----
      const displayName =
        userObj.nickname ||
        userObj.name ||
        [userObj.firstname, userObj.lastname].filter(Boolean).join(' ') ||
        (userObj.email ? userObj.email.split('@')[0] : null) ||
        'User';

      const avatar =
        userObj.avatar || userObj.photo || userObj.profileImage || userObj.imageUrl || null;

      // ---- เก็บลง localStorage ให้ Navbar ใช้ได้ทันที ----
      if (userObj._id || userObj.id || data.userId) {
        localStorage.setItem('userId', String(userObj._id || userObj.id || data.userId));
      }
      localStorage.setItem('userType', role);
      // เก็บทั้งคีย์ "user" (หลัก) และ "username" (เผื่อโค้ดเก่า)
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...userObj,
          name: displayName,
          avatar,
          userType: role,
        })
      );
      localStorage.setItem(
        'username',
        JSON.stringify({
          name: displayName,
          avatar,
          userType: role,
          email: userObj.email,
        })
      );

      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('isAuthenticated', 'true');

      props.setIsAuthenticated(true);
      window.dispatchEvent(new Event('auth-changed'));
      alert('เข้าสู่ระบบสำเร็จ');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="bg-gray-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded p-8 mx-auto flex flex-col items-center"
          style={{ maxWidth: 400 }}
        >
          <h2 className="text-2xl font-bold mb-8 text-center">เข้าสู่ระบบ</h2>

          <div className="w-full mb-4">
            <label className="block font-bold mb-2">Email</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                className="w-full pl-10 pr-4 py-2 rounded bg-gray-100 outline-none"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="w-full mb-6">
            <label className="block font-bold mb-2">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full pl-10 pr-10 py-2 rounded bg-gray-100 outline-none"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-gray-400"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gray-700 text-white font-bold py-2 rounded mb-2"
          >
            เข้าสู่ระบบ
          </button>

          <a
            href="/register"
            className="block text-center text-gray-700 hover:text-blue-600 mt-2"
          >
            ลงทะเบียน
          </a>
        </form>
      </div>
    </div>
  );
}

export default Login;
