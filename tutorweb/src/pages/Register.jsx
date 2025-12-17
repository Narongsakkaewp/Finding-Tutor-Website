import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, GraduationCap, Presentation, AlertCircle } from 'lucide-react';

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: '',
    type: 'student', // default value
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeChange = (selectedType) => {
    setFormData({ ...formData, type: selectedType });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (formData.password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          lastname: formData.lastname,
          email: formData.email,
          password: formData.password,
          type: formData.type,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'การลงทะเบียนล้มเหลว');
      }

      if (onRegisterSuccess) {
        onRegisterSuccess(data);
      } else {
        alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
        if (onSwitchToLogin) onSwitchToLogin();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ เพิ่ม max-h-[85vh] และ overflow-y-auto เพื่อให้มี Scrollbar ถ้าจอมันเตี้ยเกินไป
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100/50 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[85vh]">
      
      {/* ส่วนเนื้อหาที่ Scroll ได้ */}
      <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar">
        
        {/* Header (ลดขนาด Margin ลง) */}
        <div className="text-center mb-6">
          <div className="relative w-14 h-14 mx-auto mb-3">
              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-pulse opacity-50"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <UserPlus size={24} strokeWidth={2.5} />
              </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">สร้างบัญชีใหม่</h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">กรุณาเลือกประเภทผู้ใช้</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* User Type Selector (ลด Padding) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => handleTypeChange('student')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                formData.type === 'student'
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <GraduationCap size={16} /> นักเรียน
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('tutor')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                formData.type === 'tutor'
                  ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Presentation size={16} /> ติวเตอร์
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg p-2.5">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Grid ชื่อ-นามสกุล */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">ชื่อ</label>
              <input
                type="text"
                name="name"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium text-sm"
                placeholder="สมชาย"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">นามสกุล</label>
              <input
                type="text"
                name="lastname"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium text-sm"
                placeholder="ใจดี"
                value={formData.lastname}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">อีเมล</label>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                <Mail size={16} />
              </span>
              <input
                type="email"
                name="email"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium text-sm"
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">รหัสผ่าน</label>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium text-sm"
                placeholder="ขั้นต่ำ 8 ตัวอักษร"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">ยืนยันรหัสผ่าน</label>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-gray-900 placeholder-gray-400 font-medium text-sm"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-black hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังสร้าง...
              </>
            ) : (
              <>
                  สมัครสมาชิก <UserPlus size={18} />
              </>
            )}
          </button>

        </form>
      </div>

      {/* Footer (Fixed at bottom inside scroll if needed, or outside) */}
      <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center rounded-b-3xl">
        <p className="text-xs text-gray-500">
          มีบัญชีอยู่แล้ว?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-all ml-1"
          >
            เข้าสู่ระบบเลย
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;