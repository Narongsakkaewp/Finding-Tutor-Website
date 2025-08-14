import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function StudentInfo() {
    const { user } = useAuth();
    const [form, setForm] = useState({
        profile_picture: '',
        nickname: '',
        phone: '',
        education: '',
        interested_subjects: ''
    });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        async function load() {
            const { data } = await api.get('/api/student/me');
            if (data) setForm(prev => ({ ...prev, ...data }));
        }
        load();
    }, []);

    const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setMsg('');
        await api.post('/api/student', form);
        setMsg('บันทึกข้อมูลโปรไฟล์เรียบร้อย');
    };

    if (user?.type !== 'student') {
        return <div className="max-w-3xl mx-auto p-6">บัญชีนี้ไม่ใช่นักเรียน</div>;
    }

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
            <h2 className="text-xl font-bold mb-4">โปรไฟล์นักเรียน</h2>
            {msg && <div className="mb-3 text-green-700">{msg}</div>}
            <form onSubmit={onSubmit} className="space-y-4">
                <input name="profile_picture" placeholder="URL รูปโปรไฟล์" className="w-full border p-2 rounded" onChange={onChange} value={form.profile_picture} />
                <div className="grid grid-cols-2 gap-3">
                    <input name="nickname" placeholder="ชื่อเล่น" className="border p-2 rounded" onChange={onChange} value={form.nickname} />
                    <input name="phone" placeholder="เบอร์โทร" className="border p-2 rounded" onChange={onChange} value={form.phone} />
                </div>
                <textarea name="education" placeholder="ระดับ/สาขาที่เรียน" className="w-full border p-2 rounded" rows={3} onChange={onChange} value={form.education} />
                <input name="interested_subjects" placeholder="วิชาที่สนใจ (คั่นด้วย , หรือ JSON)" className="w-full border p-2 rounded" onChange={onChange} value={form.interested_subjects} />
                <button className="px-4 py-2 bg-blue-600 text-white rounded">บันทึก</button>
            </form>
        </div>
    );
}
