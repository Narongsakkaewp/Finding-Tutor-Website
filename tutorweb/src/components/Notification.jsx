import React, { useState, useEffect } from "react";

function Notification({ userId, onReadAll, onOpenPost }) {
  const [notifications, setNotifications] = useState([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`http://localhost:5000/api/notifications/${userId}`)
      .then((res) => res.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching notifications:", err));
  }, [userId]);

  // group by time
  const today = [], yesterday = [], older = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfToday.getDate() - 1);

  notifications.forEach((n) => {
    const created = new Date(n.created_at);
    if (created >= startOfToday) today.push(n);
    else if (created >= startOfYesterday) yesterday.push(n);
    else older.push(n);
  });

  const latest = notifications.length > 0 ? [notifications[0]] : [];

  const openThisPost = (notif) => {
    const pid = Number(
      notif.related_id ?? notif.post_id ?? notif.student_post_id ?? notif.id
    );
    if (!pid || !onOpenPost) return;
    onOpenPost(pid); // 👉 ส่งให้ App เปลี่ยนหน้าไป MyPostDetails
  };

  const Card = ({ n, accent = false }) => (
    <button
      onClick={() => openThisPost(n)}
      className={`w-full text-left p-3 rounded-xl mb-2 border ${
        accent ? "bg-blue-100 border-blue-300" : "bg-white border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="text-sm">{n.message}</div>
      <div className="text-[11px] text-gray-500 mt-1">
        {new Date(n.created_at).toLocaleString()}
      </div>
    </button>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-6">การแจ้งเตือน</h1>

      {latest.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">ล่าสุด</h2>
          {latest.map((n) => <Card key={n.notification_id} n={n} accent />)}
        </div>
      )}

      {today.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">วันนี้</h2>
          {today.map((n) => <Card key={n.notification_id} n={n} />)}
        </div>
      )}

      {yesterday.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">เมื่อวาน</h2>
          {yesterday.map((n) => <Card key={n.notification_id} n={n} />)}
        </div>
      )}

      {older.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">เก่ากว่า</h2>
          {(showMore ? older : older.slice(0, 3)).map((n) => (
            <Card key={n.notification_id} n={n} />
          ))}
          {older.length > 3 && (
            <button className="text-blue-600 mt-2" onClick={() => setShowMore(!showMore)}>
              {showMore ? "แสดงน้อยลง" : "แสดงเพิ่มเติม"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Notification;