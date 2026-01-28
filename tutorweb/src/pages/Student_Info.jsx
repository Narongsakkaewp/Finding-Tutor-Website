// tutorweb/src/pages/Student_Info.jsx
import React, { useState, useEffect, useMemo } from 'react';

// Helper function to get user from localStorage, similar to your Profile.jsx
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

export default function StudentInfoPage({ setCurrentPage }) {
  // 1. ดึงข้อมูลผู้ใช้ที่ล็อกอินอยู่จาก localStorage
  const currentUser = useMemo(() => getCurrentUser(), []);

  // 2. State สำหรับจัดการข้อมูลในฟอร์ม, ไฟล์รูป, และสถานะการโหลด/ข้อความ
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
  const [imageFile, setImageFile] = useState(null); // State สำหรับเก็บไฟล์รูปที่เลือกใหม่
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 3. เมื่อ Component โหลด, ดึงข้อมูลโปรไฟล์เดิมจาก Backend มาใส่ในฟอร์ม
  useEffect(() => {
    if (!currentUser?.user_id) {
      setError("ไม่พบข้อมูลผู้ใช้, กรุณาล็อกอินใหม่");
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/profile/${currentUser.user_id}`);
        if (!response.ok) {
          throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
        }
        const data = await response.json();

        // สังเกตว่าเราจะใช้ชื่อ field ตาม schema ของ database ที่เราออกแบบไว้
        setFormData({
          profile_picture_url: data.profile_picture_url || '',
          nickname: data.nickname || '',
          phone: data.phone || '', // แก้ไขตาม schema
          address: data.address || '',
          gradeLevel: data.grade_level || '', // แก้ไขตาม schema
          institution: data.institution || '',
          faculty: data.faculty || '',
          major: data.major || '',
          about: data.about || '' // แก้ไขตาม schema
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
      setImageFile(file); // เก็บ object ของไฟล์ไว้
      // แสดงภาพตัวอย่างทันที
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, profile_picture_url: previewUrl }));
    }
  };

  // 4. หัวใจหลัก: ฟังก์ชันส่งข้อมูลไปยัง Backend
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

      // 4.1 ถ้ามีการเลือกไฟล์รูปใหม่, ให้อัปโหลดไฟล์ก่อน
      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', imageFile);

        // ยิงไปที่ endpoint สำหรับอัปโหลดรูปภาพโดยเฉพาะ
        const uploadResponse = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) throw new Error('การอัปโหลดรูปภาพล้มเหลว');

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl; // รับ URL จริงจาก server
      }

      // 4.2 เตรียมข้อมูลทั้งหมดเพื่อส่งไปบันทึก
      const profileData = {
        nickname: formData.nickname,
        phone_number: formData.phone, // ชื่อ field ต้องตรงกับ backend
        address: formData.address,
        grade_level: formData.gradeLevel,
        institution: formData.institution,
        faculty: formData.faculty,
        major: formData.major,
        about_me: formData.about,
        profile_picture_url: imageUrl,
      };

      // 4.3 ส่งข้อมูลไปอัปเดตที่ Backend
      const response = await fetch(`http://localhost:5000/api/profile/${currentUser.user_id}`, {
        method: 'PUT', // ใช้ PUT สำหรับการอัปเดตข้อมูลที่มีอยู่แล้ว
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'การบันทึกข้อมูลล้มเหลว');
      }

      // 4.4 เมื่อสำเร็จ: แสดงข้อความและเปลี่ยนหน้ากลับไปที่โปรไฟล์
      setMessage('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!');
      setTimeout(() => {
        setCurrentPage('profile'); // กลับไปหน้าโปรไฟล์
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ดึงข้อมูลชื่อ-นามสกุล และอีเมลจาก currentUser มาแสดง (ส่วนที่ไม่ให้แก้ไข)
  const user = {
    name: currentUser?.name || '',
    lastname: currentUser?.lastname || '',
    email: currentUser?.email || ''
  };

  return (
    <div className="bg-gray-50 min-h-screen py-10">
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">แก้ไขโปรไฟล์นักเรียน</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <input type="text" value={user.name} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
              <input type="text" value={user.lastname} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2" />
            </div>
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">ชื่อเล่น</label>
              <input type="text" id="nickname" name="nickname" value={formData.nickname} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
              <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">อีเมล</label>
              <input type="email" value={user.email} disabled className="mt-1 w-full border rounded-md shadow-sm bg-gray-100 p-2" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">ที่อยู่ที่สามารถติดต่อได้</label>
              <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          {/* --- Education & About Sections... (เหมือนเดิม) --- */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">การศึกษา</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ✅✅✅ START: โค้ดที่แก้ไข ✅✅✅ */}
              <div>
                <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700">ระดับชั้น</label>
                <select
                  id="gradeLevel"
                  name="gradeLevel"
                  value={formData.gradeLevel}
                  onChange={handleChange}
                  className="mt-1 block w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
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
              </div>
              {/* ✅✅✅ END: โค้ดที่แก้ไข ✅✅✅ */}

              <div>
                <label htmlFor="institution" className="block text-sm font-medium text-gray-700">สถานศึกษา</label>
                <input type="text" id="institution" name="institution" value={formData.institution} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="faculty" className="block text-sm font-medium text-gray-700">คณะ</label>
                <input type="text" id="faculty" name="faculty" value={formData.faculty} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="major" className="block text-sm font-medium text-gray-700">สาขา</label>
                <input type="text" id="major" name="major" value={formData.major} onChange={handleChange} className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">เกี่ยวกับคุณ</h3>
            <textarea id="about" name="about" rows="4" className="mt-1 w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="แนะนำตัวเองสั้นๆ..." value={formData.about} onChange={handleChange}></textarea>
          </div>

          {/* --- Action Buttons & Messages --- */}
          <div className="flex flex-col items-end space-y-2">
            <div className="h-5">
              {message && <div className="text-green-600 text-sm">{message}</div>}
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </div>
            <div className="flex space-x-4">
              <button type="button" onClick={() => setCurrentPage('profile')} className="px-6 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
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