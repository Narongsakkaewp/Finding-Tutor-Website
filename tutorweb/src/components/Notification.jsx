// src/components/Notification.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * props:
 * - userId: number                                  // user_id ที่ล็อกอิน
 * - onOpenPost?: (id:number, type?:string, path?:string)=>void  // คลิกแล้วให้ parent นำทางเองได้
 * - onReadAll?: ()=>void                             // (ออปชัน) เรียกเมื่อมาร์คว่าอ่านทั้งหมด
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
      .then((data) =>
        Array.isArray(data) ? setNotifications(data) : setNotifications([])
      )
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

    // ล่าสุด = ตัวแรกของทั้งลิสต์ (เรียงจาก backend แล้ว)
    const latest = notifications?.length ? [notifications[0]] : [];

    return { latest, today, yesterday, older };
  }, [notifications]);

  // ===== helper: สร้างข้อความที่แสดง โดยดึงชื่อผู้ทำกิจกรรม (actor) ถ้ามี =====
  const displayMessage = (item) => {
    if (!item) return "";
    const actor = [item.actor_firstname, item.actor_lastname]
      .filter(Boolean)
      .join(" ")
      .trim();

    switch (item.type) {
      case "join_request":
        return actor
          ? `มีคำขอเข้าร่วมจาก ${actor} (โพสต์นักเรียน #${item.related_id})`
          : `มีคำขอเข้าร่วมโพสต์นักเรียน #${item.related_id}`;
      case "tutor_join_request":
        return actor
          ? `มีคำขอเข้าร่วมจาก ${actor} (โพสต์ติวเตอร์ #${item.related_id})`
          : `มีคำขอเข้าร่วมโพสต์ติวเตอร์ #${item.related_id}`;
      default:
        // ถ้า backend มี message อยู่แล้ว ก็แสดงได้เลย
        return item.message || "การแจ้งเตือนใหม่";
    }
  };

  // ===== helper: เลือกเส้นทางที่จะไปจาก notification =====
  const buildTargetPath = (item) => {
    if (!item) return null;
    // ถ้ามี deep_link จากเซิร์ฟเวอร์ ใช้ได้ทันที
    if (item.deep_link) return item.deep_link;

    // ไม่มี deep_link → map เองจาก type + related_id
    if (!item.related_id) return null;

    // type:
    // - 'join_request'           => โพสต์นักเรียนในแท็บ student
    // - 'tutor_join_request'     => โพสต์ติวเตอร์ในแท็บ tutor
    // - อื่นๆ                     => ลิงก์ไปหน้ารายละเอียดโพสต์ทั่วไป
    switch (item.type) {
      case "join_request":
        return `/feed?tab=student&open=${item.related_id}`;
      case "tutor_join_request":
        return `/feed?tab=tutor&open=${item.related_id}`;
      default:
        return `/post/${item.related_id}`;
    }
  };

  // ===== helper: เปิดปลายทาง (ให้ parent จัดการ หรือเปลี่ยน URL เอง) =====
  const openFromNotification = (item) => {
    const path = buildTargetPath(item);
    if (typeof onOpenPost === "function") {
      onOpenPost(item.related_id, item.type, path);
    } else if (path) {
      window.location.href = path;
    }
  };

  // มาร์คว่าอ่าน + เปิดโพสต์
  const handleOpen = async (item) => {
    if (!item) return;
    try {
      await fetch(
        `http://localhost:5000/api/notifications/read/${item.notification_id}`,
        { method: "PUT" }
      );
      setNotifications((prev) =>
        prev.map((x) =>
          x.notification_id === item.notification_id ? { ...x, is_read: 1 } : x
        )
      );
    } catch (e) {
      console.error("mark read error:", e);
    }
    openFromNotification(item);
  };

  // ปุ่มไปดูโพสต์
  const handleGoPost = (e, item) => {
    e.stopPropagation();
    openFromNotification(item);
  };

  // ปุ่มจัดการคำขอ
  const handleManageRequest = (e, item) => {
    e.stopPropagation();
    openFromNotification(item);
  };

  const handleReadAll = async () => {
    const unread = notifications.filter((x) => !x.is_read);
    await Promise.all(
      unread.map((x) =>
        fetch(
          `http://localhost:5000/api/notifications/read/${x.notification_id}`,
          { method: "PUT" }
        ).catch(() => { })
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
            className={`relative w-full text-left p-3 rounded-xl border mb-2 transition ${variant === "highlight"
                ? "bg-blue-100 border-blue-300 hover:bg-blue-200"
                : "bg-white hover:bg-gray-50"
              } ${!item.is_read ? "ring-1 ring-amber-300" : ""}`}
          >
            {/* จุด unread มุมซ้ายบน */}
            {!item.is_read && (
              <span className="absolute left-2 top-2 inline-block h-2 w-2 rounded-full bg-rose-500" />
            )}

            <div className="text-sm">{displayMessage(item)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(item.created_at).toLocaleString()}
            </div>

            {/* ปุ่มแอ็กชัน */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.related_id && (
                <button
                  onClick={(e) => handleGoPost(e, item)}
                  className="px-3 py-1.5 rounded-lg border text-sm bg-white hover:bg-gray-100"
                  title="เปิดโพสต์ที่เกี่ยวข้อง"
                >
                  ไปดูโพสต์
                </button>
              )}


              {(item.type === "join_request" || item.type === "tutor_join_request") && item.related_id && (
                <button
                  onClick={(e) => handleManageRequest(e, item)}
                  className="px-3 py-1.5 rounded-lg border text-sm bg-gray-900 text-white hover:bg-gray-800 "
                  title="ไปจัดการคำขอเข้าร่วม"
                >
                  จัดการคำขอ
                </button>
              )}
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
            ทําเครื่องหมายว่าอ่านแล้ว
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

          {/* วันนี้ (ยกเว้นตัวล่าสุด) */}
          <Section
            title="วันนี้"
            items={groups.today.filter(
              (x) =>
                !groups.latest.some(
                  (l) => l.notification_id === x.notification_id
                )
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
