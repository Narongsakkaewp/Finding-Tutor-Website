import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import LongdoLocationPicker from './LongdoLocationPicker';

const API_BASE = "http://localhost:5000";

const postGradeLevelOptions = [
    { value: "ประถมศึกษา", label: "ประถมศึกษา" },
    { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
    { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
    { value: "ปริญญาตรี", label: "ปริญญาตรี" },
    { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

function TutorPostForm({ tutorId, onClose, onSuccess, initialData = null }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(initialData || {
        subject: "",
        description: "", // content in backend
        target_student_level: [],
        teaching_days: "",
        teaching_time: "",
        group_size: "",
        price: "",
        contact_info: ""
    });

    // ✅ New State for Online/Onsite
    const [teachingMode, setTeachingMode] = useState("onsite"); // onsite | online
    const [platform, setPlatform] = useState("");
    const [customPlatform, setCustomPlatform] = useState("");

    const platformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Discord", "Line Call", "Other"];

    // ✅ Initialize Online/Onsite state when editing
    useEffect(() => {
        if (initialData && initialData.location) {
            if (initialData.location.startsWith("Online:") || initialData.location === "Online" || initialData.location === "ออนไลน์") {
                setTeachingMode("online");
                const parts = initialData.location.split("Online:");
                const p = parts[1]?.trim() || "";
                if (platformOptions.includes(p)) {
                    setPlatform(p);
                    setCustomPlatform("");
                } else if (p) {
                    setPlatform("Other");
                    setCustomPlatform(p);
                } else {
                    setPlatform("Google Meet"); // Default
                }
            } else {
                setTeachingMode("onsite");
            }
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLevelChange = (levelValue) => {
        setFormData(prev => {
            const currentLevels = prev.target_student_level || [];
            if (currentLevels.includes(levelValue)) {
                return { ...prev, target_student_level: currentLevels.filter(l => l !== levelValue) };
            } else {
                return { ...prev, target_student_level: [...currentLevels, levelValue] };
            }
        });
    };

    const handleLocationSelect = (address) => {
        setFormData(prev => ({ ...prev, location: address }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tutorId) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");

        const required = ["subject", "description", "teaching_days", "teaching_time", "price", "contact_info"];
        for (const k of required) {
            if (!String(formData[k] || "").trim()) return alert(`กรุณากรอกข้อมูลให้ครบ (${k})`);
        }

        // Validate Location (Online vs Onsite)
        if (teachingMode === "onsite" && !formData.location?.trim()) {
            return alert("กรุณาระบุสถานที่");
        }
        if (teachingMode === "online" && !platform) {
            return alert("กรุณาระบุแพลตฟอร์ม");
        }
        if (teachingMode === "online" && platform === "Other" && !customPlatform.trim()) {
            return alert("กรุณาระบุชื่อแพลตฟอร์ม");
        }

        if (formData.target_student_level.length === 0) {
            return alert("กรุณาเลือกระดับชั้นที่สอนอย่างน้อย 1 ระดับ");
        }

        try {
            setLoading(true);
            const isEdit = !!initialData?.id;
            const method = isEdit ? "PUT" : "POST";
            const url = isEdit
                ? `${API_BASE}/api/tutor-posts/${initialData.id}`
                : `${API_BASE}/api/tutor-posts`;

            const payload = {
                tutor_id: tutorId,
                subject: formData.subject.trim(),
                description: formData.description.trim(), // Check backend mapping (content vs description)
                target_student_level: formData.target_student_level.join(','),
                teaching_days: formData.teaching_days,
                teaching_time: formData.teaching_time,
                teaching_days: formData.teaching_days,
                teaching_time: formData.teaching_time,
                location: teachingMode === 'online'
                    ? `Online: ${platform === 'Other' ? customPlatform : platform}`
                    : formData.location.trim(),
                group_size: Number(formData.group_size) || 1,
                price: Number(formData.price),
                contact_info: formData.contact_info.trim(),
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const body = await res.json();
            if (!res.ok || !body.success) {
                throw new Error(body?.message || "เกิดข้อผิดพลาดในการบันทึกโพสต์");
            }

            onSuccess?.();
            onClose?.();

        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 p-1">
            {/* วิชา/หัวข้อ */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วิชาที่สอน</label>
                <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="เช่น คณิตศาสตร์ ม.ปลาย, ภาษาอังกฤษเพื่อการสื่อสาร" />
            </div>

            {/* รายละเอียด */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดคอร์ส / ประสบการณ์</label>
                <textarea name="description" rows="4" value={formData.description} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="อธิบายรายละเอียดการสอน เนื้อหาที่จะเรียน หรือประสบการณ์ของคุณ..." />
            </div>

            {/* ระดับชั้นที่สอน */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ระดับชั้นที่รับสอน (เลือกได้มากกว่า 1)</label>
                <div className="flex flex-wrap gap-2">
                    {postGradeLevelOptions.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleLevelChange(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${formData.target_student_level.includes(opt.value)
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* วันและเวลาที่สะดวก */}
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สอน</label>
                    <input type="date" name="teaching_days" value={formData.teaching_days} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงเวลาที่สอน</label>
                    <input type="time" name="teaching_time" value={formData.teaching_time} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
            </div>

            {/* สถานที่ (With Toggle) */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3">รูปแบบการสอน</label>
                <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="teaching_mode"
                            value="onsite"
                            checked={teachingMode === "onsite"}
                            onChange={() => setTeachingMode("onsite")}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-900">สอนที่สถานที่ (On-site)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="teaching_mode"
                            value="online"
                            checked={teachingMode === "online"}
                            onChange={() => {
                                setTeachingMode("online");
                                if (!platform) setPlatform("Google Meet"); // Default
                            }}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-900">สอนออนไลน์ (Online)</span>
                    </label>
                </div>

                {teachingMode === "onsite" ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดสถานที่</label>
                        <LongdoLocationPicker
                            onLocationSelect={handleLocationSelect}
                            defaultLocation={formData.location?.startsWith("Online:") ? "" : formData.location}
                            showMap={false}
                        />
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์มที่ใช้</label>
                            <select
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            >
                                {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        {platform === "Other" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ระบุแพลตฟอร์มอื่น ๆ</label>
                                <input
                                    type="text"
                                    value={customPlatform}
                                    onChange={(e) => setCustomPlatform(e.target.value)}
                                    className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="เช่น Skype"
                                    required
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ราคาและจำนวนคน */}
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อชั่วโมง (บาท)</label>
                    <input type="number" name="price" min="0" value={formData.price} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รับกลุ่มละไม่เกิน (คน)</label>
                    <input type="number" name="group_size" min="1" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
            </div>

            {/* ข้อมูลติดต่อ */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ (Line ID, เบอร์โทร)</label>
                <input type="text" name="contact_info" value={formData.contact_info} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="เพื่อให้นักเรียนติดต่อกลับได้สะดวก" />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "กำลังบันทึก..." : (initialData ? "บันทึกการแก้ไข" : "ลงประกาศรับสอน")}
                </button>
            </div>
        </form>
    );
}

export default TutorPostForm;
