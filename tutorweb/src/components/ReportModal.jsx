import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../config';

export default function ReportModal({ open, onClose, postId, postType, reportedUserId }) {
    const [reason, setReason] = useState("");
    const [otherReason, setOtherReason] = useState("");
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const REASONS = [
        "เนื้อหาไม่เหมาะสม / หยาบคาย",
        "ข้อมูลเท็จ / หลอกลวง",
        "สแปม / โฆษณา",
        "การคุกคาม / กลั่นแกล้ง",
        "อื่นๆ"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return alert("กรุณาเลือกเหตุผล");

        const finalReason = reason === "อื่นๆ" ? otherReason : reason;
        if (!finalReason) return alert("กรุณาระบุรายละเอียด");

        try {
            setLoading(true);
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return alert("กรุณาเข้าสู่ระบบ");

            const res = await fetch(`${API_BASE}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reporter_id: user.user_id,
                    post_id: postId || null,
                    post_type: postType,
                    reason: finalReason,
                    reported_user_id: reportedUserId || null
                })
            });

            if (res.ok) {
                alert("ขอบคุณสำหรับการแจ้งปัญหา เราจะตรวจสอบโดยเร็วที่สุด");
                onClose();
            } else {
                alert("เกิดข้อผิดพลาดในการส่งรายงาน");
            }
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-red-600">
                        <Flag size={24} />
                        <h3 className="text-xl font-bold">รายงานโพสต์</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="bg-red-50 text-red-800 text-sm p-3 rounded-lg flex items-start gap-2 mb-4">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <p>การรายงานของคุณจะถูกส่งไปยังผู้ดูแลระบบเพื่อตรวจสอบ และจะไม่เปิดเผยตัวตนของคุณให้เจ้าของโพสต์ทราบ</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {REASONS.map((r) => (
                        <label key={r} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${reason === r ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "hover:bg-gray-50"}`}>
                            <input
                                type="radio"
                                name="reason"
                                value={r}
                                checked={reason === r}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-4 h-4 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-gray-700 font-medium">{r}</span>
                        </label>
                    ))}

                    {reason === "อื่นๆ" && (
                        <textarea
                            placeholder="โปรดระบุรายละเอียดเพิ่มเติม..."
                            value={otherReason}
                            onChange={(e) => setOtherReason(e.target.value)}
                            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[80px]"
                            required
                        />
                    )}

                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">ยกเลิก</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
                        >
                            {loading ? "กำลังส่ง..." : "ส่งรายงาน"}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
