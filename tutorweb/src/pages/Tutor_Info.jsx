// tutorweb/src/pages/Tutor_Info.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    User, Phone, MapPin, Briefcase, GraduationCap,
    BookOpen, Plus, Trash2, Camera, Save, X, ChevronLeft, Check, Mail
} from 'lucide-react';
import UniversityPicker from '../components/UniversityPicker';
import SearchableSelect from '../components/SearchableSelect'; // ✅ Import
import ImageCropper from '../components/ImageCropper';


const getCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
};

const gradeLevelOptions = [
    { value: 'ประถมศึกษา', label: 'ประถมศึกษา' },
    { value: 'มัธยมต้น', label: 'มัธยมศึกษาตอนต้น (ม.1-3)' },
    { value: 'มัธยมปลาย', label: 'มัธยมศึกษาตอนปลาย (ม.4-6)' },
    { value: 'ปริญญาตรี', label: 'ปริญญาตรี' },
    { value: 'บุคคลทั่วไป', label: 'บุคคลทั่วไป' },
];

const subjectOptions = [
    { value: 'คณิตศาสตร์', label: 'คณิตศาสตร์' },
    { value: 'ฟิสิกส์', label: 'ฟิสิกส์' },
    { value: 'เคมี', label: 'เคมี' },
    { value: 'ชีววิทยา', label: 'ชีววิทยา' },
    { value: 'ภาษาอังกฤษ', label: 'ภาษาอังกฤษ' },
    { value: 'ภาษาไทย', label: 'ภาษาไทย' },
    { value: 'สังคมศึกษา', label: 'สังคมศึกษา' },
    { value: 'คอมพิวเตอร์', label: 'คอมพิวเตอร์' },
    { value: 'ศิลปะ', label: 'ศิลปะ' },
    { value: 'ดนตรี', label: 'ดนตรี' },
];

export default function TutorInfoPage({ setCurrentPage }) {
    const currentUser = useMemo(() => getCurrentUser(), []);

    const [formData, setFormData] = useState({
        profile_picture_url: '',
        nickname: '',
        phone: '',
        province: '',
        district: '',
        subdistrict: '',
        postalCode: '',
        addressDetails: '',
        about_me: '',
        education: [],
        teaching_experience: [],
        can_teach_grades: [],
        can_teach_subjects: [],
        hourly_rate: '',
    });

    const [db, setDb] = useState([]);
    const [addressData, setAddressData] = useState({ provinces: [], districts: [], subdistricts: [] });
    const [customSubject, setCustomSubject] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState(null);


    useEffect(() => {
        fetch('/db.json').then(res => res.json()).then(jsonData => {
            if (Array.isArray(jsonData)) {
                setDb(jsonData);
                setAddressData(prev => ({ ...prev, provinces: jsonData.map(p => p.name_th).sort() }));
            }
        }).catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!currentUser?.user_id || db.length === 0) return;
        const fetchProfile = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/tutor-profile/${currentUser.user_id}`);
                if (!response.ok) throw new Error("ดึงข้อมูลไม่สำเร็จ");
                const data = await response.json();

                let addr = { details: '', subdistrict: '', district: '', province: '', postalCode: '' };
                if (data.address) {
                    const parts = data.address.split(' ').filter(Boolean);
                    if (parts.length >= 1) addr.postalCode = parts[parts.length - 1];
                    if (parts.length >= 2) addr.province = parts[parts.length - 2];
                    if (parts.length >= 3) addr.district = parts[parts.length - 3];
                    if (parts.length >= 4) addr.subdistrict = parts[parts.length - 4];
                    if (parts.length > 4) addr.details = parts.slice(0, parts.length - 4).join(' ');
                }

                let districtNames = [];
                let subdistrictNames = [];
                if (addr.province) {
                    const pData = db.find(p => p.name_th === addr.province);
                    if (pData) {
                        districtNames = pData.districts.map(d => d.name_th).sort();
                        if (addr.district) {
                            const dData = pData.districts.find(d => d.name_th === addr.district);
                            if (dData) subdistrictNames = dData.sub_districts.map(s => s.name_th).sort();
                        }
                    }
                }
                setAddressData(prev => ({ ...prev, districts: districtNames, subdistricts: subdistrictNames }));

                setFormData({
                    profile_picture_url: data.profile_picture_url || '',
                    nickname: data.nickname || '',
                    phone: data.phone || '',
                    province: addr.province || '',
                    district: addr.district || '',
                    subdistrict: addr.subdistrict || '',
                    postalCode: addr.postalCode || '',
                    addressDetails: addr.details || '',
                    about_me: data.about_me || '',
                    education: data.education || [],
                    teaching_experience: data.teaching_experience || [],
                    can_teach_grades: data.can_teach_grades ? data.can_teach_grades.split(',') : [],
                    can_teach_subjects: data.can_teach_subjects ? data.can_teach_subjects.split(',') : [],
                    hourly_rate: data.hourly_rate || '',
                });
            } catch (err) { console.error(err); }
        };
        fetchProfile();
    }, [currentUser, db]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (db.length === 0) return;

        if (name === 'province') {
            const pData = db.find(p => p.name_th === value);
            setAddressData(prev => ({ ...prev, districts: pData?.districts.map(d => d.name_th).sort() || [], subdistricts: [] }));
            setFormData(prev => ({ ...prev, district: '', subdistrict: '', postalCode: '' }));
        } else if (name === 'district') {
            const pData = db.find(p => p.name_th === formData.province);
            // Safety check in case pData is undefined (though shouldn't happen if logic is correct)
            if (!pData) return;

            const dData = pData.districts.find(d => d.name_th === value);
            setAddressData(prev => ({ ...prev, subdistricts: dData?.sub_districts.map(s => s.name_th).sort() || [] }));
            setFormData(prev => ({ ...prev, subdistrict: '', postalCode: '' }));
        } else if (name === 'subdistrict') {
            const pData = db.find(p => p.name_th === formData.province);
            if (!pData) return;

            const dData = pData.districts.find(d => d.name_th === formData.district);
            if (!dData) return;

            const sData = dData.sub_districts.find(s => s.name_th === value);
            setFormData(prev => ({ ...prev, postalCode: sData ? String(sData.zip_code) : '' }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setCropImageSrc(reader.result);
            });
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const onCropComplete = (croppedBlob) => {
        setImageFile(croppedBlob);
        setFormData(prev => ({
            ...prev,
            profile_picture_url: URL.createObjectURL(croppedBlob)
        }));
        setCropImageSrc(null);
    };

    const onCropCancel = () => {
        setCropImageSrc(null);
    };


    const handleEducationChange = (index, e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, education: prev.education.map((item, i) => i === index ? { ...item, [name]: value } : item) }));
    };
    const addEducation = () => setFormData(prev => ({ ...prev, education: [...prev.education, { institution: '', degree: '', major: '', year: '' }] }));
    const removeEducation = (index) => setFormData(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== index) }));

    const handleExperienceChange = (index, e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, teaching_experience: prev.teaching_experience.map((item, i) => i === index ? { ...item, [name]: value } : item) }));
    };
    const addExperience = () => setFormData(prev => ({ ...prev, teaching_experience: [...prev.teaching_experience, { title: '', duration: '', description: '' }] }));
    const removeExperience = (index) => setFormData(prev => ({ ...prev, teaching_experience: prev.teaching_experience.filter((_, i) => i !== index) }));

    const handleGradeChange = (gradeValue) => {
        setFormData(prev => {
            const current = prev.can_teach_grades;
            return { ...prev, can_teach_grades: current.includes(gradeValue) ? current.filter(g => g !== gradeValue) : [...current, gradeValue] };
        });
    };

    const addSubject = (subject) => {
        const trimmed = subject.trim();
        if (trimmed && !formData.can_teach_subjects.includes(trimmed)) {
            setFormData(prev => ({ ...prev, can_teach_subjects: [...prev.can_teach_subjects, trimmed] }));
        }
    };
    const removeSubject = (sub) => setFormData(prev => ({ ...prev, can_teach_subjects: prev.can_teach_subjects.filter(s => s !== sub) }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser?.user_id) return setError("ไม่พบข้อมูลผู้ใช้");
        setIsSubmitting(true); setMessage(''); setError('');

        try {
            let imageUrl = formData.profile_picture_url;
            if (imageFile) {
                const fd = new FormData(); fd.append('image', imageFile);
                const res = await fetch('http://localhost:5000/api/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload failed');
                imageUrl = (await res.json()).imageUrl;
            }

            const fullAddress = [formData.addressDetails, formData.subdistrict, formData.district, formData.province, formData.postalCode].filter(Boolean).join(' ');
            const profileData = {
                nickname: formData.nickname,
                phone: formData.phone,
                address: fullAddress,
                about_me: formData.about_me,
                education: formData.education,
                teaching_experience: formData.teaching_experience,
                can_teach_grades: formData.can_teach_grades,
                can_teach_subjects: formData.can_teach_subjects,
                hourly_rate: formData.hourly_rate,
                profile_picture_url: imageUrl,
            };

            const res = await fetch(`http://localhost:5000/api/tutor-profile/${currentUser.user_id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed');

            setMessage('บันทึกเรียบร้อย!');
            setTimeout(() => setCurrentPage('profile'), 1500);
        } catch (err) { setError(err.message); }
        finally { setIsSubmitting(false); }
    };

    const user = { name: currentUser?.name || '', lastname: currentUser?.lastname || '', email: currentUser?.email || '' };

    return (
        <div className="bg-gray-50/50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">แก้ไขโปรไฟล์ติวเตอร์</h1>
                    </div>
                    <button onClick={() => setCurrentPage('profile')} className="flex items-center text-gray-500 hover:text-gray-700 transition-colors">
                        <ChevronLeft size={20} /> <span className="ml-1 font-medium">ย้อนกลับ</span>
                    </button>
                </div>

                {/* Cropper Modal */}
                {cropImageSrc && (
                    <ImageCropper
                        imageSrc={cropImageSrc}
                        onCropComplete={onCropComplete}
                        onCancel={onCropCancel}
                    />
                )}

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* 1. Profile Picture */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center">
                        <div className="relative group cursor-pointer w-40 h-40">
                            <img src={formData.profile_picture_url || 'https://via.placeholder.com/150'} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-indigo-50" />
                            <label htmlFor="profilePictureUpload" className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <Camera className="text-white w-10 h-10" />
                            </label>
                            <input type="file" id="profilePictureUpload" className="hidden" onChange={handleImageChange} accept="image/*" />
                        </div>
                        <p className="mt-4 text-sm text-gray-500">คลิกที่รูปเพื่ออัปเดตโปรไฟล์</p>
                    </div>

                    {/* 2. Personal Info */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><User size={24} /></div>
                            <h3 className="text-xl font-bold text-gray-900">ข้อมูลส่วนตัว</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="text-sm font-bold text-gray-700">ชื่อจริง</label><input type="text" value={user.name} disabled className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
                            <div><label className="text-sm font-bold text-gray-700">นามสกุล</label><input type="text" value={user.lastname} disabled className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
                            <div><label className="text-sm font-bold text-gray-700">ชื่อเล่น</label><input type="text" name="nickname" value={formData.nickname} onChange={handleChange} className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                            <div><label className="text-sm font-bold text-gray-700">เบอร์โทรศัพท์</label><input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>

                            {/* ✅ เพิ่มช่อง Email (Read-Only) */}
                            <div className="md:col-span-2">
                                <label className="text-sm font-bold text-gray-700">อีเมล</label>
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Mail size={18} /></div>
                                    <input
                                        type="email"
                                        value={user.email}
                                        disabled
                                        className="w-full pl-10 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* Address Grid */}
                            <div className="md:col-span-2 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={16} /> ที่อยู่ปัจจุบัน</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="w-full">
                                        <SearchableSelect
                                            options={addressData.provinces}
                                            value={formData.province}
                                            onChange={(val) => handleAddressChange({ target: { name: 'province', value: val } })}
                                            placeholder="ค้นหาจังหวัด..."
                                            disabled={db.length === 0}
                                        />
                                    </div>
                                    <select name="district" value={formData.district} onChange={handleAddressChange} disabled={!formData.province} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white"><option value="" disabled>อำเภอ/เขต</option>{addressData.districts.map(d => <option key={d} value={d}>{d}</option>)}</select>
                                    <select name="subdistrict" value={formData.subdistrict} onChange={handleAddressChange} disabled={!formData.district} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white"><option value="" disabled>ตำบล/แขวง</option>{addressData.subdistricts.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                    <input type="text" value={formData.postalCode} disabled placeholder="รหัสไปรษณีย์" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-100 text-gray-500" />
                                    <div className="col-span-2"><input type="text" name="addressDetails" value={formData.addressDetails} onChange={handleChange} placeholder="รายละเอียดเพิ่มเติม (Optional*) (บ้านเลขที่, ถนน, ซอย)" className="w-full px-3 py-2.5 rounded-lg border border-gray-200" /></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Teaching Info (Chips & Tags) */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="p-2 bg-purple-50 rounded-xl text-purple-600"><BookOpen size={24} /></div>
                            <h3 className="text-xl font-bold text-gray-900">ข้อมูลการสอน</h3>
                        </div>

                        {/* Grade Level Chips */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-3">ระดับชั้นที่สอนได้</label>
                            <div className="flex flex-wrap gap-3">
                                {gradeLevelOptions.map(option => {
                                    const isSelected = formData.can_teach_grades.includes(option.value);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleGradeChange(option.value)}
                                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50'}`}
                                        >
                                            {isSelected && <Check size={14} className="inline mr-1" />}
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Subject Tags */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-3">วิชาที่สอน</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {formData.can_teach_subjects.map(subject => (
                                    <span key={subject} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100">
                                        {subject}
                                        <button type="button" onClick={() => removeSubject(subject)} className="hover:text-blue-900"><X size={14} /></button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <select onChange={(e) => { if (e.target.value) addSubject(e.target.value); e.target.value = ''; }} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                                    <option value="">+ เลือกวิชา</option>
                                    {subjectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <div className="flex-1 flex gap-2">
                                    <input type="text" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="หรือพิมพ์วิชาเอง..." className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none" />
                                    <button type="button" onClick={() => { addSubject(customSubject); setCustomSubject(''); }} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all">เพิ่ม</button>
                                </div>
                            </div>
                        </div>

                        {/* Rate & About */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ค่าเรียนต่อชั่วโมง (บาท)</label>
                                <input type="number" name="hourly_rate" value={formData.hourly_rate} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="เช่น 250" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">แนะนำตัว / สไตล์การสอน</label>
                                <textarea name="about_me" rows="3" value={formData.about_me} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none" placeholder="เขียนแนะนำตัวเองให้น่าสนใจ..."></textarea>
                            </div>
                        </div>
                    </div>

                    {/* 4. Education & Experience (Cards) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Education */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="text-orange-500" /> การศึกษา</h3>
                                <button type="button" onClick={addEducation} className="text-sm text-orange-600 font-bold hover:underline">+ เพิ่ม</button>
                            </div>
                            <div className="space-y-4">
                                {formData.education.map((edu, idx) => (
                                    <div key={idx} className="relative p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
                                        <button type="button" onClick={() => removeEducation(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={16} /></button>
                                        <div className="grid gap-2">
                                            <UniversityPicker
                                                value={edu.institution}
                                                onChange={(val) => handleEducationChange(idx, { target: { name: 'institution', value: val } })}
                                                placeholder="สถานศึกษา"
                                            />
                                            <div className="flex gap-2">
                                                <input type="text" name="degree" value={edu.degree} onChange={(e) => handleEducationChange(idx, e)} placeholder="วุฒิ" className="w-1/3 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                                <input type="text" name="major" value={edu.major} onChange={(e) => handleEducationChange(idx, e)} placeholder="สาขา" className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                            </div>
                                            <input type="text" name="year" value={edu.year} onChange={(e) => handleEducationChange(idx, e)} placeholder="ปีที่จบ (เช่น 2566)" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Experience */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Briefcase className="text-blue-500" /> ประสบการณ์</h3>
                                <button type="button" onClick={addExperience} className="text-sm text-blue-600 font-bold hover:underline">+ เพิ่ม</button>
                            </div>
                            <div className="space-y-4">
                                {formData.teaching_experience.map((exp, idx) => (
                                    <div key={idx} className="relative p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                                        <button type="button" onClick={() => removeExperience(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={16} /></button>
                                        <div className="grid gap-2">
                                            <input type="text" name="title" value={exp.title} onChange={(e) => handleExperienceChange(idx, e)} placeholder="ตำแหน่ง/งาน" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" />
                                            <input type="text" name="duration" value={exp.duration} onChange={(e) => handleExperienceChange(idx, e)} placeholder="ระยะเวลา" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                            <textarea name="description" value={exp.description} onChange={(e) => handleExperienceChange(idx, e)} placeholder="รายละเอียดงาน..." rows="2" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"></textarea>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-4 pt-6 border-t border-gray-100">
                        <div className="h-6 text-sm font-bold">{message && <span className="text-green-600">{message}</span>}{error && <span className="text-red-600">{error}</span>}</div>
                        <div className="flex gap-4 w-full md:w-auto">
                            <button type="button" onClick={() => setCurrentPage('profile')} className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-all">ยกเลิก</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:bg-indigo-300">{isSubmitting ? 'กำลังบันทึก...' : <><Save size={20} /> บันทึกข้อมูล</>}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}