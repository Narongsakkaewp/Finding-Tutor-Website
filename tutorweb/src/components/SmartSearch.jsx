import React, { useState, useEffect, useRef } from "react";
import { Search, Clock, X, BookOpen, ChevronRight, TrendingUp, Trash2 } from "lucide-react";
import { API_BASE } from '../config';

// Helper hook for debouncing
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SmartSearch({ userId, onSearch, onSelectResult }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [liveResults, setLiveResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const searchContainerRef = useRef(null);

  // 1. Fetch History
  const fetchSearchHistory = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/search/history?user_id=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setSearchHistory(data);
    } catch (err) { console.error("History Error", err); }
  };

  // ✅ ฟังก์ชันลบประวัติทีละอัน (Delete by Keyword)
  const handleDeleteItem = async (e, keyword) => {
    e.stopPropagation(); // หยุดไม่ให้คลิกทะลุไปเป็นการค้นหา

    // ลบออกจากหน้าจอก่อนทันที (Optimistic Update)
    setSearchHistory(prev => prev.filter(item => item.keyword !== keyword));

    try {
      // ส่ง user_id และ keyword ไปลบ
      await fetch(`${API_BASE}/api/search/history?user_id=${userId}&keyword=${encodeURIComponent(keyword)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error("Failed to delete", err);
      fetchSearchHistory(); // ถ้าลบพลาด ให้ดึงข้อมูลกลับมาใหม่
    }
  };

  // ✅ ฟังก์ชันล้างประวัติทั้งหมด
  const handleClearHistory = async (e) => {
    e.stopPropagation();
    if (!userId) return;
    if (!window.confirm("คุณต้องการล้างประวัติการค้นหาทั้งหมดใช่ไหม?")) return;

    setSearchHistory([]); // ลบหน้าจอทันที

    try {
      // ส่งแค่ user_id ไปเพื่อลบทั้งหมด
      await fetch(`${API_BASE}/api/search/history?user_id=${userId}`, { method: 'DELETE' });
    } catch (err) { console.error("Error clearing history:", err); }
  };

  // 2. Live Search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setLiveResults(null);
      return;
    }

    let ignore = false;
    async function doLiveSearch() {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(debouncedQuery)}&user_id=${userId || 0}`);
        const data = await res.json();
        if (!ignore) setLiveResults(data);
      } catch (e) {
        console.error("Live Search Failed", e);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    doLiveSearch();
    return () => { ignore = true; };
  }, [debouncedQuery, userId]);

  const handleTriggerSearch = (val) => {
    const text = val || query;
    if (onSearch) onSearch(text);
    setIsSearchFocused(false);
    setLiveResults(null);
  };

  const handleSelectResult = (item, type) => {
    // 1. If parent provided a specific handler for clicks (e.g. Index page opening a modal)
    if (onSelectResult) {
      onSelectResult(item, type);
    }

    // 2. Standard behavior: Update text and trigger generic search
    if (type === 'tutor') {
      setQuery(item.nickname || item.name);
      if (onSearch) onSearch(item.nickname || item.name);
    } else {
      setQuery(item.subject);
      if (onSearch) onSearch(item.subject);
    }
    setIsSearchFocused(false);
  };

  // Click Outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={searchContainerRef} className="relative w-full z-50"> {/* ✅ เพิ่ม z-50 ตรงนี้เพื่อให้ลอยเหนืออันอื่น */}

      {/* --- Unified Search Bar --- */}
      <div className={`
        relative flex items-center bg-white rounded-full shadow-lg
        transition-all duration-300 border-2 
        ${isSearchFocused ? 'border-indigo-400 ring-4 ring-indigo-100' : 'border-transparent'}
      `}>
        <div className="pl-5 text-gray-400">
          <Search size={20} className={isSearchFocused ? "text-indigo-500" : ""} />
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setIsSearchFocused(true); fetchSearchHistory(); }}
          onKeyDown={(e) => e.key === "Enter" && handleTriggerSearch()}
          placeholder="ค้นหาติวเตอร์, วิชา, หรือระดับชั้น..."
          className="flex-1 w-full py-3.5 px-4 bg-transparent outline-none text-gray-700 font-medium placeholder-gray-400 text-base"
          autoComplete="off"
        />

        <div className="flex items-center gap-2 pr-2">
          {isLoading && <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>}
          {query && (
            <button onClick={() => setQuery("")} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="p-1">
          <button
            onClick={() => handleTriggerSearch()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 text-sm"
          >
            ค้นหา
          </button>
        </div>
      </div>

      {/* --- Dropdown Results --- */}
      <div className={`
          absolute top-full left-0 w-full mt-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden 
          origin-top transition-all duration-200 ease-out
          ${isSearchFocused ? 'opacity-100 translate-y-0 scale-100 visible' : 'opacity-0 -translate-y-2 scale-95 invisible pointer-events-none'}
      `}>
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">

          {/* Case 1: Live Results Found */}
          {liveResults && (liveResults.tutors?.length > 0 || liveResults.posts?.length > 0) ? (
            <div>
              {/* Tutors Section */}
              {liveResults.tutors.length > 0 && (
                <div className="py-2">
                  <div className="px-5 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 bg-gray-50/80">
                    <TrendingUp size={14} className="text-indigo-500" /> ติวเตอร์ที่ตรงกัน
                  </div>
                  {liveResults.tutors.map((t, i) => (
                    <div
                      key={`t-${i}`}
                      className="px-5 py-3 hover:bg-indigo-50/50 cursor-pointer flex items-center gap-4 transition-colors border-b border-gray-50/50 last:border-0"
                      onClick={() => handleSelectResult(t, 'tutor')}
                    >
                      <img src={t.profile_picture_url || "/../blank_avatar.jpg"} className="w-10 h-10 rounded-full object-cover shadow-sm border border-white" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 highlight-text truncate">{t.nickname || t.name}</div>
                        <div className="text-xs text-indigo-500 font-medium truncate">{t.can_teach_subjects}</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  ))}
                </div>
              )}

              {/* Posts Section */}
              {liveResults.posts?.length > 0 && (
                <div className="py-2 border-t border-gray-100">
                  <div className="px-5 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 bg-gray-50/80">
                    <BookOpen size={14} className="text-orange-500" /> คอร์สเรียน / ประกาศสอน
                  </div>
                  {liveResults.posts.map((s, i) => (
                    <div
                      key={`s-${i}`}
                      className="px-5 py-3 hover:bg-orange-50/50 cursor-pointer flex items-center gap-4 transition-colors border-b border-gray-50/50 last:border-0"
                      onClick={() => handleSelectResult(s, 'post')}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
                        <BookOpen size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 truncate">{s.subject}</div>
                        <div className="text-xs text-gray-500 truncate">{s.description || 'ไม่มีรายละเอียด'}</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : query && !isLoading && liveResults ? (
            // Case 2: No Results
            <div className="p-8 text-center flex flex-col items-center text-gray-400">
              <div className="mb-2 bg-gray-50 p-3 rounded-full"><Search size={24} /></div>
              <span className="text-sm">ไม่พบข้อมูลสำหรับ "{query}"</span>
            </div>
          ) : null}

          {/* Case 3: History (Show if no query or short query) */}
          {(!query || query.length < 2) && (
            <div className="py-2">
              {searchHistory.length > 0 ? (
                <>
                  {/* ✅ ส่วนหัวข้อประวัติ + ปุ่มล้างทั้งหมด */}
                  <div className="px-5 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Clock size={12} /> ประวัติการค้นหาล่าสุด
                    </div>
                    <button
                      onClick={handleClearHistory}
                      className="flex items-center gap-1 text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer hover:underline"
                    >
                      <Trash2 size={10} /> ล้างทั้งหมด
                    </button>
                  </div>

                  {searchHistory.map((item, index) => (
                    <div
                      // ✅ ใช้ keyword เป็น key แทน history_id เพราะมันไม่มี
                      key={item.keyword || index}
                      className="group flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer transition-all border-b border-gray-50/50 last:border-0"
                      onClick={() => {
                        setQuery(item.keyword);
                        handleTriggerSearch(item.keyword);
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <Clock size={16} className="text-gray-300 min-w-[16px]" />
                        <span className="text-gray-700 font-medium truncate">
                          {item.keyword}
                        </span>
                      </div>

                      {/* ✅ ปุ่มลบทีละรายการ (ส่ง keyword ไปลบ) */}
                      <button
                        onClick={(e) => handleDeleteItem(e, item.keyword)}
                        className="p-1.5 rounded-full text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="ลบรายการนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-6 text-center text-gray-400 text-sm">
                  พิมพ์คำค้นหาเพื่อเริ่มค้นหาติวเตอร์
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}