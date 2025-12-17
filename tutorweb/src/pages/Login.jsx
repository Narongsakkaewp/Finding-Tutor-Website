import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import logo from "../assets/logo/FindingTutor_Logo.png";

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }

      if (onLoginSuccess) {
        onLoginSuccess(data);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white p-6 sm:p-8">
      {/* Header Section */}
      <div className="text-center mb-10">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-indigo-100 rounded-full animate-pulse opacity-50"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <LogIn size={32} strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">ยินดีต้อนรับ</h2>
        <p className="text-gray-500 text-sm mt-2 font-medium">กรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Error Alert */}
        {error && (
          <div className="flex items-center p-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700 ml-1">อีเมล</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input
              type="email"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all sm:text-sm bg-gray-50 focus:bg-white"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-semibold text-gray-700">รหัสผ่าน</label>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all sm:text-sm bg-gray-50 focus:bg-white"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer focus:outline-none"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังเข้าสู่ระบบ...
            </>
          ) : (
            <>
              เข้าสู่ระบบ <LogIn className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600">
          ยังไม่มีบัญชีใช่ไหม?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors hover:underline"
          >
            สมัครสมาชิกฟรี
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;