import React, { useState } from 'react';

// ✅ 1. รับ onSwitchToLogin เข้ามาเป็น prop ใหม่
function Register({ onRegisterSuccess, onSwitchToLogin }) {
    const [name, setName] = useState('');
    const [lastname, setLastname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [type, setType] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('รหัสผ่านไม่ตรงกัน');
            return;
        }
        if (password.length < 8) {
            setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
            return;
        }
        if (!type) {
            setError('กรุณาเลือกประเภทผู้ใช้งาน');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, lastname, email, password, type }),
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'สมัครสมาชิกไม่สำเร็จ');
            }
            if (onRegisterSuccess) {
                onRegisterSuccess(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800">สร้างบัญชีใหม่</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="bg-red-50 text-red-700 text-sm rounded-lg p-3 text-center">{error}</p>}
                
                <div className="flex flex-col sm:flex-row gap-4">
                    <input type="text" name="name" placeholder="ชื่อ" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200" />
                    <input type="text" name="lastname" placeholder="นามสกุล" value={lastname} onChange={e => setLastname(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200" />
                </div>
                
                <input type="email" name="email" placeholder="อีเมล" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200" />
                <input type="password" name="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200" />
                <input type="password" name="confirmPassword" placeholder="ยืนยันรหัสผ่าน" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200" />

                <select name="type" value={type} onChange={e => setType(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
                    <option value="" disabled>เลือกประเภท</option>
                    <option value="student">นักเรียน</option>
                    <option value="tutor">ติวเตอร์</option>
                </select>

                <button type="submit" disabled={loading} className="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg hover:bg-gray-900 disabled:bg-gray-400 transition">
                    {loading ? "กำลังสมัคร..." : "ลงทะเบียน"}
                </button>

                {/* ✅ 2. เพิ่มส่วนนี้เข้าไปใต้ปุ่มลงทะเบียน */}
                <p className="text-center text-sm text-gray-600 pt-2">
                    มีบัญชีอยู่แล้ว?{' '}
                    <button
                        type="button"
                        onClick={onSwitchToLogin}
                        className="font-medium text-blue-600 hover:underline"
                    >
                        เข้าสู่ระบบ
                    </button>
                </p>

            </form>
        </div>
    );
}

export default Register;