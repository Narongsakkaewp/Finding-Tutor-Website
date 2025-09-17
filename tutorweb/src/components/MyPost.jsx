import React, { useState, useEffect } from "react";

export default function MyPost() {
  const [posts, setPosts] = useState([]);
  const [expanded, setExpanded] = useState(false); // ✅ คุมการเปิดปิดฟอร์ม
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    preferred_days: "",
    preferred_time: "",
    location: "",
    group_size: "",
    budget: "",
    contact_info: ""
  });

  // ⬇️ สมมติว่าคุณเก็บ user หลัง login ไว้ใน localStorage
  const currentUser = JSON.parse(localStorage.getItem("user"));

  // โหลดโพสต์ทั้งหมด (feed)
  useEffect(() => {
    fetch("http://localhost:5000/api/student_posts")
      .then(res => res.json())
      .then(data => setPosts(data.items || []))
      .catch(err => console.error(err));
  }, []);

  // อัปเดตค่า form
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ส่งโพสต์ใหม่
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("กรุณาเข้าสู่ระบบก่อนโพสต์");
      return;
    }
    // ตรวจสอบว่ากรอกครบทุกช่องไหม
    for (let key in formData) {
      if (!formData[key]) {
        alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
      }
    }

    try {
      const res = await fetch("http://localhost:5000/api/student_posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.user_id,   // ⬅️ ส่ง user_id ไปด้วย
          ...formData
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("โพสต์สำเร็จ");
        setFormData({
          subject: "",
          description: "",
          preferred_days: "",
          preferred_time: "",
          location: "",
          group_size: "",
          budget: "",
          contact_info: ""
        });
        setExpanded(false); // ✅ โพสต์เสร็จปิดกล่อง
      } else {
        alert(data.message || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-4xl mx-auto">
        {/* ✅ กล่องโพสต์ */}
        <h1 className="text-xl font-bold mb-4">โพสต์</h1>
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center gap-3">
          <img
            src={currentUser?.profile_image || "/default-avatar.png"}
            alt="รูป"
            className="w-10 h-10 rounded-full"
          />
          <div
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-600 cursor-pointer hover:bg-gray-200"
            onClick={() => setExpanded(true)}
          >
            {`สวัสดี, ${currentUser?.name || ""}`}
          </div>
        </div>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input type="text" name="subject" placeholder="วิชา"
              value={formData.subject} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <textarea name="description" placeholder="รายละเอียด"
              value={formData.description} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="text" name="preferred_days" placeholder="วันสะดวก"
              value={formData.preferred_days} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="time" name="preferred_time"
              value={formData.preferred_time} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="text" name="location" placeholder="สถานที่"
              value={formData.location} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="number" name="group_size" placeholder="จำนวนคน"
              value={formData.group_size} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="number" name="budget" placeholder="งบประมาณ"
              value={formData.budget} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <input type="text" name="contact_info" placeholder="ข้อมูลติดต่อ"
              value={formData.contact_info} onChange={handleChange} required
              className="border rounded p-2 w-full" />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                โพสต์
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ✅ ฟีดโพสต์ */}
      <h2 className="text-xl font-bold mb-4">ฟีดโพสต์นักเรียน</h2>
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post._id} className="bg-white border p-4 rounded shadow">
            <div className="flex items-center gap-3 mb-2">
              <img
                src={post.user?.profile_image || "/default-avatar.png"}
                alt="avatar"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold">{post.user?.first_name} {post.user?.last_name}</p>
                <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <h3 className="text-lg font-bold">{post.subject}</h3>
            <p>{post.description}</p>
            <p className="text-sm text-gray-500">📍 สถานที่: {post.location}</p>
            <p className="text-sm text-gray-500">👥 จำนวนคน: {post.group_size} คน</p>
            <p className="text-sm text-gray-500">💰 งบประมาณ: {post.budget} บาท</p>
            <p className="text-sm text-gray-500">📅 วันสะดวก: {post.preferred_days}</p>
            <p className="text-sm text-gray-500">⏰ เวลา: {post.preferred_time}</p>
            <p className="text-sm text-gray-500">✉️ ข้อมูลติดต่อ: {post.contact_info}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
