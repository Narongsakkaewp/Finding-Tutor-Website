import React, { useState } from "react";
import { X, MessageSquareWarning, Send, AlertCircle, Loader2 } from "lucide-react";
import { API_BASE } from '../config';

// ⚠️ เช็ค Port ให้ตรงกับ Server ของคุณ
export default function ReportIssueModal({ isOpen, onClose, user }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "พบข้อผิดพลาด (Bug)",
    topic: "",
    detail: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ส่งข้อมูลไปหา Server
      const res = await fetch(`${API_BASE}/api/report-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user_contact: user?.email || user?.name || "ไม่ระบุตัวตน"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("ส่งข้อมูลเรียบร้อยแล้ว! ขอบคุณที่แจ้งปัญหาครับ");
      setFormData({ category: "พบข้อผิดพลาด (Bug)", topic: "", detail: "" });
      onClose();

    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-3 text-orange-700">
            <div className="p-2 bg-white rounded-full shadow-sm"><MessageSquareWarning size={20} /></div>
            <h3 className="font-bold text-lg">รายงานปัญหา / ข้อเสนอแนะ</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full"><X size={20} /></button>
        </div>

        {/* Form */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ประเภท</label>
              <select className="w-full p-2.5 border rounded-xl outline-none bg-gray-50"
                value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                <option>พบข้อผิดพลาด (Bug)</option>
                <option>บัญชีผู้ใช้ / เข้าสู่ระบบ</option>
                <option>รายงานผู้ใช้ (กรุณากรอกชื่อ-นามสกุลผู้ใช้งานด้วยครับ)</option>
                <option>เสนอแนะฟีเจอร์ใหม่</option>
                <option>เนื้อหาไม่เหมาะสม</option>
                <option>อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">หัวข้อ</label>
              <input type="text" required className="w-full p-2.5 border rounded-xl outline-none" placeholder="เช่น ค้นหาไม่ได้, ไม่สามารถโพสต์ได้"
                value={formData.topic} onChange={(e) => setFormData({...formData, topic: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">รายละเอียด</label>
              <textarea rows="4" required className="w-full p-2.5 border rounded-xl outline-none resize-none" placeholder="อธิบายเพิ่มเติม..."
                value={formData.detail} onChange={(e) => setFormData({...formData, detail: e.target.value})}></textarea>
            </div>
            <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg flex gap-2"><AlertCircle size={16} /><p>ข้อมูลของคุณจะถูกส่งให้ทีมพัฒนาโดยตรง</p></div>
            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">ยกเลิก</button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 flex items-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />} {loading ? "กำลังส่ง..." : "ส่งรายงาน"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}