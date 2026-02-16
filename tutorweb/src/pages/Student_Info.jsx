// tutorweb/src/pages/Student_Info.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  User, Phone, MapPin, School, BookOpen, FileText,
  Camera, Save, X, ChevronLeft
} from 'lucide-react';
import UniversityPicker from '../components/UniversityPicker'; // ✅ Import

// Helper function
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

export default function StudentInfoPage({ setCurrentPage }) {
  const currentUser = useMemo(() => getCurrentUser(), []);

  const [formData, setFormData] = useState({
    profile_picture_url: '',
    nickname: '',
    phone: '',
    address: '',
    gradeLevel: '',
    institution: '',
    faculty: '',
    major: '',
    about: ''
  });
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
        const response = await fetch(`http://localhost:5000/api/profile/${currentUser.user_id}`);
        if (!response.ok) throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
        const data = await response.json();

        setFormData({
          profile_picture_url: data.profile_picture_url || '',
          nickname: data.nickname || '',
          phone: data.phone || '',
          address: data.address || '',
          gradeLevel: data.grade_level || '',
          institution: data.institution || '',
          faculty: data.faculty || '',
          major: data.major || '',
          about: data.about || ''
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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        phone_number: formData.phone,
        address: formData.address,
        grade_level: formData.gradeLevel,
        institution: formData.institution,
        faculty: formData.faculty,
        major: formData.major,
        about_me: formData.about,
        profile_picture_url: imageUrl,
      };

      const response = await fetch(`http://localhost:5000/api/profile/${currentUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'การบันทึกข้อมูลล้มเหลว');
      }

      setMessage('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!');
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
    <div className="bg-gray-50/50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">แก้ไขโปรไฟล์นักเรียน</h1>
          </div>
          <button
            onClick={() => setCurrentPage('profile')}
            className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={20} /> <span className="ml-1 font-medium">ย้อนกลับ</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* 1. ส่วนรูปโปรไฟล์ */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-lg ring-4 ring-indigo-50">
                <img
                  src={formData.profile_picture_url || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              {/* Camera Overlay */}
              <label htmlFor="profilePictureUpload" className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                <Camera className="text-white w-10 h-10 drop-shadow-md" />
              </label>
              <input type="file" id="profilePictureUpload" className="hidden" onChange={handleImageChange} accept="image/*" />
            </div>
            <p className="mt-4 text-sm text-gray-500">คลิกที่รูปเพื่อเปลี่ยนรูปโปรไฟล์</p>
          </div>

          {/* 2. ข้อมูลส่วนตัว (Card) */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><User size={24} /></div>
              <h3 className="text-xl font-bold text-gray-900">ข้อมูลส่วนตัว</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อจริง</label>
                <input type="text" value={user.name} disabled className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">นามสกุล</label>
                <input type="text" value={user.lastname} disabled className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>

              <div>
                <label htmlFor="nickname" className="block text-sm font-semibold text-gray-700 mb-1">ชื่อเล่น</label>
                <input
                  type="text" id="nickname" name="nickname" value={formData.nickname} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                  placeholder="ระบุชื่อเล่นของคุณ"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Phone size={18} /></div>
                  <input
                    type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange}
                    className="w-full pl-10 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">อีเมล</label>
                <input type="email" value={user.email} disabled className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1">ที่อยู่ที่สามารถติดต่อได้</label>
                <div className="relative">
                  <div className="absolute top-3.5 left-3 pointer-events-none text-gray-400"><MapPin size={18} /></div>
                  <input
                    type="text" id="address" name="address" value={formData.address} onChange={handleChange}
                    className="w-full pl-10 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. การศึกษา (Card) */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><School size={24} /></div>
              <h3 className="text-xl font-bold text-gray-900">การศึกษา</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="gradeLevel" className="block text-sm font-semibold text-gray-700 mb-1">ระดับชั้นปัจจุบัน</label>
                <div className="relative">
                  <select
                    id="gradeLevel" name="gradeLevel" value={formData.gradeLevel} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                  >
                    <option value="" disabled>--- เลือกระดับชั้น ---</option>
                    <option value="ประถมศึกษา">ประถมศึกษา</option>
                    <option value="ม.1">มัธยมศึกษาปีที่ 1</option>
                    <option value="ม.2">มัธยมศึกษาปีที่ 2</option>
                    <option value="ม.3">มัธยมศึกษาปีที่ 3</option>
                    <option value="ม.4">มัธยมศึกษาปีที่ 4</option>
                    <option value="ม.5">มัธยมศึกษาปีที่ 5</option>
                    <option value="ม.6">มัธยมศึกษาปีที่ 6</option>
                    <option value="ปริญญาตรี">ปริญญาตรี</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="institution" className="block text-sm font-semibold text-gray-700 mb-1">สถานศึกษา</label>
                <UniversityPicker
                  value={formData.institution}
                  onChange={(val) => setFormData(prev => ({ ...prev, institution: val }))}
                  placeholder="ชื่อโรงเรียน / มหาวิทยาลัย"
                />
              </div>
              <div>
                <label htmlFor="faculty" className="block text-sm font-semibold text-gray-700 mb-1">คณะ (ถ้ามี)</label>
                <input type="text" id="faculty" name="faculty" value={formData.faculty} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ระบุคณะ" />
              </div>
              <div>
                <label htmlFor="major" className="block text-sm font-semibold text-gray-700 mb-1">สาขา/สายการเรียน (ถ้ามี)</label>
                <input type="text" id="major" name="major" value={formData.major} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ระบุสาขา หรือ สายวิทย์-คณิต" />
              </div>
            </div>
          </div>

          {/* 4. เกี่ยวกับคุณ (Card) */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><FileText size={24} /></div>
              <h3 className="text-xl font-bold text-gray-900">เกี่ยวกับคุณ</h3>
            </div>
            <textarea
              id="about" name="about" rows="4"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              placeholder="แนะนำตัวเองสั้นๆ เพื่อให้ติวเตอร์รู้จักคุณมากขึ้น..."
              value={formData.about} onChange={handleChange}
            ></textarea>
          </div>

          {/* Messages & Actions */}
          <div className="flex flex-col items-end gap-4 pt-4">
            {message && <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200 animate-fade-in">{message}</div>}
            {error && <div className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200 animate-fade-in">{error}</div>}

            <div className="flex gap-4 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setCurrentPage('profile')}
                className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:bg-indigo-300 disabled:shadow-none"
              >
                {isSubmitting ? 'กำลังบันทึก...' : <><Save size={20} /> บันทึกข้อมูล</>}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}