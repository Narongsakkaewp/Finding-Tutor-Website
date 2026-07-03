import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { CalendarDays, Clock3, MapPin, User, Users } from "lucide-react";
import { logUserInteraction } from "../utils/interactions";

const INITIAL_VISIBLE = 9;
const LOAD_MORE_STEP = 9;

const formatPrice = (value) => new Intl.NumberFormat("th-TH").format(Number(value || 0));

const parseSessionDate = (dateValue, timeValue) => {
  const dateText = String(dateValue || "").trim();
  if (!dateText) return null;

  const ymd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!ymd && !dmy) return null;

  const year = ymd ? Number(ymd[1]) : Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]);
  const month = ymd ? Number(ymd[2]) - 1 : Number(dmy[2]) - 1;
  const day = ymd ? Number(ymd[3]) : Number(dmy[1]);
  const timeText = String(timeValue || "").trim();
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  const date = new Date(
    year,
    month,
    day,
    timeMatch ? Number(timeMatch[1]) : 23,
    timeMatch ? Number(timeMatch[2]) : 59,
    timeMatch ? Number(timeMatch[3] || 0) : 59
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

const isTutorPostExpired = (tutor = {}) => {
  if (tutor.is_expired === true) return true;

  const rawDays = tutor.teaching_days || tutor.meta?.teaching_days || "";
  const rawTimes = tutor.teaching_time || tutor.meta?.teaching_time || "";
  const dayText = String(rawDays || "");
  const timeText = String(rawTimes || "");
  const extractedDays = dayText.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}/g);
  const extractedTimes = timeText.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  const days = (extractedDays || dayText.split(",")).map((item) => item.trim()).filter(Boolean);
  const times = (extractedTimes || timeText.split(",")).map((item) => item.trim());

  if (!days.length) return false;

  const sessions = days
    .map((day, index) => parseSessionDate(day, times[index] || times[0] || ""))
    .filter(Boolean);

  if (!sessions.length) return false;
  return !sessions.some((session) => session.getTime() >= Date.now());
};

export default function UpcomingTutorCourses({ userId, onOpen }) {
  const [payload, setPayload] = useState({ items: [], based_on: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joinLoading, setJoinLoading] = useState({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/api/recommendations/upcoming-courses?user_id=${userId || 0}&limit=36&_t=${Date.now()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || `Upcoming API failed (${res.status})`);
        }
        if (!ignore) {
          setPayload({
            items: Array.isArray(data.items) ? data.items : [],
            based_on: data.based_on || "",
          });
        }
      } catch (err) {
        if (!ignore) setError(err.message || "โหลดคอร์สเรียนที่กำลังจะมาถึงไม่สำเร็จ");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const onRefresh = () => load();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("recommendation:refresh", onRefresh);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("recommendation:refresh", onRefresh);
    };
  }, [userId]);

  const items = payload.items || [];
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const applyRowUpdate = (postId, updater) => {
    setPayload((prev) => ({
      ...prev,
      items: (prev.items || []).map((row) => (
        (row.id || row.tutor_post_id) === postId ? updater(row) : row
      )),
    }));
  };

  const handleJoin = async (e, item) => {
    e.stopPropagation();
    if (!userId) return alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");
    if (isTutorPostExpired(item)) return alert("โพสต์นี้เลยวันเรียนแล้ว ไม่สามารถขอเข้าร่วมได้");
    if (!window.confirm("ยืนยันที่จะเข้าร่วมคลาสนี้ใช่หรือไม่?")) return;

    const postId = item.id || item.tutor_post_id;
    setJoinLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${postId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.message || "ไม่สามารถเข้าร่วมคลาสได้");
        return;
      }

      applyRowUpdate(postId, (row) => ({
        ...row,
        joined: true,
        pending_me: true,
        join_count: Number(data?.join_count ?? row.join_count ?? 0),
      }));
      window.dispatchEvent(new Event("recommendation:refresh"));
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setJoinLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleUnjoin = async (e, item) => {
    e.stopPropagation();
    if (!userId) return;

    const confirmMessage = item.pending_me
      ? "ยืนยันที่จะยกเลิกคำขอนี้ใช่หรือไม่?"
      : "ยืนยันที่จะยกเลิกการเข้าร่วมใช่หรือไม่?";
    if (!window.confirm(confirmMessage)) return;

    const postId = item.id || item.tutor_post_id;
    setJoinLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${postId}/join?user_id=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.message || "ไม่สามารถยกเลิกได้");
        return;
      }

      applyRowUpdate(postId, (row) => ({
        ...row,
        joined: false,
        pending_me: false,
        join_count: Number(data?.join_count ?? row.join_count ?? 0),
      }));
      window.dispatchEvent(new Event("recommendation:refresh"));
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setJoinLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">กำลังโหลดคอร์สเรียนที่กำลังจะมาถึง...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        โหลดคอร์สเรียนที่กำลังจะมาถึงไม่สำเร็จ: {error}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">คอร์สเรียนที่กำลังจะมาถึง</h2>
            {/* <p className="text-sm text-slate-600">เรียงจากคลาสที่ใกล้เริ่มเรียนและตรงกับความสนใจของคุณมากที่สุด</p> */}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-cyan-100 bg-white px-3 py-1 text-sm font-medium text-slate-600">
            {payload.based_on || "คอร์สที่ใกล้ถึงวันเรียนและยังมีที่ว่าง"}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-white p-8 text-center text-sm text-slate-500">
          ยังไม่มีคอร์สที่ใกล้ถึงวันเรียนและตรงกับความสนใจของคุณในตอนนี้
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const key = item.id || item.tutor_post_id;
              const capacity = Number(item.group_size || 0);
              const joinCount = Number(item.join_count || 0);
              const seatsLeft = capacity > 0 ? Math.max(0, capacity - joinCount) : null;
              const isFull = capacity > 0 && joinCount >= capacity;
              const isOwner = item.owner_id === userId || item.tutor_id === userId;

              return (
                <div
                  key={key}
                  className="group rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md cursor-pointer"
                  onClick={() => {
                    logUserInteraction({
                      userId,
                      actionType: "open_upcoming_course",
                      relatedId: key,
                      subjectKeyword: item.subject,
                    });
                    onOpen?.(item);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.profile_picture_url || item.image || "../blank_avatar.jpg"}
                      alt={item.name || "tutor"}
                      className="h-12 w-12 rounded-full border object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-[17px] font-bold leading-tight text-slate-900">
                        {item.subject}
                      </h3>

                      <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <User size={14} />
                        <span className="truncate">
                          {(item.first_name || item.user?.first_name || item.name || "ติวเตอร์")} {item.last_name || item.user?.last_name || item.lastname || ""}
                        </span>
                      </div>

                      {/* {(item.location?.startsWith("Online:") || item.location === "Online") ? (
                      <div className="mt-1 text-xs font-medium text-indigo-600">{item.location}</div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-400">{item.location || "ไม่ระบุสถานที่"}</div>
                    )} */}
                    </div>
                  </div>

                  <div className="mt-3 h-px bg-slate-100" />

                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Clock3 size={14} className="shrink-0 text-teal-600" />
                      <span className="truncate">เริ่มเรียน: {item.next_session_label || "-"}</span>
                    </div>

                    <div className={`flex items-center gap-2 text-sm ${(item.location?.startsWith("Online:") || item.location === "Online")
                        ? "text-indigo-600 font-medium"
                        : "text-slate-600"
                      }`}>
                      <MapPin
                        size={14}
                        className={`shrink-0 ${(item.location?.startsWith("Online:") || item.location === "Online")
                            ? "text-indigo-500"
                            : "text-slate-400"
                          }`}
                      />
                      <span className="truncate">{item.location || item.meta?.location || "ไม่ระบุสถานที่"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users size={14} className="shrink-0 text-slate-400" />
                      <span>{capacity > 0 ? `ว่างอีก ${seatsLeft} คน จากทั้งหมด ${capacity} คน` : "ยังเปิดรับผู้เรียน"}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-green-100 text-green-700">
                      {formatPrice(item.price)} บ./ชม.
                    </span>

                    {Number(item.reviews || 0) > 0 ? (
                      <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                        {Number(item.rating || 0).toFixed(1)} ({item.reviews} รีวิว)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded-full font-medium">
                        คอร์สใกล้เริ่ม
                      </span>
                    )}
                  </div>

                  {!isOwner && (
                    <div className="mt-3">
                      {item.joined || item.pending_me ? (
                        <button
                          type="button"
                          disabled={joinLoading[key]}
                          onClick={(e) => handleUnjoin(e, item)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {joinLoading[key] ? "กำลังประมวลผล..." : (item.pending_me ? "ยกเลิกคำขอ" : "ยกเลิกการเข้าร่วม")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={joinLoading[key] || isFull}
                          onClick={(e) => handleJoin(e, item)}
                          className={`w-full rounded-xl py-2 text-sm font-bold text-white transition-colors ${isFull ? "cursor-not-allowed bg-slate-300" : "bg-teal-600 hover:bg-teal-700"
                            } disabled:opacity-80`}
                        >
                          {isFull ? "เต็มแล้ว" : (joinLoading[key] ? "กำลังประมวลผล..." : "ขอเข้าร่วม")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                className="px-6 py-2.5 rounded-full bg-white border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 hover:text-teal-600 hover:border-indigo-100 shadow-sm transition-all active:scale-95"
              >
                แสดงเพิ่มเติม
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
