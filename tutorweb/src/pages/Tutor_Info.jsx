import React, { useState, useEffect, useMemo } from 'react';

// ... (getCurrentUser function and initial option arrays are the same) ...
const getCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
};

const gradeLevelOptions = [
    { value: 'ประถม', label: 'ประถมศึกษา' },
    { value: 'ม.1', label: 'มัธยมศึกษาปีที่ 1' },
    { value: 'ม.2', label: 'มัธยมศึกษาปีที่ 2' },
    { value: 'ม.3', label: 'มัธยมศึกษาปีที่ 3' },
    { value: 'ม.4', label: 'มัธยมศึกษาปีที่ 4' },
    { value: 'ม.5', label: 'มัธยมศึกษาปีที่ 5' },
    { value: 'ม.6', label: 'มัธยมศึกษาปีที่ 6' },
    { value: 'ปริญญาตรี', label: 'ปริญญาตรี' },
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
    { value: 'อื่นๆ', label: 'อื่นๆ โปรดระบุ' },
];

export default function TutorInfoPage({ setCurrentPage }) {
    const currentUser = useMemo(() => getCurrentUser(), []);

    const [formData, setFormData] = useState({
        profile_picture_url: '',
        nickname: '',
        phone: '',
        address: '',
        about_me: '',
        education: [],
        teaching_experience: [],
        can_teach_grades: [],
        can_teach_subjects: [],
        hourly_rate: '',
    });

    const [customSubject, setCustomSubject] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!currentUser?.user_id) {
            setError("ไม่พบข้อมูลผู้ใช้, กรุณาล็อกอินใหม่");
            return;
        }

        const fetchProfile = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/tutor-profile/${currentUser.user_id}`);
                if (!response.ok) {
                    throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ติวเตอร์ได้");
                }
                const data = await response.json();
                
                setFormData({
                    profile_picture_url: data.profile_picture_url || '',
                    nickname: data.nickname || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    about_me: data.about_me || '',
                    education: data.education || [],
                    teaching_experience: data.teaching_experience || [],
                    can_teach_grades: data.can_teach_grades ? data.can_teach_grades.split(',') : [],
                    can_teach_subjects: data.can_teach_subjects ? data.can_teach_subjects.split(',') : [],
                    hourly_rate: data.hourly_rate || '',
                });
            } catch (err) {
                setError(err.message);
            }
        };

        fetchProfile();
    }, [currentUser]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const previewUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, profile_picture_url: previewUrl }));
        }
    };

    // Education/Experience Handlers (เหมือนเดิม)
    const handleEducationChange = (index, e) => {
        const { name, value } = e.target;
        const updatedEducation = formData.education.map((item, i) =>
            i === index ? { ...item, [name]: value } : item
        );
        setFormData(prev => ({ ...prev, education: updatedEducation }));
    };
    const addEducation = () => setFormData(prev => ({ ...prev, education: [...prev.education, { institution: '', degree: '', major: '', year: '' }]}));
    const removeEducation = (index) => setFormData(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== index)}));
    const handleExperienceChange = (index, e) => {
        const { name, value } = e.target;
        const updatedExperience = formData.teaching_experience.map((item, i) =>
            i === index ? { ...item, [name]: value } : item
        );
        setFormData(prev => ({ ...prev, teaching_experience: updatedExperience }));
    };
    const addExperience = () => setFormData(prev => ({ ...prev, teaching_experience: [...prev.teaching_experience, { title: '', duration: '', description: '' }]}));
    const removeExperience = (index) => setFormData(prev => ({ ...prev, teaching_experience: prev.teaching_experience.filter((_, i) => i !== index)}));
    
    // ✅ 1. ฟังก์ชันใหม่สำหรับจัดการ Checkbox ของระดับชั้น
    const handleGradeChange = (gradeValue) => {
        setFormData(prev => {
            const currentGrades = prev.can_teach_grades;
            // ถ้ามีอยู่แล้วให้เอาออก (ยกเลิกติ๊ก) ถ้ายังไม่มีให้เพิ่มเข้าไป (ติ๊กเลือก)
            if (currentGrades.includes(gradeValue)) {
                return { ...prev, can_teach_grades: currentGrades.filter(g => g !== gradeValue) };
            } else {
                return { ...prev, can_teach_grades: [...currentGrades, gradeValue] };
            }
        });
    };

    // ฟังก์ชันจัดการวิชา (เหมือนเดิม)
    const addSubject = (subject) => {
        const trimmedSubject = subject.trim();
        if (trimmedSubject && !formData.can_teach_subjects.includes(trimmedSubject)) {
            setFormData(prev => ({
                ...prev,
                can_teach_subjects: [...prev.can_teach_subjects, trimmedSubject]
            }));
        }
    };
    const handleAddCustomSubjectByKey = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSubject(customSubject);
            setCustomSubject('');
        }
    };
    const handleAddCustomSubjectByClick = () => {
        addSubject(customSubject);
        setCustomSubject('');
    };
    const removeSubject = (subjectToRemove) => {
        setFormData(prev => ({
            ...prev,
            can_teach_subjects: prev.can_teach_subjects.filter(subject => subject !== subjectToRemove)
        }));
    };
    
    // handleSubmit (เหมือนเดิม)
    const handleSubmit = async (e) => {
        e.preventDefault();
        // ... (โค้ดส่วนนี้เหมือนเดิมทุกประการ)
        if (!currentUser?.user_id) {
            setError("ไม่สามารถบันทึกได้: ไม่พบข้อมูลผู้ใช้");
            return;
        }

        setIsSubmitting(true);
        setMessage('');
        setError('');

        try {
            let imageUrl = formData.profile_picture_url;

            if (imageFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('image', imageFile);
                const uploadResponse = await fetch('http://localhost:5000/api/upload', {
                    method: 'POST',
                    body: uploadFormData,
                });
                if (!uploadResponse.ok) throw new Error('การอัปโหลดรูปภาพล้มเหลว');
                const uploadResult = await uploadResponse.json();
                imageUrl = uploadResult.imageUrl;
            }

            const profileData = {
                nickname: formData.nickname,
                phone: formData.phone,
                address: formData.address,
                about_me: formData.about_me,
                education: formData.education,
                teaching_experience: formData.teaching_experience,
                can_teach_grades: formData.can_teach_grades,
                can_teach_subjects: formData.can_teach_subjects,
                hourly_rate: formData.hourly_rate,
                profile_picture_url: imageUrl,
            };

            const response = await fetch(`http://localhost:5000/api/tutor-profile/${currentUser.user_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'การบันทึกข้อมูลติวเตอร์ล้มเหลว');
            }

            setMessage('บันทึกข้อมูลโปรไฟล์ติวเตอร์เรียบร้อยแล้ว!');
            setTimeout(() => {
                setCurrentPage('profile');
            }, 1500);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const user = {
        name: currentUser?.name || '',
        lastname: currentUser?.lastname || '',
        email: currentUser?.email || ''
    };

    return (
        <div className="bg-gray-50 min-h-screen py-10">
            <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center">แก้ไขโปรไฟล์ติวเตอร์</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ... (Profile Picture, Main Info, About Me, Education, Experience sections are the same) ... */}
                    {/* --- Profile Picture Section --- */}
                    <div className="flex flex-col items-center space-y-4">
                        <img 
                            src={formData.profile_picture_url || 'https://via.placeholder.com/150'} 
                            alt="Profile" 
                            className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                        />
                        <input type="file" id="profilePictureUpload" className="hidden" onChange={handleImageChange} accept="image/*" />
                        <label htmlFor="profilePictureUpload" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            เปลี่ยนรูปโปรไฟล์
                        </label>
                    </div>
                    
                    {/* --- Main Info Section --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                            <input type="text" value={user.name} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                            <input type="text" value={user.lastname} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2"/>
                        </div>
                        <div>
                            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">ชื่อเล่น</label>
                            <input type="text" id="nickname" name="nickname" value={formData.nickname} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">อีเมล</label>
                            <input type="email" value={user.email} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2"/>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">ที่อยู่ที่สามารถติดต่อได้</label>
                            <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                    </div>
                    
                    {/* --- About Me --- */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">เกี่ยวกับคุณ</h3>
                        <textarea id="about_me" name="about_me" rows="4" className="mt-1 w-full border border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="แนะนำตัวเอง, สไตล์การสอน, ประสบการณ์..." value={formData.about_me} onChange={handleChange}></textarea>
                    </div>

                    {/* --- Education Section --- */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">ประวัติการศึกษา</h3>
                        {formData.education.map((edu, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border rounded-md relative">
                            <button
                                type="button"
                                onClick={() => removeEducation(index)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
                                title="ลบ"
                            >
                            &times;
                            </button>
                            <div>
                                <label htmlFor={`edu-institution-${index}`} className="block text-sm font-medium text-gray-700">สถานศึกษา</label>
                                <input
                                    type="text"
                                    id={`edu-institution-${index}`}
                                    name="institution"
                                    value={edu.institution}
                                    onChange={(e) => handleEducationChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label htmlFor={`edu-degree-${index}`} className="block text-sm font-medium text-gray-700">ระดับ/วุฒิที่ได้รับ</label>
                                <input
                                    type="text"
                                    id={`edu-degree-${index}`}
                                    name="degree"
                                    value={edu.degree}
                                    onChange={(e) => handleEducationChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label htmlFor={`edu-major-${index}`} className="block text-sm font-medium text-gray-700">สาขาวิชา</label>
                                <input
                                    type="text"
                                    id={`edu-major-${index}`}
                                    name="major"
                                    value={edu.major}
                                    onChange={(e) => handleEducationChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label htmlFor={`edu-year-${index}`} className="block text-sm font-medium text-gray-700">ปีที่สำเร็จการศึกษา</label>
                                <input
                                    type="text"
                                    id={`edu-year-${index}`}
                                    name="year"
                                    value={edu.year}
                                    onChange={(e) => handleEducationChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                    placeholder="เช่น 2020"
                                />
                            </div>
                        </div>
                        ))}
                        <button
                            type="button"
                            onClick={addEducation}
                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm mt-2"
                        >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        เพิ่มประวัติการศึกษา
                        </button>
                    </div>

                    {/* --- Teaching Experience Section --- */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">ประสบการณ์ด้านการสอน</h3>
                        {formData.teaching_experience.map((exp, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border rounded-md relative">
                            <button
                                type="button"
                                onClick={() => removeExperience(index)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
                                title="ลบ"
                            >
                            &times;
                            </button>
                            <div>
                                <label htmlFor={`exp-title-${index}`} className="block text-sm font-medium text-gray-700">ตำแหน่ง/ลักษณะงาน</label>
                                <input
                                    type="text"
                                    id={`exp-title-${index}`}
                                    name="title"
                                    value={exp.title}
                                    onChange={(e) => handleExperienceChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                    placeholder="เช่น ติวเตอร์อิสระ, ครูสอนพิเศษ"
                                />
                            </div>
                            <div>
                                <label htmlFor={`exp-duration-${index}`} className="block text-sm font-medium text-gray-700">ระยะเวลา</label>
                                <input
                                    type="text"
                                    id={`exp-duration-${index}`}
                                    name="duration"
                                    value={exp.duration}
                                    onChange={(e) => handleExperienceChange(index, e)}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2"
                                    placeholder="เช่น 2018-ปัจจุบัน, 2 ปี"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor={`exp-description-${index}`} className="block text-sm font-medium text-gray-700">รายละเอียด</label>
                                <textarea
                                    id={`exp-description-${index}`}
                                    name="description"
                                    rows="2"
                                    value={exp.description}
                                    onChange={(e) => handleExperienceChange(index, e)}
                                    className="mt-1 w-full border border rounded-md shadow-sm p-2"
                                    placeholder="อธิบายบทบาทและสิ่งที่สอน"
                                ></textarea>
                            </div>
                        </div>
                        ))}
                        <button
                            type="button"
                            onClick={addExperience}
                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm mt-2"
                        >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        เพิ่มประสบการณ์การสอน
                        </button>
                    </div>

                    
                    {/* --- Teaching Capabilities Section --- */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">ความสามารถในการสอน</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* ✅ 2. START: UI ใหม่สำหรับ "ระดับชั้นที่สอนได้" (Checkbox) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ระดับชั้นที่สอนได้</label>
                                <div className="mt-2 space-y-2">
                                    {gradeLevelOptions.map(option => (
                                        <div key={option.value} className="flex items-center">
                                            <input
                                                id={`grade-${option.value}`}
                                                name="can_teach_grades"
                                                type="checkbox"
                                                value={option.value}
                                                checked={formData.can_teach_grades.includes(option.value)}
                                                onChange={() => handleGradeChange(option.value)}
                                                className="h-4 w-4 text-blue-600 border rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor={`grade-${option.value}`} className="ml-3 block text-sm text-gray-900">
                                                {option.label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* ✅ END: UI ใหม่สำหรับ "ระดับชั้นที่สอนได้" (Checkbox) */}

                            {/* ✅ 3. START: UI ใหม่สำหรับ "วิชาที่สอน" (เพิ่มปุ่ม) */}
                            <div>
                                <label htmlFor="subjects" className="block text-sm font-medium text-gray-700">วิชาที่สอน</label>

                                <div className="mt-1 flex flex-wrap gap-2 p-2 border border rounded-md min-h-[42px]">
                                    {formData.can_teach_subjects.length > 0 ? (
                                        formData.can_teach_subjects.map(subject => (
                                            <span key={subject} className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                                                {subject}
                                                <button type="button" onClick={() => removeSubject(subject)} className="ml-1.5 text-blue-600 hover:text-blue-800" title={`ลบ ${subject}`}>
                                                    &times;
                                                </button>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500">ยังไม่ได้เลือกวิชา</span>
                                    )}
                                </div>
                                
                                <div className="mt-2 grid grid-cols-1 gap-2">
                                    <select
                                        onChange={(e) => {
                                            if(e.target.value) addSubject(e.target.value);
                                            e.target.value = '';
                                        }}
                                        className="w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">--- เลือกจากรายการ ---</option>
                                        {subjectOptions.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={customSubject}
                                            onChange={(e) => setCustomSubject(e.target.value)}
                                            onKeyDown={handleAddCustomSubjectByKey}
                                            className="flex-grow w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="หรือพิมพ์วิชาอื่น..."
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleAddCustomSubjectByClick}
                                            className="px-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                                        >
                                            เพิ่ม
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="hourly_rate" className="block text-sm font-medium text-gray-700">อัตราค่าสอนต่อชั่วโมง (บาท)</label>
                                <input
                                    type="number"
                                    id="hourly_rate"
                                    name="hourly_rate"
                                    value={formData.hourly_rate}
                                    onChange={handleChange}
                                    className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="เช่น 300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* --- Action Buttons & Messages --- */}
                    <div className="flex flex-col items-end space-y-2">
                        <div className="h-5">
                            {message && <div className="text-green-600 text-sm">{message}</div>}
                            {error && <div className="text-red-600 text-sm">{error}</div>}
                        </div>
                        <div className="flex space-x-4">
                            <button type="button" onClick={() => setCurrentPage('profile')} className="px-6 py-2 border border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                ยกเลิก
                            </button>
                            <button type="submit" disabled={isSubmitting} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300">
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}