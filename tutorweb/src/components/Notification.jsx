import React, { useState, useEffect } from "react";

function Notification({ userId, onReadAll }) {
  const [notifications, setNotifications] = useState([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!userId) return; // ใช้ userId แทน user

    fetch(`http://localhost:5000/api/notifications/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("📌 Notifications:", data);
        setNotifications(data);
      })
      .catch((err) => console.error("Error fetching notifications:", err));
  }, [userId]);

  // จัดกลุ่มแจ้งเตือนตามวัน
  const today = [];
  const yesterday = [];
  const older = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  notifications.forEach((n) => {
    const created = new Date(n.created_at);
    if (created >= startOfToday) {
      today.push(n);
    } else if (created >= startOfYesterday) {
      yesterday.push(n);
    } else {
      older.push(n);
    }
  });

  const latest = notifications.length > 0 ? [notifications[0]] : [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-6">การแจ้งเตือน</h1>

      {/* 🔹 ล่าสุด */}
      {latest.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">ล่าสุด</h2>
          {latest.map((n) => (
            <div
              key={n.notification_id}
              className="bg-blue-100 border border-blue-300 p-3 rounded-xl mb-2"
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* 🔹 วันนี้ */}
      {today.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">วันนี้</h2>
          {today.map((n) => (
            <div
              key={n.notification_id}
              className="border border-gray-300 p-3 rounded-xl mb-2 bg-white"
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* 🔹 เมื่อวาน */}
      {yesterday.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">เมื่อวาน</h2>
          {yesterday.map((n) => (
            <div
              key={n.notification_id}
              className="border border-gray-300 p-3 rounded-xl mb-2 bg-white"
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* 🔹 เก่ากว่า */}
      {older.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">เก่ากว่า</h2>
          {older.slice(0, showMore ? older.length : 3).map((n) => (
            <div
              key={n.notification_id}
              className="border border-gray-300 p-3 rounded-xl mb-2 bg-white"
            >
              {n.message}
            </div>
          ))}
          {older.length > 3 && (
            <button
              className="text-blue-600 mt-2"
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? "แสดงน้อยลง" : "แสดงเพิ่มเติม"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Notification;