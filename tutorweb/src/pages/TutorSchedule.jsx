import React, { useEffect, useState } from "react";
import TutorLayout from "../components/TutorLayout";

const API_BASE = "http://localhost:5000";
const getTutorId = () => localStorage.getItem("tutorId") || "";

function TutorSchedule() {
  const tutorId = getTutorId();
  const [items, setItems] = useState([]);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoadErr("");
        // คุณสามารถเปลี่ยนเป็น endpoint จริง เช่น /api/tutor-schedule?tutorId=...
        const res = await fetch(`${API_BASE}/api/tutor-schedule?tutorId=${encodeURIComponent(tutorId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) setItems(data.items || []);
      } catch (e) {
        if (!ignore) { setLoadErr(e.message || "โหลดตารางไม่สำเร็จ"); setItems([]); }
      }
    })();
    return () => { ignore = true; };
  }, [tutorId]);

  return (
    <TutorLayout>
      <div className="bg-white rounded-3xl border shadow-sm p-5 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold">ตารางสอน</h1>
        <p className="text-gray-600 mt-1 mb-6">ดูแผนการสอนที่กำลังจะมาถึง</p>

        {loadErr && <div className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{loadErr}</div>}

        {items.length === 0 ? (
          <div className="text-sm text-gray-600">ยังไม่มีรายการตารางสอน</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 border-b">วันที่</th>
                  <th className="py-2 border-b">เวลา</th>
                  <th className="py-2 border-b">วิชา</th>
                  <th className="py-2 border-b">ผู้เรียน</th>
                  <th className="py-2 border-b">สถานที่</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it._id} className="border-b last:border-0">
                    <td className="py-2">{it.date}</td>
                    <td className="py-2">{it.time}</td>
                    <td className="py-2">{it.subject}</td>
                    <td className="py-2">{it.studentName || "-"}</td>
                    <td className="py-2">{it.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TutorLayout>
  );
}
export default TutorSchedule;