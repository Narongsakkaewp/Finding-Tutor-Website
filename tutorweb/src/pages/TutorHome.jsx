import React, { useState } from "react";
import TutorLayout from "../components/TutorLayout";
import StudentPosts from "../components/StudentPosts";
import TutorPosts from "../components/TutorPosts";
import { Star, Search, CalendarCheck, MessageSquarePlus } from "lucide-react";

const SUBJECTS = [
  { id: "s1", dbKey: "Math 1", title: "คณิตศาสตร์" },
  { id: "s2", dbKey: "English", title: "ภาษาอังกฤษเพื่อการสื่อสาร" },
  { id: "s3", dbKey: "Physics 1", title: "Physics" },
  { id: "s4", dbKey: "Python Beginner", title: "เขียนโปรแกรมด้วย Python" },
  { id: "s5", dbKey: "UIUX", title: "ออกแบบ UI/UX" },
  { id: "s6", dbKey: "Biology 1", title: "ชีววิทยา" },
];

const getTutorId = () => localStorage.getItem("tutorId") || "";

function TutorHome() {
  const [subjectKey, setSubjectKey] = useState(SUBJECTS[0]?.dbKey || "");
  const [query, setQuery] = useState("");
  const tutorId = getTutorId();

  return (
    <TutorLayout>
      {/* Hero */}
      <div className="bg-white rounded-3xl border shadow-sm p-5 md:p-8 relative overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 mb-3">
              <Star className="h-3.5 w-3.5" /> โอกาสใหม่ ๆ สำหรับติวเตอร์
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
              จับคู่กับ <span className="underline decoration-gray-900 decoration-4 underline-offset-4">นักเรียนที่ตรงใจ</span> ได้เร็วขึ้น
            </h1>
            <p className="text-gray-600 mt-3 max-w-prose">
              ดูคำขอเรียนล่าสุด คัดกรองตามวิชา/เวลา/พื้นที่ แล้วส่งข้อเสนอให้ผู้เรียนทันที
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/tutor/create-post" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black">
                <MessageSquarePlus className="h-4 w-4" /> สร้างโพสต์รับสอน
              </a>
              <a href="/tutor/schedule" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-gray-50">
                <CalendarCheck className="h-4 w-4" /> จัดตารางสอน
              </a>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="relative aspect-[4/3] rounded-3xl bg-gray-100 border overflow-hidden">
              <img alt="hero" className="object-cover w-full h-full" src="https://images.pexels.com/photos/4144923/pexels-photo-4144923.jpeg" />
            </div>
          </div>
        </div>
      </div>

      {/* Student Demand */}
      <section className="mt-10 md:mt-14">
        <div className="flex items-end justify-between mb-4 md:mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">นักเรียนกำลังมองหา</h2>
            <p className="text-sm text-gray-500 mt-1">คัดกรองคำขอเรียนตามวิชา</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาคีย์เวิร์ดในคำขอเรียน (เช่น เวลา, ออนไลน์, งบฯ)..."
                className="w-full pl-10 pr-3 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <select
                value={subjectKey}
                onChange={(e) => setSubjectKey(e.target.value)}
                className="w-full md:w-64 px-3 py-3 rounded-xl border bg-white"
              >
                {SUBJECTS.map(s => (<option key={s.id} value={s.dbKey}>{s.title}</option>))}
              </select>
            </div>
          </div>

          {/* ฟีดนักเรียนตามวิชา */}
          <StudentPosts subjectKey={subjectKey} />
        </div>
      </section>

      {/* My Posts */}
      <section className="mt-12 md:mt-16">
        <div className="flex items-end justify-between mb-4 md:mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">โพสต์ของฉัน</h2>
            <p className="text-sm text-gray-500 mt-1">ประกาศรับสอนและอัปเดตล่าสุด</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 md:p-5">
          <TutorPosts tutorId={tutorId} />
        </div>
      </section>
    </TutorLayout>
  );
}
export default TutorHome;