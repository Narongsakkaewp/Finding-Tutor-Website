import React, { useState } from 'react';

export default function TutorInfo() {
    const [form, setForm] = useState({
        profile_picture: '',
        nickname: '',
        phone: '',
        education: '',
        teaching_experience: '',
        subjects: '',
        hourly_rate: '',
        available_locations: ''
    });
    const [msg, setMsg] = useState('');

    const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = e => {
        e.preventDefault();
        setMsg('บันทึกข้อมูลโปรไฟล์เรียบร้อย');
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
            <h2 className="text-xl font-bold mb-4">โปรไฟล์ติวเตอร์</h2>
            {msg && <div className="mb-3 text-green-700">{msg}</div>}
            <form onSubmit={onSubmit} className="space-y-4">
                <input name="profile_picture" placeholder="URL รูปโปรไฟล์" className="w-full border p-2 rounded" onChange={onChange} value={form.profile_picture} />
                <div className="grid grid-cols-2 gap-3">
                    <input name="nickname" placeholder="ชื่อเล่น" className="border p-2 rounded" onChange={onChange} value={form.nickname} />
                    <input name="phone" placeholder="เบอร์โทร" className="border p-2 rounded" onChange={onChange} value={form.phone} />
                </div>
                <input name="education" placeholder="วุฒิการศึกษา" className="w-full border p-2 rounded" onChange={onChange} value={form.education} />
                <textarea name="teaching_experience" placeholder="ประสบการณ์สอน" className="w-full border p-2 rounded" rows={3} onChange={onChange} value={form.teaching_experience} />
                <input name="subjects" placeholder="วิชาที่สอน" className="w-full border p-2 rounded" onChange={onChange} value={form.subjects} />
                <input name="hourly_rate" placeholder="ค่าติวต่อชั่วโมง" className="w-full border p-2 rounded" onChange={onChange} value={form.hourly_rate} />
                <input name="available_locations" placeholder="พื้นที่ที่รับสอน" className="w-full border p-2 rounded" onChange={onChange} value={form.available_locations} />
                <button className="px-4 py-2 bg-blue-600 text-white rounded">บันทึก</button>
            </form>
        </div>
    );
}