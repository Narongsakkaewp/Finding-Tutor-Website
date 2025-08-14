import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function TutorInfo() {
    const { user } = useAuth();
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

    useEffect(() => {
        async function load() {
            const { data } = await api.get('/api/tutor/me');
            if (data) setForm(prev => ({ ...prev, ...data }));
        }
        load();
    }, []);

    const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setMsg('');
        await api.post('/api/tutor', {
            ...form,
            hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null
        });
        setMsg('บันทึกข้อมูลโปรไฟล์เรียบร้อย');
    };

    if (user?.type !== 'tutor') {
        return <div className="max-w-3xl mx-auto p-6">บัญชีนี้ไม่ใช่ติวเตอร์</div>;
    }

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
                <textarea name="education" placeholder="ประวัติการศึกษา" className="w-full border p-2 rounded" rows={3} onChange={onChange} value={form.education} />
                <textarea name="teaching_experience" placeholder="ประวัติการสอน" className="w-full border p-2 rounded" rows={3} onChange={onChange} value={form.teaching_experience} />
                <input name="subjects" placeholder="วิชาที่สอน (คั่นด้วย , หรือเป็น JSON)" className="w-full border p-2 rounded" onChange={onChange} value={form.subjects} />
                <div className="grid grid-cols-2 gap-3">
                    <input name="hourly_rate" type="number" step="0.01" placeholder="ค่าติวต่อชั่วโมง" className="border p-2 rounded" onChange={onChange} value={form.hourly_rate ?? ''} />
                    <input name="available_locations" placeholder="พื้นที่/สถานที่ที่สอนได้" className="border p-2 rounded" onChange={onChange} value={form.available_locations} />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded">บันทึก</button>
            </form>
        </div>
    );
}