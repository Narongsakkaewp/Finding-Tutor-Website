// tutorweb/src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, GraduationCap, Presentation, AlertCircle, ArrowLeft, AtSign } from 'lucide-react'; //  เพิ่ม AtSign
import { API_BASE } from '../config';

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [step, setStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(300);
  const [formData, setFormData] = useState({
    username: '', //  เพิ่ม username
    name: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: '',
    type: 'student',
  });

  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    //  ยอมรับ ภาษาอังกฤษ, ตัวเลข, จุด (.), และ ขีดล่าง (_)
    if (e.target.name === 'username') {
      // เพิ่ม . (จุด) เข้าไปในเงื่อนไขการกรอง
      const val = e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
      setFormData({ ...formData, username: val });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleTypeChange = (selectedType) => {
    setFormData({ ...formData, type: selectedType });
  };

  useEffect(() => {
    if (step !== 2 || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [step, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Step 1: ขอ OTP ---
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.username.length < 12) {
      setError('Username ต้องมีอย่างน้อย 12 ตัวอักษร');
      return;
    }
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
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, username: formData.username, type: 'register' }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ส่ง OTP ไม่สำเร็จ');
      }

      setTimeLeft(300); // รีเซ็ตเวลา
      setStep(2);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: ยืนยัน OTP และสมัครสมาชิก ---
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          otp: otp
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'การสมัครสมาชิกล้มเหลว');
      }

      if (onRegisterSuccess) {
        onRegisterSuccess({ ...data, isNewRegistration: true });
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

  // --- UI ---
  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100/50 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[85vh]">
      <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative w-14 h-14 mx-auto mb-3">
            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-pulse opacity-50"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <UserPlus size={24} strokeWidth={2.5} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            {step === 1 ? 'สร้างบัญชีใหม่' : 'ยืนยันอีเมล'}
          </h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            {step === 1 ? 'กรุณาเลือกประเภทผู้ใช้และกรอกข้อมูล' : `กรอกรหัส OTP ที่ส่งไปยัง ${formData.email}`}
          </p>
        </div>

        {/* --- STEP 1: กรอกข้อมูล --- */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">

            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
              <button type="button" onClick={() => handleTypeChange('student')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${formData.type === 'student' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><GraduationCap size={16} /> นักเรียน</button>
              <button type="button" onClick={() => handleTypeChange('tutor')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${formData.type === 'tutor' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><Presentation size={16} /> ติวเตอร์</button>
            </div>

            {/* ช่อง Username */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">ชื่อผู้ใช้งาน (Username)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSign className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm"
                  placeholder="อังกฤษ, ตัวเลข, จุด(.) และ ขีดล่าง(_)"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">{formData.username.length}/20</span>
              </div>
              <span className="text-xs font-light text-gray-500">*คุณจะไม่สามารถแก้ไขชื่อผู้ใช้ได้ภายหลังการลงทะเบียน</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase ml-1">ชื่อ</label><input type="text" name="name" className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm" placeholder="สมชาย" value={formData.name} onChange={handleChange} required /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-gray-500 uppercase ml-1">นามสกุล</label><input type="text" name="lastname" className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm" placeholder="ใจดี" value={formData.lastname} onChange={handleChange} required /></div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">อีเมล</label>
              <input type="email" name="email" className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm" placeholder="email@example.com" value={formData.email} onChange={handleChange} required />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">รหัสผ่าน</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} name="password" className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm pr-10" placeholder="ขั้นต่ำ 8 ตัวอักษร" value={formData.password} onChange={handleChange} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">ยืนยันรหัสผ่าน</label>
              <input type={showPassword ? 'text' : 'password'} name="confirmPassword" className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 outline-none text-sm" placeholder="กรอกรหัสผ่านอีกครั้ง" value={formData.confirmPassword} onChange={handleChange} required />
            </div>

            {error && (
              <div className="mb-2 flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg p-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-black transition-all mt-2 disabled:bg-gray-300">
              {loading ? 'กำลังส่ง OTP...' : 'ดำเนินการต่อ'}
            </button>
          </form>
        )}

        {/* --- STEP 2: กรอก OTP --- */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-6">
            <div className="space-y-2 text-center">
              <label className="text-sm font-bold text-gray-700">รหัสยืนยัน 6 หลัก</label>
              <p className='text-xs text-gray-500'>หากไม่พบอีเมล กรุณาตรวจสอบใน Junk/Spam</p>
              <input
                type="text"
                maxLength="6"
                className="w-full text-center text-3xl tracking-[0.5em] font-bold py-3 rounded-xl bg-gray-50 border-2 border-indigo-100 focus:border-indigo-500 focus:bg-white outline-none transition-all text-indigo-600"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
                autoFocus
              />

              <p className={`text-xs mt-2 font-medium transition-colors ${timeLeft <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {timeLeft > 0 ? (
                  <>รหัสจะหมดอายุใน <span className="text-indigo-600 font-bold">{formatTime(timeLeft)}</span> นาที</>
                ) : (
                  "รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่"
                )}
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg p-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors text-sm"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-all disabled:bg-indigo-300 disabled:shadow-none"
              >
                {loading ? 'กำลังตรวจสอบ...' : 'ยืนยันและสมัครสมาชิก'}
              </button>
            </div>

            <div className="text-center">
              <button type="button" onClick={handleRequestOtp} disabled={timeLeft > 0} className="text-xs text-indigo-500 hover:underline disabled:text-gray-300 disabled:no-underline">
                ขอรหัสใหม่
              </button>
            </div>
          </form>
        )}

      </div>

      {step === 1 && (
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center rounded-b-3xl">
          <p className="text-xs text-gray-500">
            มีบัญชีอยู่แล้ว?
            <button type="button" onClick={onSwitchToLogin} className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-all ml-1">
              เข้าสู่ระบบเลย
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default Register;