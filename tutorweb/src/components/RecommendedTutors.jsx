import React, { useEffect, useState } from "react";
import { Star, MapPin, User } from "lucide-react";
import { API_BASE } from "../config";
import { logUserInteraction } from "../utils/interactions";

export default function RecommendedTutors({ userId, onOpen }) {
  const [recs, setRecs] = useState({ items: [], explore_items: [], based_on: "", reason_terms: [] });
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState({});
  const [showExplore, setShowExplore] = useState(false);

  useEffect(() => {
    const id = userId || 0;
    let ignore = false;

    const applyData = (data) => {
      if (ignore) return;

      const payload = Array.isArray(data)
        ? { items: data, explore_items: [], based_on: "", reason_terms: [] }
        : data;

      const dedupeRows = (rows = []) => {
        const seen = new Set();
        return rows.filter((item) => {
          const key = item.id || item.tutor_post_id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      setRecs({
        ...payload,
        items: dedupeRows(payload.items || []),
        explore_items: dedupeRows(payload.explore_items || []),
      });
    };

    const fetchRecommendations = () => {
      fetch(`${API_BASE}/api/recommendations?user_id=${id}&_t=${Date.now()}`)
        .then((res) => res.json())
        .then(applyData)
        .catch((err) => console.error("Recs Error:", err))
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    };

    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 45000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRecommendations();
    };
    const onRecommendationRefresh = () => {
      fetchRecommendations();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("recommendation:refresh", onRecommendationRefresh);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("recommendation:refresh", onRecommendationRefresh);
    };
  }, [userId]);

  const handleJoin = async (e, tutor) => {
    e.stopPropagation();
    if (!userId) return alert("กรุณาเข้าสู่ระบบก่อนทำรายการ");
    if (!window.confirm("ยืนยันที่จะเข้าร่วมคลาสนี้ใช่หรือไม่?")) return;

    const postId = tutor.id || tutor.tutor_post_id;
    setJoinLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${postId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.message || "Error joining tutor post");
        return;
      }

      setRecs((prev) => {
        const updateRows = (rows = []) => rows.map((row) => (
          (row.id || row.tutor_post_id) === postId
            ? { ...row, joined: true, pending_me: true, join_count: data.join_count }
            : row
        ));

        return {
          ...prev,
          items: updateRows(prev.items),
          explore_items: updateRows(prev.explore_items),
        };
      });
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setJoinLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleUnjoin = async (e, tutor) => {
    e.stopPropagation();
    if (!userId) return;

    const cancelMessage = tutor.pending_me
      ? "ยืนยันที่จะยกเลิกคำขอนี้ใช่หรือไม่?"
      : "ยืนยันที่จะยกเลิกการเข้าร่วมใช่หรือไม่?";
    if (!window.confirm(cancelMessage)) return;

    const postId = tutor.id || tutor.tutor_post_id;
    setJoinLoading((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${API_BASE}/api/posts/tutor/${postId}/join?user_id=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.message || "Error unjoining tutor post");
        return;
      }

      setRecs((prev) => {
        const updateRows = (rows = []) => rows.map((row) => (
          (row.id || row.tutor_post_id) === postId
            ? { ...row, joined: false, pending_me: false, join_count: data.join_count }
            : row
        ));

        return {
          ...prev,
          items: updateRows(prev.items),
          explore_items: updateRows(prev.explore_items),
        };
      });
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setJoinLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">กำลังประมวลผลติวเตอร์ที่เหมาะกับคุณ...</div>;
  }

  const hasPrimaryItems = Array.isArray(recs.items) && recs.items.length > 0;
  const hasExploreItems = Array.isArray(recs.explore_items) && recs.explore_items.length > 0;
  const hasReasonTerms = Array.isArray(recs.reason_terms) && recs.reason_terms.length > 0;
  const basedOnLabel = hasReasonTerms
    ? `อ้างอิงจากความสนใจล่าสุด: `: "แนะนำจากโพสต์ใหม่และโพสต์ยอดนิยมในระบบ";

  if (!hasPrimaryItems && !hasExploreItems) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Star className="text-yellow-500 fill-yellow-500" size={24} />
          <h2 className="text-xl font-bold text-gray-800">แนะนำสำหรับคุณ</h2>
        </div>
        <div className="bg-white rounded-2xl border border-dashed border-indigo-200 p-6 text-center text-sm text-gray-500">
          ยังไม่มีโพสต์ติวเตอร์ที่ตรงเงื่อนไขในตอนนี้ ระบบจะอัปเดตให้อัตโนมัติเมื่อมีโพสต์ใหม่หรือเมื่อความสนใจของคุณเปลี่ยน
        </div>
      </div>
    );
  }

  const renderCard = (tutor, variant = "primary") => {
    const isExpired = !!tutor.is_expired;
    const isExplore = variant === "explore";
    const key = tutor.id || tutor.tutor_post_id;
    const isFull = Number(tutor.group_size || 0) > 0 && Number(tutor.join_count || 0) >= Number(tutor.group_size || 0);

    return (
      <div
        key={`${variant}-${key}`}
        className={`rounded-xl p-4 shadow-sm hover:shadow-md transition-all border cursor-pointer group relative overflow-hidden ${
          isExpired ? "bg-gray-50 border-gray-200 opacity-80" : "bg-white hover:border-indigo-300"
        }`}
        onClick={() => {
          logUserInteraction({
            userId,
            actionType: isExplore ? "open_explore_recommendation" : "open_recommendation",
            relatedId: key,
            subjectKeyword: tutor.subject,
          });
          onOpen?.(tutor);
        }}
      >
        {isExpired && (
          <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
            เลยวันเรียนแล้ว
          </div>
        )}

        {isExplore && !isExpired && (
          <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
            สำรวจเพิ่ม
          </div>
        )}

        <div className="flex items-start gap-3">
          <img
            src={tutor.profile_picture_url || tutor.image || "../blank_avatar.jpg"}
            alt="tutor"
            className={`w-12 h-12 rounded-full object-cover border ${isExpired ? "grayscale" : ""}`}
          />
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate group-hover:text-indigo-600 transition-colors ${isExpired ? "text-gray-600" : "text-gray-900"}`}>
              {tutor.subject}
            </h3>
            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <User size={14} />
              {tutor.first_name || tutor.user?.first_name || tutor.name || "ติวเตอร์"} {tutor.last_name || tutor.user?.last_name || tutor.lastname || ""}
            </div>
            <div className="text-xs flex items-center gap-1 mt-1">
              {(tutor.location?.startsWith("Online:") || tutor.location === "Online") ? (
                <>
                  <User size={12} className="text-indigo-500" />
                  <span className="text-indigo-600 font-medium truncate">{tutor.location}</span>
                </>
              ) : (
                <>
                  <MapPin size={12} className="text-gray-400" />
                  <span className="text-gray-400 truncate">{tutor.location || "ไม่ระบุสถานที่"}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t flex flex-col gap-2">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${isExpired ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"}`}>
              {tutor.price} บ./ชม.
            </span>

            {isExpired ? (
              <span className="text-[10px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                เปิดดูรายละเอียดได้
              </span>
            ) : isExplore ? (
              <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                {tutor.exploration_reason === "expired" ? "โพสต์เก่าที่อาจยังมีประโยชน์" : "เพิ่มความหลากหลายให้ฟีด"}
              </span>
            ) : null}
          </div>

          {!isExpired && (tutor.owner_id !== userId && tutor.tutor_id !== userId) && (
            <div className="mt-2">
              {tutor.joined || tutor.pending_me ? (
                <button
                  disabled={joinLoading[key]}
                  onClick={(e) => handleUnjoin(e, tutor)}
                  className="w-full py-2 rounded-xl text-sm font-bold border text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {joinLoading[key] ? "กำลังประมวลผล..." : (tutor.pending_me ? "ยกเลิกคำขอ" : "ยกเลิกการเข้าร่วม")}
                </button>
              ) : (
                <button
                  disabled={joinLoading[key] || isFull}
                  onClick={(e) => handleJoin(e, tutor)}
                  className={`w-full py-2 rounded-xl text-sm font-bold text-white transition-colors ${isFull ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
                >
                  {isFull ? "เต็มแล้ว" : (joinLoading[key] ? "กำลังประมวลผล..." : "ขอเข้าร่วม")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-yellow-500 fill-yellow-500" size={24} />
        <h2 className="text-xl font-bold text-gray-800">แนะนำสำหรับคุณ</h2>
      </div>

      <p className="text-sm text-gray-600 mb-4 bg-white inline-block px-3 py-1 rounded-full border">
        {basedOnLabel}
      </p>

      {hasPrimaryItems ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.items.map((tutor) => renderCard(tutor, "primary"))}
        </div>
      ) : (
        <div className="bg-white/90 rounded-2xl border border-indigo-100 p-4 text-sm text-gray-600">
          ยังไม่มีโพสต์ที่ตรงมากพอในตอนนี้ ลองดูรายการสำรวจเพิ่มเติมด้านล่างได้เลย
        </div>
      )}

      {hasExploreItems && (
        <div className="mt-6">
          {hasPrimaryItems && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowExplore((prev) => !prev)}
                className="px-5 py-2.5 rounded-full border border-indigo-200 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
              >
                {showExplore ? "ซ่อนรายการสำรวจเพิ่มเติม" : "ดูโพสต์เพิ่มเติมที่หลากหลายขึ้น"}
              </button>
            </div>
          )}

          {(!hasPrimaryItems || showExplore) && (
            <div className="mt-5">
              <div className="mb-3 text-sm text-gray-600 bg-white/80 inline-block px-3 py-1.5 rounded-full border">
                สำรวจโพสต์ที่ใกล้เคียงน้อยลง หรือโพสต์เก่าที่อาจยังน่าสนใจ
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recs.explore_items.map((tutor) => renderCard(tutor, "explore"))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
