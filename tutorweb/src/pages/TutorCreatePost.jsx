import React, { useState } from "react";
import TutorLayout from "../components/TutorLayout";
import { API_BASE } from '../config';

const getTutorId = () => localStorage.getItem("tutorId") || "";

function TutorCreatePost() {
  const tutorId = getTutorId();
  const [form, setForm] = useState({
    subject: "",
    content: "",
    meta: {
      teaching_days: "",
      teaching_time: "",
      location: "ออนไลน์",
      price: "",
      contact_info: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name in form.meta) setForm((f) => ({ ...f, meta: { ...f.meta, [name]: value } }));
    else setForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/tutor-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId, ...form, meta: { ...form.meta, price: Number(form.meta.price || 0) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg("โพสต์สำเร็จ!");
      setForm({ subject: "", content: "", meta: { teaching_days: "", teaching_time: "", location: "ออนไลน์", price: "", contact_info: "" } });
    } catch (e) {
      setMsg(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TutorLayout>
      <div className="bg-white rounded-3xl border shadow-sm p-5 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold">สร้างโพสต์รับสอน</h1>
        <p className="text-gray-600 mt-1 mb-6">ระบุรายละเอียดคอร์ส/ช่วงเวลา/ช่องทางติดต่อ</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">วิชา/หัวข้อ</label>
            <input name="subject" value={form.subject} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="เช่น คณิต ม.ปลาย, Python พื้นฐาน" />
          </div>
          <div>
            <label className="block text-sm font-medium">รายละเอียด</label>
            <textarea name="content" value={form.content} onChange={onChange} rows={5} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="สรุปรายวิชา แนวทางการสอน สิ่งที่ผู้เรียนจะได้รับ" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">วันที่สอน</label>
              <input name="teaching_days" value={form.meta.teaching_days} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="เช่น เสาร์-อาทิตย์, จ-พ" />
            </div>
            <div>
              <label className="block text-sm font-medium">ช่วงเวลา</label>
              <input name="teaching_time" value={form.meta.teaching_time} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="เช่น 18:00-20:00" />
            </div>
            <div>
              <label className="block text-sm font-medium">สถานที่</label>
              <input name="location" value={form.meta.location} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="ออนไลน์ / กรุงเทพฯ เขต..." />
            </div>
            <div>
              <label className="block text-sm font-medium">ราคา (บาท/ชม.)</label>
              <input name="price" type="number" value={form.meta.price} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="เช่น 350" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">ช่องทางติดต่อ</label>
              <input name="contact_info" value={form.meta.contact_info} onChange={onChange} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="LINE/เบอร์โทร/อีเมล" />
            </div>
          </div>

          <div className="pt-2">
            <button disabled={saving} className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black">
              {saving ? "กำลังบันทึก..." : "โพสต์"}
            </button>
          </div>

          {msg && <div className="text-sm mt-3">{msg}</div>}
        </form>
      </div>
    </TutorLayout>
  );
}
export default TutorCreatePost;