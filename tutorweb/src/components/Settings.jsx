// tutorweb/src/components/Settings.jsx
import React, { useState, useEffect } from "react";
import { User, Mail, Lock, Trash2, Save, AlertTriangle, Eye, EyeOff, Info, X } from "lucide-react"; // ✅ เพิ่ม Icon
import DeleteAccountModal from './DeleteAccountModal';

const API_BASE = "http://localhost:5000";

export default function Settings() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // State สำหรับแก้ไขข้อมูลทั่วไป
    const [profileData, setProfileData] = useState({
        name: "",
        lastname: "",
        email: ""
    });

    // State สำหรับ OTP Email Change
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState("");
    const [tempEmail, setTempEmail] = useState(""); // เก็บอีเมลใหม่ไว้ชั่วคราวรอ OTP

    // State สำหรับเปลี่ยนรหัสผ่าน
    const [passData, setPassData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [showPass, setShowPass] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (storedUser) {
            setUser(storedUser);
            setProfileData({
                name: storedUser.name || "",
                lastname: storedUser.lastname || "",
                email: storedUser.email || "",
                username: storedUser.username || "",
                name_change_at: storedUser.name_change_at || null
            });

            // ✅ Fetch fresh data mainly to get 'name_change_at'
            fetch(`${API_BASE}/api/profile/${storedUser.user_id}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setProfileData(prev => ({
                            ...prev,
                            name: data.first_name || data.name || prev.name,
                            lastname: data.last_name || data.lastname || prev.lastname,
                            email: data.email || prev.email,
                            username: data.username || prev.username,
                            name_change_at: data.name_change_at
                        }));
                        // Update local user object gently (optional)
                        const updatedUser = { ...storedUser, name_change_at: data.name_change_at, email: data.email };
                        localStorage.setItem("user", JSON.stringify(updatedUser));
                        setUser(updatedUser);
                    }
                })
                .catch(err => console.error("Failed to fetch fresh profile:", err));
        }
    }, []);

    // --- Handlers ---

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        // 1. ตรวจสอบว่ามีการเปลี่ยนอีเมลหรือไม่
        if (profileData.email !== user.email) {
            // ถ้าเปลี่ยนอีเมล -> เปิด Modal OTP
            setTempEmail(profileData.email); // เก็บเมลใหม่ไว้
            setShowOtpModal(true);
            setOtp("");
            setOtpError("");

            // ส่ง OTP ไปที่อีเมลใหม่
            requestOtpForEmailChange(profileData.email);
            return;
        }

        // 2. ถ้าไม่ได้เปลี่ยนอีเมล -> อัปเดตปกติ
        submitUpdate(null);
    };

    const requestOtpForEmailChange = async (newEmail) => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newEmail, type: 'change_email', userId: user.user_id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            // alert("ส่งรหัส OTP ไปยัง " + newEmail + " แล้ว");
        } catch (err) {
            setOtpError(err.message);
            // ถ้าส่งไม่ผ่าน ให้ปิด modal หรือแจ้งเตือน
            // setShowOtpModal(false); 
        }
    };

    const submitUpdate = async (otpCode) => {
        setLoading(true);
        try {
            const body = { ...profileData };
            if (otpCode) body.otp = otpCode; // แนบ OTP ไปด้วยถ้ามี

            const res = await fetch(`${API_BASE}/api/user/${user.user_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "อัปเดตไม่สำเร็จ");

            const newUser = { ...user, ...profileData };
            localStorage.setItem("user", JSON.stringify(newUser));
            setUser(newUser);

            setMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว" });
            setShowOtpModal(false); // ปิด Modal ถ้าสำเร็จ
        } catch (err) {
            if (otpCode) {
                setOtpError(err.message); // ถ้าเป็น error จาก OTP
            } else {
                setMessage({ type: "error", text: err.message });
            }
        } finally {
            setLoading(false);
        }
    };

    // กดปุ่มยืนยันใน Modal
    const handleVerifyOtp = () => {
        if (!otp || otp.length !== 6) {
            setOtpError("กรุณากรอกรหัส OTP 6 หลัก");
            return;
        }
        submitUpdate(otp);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });

        if (passData.newPassword !== passData.confirmPassword) {
            setMessage({ type: "error", text: "รหัสผ่านใหม่ไม่ตรงกัน" });
            return;
        }
        if (passData.newPassword.length < 8) {
            setMessage({ type: "error", text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/user/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: user.user_id,
                    oldPassword: passData.currentPassword,
                    newPassword: passData.newPassword
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");

            setMessage({ type: "success", text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
            setPassData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/";
    };

    if (!user) return <div className="p-10 text-center">กรุณาเข้าสู่ระบบ</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 relative">
            <div className="max-w-3xl mx-auto space-y-8">

                <h1 className="text-3xl font-bold text-gray-800">ตั้งค่าบัญชี</h1>

                {message.text && (
                    <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.type === 'error' && <AlertTriangle size={18} />}
                        {message.text}
                    </div>
                )}

                {/* 1. แก้ไขข้อมูลส่วนตัว */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6 border-b pb-4">
                        <User className="text-indigo-600" />
                        <h2 className="text-xl font-bold text-gray-800">ข้อมูลส่วนตัว</h2>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input
                                type="text"
                                value={profileData.username || ""}
                                disabled
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none font-mono"
                            />
                        </div>
                        {/* ✅ Logic 90 Days Limit UI */}
                        {(() => {
                            const lastChange = profileData.name_change_at ? new Date(profileData.name_change_at) : null;
                            let isLocked = false;
                            let nextDateStr = "";

                            if (lastChange) {
                                const diffTime = Math.abs(new Date() - lastChange);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays < 90) {
                                    isLocked = true;
                                    const nextDate = new Date(lastChange);
                                    nextDate.setDate(nextDate.getDate() + 90);
                                    nextDateStr = nextDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                                }
                            }

                            return (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
                                            <input
                                                type="text"
                                                value={profileData.name}
                                                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                                disabled={isLocked}
                                                className={`w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-100 ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
                                            <input
                                                type="text"
                                                value={profileData.lastname}
                                                onChange={(e) => setProfileData({ ...profileData, lastname: e.target.value })}
                                                disabled={isLocked}
                                                className={`w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-100 ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Info Box */}
                                    <div className={`border rounded-xl p-3 flex items-start sm:items-center gap-3 ${isLocked ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                                        <Info className={isLocked ? "text-amber-600 shrink-0" : "text-blue-600 shrink-0"} size={18} />
                                        <div className={`text-sm ${isLocked ? "text-amber-800" : "text-blue-800"}`}>
                                            {isLocked ? (
                                                <span>
                                                    คุณไม่สามารถแก้ไขชื่อได้ในขณะนี้ (ต้องรอ 90 วัน) <br className="hidden sm:block" />
                                                    แก้ไขได้อีกครั้งวันที่: <strong>{nextDateStr}</strong>
                                                </span>
                                            ) : (
                                                <span>
                                                    <strong>คำเตือน:</strong> หากคุณแก้ไขชื่อ-นามสกุล คุณจะ <span className="underline text-red-500">ไม่สามารถแก้ไขได้อีกเป็นเวลา 90 วัน</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email (ใช้สำหรับเข้าสู่ระบบ)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="email"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1 pl-1">* หากเปลี่ยนอีเมล คุณจะต้องยืนยันรหัส OTP ที่ส่งไปยังอีเมลใหม่</p>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-300">
                                <Save size={18} /> บันทึกการเปลี่ยนแปลง
                            </button>
                        </div>
                    </form>
                </section>

                {/* 2. เปลี่ยนรหัสผ่าน */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-6 border-b pb-4">
                        <Lock className="text-indigo-600" />
                        <h2 className="text-xl font-bold text-gray-800">รหัสผ่านและความปลอดภัย</h2>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="max-w-md space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านปัจจุบัน</label>
                                <input
                                    type="password"
                                    value={passData.currentPassword}
                                    onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
                                <input
                                    type={showPass ? "text" : "password"}
                                    value={passData.newPassword}
                                    onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-9 text-gray-400">
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
                                <input
                                    type="password"
                                    value={passData.confirmPassword}
                                    onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-black transition-colors disabled:bg-gray-300">
                                เปลี่ยนรหัสผ่าน
                            </button>
                        </div>
                    </form>
                </section>

                {/* 3. ลบบัญชี */}
                <section className="bg-red-50 rounded-2xl p-6 border border-red-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Trash2 className="text-red-600" />
                        <h2 className="text-xl font-bold text-red-700">ลบบัญชีผู้ใช้</h2>
                    </div>
                    <p className="text-red-600/80 mb-6 text-sm">
                        เมื่อคุณลบบัญชี ข้อมูลทั้งหมดรวมถึงประวัติการสอน โพสต์ และรีวิวจะถูกลบถาวรและไม่สามารถกู้คืนได้
                    </p>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="bg-white border border-red-200 text-red-600 px-6 py-2 rounded-xl hover:bg-red-600 hover:text-white transition-colors font-medium"
                    >
                        ลบบัญชีของฉันถาวร
                    </button>
                </section>

            </div>

            {/* OTP Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative">
                        <button
                            onClick={() => setShowOtpModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail size={32} className="text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">ยืนยันอีเมลใหม่</h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                กรุณากรอกรหัส OTP 6 หลัก ที่ส่งไปยังอีเมล
                                <br />
                                <span className="font-semibold text-indigo-600">{tempEmail}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="XXXXXX"
                                className="w-full text-center text-3xl tracking-[0.5em] font-bold py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none text-gray-800"
                                autoFocus
                            />

                            {otpError && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 justify-center">
                                    <AlertTriangle size={16} /> {otpError}
                                </div>
                            )}

                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.length !== 6}
                                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                            >
                                {loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP"}
                            </button>

                            <div className="text-center">
                                <button
                                    onClick={() => requestOtpForEmailChange(tempEmail)}
                                    className="text-sm text-gray-500 hover:text-indigo-600 underline"
                                >
                                    ขอรหัส OTP อีกครั้ง
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={user}
                userType={user.role || localStorage.getItem('userType')}
                onLogout={handleLogout}
            />
        </div>
    );
}