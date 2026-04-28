// src/components/MyPostForm.jsx
import React, { useState, useEffect } from "react";
import LongdoLocationPicker from './LongdoLocationPicker';
import { API_BASE } from '../config';
import { Calendar, Clock, Plus, X } from "lucide-react"; // 🌟 นำเข้า Icon เพิ่มเติม

const postGradeLevelOptions = [
    { value: "ประถมศึกษา", label: "ประถมศึกษา" },
    { value: "มัธยมต้น", label: "มัธยมศึกษาตอนต้น (ม.1-ม.3)" },
    { value: "มัธยมปลาย", label: "มัธยมศึกษาตอนปลาย (ม.4-ม.6)" },
    { value: "ปริญญาตรี", label: "ปริญญาตรี" },
    { value: "บุคคลทั่วไป", label: "บุคคลทั่วไป" },
];

const today = new Date().toISOString().split("T")[0];
const platformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Discord", "Line Call", "Other"];

function normalizeDateInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
        return `${ymd[1]}-${String(ymd[2]).padStart(2, "0")}-${String(ymd[3]).padStart(2, "0")}`;
    }

    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
        const day = String(dmy[1]).padStart(2, "0");
        const month = String(dmy[2]).padStart(2, "0");
        const year = Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]);
        return `${year}-${month}-${day}`;
    }

    return raw;
}

function formatThaiDateLabel(value) {
    const normalized = normalizeDateInput(value);
    if (!normalized) return "";

    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return normalized;

    const year = Number(match[1]) + 543;
    const month = Number(match[2]);
    const day = Number(match[3]);
    return `${day}/${month}/${year}`;
}

function createInitialStudentFormData(initialData = {}) {
    const normalizedLevels = Array.isArray(initialData?.target_student_level)
        ? initialData.target_student_level
        : String(initialData?.target_student_level || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    return {
        subject: "",
        description: "",
        grade_level: "",
        location: "",
        group_size: "",
        budget: "",
        price: "",
        contact_info: "",
        ...initialData,
        target_student_level: normalizedLevels,
    };
}

export default function MyPostForm({
    feedType,
    isTutor,
    isAdmin = false,
    meId,
    tutorId,
    user,
    editMode,
    editingPostId,
    initialData,
    onClose,
    onSuccess
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(() => createInitialStudentFormData(initialData));
    const actorUserId = user?.user_id || meId || tutorId || 0;

    // ✅ State สำหรับจัดการ วัน/เวลา (แบบหลายรายการ)
    const [dateList, setDateList] = useState([]);
    const [tempDate, setTempDate] = useState("");
    const [tempTime, setTempTime] = useState("");

    // Contact Info State
    const [contactType, setContactType] = useState('Line ID');
    const [contactValue, setContactValue] = useState('');

    const [teachingMode, setTeachingMode] = useState("onsite");
    const [platform, setPlatform] = useState("");
    const [customPlatform, setCustomPlatform] = useState("");
    useEffect(() => {
        setFormData(createInitialStudentFormData(initialData));
    }, [initialData, editMode, feedType]);

    useEffect(() => {
        // จัดการ Location
        if (formData.location) {
            if (formData.location.startsWith("Online:") || formData.location === "Online" || formData.location === "ออนไลน์") {
                setTeachingMode("online");
                const parts = formData.location.split("Online:");
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
    }, [formData.location]);

    useEffect(() => {
        // จัดการ Contact
        if (formData.contact_info) {
            const ci = formData.contact_info;
            if (ci.startsWith("Line ID:")) {
                setContactType("Line ID");
                setContactValue(ci.replace("Line ID:", "").trim());
            } else if (ci.startsWith("เบอร์โทร:")) {
                setContactType("เบอร์โทร");
                setContactValue(ci.replace("เบอร์โทร:", "").trim());
            } else if (ci.startsWith("Email:")) {
                setContactType("Email");
                setContactValue(ci.replace("Email:", "").trim());
            } else if (ci.includes(":")) {
                const parts = ci.split(":");
                setContactType("อื่นๆ");
                setContactValue(parts.slice(1).join(":").trim());
            } else {
                setContactType("อื่นๆ");
                setContactValue(ci.trim());
            }
        }
    }, [formData.contact_info]);

    useEffect(() => {
        const source = initialData || {};
        const daysStr = feedType === "student" ? source.preferred_days : source.teaching_days;
        const timesStr = feedType === "student" ? source.preferred_time : source.teaching_time;

        if (daysStr) {
            const dArr = daysStr.split(',').map(d => d.trim());
            const tArr = (timesStr || "").split(',').map(t => t.trim());
            const loadedList = dArr.map((d, i) => ({
                date: normalizeDateInput(d),
                time: tArr[i] || ""
            })).filter(x => x.date);
            setDateList(loadedList);
        } else {
            setDateList([]);
        }
        setTempDate("");
        setTempTime("");
    }, [initialData, editMode, feedType]);

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

    const handleLocationSelect = (address, locationObj) => {
        setFormData(prev => ({ ...prev, location: address }));
    };

    // 🌟 ฟังก์ชันจัดการเพิ่ม/ลบ วันเวลา
    const handleAddDateTime = () => {
        if (!tempDate) return alert("กรุณาเลือกวันที่ครับ");
        if (dateList.some(item => item.date === tempDate)) {
            return alert("คุณได้เลือกวันที่นี้ไปแล้วครับ");
        }
        setDateList([...dateList, { date: tempDate, time: tempTime }]);
        setTempDate("");
        setTempTime("");
    };

    const handleRemoveDateTime = (indexToRemove) => {
        setDateList(dateList.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!actorUserId) return alert("กรุณาเข้าสู่ระบบก่อนโพสต์");
        if (isAdmin) return alert("บัญชีแอดมินไม่สามารถสร้างหรือแก้ไขโพสต์ได้");

        // 🌟 ตรวจสอบว่าได้ใส่วันเวลาอย่างน้อย 1 วันหรือไม่
        if (dateList.length === 0) {
            return alert("กรุณากำหนดวันและเวลาที่ต้องการเรียนหรือสอนอย่างน้อย 1 วันครับ");
        }

        // แปลง Array กลับไปเป็น String คั่นด้วยลูกน้ำเพื่อส่งเข้า Database
        const daysString = dateList.map(item => item.date).join(', ');
        const timesString = dateList.map(item => item.time || "--:--").join(', ');

        try {
            setLoading(true);
            const method = editMode ? "PUT" : "POST";
            const idPart = editMode ? `/${editingPostId}` : "";

            if (feedType === "student") {
                // ลบ preferred_days, preferred_time ออกจาก required check เพราะเราเช็คด้านบนแล้ว
                const required = ["subject", "description", "group_size", "budget", "grade_level"];
                for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
                if (!contactValue.trim()) return alert("กรุณากรอกข้อมูลติดต่อ");

                if (teachingMode === "onsite" && !formData.location.trim()) return alert("กรุณาระบุสถานที่");
                if (teachingMode === "online" && !platform) return alert("กรุณาระบุแพลตฟอร์ม");
                if (teachingMode === "online" && platform === "Other" && !customPlatform.trim()) return alert("กรุณาระบุชื่อแพลตฟอร์ม");

                const payload = {
                    user_id: actorUserId,
                    subject: formData.subject.trim(),
                    description: formData.description.trim(),
                    preferred_days: daysString, // 🌟 ส่งค่าวันใหม่
                    preferred_time: timesString, // 🌟 ส่งค่าเวลาใหม่
                    grade_level: formData.grade_level,
                    location: teachingMode === 'online'
                        ? `Online: ${platform === 'Other' ? customPlatform : platform}`
                        : formData.location.trim(),
                    group_size: Number(formData.group_size),
                    budget: Number(formData.budget),
                    contact_info: contactType === "อื่นๆ" ? contactValue.trim() : `${contactType}: ${contactValue.trim()}`,
                };

                const res = await fetch(`${API_BASE}/api/student_posts${idPart}`, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error("เกิดข้อผิดพลาด");

            } else {
                const required = ["subject", "description", "price"];
                for (const k of required) if (!String(formData[k]).trim()) return alert("กรุณากรอกข้อมูลให้ครบ");
                if (!contactValue.trim()) return alert("กรุณากรอกข้อมูลติดต่อ");

                if (teachingMode === "onsite" && !formData.location.trim()) return alert("กรุณาระบุสถานที่");
                if (teachingMode === "online" && !platform) return alert("กรุณาระบุแพลตฟอร์ม");
                if (formData.target_student_level.length === 0) return alert("กรุณาเลือกระดับชั้นที่สอนอย่างน้อย 1 ระดับ");
                if (!isTutor) throw new Error("เฉพาะติวเตอร์เท่านั้นที่โพสต์ฝั่งติวเตอร์ได้");

                const payload = {
                    tutor_id: actorUserId,
                    subject: formData.subject.trim(),
                    description: formData.description.trim(),
                    target_student_level: formData.target_student_level.join(','),
                    teaching_days: daysString, // 🌟 ส่งค่าวันใหม่
                    teaching_time: timesString, // 🌟 ส่งค่าเวลาใหม่
                    location: teachingMode === 'online'
                        ? `Online: ${platform === 'Other' ? customPlatform : platform}`
                        : formData.location.trim(),
                    group_size: Number(formData.group_size) || 1,
                    price: Number(formData.price),
                    contact_info: contactType === "อื่นๆ" ? contactValue.trim() : `${contactType}: ${contactValue.trim()}`,
                };

                const res = await fetch(`${API_BASE}/api/tutor-posts${idPart}`, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const body = await res.json();
                if (!res.ok || !body.success) {
                    throw new Error(body?.message || "เกิดข้อผิดพลาดในการสร้าง/แก้ไขโพสต์ (tutor)");
                }
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            alert(err.message || "Server error");
        } finally {
            setLoading(false);
        }
    };

    // 🌟 Component แยกสำหรับเรนเดอร์กล่องใส่วันเวลา
    const renderDateTimeSection = () => (
        <div className="md:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <label className="block text-sm font-bold text-gray-700 mb-3">
                กำหนดวันและเวลาที่ต้องการเรียนหรือสอน <span className="text-red-500">*</span>
            </label>

            {/* แถบกรอกข้อมูลเพิ่ม */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-gray-500 mb-1">วันที่</label>
                    <input
                        type="date"
                        min={today}
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-500 mb-1">เวลา</label>
                    <input
                        type="time"
                        value={tempTime}
                        onChange={(e) => setTempTime(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2.5 w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={handleAddDateTime}
                    className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1 transition-colors shadow-sm"
                >
                    <Plus size={16} /> เพิ่ม
                </button>
            </div>

            {/* แสดงรายการวันที่ที่ถูกเลือกไว้แล้ว */}
            {dateList.length > 0 ? (
                <ul className="space-y-2 mt-2">
                    {dateList.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-white p-3 px-4 rounded-lg border border-gray-200 shadow-sm animate-in fade-in zoom-in duration-200">
                            <span className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                                <span className="flex items-center gap-1.5 text-indigo-600">
                                    <Calendar size={16} />
                                    {formatThaiDateLabel(item.date)}
                                </span>
                                {item.time && (
                                    <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                                        <Clock size={14} />
                                        {item.time}
                                    </span>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleRemoveDateTime(idx)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-sm text-gray-400 text-center py-5 border-2 border-dashed border-indigo-100 rounded-lg bg-white/50">
                    ยังไม่ได้เลือกวันและเวลาครับ
                </div>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* วิชา/หัวข้อ */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วิชา / หัวข้อ</label>
                <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
            </div>

            {/* รายละเอียด */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เนื้อหาที่ต้องการเรียน</label>
                <textarea name="description" rows="3" value={formData.description} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>

            {feedType === "student" ? (
                <>
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* 🌟 กล่องใส่วันเวลาใหม่ */}
                        {renderDateTimeSection()}

                        {/* ระดับชั้น */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้นของผู้เรียน</label>
                            <select name="grade_level" value={formData.grade_level} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">-- กรุณาเลือก --</option>
                                {postGradeLevelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* สถานที่ (With Toggle) */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-3">รูปแบบการเรียน</label>
                        <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="teaching_mode" value="onsite" checked={teachingMode === "onsite"} onChange={() => setTeachingMode("onsite")} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                <span className="text-gray-900">เรียนที่สถานที่ (On-site)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="teaching_mode" value="online" checked={teachingMode === "online"} onChange={() => { setTeachingMode("online"); if (!platform) setPlatform("Google Meet"); }} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                <span className="text-gray-900">เรียนออนไลน์ (Online)</span>
                            </label>
                        </div>

                        {teachingMode === "onsite" ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดสถานที่</label>
                                <LongdoLocationPicker onLocationSelect={handleLocationSelect} defaultLocation={formData.location?.startsWith("Online:") ? "" : formData.location} showMap={false} />
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์มที่ใช้</label>
                                    <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                {platform === "Other" && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ระบุแพลตฟอร์มอื่น ๆ</label>
                                        <input type="text" value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)} className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น Skype" required />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* จำนวนคนและงบประมาณ */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                            <input type="number" name="group_size" min="1" placeholder="1 = ตัวต่อตัว" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (ต่อชั่วโมง)</label>
                            <input type="number" name="budget" min="0" value={formData.budget} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* ส่วนของ Tutor */}
                    <div className="border rounded-xl p-4">
                        <label className="block text-sm font-bold text-gray-800 mb-3">ระดับชั้นที่รับสอน (เลือกได้มากกว่า 1)</label>
                        <div className="flex flex-wrap gap-3">
                            {postGradeLevelOptions.map(option => (
                                <label key={option.value} className="flex items-center space-x-2 cursor-pointer px-3 py-2 bg-white hover:bg-blue-50 border border-gray-200 rounded-lg transition-all shadow-sm select-none">
                                    <input id={`level-${option.value}`} type="checkbox" value={option.value} checked={(formData.target_student_level || []).includes(option.value)} onChange={() => handleLevelChange(option.value)} className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 whitespace-nowrap">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* 🌟 กล่องใส่วันเวลาใหม่ */}
                        {renderDateTimeSection()}

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เรียน (คน)</label>
                            <input type="number" name="group_size" min="0" placeholder="1 = ตัวต่อตัว" value={formData.group_size} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-sm font-bold text-gray-700 mb-3">รูปแบบการสอน</label>
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="tutor_teaching_mode" value="onsite" checked={teachingMode === "onsite"} onChange={() => setTeachingMode("onsite")} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-gray-900">สอนที่สถานที่ (On-site)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="tutor_teaching_mode" value="online" checked={teachingMode === "online"} onChange={() => { setTeachingMode("online"); if (!platform) setPlatform("Google Meet"); }} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-gray-900">สอนออนไลน์ (Online)</span>
                                </label>
                            </div>

                            {teachingMode === "onsite" ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดสถานที่</label>
                                    <LongdoLocationPicker onLocationSelect={handleLocationSelect} defaultLocation={formData.location?.startsWith("Online:") ? "" : formData.location} showMap={false} />
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์มที่ใช้</label>
                                        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                            {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    {platform === "Other" && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ระบุแพลตฟอร์มอื่น ๆ</label>
                                            <input type="text" value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)} className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น Skype" required />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (ต่อชั่วโมง)</label>
                            <input type="number" name="price" min="0" value={formData.price} onChange={handleChange} required className="border rounded-lg p-2.5 w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                </>
            )}

            {/* ข้อมูลติดต่อ (ส่วนรวมที่ใช้เหมือนกัน) */}
            <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ข้อมูลติดต่อ</label>
                <div className="flex gap-2">
                    <select value={contactType} onChange={(e) => setContactType(e.target.value)} className="border rounded-lg p-2.5 w-1/3 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                        <option value="Line ID">Line ID</option>
                        <option value="เบอร์โทร">เบอร์โทร</option>
                        <option value="Email">Email</option>
                        <option value="Facebook">Facebook</option>
                        <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                    <input type="text" value={contactValue} onChange={(e) => setContactValue(e.target.value)} required className="border rounded-lg p-2.5 w-2/3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={contactType === "อื่นๆ" ? "ระบุข้อมูลติดต่อ" : `ระบุ ${contactType}`} />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors">ยกเลิก</button>
                <button disabled={loading} type="submit" className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            กำลังโพสต์...
                        </span>
                    ) : (editMode ? "บันทึกการแก้ไข" : "สร้างโพสต์")}
                </button>
            </div>
        </form>
    );
}
