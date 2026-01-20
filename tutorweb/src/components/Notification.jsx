// src/components/Notification.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, Check, Clock, ChevronRight, User, BookOpen, Calendar, CheckCircle
} from "lucide-react";

function Notification({ userId, onOpenPost, onReadAll, onReadOne }) {
  const [notifications, setNotifications] = useState([]);
  const [scheduleAlerts, setScheduleAlerts] = useState([]); // New Real-time alerts
  const [showMoreOlder, setShowMoreOlder] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizedUserId = useMemo(() => {
    if (userId == null) return 0;
    if (typeof userId === "number") return Number.isFinite(userId) ? userId : 0;
    const n = Number(String(userId).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [userId]);

  // โหลดแจ้งเตือนและ Schedule Alerts
  useEffect(() => {
    if (!normalizedUserId) return;

    const controller = new AbortController();
    setLoading(true);

    async function fetchData() {

      try {
        // Fetch regular notifications
        const notifUrl = `http://localhost:5000/api/notifications/${normalizedUserId}?_ts=${Date.now()}`;
        const notifRes = await fetch(notifUrl, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          signal: controller.signal,
        });
        if (!notifRes.ok) throw new Error("Network error fetching notifications");
        const notifData = await notifRes.json();
        setNotifications(Array.isArray(notifData) ? notifData : []);

        // Fetch Real-time Schedule Alerts
        const schedUrl = `http://localhost:5000/api/schedule-alerts/${normalizedUserId}?_ts=${Date.now()}`;
        const schedRes = await fetch(schedUrl, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          signal: controller.signal,
        });
        if (!schedRes.ok) throw new Error("Network error fetching schedule alerts");
        const schedData = await schedRes.json();
        setScheduleAlerts(Array.isArray(schedData) ? schedData : []);

      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Error fetching data:", e);
          setNotifications([]);
          setScheduleAlerts([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    return () => controller.abort();
  }, [normalizedUserId]);

  // Logic จัดกลุ่ม
  const groups = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // [FIX] Group by Unread status
    const latest = sorted.filter(x => !x.is_read);
    const others = sorted.filter(x => x.is_read); // Process only read items for other sections

    const today = [];
    const yesterday = [];
    const older = [];
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startToday.getDate() - 1);

    others.forEach((item) => {
      const created = new Date(item.created_at);
      if (created >= startToday) today.push(item);
      else if (created >= startYesterday) yesterday.push(item);
      else older.push(item);
    });

    return { latest, today, yesterday, older };
  }, [notifications]);

  // --- ส่วนจัดการการแสดงผล ---

  const [offerModal, setOfferModal] = useState(null); // { tutor, post_id, actor_id, notification_id ... }
  const [offerLoading, setOfferLoading] = useState(false);

  const fetchTutorData = async (actorId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tutor-profile/${actorId}`);
      if (!res.ok) throw new Error("Failed to load tutor");
      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleOpen = async (item) => {
    if (!item) return;

    // Handle schedule alerts separately (they don't have notification_id for marking as read)
    if (item.is_schedule_alert) {
      // For schedule alerts, we might want to navigate directly or just acknowledge
      // For now, let's just navigate if there's a path
      let path = null;
      if (item.type.includes('schedule_student')) {
        path = `/feed?tab=student&open=${item.related_id}`;
      } else if (item.type.includes('schedule_tutor')) {
        path = `/feed?tab=tutor&open=${item.related_id}`;
      } else if (item.type === 'schedule_tomorrow' || item.type === 'schedule_today') {
        // Fallback for old notifications or calendar events
        path = `/feed?tab=student&open=${item.related_id}`;
      }

      if (typeof onOpenPost === "function" && path) {
        const url = new URL(path, window.location.origin);
        onOpenPost(url.searchParams.get("open"), item.type, path);
      } else if (path) {
        window.location.href = path;
      }
      return; // Exit early for schedule alerts
    }

    // Mark as read immediately in UI for regular notifications
    if (!item.is_read) {
      setNotifications((prev) => prev.map((x) => (x.notification_id === item.notification_id ? { ...x, is_read: 1 } : x)));
      if (onReadOne) onReadOne(); // [FIX] Call parent to update badge
      try {
        fetch(`http://localhost:5000/api/notifications/read/${item.notification_id}`, { method: "PUT" });
      } catch (e) { console.error(e); }
    }

    if (item.type === 'offer') {
      // ตรวจสอบว่าเคยตอบรับไปแล้วหรือยัง (เช็คจาก API status)
      // แต่เบื้องต้นเปิด Modal ก่อน
      setOfferLoading(true);
      const tutor = await fetchTutorData(item.actor_id);
      setOfferLoading(false);

      if (tutor) {
        setOfferModal({
          notification_id: item.notification_id,
          post_id: item.related_id,
          actor_id: item.actor_id,
          tutor
        });
      } else {
        alert("ไม่สามารถโหลดข้อมูลติวเตอร์ได้");
      }
      return;
    }

    let path = null;
    if (item.type === 'join_request') path = `/feed?tab=student&open=${item.related_id}`;
    else if (item.type === 'tutor_join_request') path = `/feed?tab=tutor&open=${item.related_id}`;
    else if (item.type === 'join_approved') path = `/feed?tab=student&open=${item.related_id}`; // หรือไปที่ calendar

    if (typeof onOpenPost === "function" && path) {
      // Extract params
      const url = new URL(path, window.location.origin);
      onOpenPost(url.searchParams.get("open"), item.type, path);
    } else if (path) {
      window.location.href = path;
    }
  };

  const handleCreateRequest = async (action) => {
    if (!offerModal) return;
    if (!userId) return alert("Error: User ID missing");

    try {
      setOfferLoading(true);
      const url = `http://localhost:5000/api/student_posts/${offerModal.post_id}/requests/${offerModal.actor_id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }) // 'approve' or 'reject'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      alert(action === 'approve' ? "ตอบรับข้อเสนอเรียบร้อย! ข้อมูลจะถูกบันทึกลงปฏิทินของคุณ" : "ปฏิเสธข้อเสนอเรียบร้อย");
      setOfferModal(null);
    } catch (e) {
      alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setOfferLoading(false);
    }
  };

  const handleReadAll = async () => {
    const unread = notifications.filter((x) => !x.is_read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
    await Promise.all(unread.map((x) => fetch(`http://localhost:5000/api/notifications/read/${x.notification_id}`, { method: "PUT" })));
    if (onReadAll) onReadAll();
  };

  // ✅ Component ย่อย: Avatar ที่ไม่แตก
  const Avatar = ({ src, type }) => {
    const [imgError, setImgError] = useState(false);

    // เลือกสี Badge ตามประเภท
    let badgeColor = "bg-blue-500";
    let BadgeIcon = User;
    if (type.includes('approved') || type === 'offer_accepted') { badgeColor = "bg-green-500"; BadgeIcon = Check; }
    if (type.includes('rejected')) { badgeColor = "bg-rose-500"; BadgeIcon = Check; }
    if (type === 'offer') { badgeColor = "bg-purple-500"; BadgeIcon = BookOpen; }
    if (type.includes('schedule')) { badgeColor = "bg-orange-500"; BadgeIcon = Calendar; }

    return (
      <div className="relative shrink-0">
        {src && !imgError ? (
          <img
            src={src}
            alt="avatar"
            onError={() => setImgError(true)}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm">
            <User size={24} className="text-gray-400" />
          </div>
        )}

        <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-full text-white border-2 border-white shadow-sm ${badgeColor}`}>
          <BadgeIcon size={12} strokeWidth={3} />
        </div>
      </div>
    );
  };

  // Component ย่อย: รายการแจ้งเตือน
  const NotificationItem = ({ item }) => {
    const isUnread = !item.is_read && !item.is_schedule_alert; // Schedule alerts are always "new" in this context
    const actorName = [item.actor_firstname, item.actor_lastname].filter(Boolean).join(" ").trim() || "ผู้ใช้งาน";
    const subjectText = item.post_subject || `โพสต์ #${item.related_id}`;

    // สร้างข้อความ
    let content;
    switch (item.type) {
      case "join_request":
      case "tutor_join_request":
        content = (
          <span>
            <span className="font-bold text-gray-900">{actorName}</span> ส่งคำขอเข้าร่วม <span className="font-semibold text-indigo-600">"{subjectText}"</span>
          </span>
        );
        break;
      case "offer":
        content = (
          <span>
            <span className="font-bold text-gray-900">{actorName}</span> (ติวเตอร์) เสนอที่จะสอนในวิชา <span className="font-semibold text-indigo-600">"{subjectText}"</span>
          </span>
        );
        break;
      case "join_approved":
        content = (
          <span>
            คำขอเข้าร่วม <span className="font-semibold text-indigo-600">"{subjectText}"</span> ของคุณ <span className="text-green-600 font-bold">ได้รับการอนุมัติแล้ว</span>
          </span>
        );
        break;
      case "join_rejected":
        content = (
          <span>
            คำขอเข้าร่วม <span className="font-semibold text-indigo-600">"{subjectText}"</span> ของคุณ <span className="text-rose-500 font-bold">ถูกปฏิเสธ</span>
          </span>
        );
        break;
      case "offer_accepted":
        content = (
          <span>
            <span className="font-bold text-gray-900">{actorName}</span> ยอมรับเสนอสอนวิชา <span className="font-semibold text-indigo-600">"{subjectText}"</span> ของคุณแล้ว
          </span>
        );
        break;
      case "schedule_tomorrow":
      case "schedule_student_tomorrow":
      case "schedule_tutor_tomorrow":
        content = (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-orange-600 flex items-center gap-2">
              🗓️ แจ้งเตือนจากระบบ
            </span>
            <span className="text-gray-700">
              พรุ่งนี้คุณมีนัดติว/สอน วิชา <span className="font-semibold text-gray-900">"{subjectText}"</span>
            </span>
          </div>
        );
        break;
      case "schedule_today":
      case "schedule_student_today":
      case "schedule_tutor_today":
        content = (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-red-600 flex items-center gap-2">
              ⏰ แจ้งเตือนจากระบบ
            </span>
            <span className="text-gray-700">
              วันนี้คุณมีนัดติว/สอน วิชา <span className="font-semibold text-gray-900">"{subjectText}"</span>
            </span>
          </div>
        );
        break;
      default:
        content = <span>{item.message || "มีการแจ้งเตือนใหม่"}</span>;
    }

    return (
      <div
        onClick={() => handleOpen(item)}
        className={`group flex items-center gap-5 p-5 mb-3 rounded-2xl cursor-pointer transition-all duration-200 border
          ${isUnread
            ? "bg-white border-indigo-100 shadow-lg shadow-indigo-100/40 hover:border-indigo-300 transform hover:-translate-y-0.5"
            : item.is_schedule_alert
              ? "bg-orange-50 border-orange-200 shadow-lg shadow-orange-100/40 hover:border-orange-300 transform hover:-translate-y-0.5"
              : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm"
          }
        `}
      >
        {/* Avatar */}
        <Avatar src={item.actor_avatar} type={item.type} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-base text-gray-700 leading-snug">
            {content}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={13} className="text-gray-400" />
            <span className="text-sm text-gray-400 font-medium">
              {new Date(item.created_at).toLocaleString('th-TH', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
            {isUnread && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600 tracking-wide uppercase">
                New
              </span>
            )}
            {item.is_schedule_alert && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 tracking-wide uppercase">
                Alert
              </span>
            )}
          </div>
        </div>

        {/* Arrow Icon */}
        <div className="text-gray-300 group-hover:text-indigo-500 transition-colors">
          <ChevronRight size={24} />
        </div>
      </div>
    );
  };

  const Section = ({ title, items, highlight = false }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 px-2 flex items-center gap-2 ${highlight ? 'text-indigo-600' : 'text-gray-400'}`}>
          {highlight && <Bell size={16} className="fill-current" />} {title}
        </h3>
        <div className="space-y-3">
          {items.map((item) => (
            <NotificationItem key={item.notification_id || `sched-${item.type}-${item.related_id}`} item={item} />
          ))}
        </div>
      </div>
    );
  };

  // --- Modal สำหรับ Offer ---
  const OfferModal = () => {
    if (!offerModal) return null;
    const { tutor } = offerModal;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setOfferModal(null)} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

          {/* Header */}
          <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-600">
            <button onClick={() => setOfferModal(null)} className="absolute top-3 right-3 p-1 rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors">
              <ChevronRight size={20} className="rotate-90" /> {/* Close Icon substitute if X not imported */}
            </button>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
              <img
                src={tutor.profile_picture_url || "/default-avatar.png"}
                alt="tutor"
                className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-md"
              />
            </div>
          </div>

          <div className="pt-14 pb-6 px-6 text-center">
            <h3 className="text-xl font-bold text-gray-900">{tutor.nickname ? `ติวเตอร์ ${tutor.nickname}` : `${tutor.name} ${tutor.lastname}`}</h3>
            <p className="text-gray-500 text-sm mt-1">{tutor.can_teach_subjects || "ไม่ระบุวิชา"}</p>

            <div className="mt-4 space-y-3 text-left bg-gray-50 p-4 rounded-xl text-sm text-gray-700">
              <div className="flex gap-2">
                <span className="font-bold shrink-0 w-20">แนะนำตัว:</span>
                <span>{tutor.about_me || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold shrink-0 w-20">เรทราคา:</span>
                <span>{tutor.hourly_rate ? `${tutor.hourly_rate} บ./ชม.` : "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold shrink-0 w-20">ติดต่อ:</span>
                <span>{tutor.phone || tutor.email || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold shrink-0 w-20">สถานที่:</span>
                <span>{tutor.address || "-"}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                disabled={offerLoading}
                onClick={() => handleCreateRequest('reject')}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              >
                ปฏิเสธ
              </button>
              <button
                disabled={offerLoading}
                onClick={() => handleCreateRequest('approve')}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:shadow-indigo-300"
              >
                {offerLoading ? "กำลังบันทึก..." : "ตกลง"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const totalUnread = notifications.filter(x => !x.is_read).length + scheduleAlerts.length;

  return (
    // ✅ ปรับเป็น max-w-6xl (กว้างสะใจ) และพื้นหลังสีเทาอ่อน
    <div className="w-full min-h-screen bg-gray-50/50 pb-20">
      <OfferModal />

      {/* Header Bar */}
      <div className="sticky top-0 z-20 px-4 md:px-8 py-4 mb-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Bell size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือน</h1>
              <p className="text-gray-500 text-sm">จัดการการแจ้งเตือนและกิจกรรมของคุณ</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalUnread > 0 && (
              <button
                onClick={handleReadAll}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                <CheckCircle size={16} /> อ่านทั้งหมด
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-400">กำลังโหลด...</p>
          </div>
        ) : (
          <>
            {/* 🚨 Pinned Schedule Alerts */}
            {scheduleAlerts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 px-2 flex items-center gap-2 text-orange-600">
                  <Calendar size={16} /> ตารางเรียนของคุณ
                </h3>
                <div className="space-y-3">
                  {scheduleAlerts.map((alert, idx) => (
                    <div key={`alert-${idx}`} className="px-5 py-3 bg-white border-l-4 border-orange-400 rounded-r-xl shadow-sm hover:shadow-md transition-all">
                      <NotificationItem item={{
                        type: alert.type,
                        post_subject: alert.post_subject,
                        data: { subject: alert.post_subject },
                        created_at: alert.created_at,
                        is_read: 0,
                        is_schedule_alert: true,
                        related_id: alert.related_id
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Section title="ใหม่" items={groups.latest} highlight={true} />
            <Section title="วันนี้" items={groups.today} />
            <Section title="เมื่อวาน" items={groups.yesterday} />
            <Section title="เก่ากว่านี้" items={groups.older} />

            {/* Show More Logic */}
            {notifications.length > 20 && !showMoreOlder && (
              <button onClick={() => setShowMoreOlder(true)} className="w-full py-4 text-center text-gray-500 hover:text-indigo-600 font-medium">ดูการแจ้งเตือนเก่ากว่านี้</button>
            )}

            {notifications.length === 0 && scheduleAlerts.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                  <Bell size={32} />
                </div>
                <h3 className="text-gray-900 font-bold text-lg">ไม่มีการแจ้งเตือน</h3>
                <p className="text-gray-500">คุณจะได้รับการแจ้งเตือนเมื่อมีกิจกรรมใหม่ๆ</p>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}


export default Notification;