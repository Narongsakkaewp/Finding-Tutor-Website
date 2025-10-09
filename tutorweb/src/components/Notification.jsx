import React, { useEffect, useMemo, useState } from "react";

/**
 * props:
 * - userId: number             // user_id ที่ล็อกอิน
 * - onOpenPost?: (id:number)=>void  // เรียกเมื่อคลิกแจ้งเตือนของโพสต์
 * - onReadAll?: ()=>void            // (ออปชัน) เรียกเมื่อมาร์คว่าอ่านทั้งหมด
 */
function Notification({ userId, onOpenPost, onReadAll }) {
  const [notifications, setNotifications] = useState([]);
  const [showMoreOlder, setShowMoreOlder] = useState(false);
  const [loading, setLoading] = useState(false);

  // โหลดแจ้งเตือน
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/notifications/${userId}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setNotifications(data) : setNotifications([]))
      .catch((e) => console.error("fetch notifications error:", e))
      .finally(() => setLoading(false));
  }, [userId]);

  // group ตามวัน
  const groups = useMemo(() => {
    const today = [];
    const yesterday = [];
    const older = [];

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startToday.getDate() - 1);

    (notifications || []).forEach((item) => {
      const created = new Date(item.created_at);
      if (created >= startToday) today.push(item);
      else if (created >= startYesterday) yesterday.push(item);
      else older.push(item);
    });

    // ล่าสุด = ตัวแรกของทั้งลิสต์ (เรียงมาจาก backend แล้ว)
    const latest = notifications?.length ? [notifications[0]] : [];

    return { latest, today, yesterday, older };
  }, [notifications]);

  // มาร์คว่่าอ่าน + เปิดโพสต์
  const handleOpen = async (item) => {
    if (!item) return;
    try {
      await fetch(`http://localhost:5000/api/notifications/read/${item.notification_id}`, {
        method: "PUT",
      });
      // อัปเดตสถานะในจอ
      setNotifications((prev) =>
        prev.map((x) =>
          x.notification_id === item.notification_id ? { ...x, is_read: 1 } : x
        )
      );
    } catch (e) {
      console.error("mark read error:", e);
    }
    if (typeof onOpenPost === "function" && item.related_id) {
      onOpenPost(item.related_id); // จะพาไป MyPostDetails ผ่าน App
    }
  };

  const handleReadAll = async () => {
    // มาร์คทั้งหมดทีละตัว (ตรงไปตรงมา)
    const unread = notifications.filter((x) => !x.is_read);
    await Promise.all(
      unread.map((x) =>
        fetch(`http://localhost:5000/api/notifications/read/${x.notification_id}`, {
          method: "PUT",
        }).catch(() => {})
      )
    );
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
    if (typeof onReadAll === "function") onReadAll();
  };

  const Section = ({ title, items, variant = "normal", limit }) => {
    if (!items || items.length === 0) return null;
    const visible = typeof limit === "number" ? items.slice(0, limit) : items;

    return (
      <div className="mb-6">
        <h2 className="font-semibold mb-2">{title}</h2>
        {visible.map((item) => (
          <button
            key={item.notification_id}
            onClick={() => handleOpen(item)}
            className={`w-full text-left p-3 rounded-xl border mb-2 transition ${
              variant === "highlight"
                ? "bg-blue-100 border-blue-300 hover:bg-blue-200"
                : "bg-white hover:bg-gray-50"
            } ${!item.is_read ? "ring-1 ring-amber-300" : ""}`}
          >
            <div className="text-sm">{item.message}</div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(item.created_at).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">การแจ้งเตือน</h1>
        {notifications.some((x) => !x.is_read) && (
          <button
            onClick={handleReadAll}
            className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            มาร์คว่าอ่านทั้งหมด
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">กำลังโหลด...</div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-500">ยังไม่มีการแจ้งเตือน</div>
      ) : (
        <>
          {/* ล่าสุด: แสดง 1 อัน */}
          <Section title="ล่าสุด" items={groups.latest} variant="highlight" />

          {/* วันนี้ (ยกเว้นตัวล่าสุด ถ้ามันอยู่วันนี้ด้วย) */}
          <Section
            title="วันนี้"
            items={groups.today.filter(
              (x) => !groups.latest.some((l) => l.notification_id === x.notification_id)
            )}
          />

          {/* เมื่อวาน */}
          <Section title="เมื่อวาน" items={groups.yesterday} />

          {/* เก่ากว่า + show more */}
          {groups.older.length > 0 && (
            <div>
              <Section
                title="เก่ากว่า"
                items={groups.older}
                limit={showMoreOlder ? undefined : 3}
              />
              {groups.older.length > 3 && (
                <button
                  className="text-blue-600 text-sm"
                  onClick={() => setShowMoreOlder((s) => !s)}
                >
                  {showMoreOlder ? "แสดงน้อยลง" : "แสดงเพิ่มเติม"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Notification;