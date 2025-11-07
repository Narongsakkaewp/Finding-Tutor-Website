// src/components/StudentCalendar.jsx
import React, { useEffect, useState } from "react";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

/* ---------- helpers (ไม่มี hooks ใช้ได้ที่ top-level) ---------- */
// สร้าง key วันที่แบบ local time (ไม่โดน UTC เลื่อนวัน)
const toKeyLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// format เวลาแบบไทย (แสดง HH:mm)
const fmtTime = (t) =>
  t
    ? new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok",
      }).format(new Date(`1970-01-01T${t}`))
    : "";

/* -------------------- Component -------------------- */
function StudentCalendar({ userId: userIdProp }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // หา userId จาก prop หรือ localStorage
  const userId = (() => {
    if (Number.isFinite(Number(userIdProp))) return Number(userIdProp);
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return Number(u?.user_id ?? u?.user?.user_id ?? 0);
    } catch {
      return 0;
    }
  })();

  // โหลดเหตุการณ์ช่วง +-90 วัน (ใช้รูปแบบวันที่แบบ local)
  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const start = new Date();
        start.setDate(start.getDate() - 90);
        const end = new Date();
        end.setDate(end.getDate() + 90);

        const q = `?start=${toKeyLocal(start)}&end=${toKeyLocal(end)}`;
        const res = await fetch(`/api/calendar/${userId}${q}`);
        const data = await res.json();
        const list = Array.isArray(data?.items) ? data.items : [];
        setEvents(list);
      } catch (e) {
        console.error("fetch calendar error:", e);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // กรองเหตุการณ์ตามวันที่ที่เลือก (จับคู่ event_date แบบ YYYY-MM-DD)
  const selectedKey = toKeyLocal(selectedDate);
  const dayEvents = events.filter((ev) => ev.event_date === selectedKey);

  // ทำชุดวันทั้งหมดที่มีเหตุการณ์ เพื่อใส่จุด/ไฮไลต์ในปฏิทิน
  const eventDateSet = new Set(events.map((ev) => ev.event_date));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ปฏิทิน */}
      <div>
        <h2 className="text-lg font-bold mb-2">ตารางเวลาของฉัน</h2>
        <ReactCalendar
          locale="th-TH"
          value={selectedDate}
          onChange={(val) => {
            const d = Array.isArray(val) ? val[0] : val;
            setSelectedDate(d);
          }}
          // ใส่จุดวันที่มี event
          tileContent={({ date, view }) => {
            if (view !== "month") return null;
            const key = toKeyLocal(date);
            return eventDateSet.has(key) ? (
              <div
                style={{
                  marginTop: 2,
                  width: 6,
                  height: 6,
                  borderRadius: "9999px",
                  background: "#ef4444", // แดง
                  marginInline: "auto",
                }}
              />
            ) : null;
          }}
        />
      </div>

      {/* รายการการติวของวันนั้น */}
      <div>
        <h2 className="text-lg font-bold mb-2">การติวของคุณ</h2>

        {loading ? (
          <div className="p-4 bg-gray-100 rounded-lg text-gray-500">
            กำลังโหลด…
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="p-4 bg-gray-100 rounded-lg text-gray-500">
            ยังไม่มีการติวในวันนี้
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((ev) => (
              <div
                key={ev.event_id}
                className="border p-3 rounded-lg bg-red-50 shadow-sm"
              >
                <p className="text-red-600 font-semibold">
                  {fmtTime(ev.event_time)}
                </p>
                <p className="font-medium">{ev.title || ev.subject || "การติว"}</p>
                {ev.location ? (
                  <p className="text-sm text-gray-600">📍 {ev.location}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentCalendar;