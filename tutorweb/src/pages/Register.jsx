// Register.jsx
import React, { useState } from 'react';
 
function Register() {
    const [name, setName] = useState('');
    const [lastname, setLastname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [type, setType] = useState('');
 
    const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน');
        return;
    }
 
    if (password.length < 8) {
        alert('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
        return;
    }
 
    if (!type) {
        alert('กรุณาเลือกประเภทผู้ใช้งาน');
        return;
    }
    try {
        const res = await fetch('http://localhost:5000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, lastname, email, password, type }),
        });
        const data = await res.json();
        if (data.success) {
            alert('สมัครสมาชิกสำเร็จ');
            localStorage.setItem('userType', type);
            // อาจ redirect ไปหน้า login
        } else {
            alert(data.message || 'สมัครสมาชิกไม่สำเร็จ');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
};
 
    return (
        <div className="bg-gray-100 p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl mx-auto">
                <form
                    onSubmit={handleSubmit}
                    className="w-full bg-white rounded p-8 mx-auto flex flex-col items-center border-2"
                    style={{ maxWidth: 500 }}
                >
                    <h2 className="text-2xl font-bold mb-8 text-center">ลงทะเบียน</h2>
                    <div className="w-full mb-4 flex flex-row gap-4">
                        <div className="w-full mb-4">
                            <label className="block font-bold mb-2">ชื่อ</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 rounded bg-gray-100 outline-none"
                                placeholder="ชื่อ"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-full mb-4">
                            <label className="block font-bold mb-2">นามสกุล</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 rounded bg-gray-100 outline-none"
                                placeholder="นามสกุล"
                                value={lastname}
                                onChange={e => setLastname(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="w-full mb-4">
                        <label className="block font-bold mb-2">Email</label>
                        <input
                            type="email"
                            className="w-full px-4 py-2 rounded bg-gray-100 outline-none"
                            placeholder="example@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="w-full mb-4">
                        <label className="block font-bold mb-2">รหัสผ่าน</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full px-4 pr-10 py-2 rounded bg-gray-100 outline-none"
                                placeholder="กรุณากรอกอย่างน้อย 8 ตัวอักษร"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-3 text-gray-400"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                            </button>
                        </div>
                    </div>
                    <div className="w-full mb-4">
                        <label className="block font-bold mb-2">ยืนยันรหัสผ่าน</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full px-4 pr-10 py-2 rounded bg-gray-100 outline-none"
                                placeholder="กรอกรอกรหัสผ่านอีกครั้ง"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-3 text-gray-400"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                            </button>
                        </div>
                    </div>
                    <div className="w-full mb-6">
                        <label className="block font-bold mb-2">ประเภทผู้ใช้งาน</label>
                        <select
                            className="w-full px-4 py-2 rounded bg-gray-100 outline-none"
                            value={type}
                            onChange={e => setType(e.target.value)}
                            required
                        >
                            <option value="">เลือกประเภท</option>
                            <option value="student">นักเรียน</option>
                            <option value="tutor">ติวเตอร์</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-gray-700 text-white font-bold py-2 rounded mb-2"
                    >
                        ลงทะเบียน
                    </button>
                </form>
            </div>
        </div>
    );
}
 
export default Register;