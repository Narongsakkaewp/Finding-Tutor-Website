// src/components/SmartSearch.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, Clock, X } from "lucide-react";

export default function SmartSearch({ userId, onSearch }) {
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchContainerRef = useRef(null);

  // ฟังก์ชันดึงประวัติการค้นหา
  const fetchSearchHistory = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/search/history?user_id=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  // เมื่อกดค้นหา (ส่งค่ากลับไปให้ Parent Component ผ่าน onSearch)
  const handleTriggerSearch = (val) => {
    const text = val || query;
    if (onSearch) {
      onSearch(text);
    }
    setIsSearchFocused(false);
  };

  // ปิด Dropdown เมื่อคลิกข้างนอก
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
    <div ref={searchContainerRef} className="mt-8 relative z-50 max-w-xl">
      {/* Input Area */}
      <div className="p-2 bg-white rounded-2xl shadow-lg flex flex-col md:flex-row gap-2 relative z-20">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsSearchFocused(true);
              fetchSearchHistory();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleTriggerSearch()}
            placeholder="ค้นหาติวเตอร์จากวิชาที่คุณต้องการ..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent outline-none text-gray-800 placeholder-gray-400"
            autoComplete="off"
          />
          {/* ปุ่มเคลียร์ข้อความ */}
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-3.5 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button
          onClick={() => handleTriggerSearch()}
          className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-md"
        >
          ค้นหา
        </button>
      </div>

      {/* Dropdown: History */}
      {isSearchFocused && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-left">
          {searchHistory.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={12} /> ประวัติการค้นหาล่าสุด
              </div>
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(item.keyword);
                    handleTriggerSearch(item.keyword);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center justify-between group transition-colors"
                >
                  <span className="text-gray-700 font-medium group-hover:text-indigo-700">
                    {item.keyword}
                  </span>
                  <span className="text-xs text-gray-300 group-hover:text-indigo-300">
                    ค้นหาอีกครั้ง
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400 text-sm">
                ไม่มีประวัติการค้นหา
            </div>
          )}
        </div>
      )}
    </div>
  );
}