// src/components/LongdoLocationPicker.jsx
import React, { useEffect, useRef, useState } from 'react';
export default function LongdoLocationPicker({ onLocationSelect, defaultLocation, showMap = true }) {
  const mapId = useRef(`longdo-map-${Math.random().toString(36).substr(2, 9)}`);
  const mapInstance = useRef(null);

  const [searchQuery, setSearchQuery] = useState(defaultLocation || "");
  const [suggestions, setSuggestions] = useState([]);

  const LONGDO_API_KEY = "c610f6d49ed6e702d9cb6aae7874df2c";

  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]+>/g, '');
  };

  useEffect(() => {
    if (!showMap) return;

    const initMap = () => {
      if (!window.longdo) {
        setTimeout(initMap, 500);
        return;
      }

      const mapDiv = document.getElementById(mapId.current);
      if (mapDiv) {
        mapDiv.innerHTML = "";
        try {
          const map = new window.longdo.Map({
            placeholder: mapDiv,
            language: 'th'
          });
          mapInstance.current = map;

          map.Event.bind('click', function () {
            const mouseLoc = map.location(window.longdo.LocationMode.Pointer);
            if (mouseLoc) {
              map.Overlays.clear();
              const marker = new window.longdo.Marker(mouseLoc);
              map.Overlays.add(marker);

              const locationString = `พิกัด: ${mouseLoc.lat.toFixed(5)}, ${mouseLoc.lon.toFixed(5)}`;
              setSearchQuery(locationString);

              if (onLocationSelect) {
                onLocationSelect(locationString, { lat: mouseLoc.lat, lng: mouseLoc.lon });
              }
            }
          });
        } catch (e) {
          console.error("Map init error:", e);
        }
      }
    };

    initMap();

    return () => { mapInstance.current = null; };
  }, [showMap]);

  const handleSearch = async (val) => {
    setSearchQuery(val);
    if (onLocationSelect) {
      onLocationSelect(val, { lat: null, lng: null });
    }
    if (val.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`https://search.longdo.com/mapsearch/json/suggest?limit=10&key=${LONGDO_API_KEY}&keyword=${val}`);
      const json = await res.json();
      if (json && json.data) {
        setSuggestions(json.data);
      }
    } catch (error) {
      console.error("Search Error:", error);
    }
  };

  const selectSuggestion = (item) => {
    const cleanName = stripHtml(item.w);
    setSearchQuery(cleanName);
    setSuggestions([]);

    const lat = Number(item.lat);
    const lon = Number(item.lon);

    // ส่งค่ากลับทันที (ไม่ว่าจะเปิด map หรือไม่)
    if (onLocationSelect) {
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        onLocationSelect(cleanName, { lat, lng: lon });
      } else {
        onLocationSelect(cleanName, null);
      }
    }

    if (showMap && mapInstance.current && Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        const loc = { lat, lon };
        mapInstance.current.location(loc, true);
        mapInstance.current.Overlays.clear();
        mapInstance.current.Overlays.add(new window.longdo.Marker(loc));
        mapInstance.current.zoom(15);
        setTimeout(() => { if (mapInstance.current) mapInstance.current.resize(); }, 300);
      } catch (err) {
        console.warn("Map move error:", err);
      }
    }
  };

  const wrapperRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  return (
    <div ref={wrapperRef} className="space-y-3 relative w-full">
      {/* Search Input */}
      <div className="relative z-20">
        <input
          type="text"
          placeholder="ค้นหาสถานที่"
          className="w-full px-3 py-2 rounded-lg border focus:border-indigo-500 outline-none"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-30 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-auto">
            {suggestions.map((item, index) => (
              <li
                key={index}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
                onClick={() => selectSuggestion(item)}
              >
                <div className="font-bold text-gray-800">{stripHtml(item.w)}</div>
                <div className="text-xs text-gray-500 truncate">{stripHtml(item.d)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {showMap && (
        <>
          <div
            id={mapId.current}
            className="h-64 w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100 relative z-10"
          ></div>
          <div className="text-xs text-gray-400 text-right">Powered by Longdo Map</div>
        </>
      )}
    </div>
  );
}