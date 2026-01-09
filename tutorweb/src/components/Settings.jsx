import React, { useState, useEffect } from "react";
import { User, Mail, Lock, Trash2, Save, AlertTriangle, Eye, EyeOff } from "lucide-react";
import DeleteAccountModal from './DeleteAccountModal'; // ✅ Import Modal ที่เราสร้าง

// Mockup API URL (เปลี่ยนตามจริง)
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

    // State สำหรับเปลี่ยนรหัสผ่าน
    const [passData, setPassData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [showPass, setShowPass] = useState(false);

    // State สำหรับ Modal ลบบัญชี
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // โหลดข้อมูล User ปัจจุบัน
    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (storedUser) {
            setUser(storedUser);
            setProfileData({
                name: storedUser.name || "",
                lastname: storedUser.lastname || "",
                email: storedUser.email || ""
            });
        }
    }, []);

    // --- Handlers ---

    // 1. อัปเดตข้อมูลทั่วไป
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch(`${API_BASE}/api/user/${user.user_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profileData),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "อัปเดตไม่สำเร็จ");

            // อัปเดต localStorage
            const newUser = { ...user, ...profileData };
            localStorage.setItem("user", JSON.stringify(newUser));
            setUser(newUser);

            setMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว" });
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    // 2. เปลี่ยนรหัสผ่าน
    const handleChangePassword = async (e) => {
        e.preventDefault();
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
                method: "POST", // หรือ PUT ตาม API ของคุณ
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
    // 3. ฟังก์ชันเด้งออกจากระบบ
    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/";
    };

    if (!user) return <div className="p-10 text-center">กรุณาเข้าสู่ระบบ</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-3xl mx-auto space-y-8">

                <h1 className="text-3xl font-bold text-gray-800">ตั้งค่าบัญชี</h1>

                {/* Alert Message */}
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
                        <h2 className="text-xl font-bold text-gray-800">ชื่อและอีเมล</h2>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
                                <input
                                    type="text"
                                    value={profileData.name}
                                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
                                <input
                                    type="text"
                                    value={profileData.lastname}
                                    onChange={(e) => setProfileData({ ...profileData, lastname: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </div>
                        </div>
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

                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
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
                        <div className="pt-2">
                            <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-black transition-colors disabled:bg-gray-300">
                                เปลี่ยนรหัสผ่าน
                            </button>
                        </div>
                    </form>
                </section>

                {/* 3. ลบบัญชี (Danger Zone) */}
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

            {/* เรียก Component DeleteAccountModal */}
            <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={user}                // ✅ ส่ง object user ทั้งก้อน
                userType={user.role || localStorage.getItem('userType')} // ✅ ส่งประเภท
                onLogout={handleLogout}
            />
        </div>
    );
}