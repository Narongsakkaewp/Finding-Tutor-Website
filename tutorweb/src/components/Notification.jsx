// src/components/Notification.jsx
import React, { useEffect, useMemo, useState } from "react";
import { 
  Bell, Check, Clock, ChevronRight, User, BookOpen 
} from "lucide-react";

function Notification({ userId, onOpenPost, onReadAll }) {
  const [notifications, setNotifications] = useState([]);
  const [showMoreOlder, setShowMoreOlder] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizedUserId = useMemo(() => {
    if (userId == null) return 0;
    if (typeof userId === "number") return Number.isFinite(userId) ? userId : 0;
    const n = Number(String(userId).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [userId]);

  // โหลดแจ้งเตือน
  useEffect(() => {
    if (!normalizedUserId) return;

    const controller = new AbortController();
    setLoading(true);

    const url = `http://localhost:5000/api/notifications/${normalizedUserId}?_ts=${Date.now()}`;

    fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Network error");
        return r.json();
      })
      .then((data) => (Array.isArray(data) ? setNotifications(data) : setNotifications([])))
      .catch((e) => { if (e.name !== "AbortError") setNotifications([]); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [normalizedUserId]);

  // Logic จัดกลุ่ม
  const groups = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    let latest = [];
    let others = sorted;
    if (sorted.length > 0 && !sorted[0].is_read) {
      latest = [sorted[0]];
      others = sorted.slice(1);
    }

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

  const handleOpen = async (item) => {
    if (!item) return;
    setNotifications((prev) => prev.map((x) => (x.notification_id === item.notification_id ? { ...x, is_read: 1 } : x)));

    try {
      await fetch(`http://localhost:5000/api/notifications/read/${item.notification_id}`, { method: "PUT" });
    } catch (e) { console.error(e); }

    let path = null;
    if(item.type === 'join_request') path = `/feed?tab=student&open=${item.related_id}`;
    else if(item.type === 'tutor_join_request') path = `/feed?tab=tutor&open=${item.related_id}`;
    
    if (typeof onOpenPost === "function") {
      onOpenPost(item.related_id, item.type, path);
    } else if (path) {
      window.location.href = path;
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
    if (type.includes('approved')) { badgeColor = "bg-green-500"; BadgeIcon = Check; }
    if (type.includes('rejected')) { badgeColor = "bg-rose-500"; BadgeIcon = Check; }

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
    const isUnread = !item.is_read;
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
        default:
            content = <span>{item.message || "มีการแจ้งเตือนใหม่"}</span>;
    }

    return (
      <div 
        onClick={() => handleOpen(item)}
        className={`group flex items-center gap-5 p-5 mb-3 rounded-2xl cursor-pointer transition-all duration-200 border
          ${isUnread 
            ? "bg-white border-indigo-100 shadow-lg shadow-indigo-100/40 hover:border-indigo-300 transform hover:-translate-y-0.5" 
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
                    day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' 
                })}
             </span>
             {isUnread && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600 tracking-wide uppercase">
                    New
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
               <NotificationItem key={item.notification_id} item={item} />
            ))}
        </div>
      </div>
    );
  };

  return (
    // ✅ ปรับเป็น max-w-6xl (กว้างสะใจ) และพื้นหลังสีเทาอ่อน
    <div className="w-full min-h-screen bg-gray-50/50 pb-20">
      
      {/* Header Bar */}
      <div className="sticky top-0 z-20 px-4 md:px-8 py-4 mb-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                    <Bell size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">การแจ้งเตือน</h1>
                </div>
            </div>
            
            {notifications.some((x) => !x.is_read) && (
            <button
                onClick={handleReadAll}
                className="hidden md:flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors px-4 py-2 rounded-xl hover:bg-indigo-50"
            >
                <Check size={18} />
                อ่านทั้งหมด
            </button>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-t-indigo-600"></div>
            <p className="text-sm font-medium animate-pulse">กำลังโหลดข้อมูล...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 gap-6 bg-white rounded-[2rem] border border-dashed border-gray-200 mx-auto max-w-2xl shadow-sm">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
              <Bell size={48} className="text-gray-300" />
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-gray-700 mb-1">ยังไม่มีการแจ้งเตือน</h3>
                <p className="text-gray-400">เมื่อมีคนสนใจโพสต์ของคุณ จะปรากฏขึ้นที่นี่</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <Section title="มาใหม่ 🔥" items={groups.latest} highlight={true} />
            <Section title="วันนี้" items={groups.today} />
            <Section title="เมื่อวานนี้" items={groups.yesterday} />
            
            {groups.older.length > 0 && (
              <div>
                <Section 
                  title="เก่ากว่านี้" 
                  items={showMoreOlder ? groups.older : groups.older.slice(0, 3)} 
                />
                
                {groups.older.length > 3 && (
                  <button
                    className="w-full py-4 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm hover:shadow-md"
                    onClick={() => setShowMoreOlder((s) => !s)}
                  >
                    {showMoreOlder ? "ซ่อนรายการเก่า" : `ดูรายการที่เหลือ (${groups.older.length - 3})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notification;