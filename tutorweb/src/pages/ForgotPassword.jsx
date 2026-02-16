// tutorweb/src/pages/ForgotPassword.jsx
import React, { useState } from 'react';
import { Mail, Lock, Key, ArrowLeft, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

const API_BASE = "http://localhost:5000";

export default function ForgotPassword({ onSwitchToLogin }) {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [showPassword, setShowPassword] = useState(false);

    // Step 1: Request OTP
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.toLowerCase(), type: 'forgot_password' }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "ไม่สามารถส่ง OTP ได้");

            setMessage({ type: "success", text: "ส่งรหัส OTP ไปยังอีเมลแล้ว กรุณาตรวจสอบ" });
            setStep(2);
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Reset Password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "รหัสผ่านใหม่ไม่ตรงกัน" });
            return;
        }
        if (newPassword.length < 8) {
            setMessage({ type: "error", text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");

            // Success
            setMessage({ type: "success", text: "เปลี่ยนรหัสผ่านสำเร็จ! กำลังกลับไปหน้าเข้าสู่ระบบ..." });

            // Wait 2 seconds then go to login
            setTimeout(() => {
                onSwitchToLogin();
            }, 2000);

        } catch (err) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full bg-white p-6 sm:p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Key size={32} className="text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">ลืมรหัสผ่าน?</h2>
                <p className="text-gray-500 text-sm mt-2">
                    {step === 1 ? "กรอกอีเมลของคุณเพื่อรับรหัสยืนยัน (OTP)" : "กรอกรหัส OTP และตั้งรหัสผ่านใหม่"}
                </p>
            </div>

            {message.text && (
                <div className={`mb-6 p-3 rounded-xl flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    {message.text}
                </div>
            )}

            {step === 1 ? (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">อีเมล</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:bg-gray-300"
                    >
                        {loading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
                    </button>
                    <button
                        type="button"
                        onClick={onSwitchToLogin}
                        className="w-full text-sm text-gray-500 hover:text-gray-800 py-2 flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
                    </button>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">รหัส OTP (6 หลัก)</label>
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full text-center text-2xl tracking-[0.5em] font-bold py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                            placeholder="XXXXXX"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">รหัสผ่านใหม่</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                placeholder="••••••••••"
                                required
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 ml-1">ยืนยันรหัสผ่านใหม่</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                placeholder="••••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-all shadow-lg disabled:bg-gray-300 mt-2"
                    >
                        {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                    </button>

                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full text-sm text-gray-500 hover:text-gray-800 py-2"
                    >
                        เปลี่ยนอีเมล
                    </button>
                </form>
            )}
        </div>
    );
}
