import React, { useState } from "react";
import { AlertTriangle, Trash2, Loader2, X } from "lucide-react";

// เปลี่ยนเป็น Port Backend ของคุณ
const API_BASE = "http://localhost:5000";

export default function DeleteAccountModal({ isOpen, onClose, user, userType, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  if (!isOpen) return null;

  const reasons = [
    "ไม่ค่อยได้ใช้งาน",
    "เจอแอปพลิเคชันอื่นที่ดีกว่า",
    "ระบบใช้งานยาก / ไม่เข้าใจ",
    "เจอปัญหาทางเทคนิคบ่อย",
    "อื่นๆ"
  ];

  const handleDelete = async () => {
    setLoading(true);
    try {
      const finalReason = reason === "อื่นๆ" ? otherReason : reason;

      // ส่งข้อมูลไป Backend
      const res = await fetch(`${API_BASE}/api/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.user_id,          
          userName: (user?.name || "") + " " + (user?.lastname || ""),
          userType: userType,            
          reason: finalReason,           
          detail: otherReason || "-"     
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("ลบบัญชีเรียบร้อยแล้ว ขอบคุณที่เคยใช้งานบริการของเราครับ");
      onLogout(); 

    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        
        {/* Header สีแดง */}
        <div className="bg-rose-50 px-6 py-4 border-b border-rose-100 flex justify-between items-center">
          <div className="flex items-center gap-3 text-rose-700">
            <div className="p-2 bg-white rounded-full shadow-sm"><AlertTriangle size={20} /></div>
            <h3 className="font-bold text-lg">ลบบัญชีผู้ใช้งาน</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            // --- Step 1: ถามเหตุผล ---
            <div className="space-y-4">
              <p className="text-gray-600 font-medium">เราเสียใจที่คุณจะไป 😢 ช่วยบอกเหตุผลให้เราทราบเพื่อนำไปปรับปรุงได้ไหมครับ?</p>
              
              <div className="space-y-2">
                {reasons.map((r) => (
                  <label key={r} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${reason === r ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="radio" 
                      name="reason" 
                      className="accent-rose-600 w-4 h-4 mr-3"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <span className="text-sm font-medium">{r}</span>
                  </label>
                ))}
              </div>

              {reason === "อื่นๆ" && (
                <textarea 
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-rose-200 text-sm"
                  placeholder="โปรดระบุสาเหตุ..."
                  rows="2"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                ></textarea>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">ยกเลิก</button>
                <button 
                  disabled={!reason}
                  onClick={() => setStep(2)} 
                  className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl shadow-lg hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  ต่อไป
                </button>
              </div>
            </div>
          ) : (
            // --- Step 2: ยืนยันครั้งสุดท้าย ---
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-800">ยืนยันการลบบัญชี?</h4>
              <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">
                การดำเนินการนี้ไม่สามารถย้อนกลับได้ ข้อมูลโปรไฟล์, โพสต์, และประวัติการใช้งานทั้งหมดของคุณจะถูกลบถาวร
              </p>
              
              <div className="pt-4 flex justify-center gap-3 w-full">
                <button 
                  onClick={() => setStep(1)} 
                  className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium"
                >
                  ย้อนกลับ
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-[2] px-4 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "ยืนยันลบถาวร"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}