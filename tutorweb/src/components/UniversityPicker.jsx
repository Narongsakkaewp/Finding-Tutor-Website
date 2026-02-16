import React, { useState, useEffect, useRef } from 'react';
import { School, Check, X } from 'lucide-react';

export default function UniversityPicker({ value, onChange, placeholder = "ระบุชื่อมหาวิทยาลัย", disabled = false, className = "" }) {
    const [query, setQuery] = useState(value || "");
    const [suggestions, setSuggestions] = useState([]);
    const [allUniversities, setAllUniversities] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Fetch Universities Data
    useEffect(() => {
        const fetchUniversities = async () => {
            try {
                const [thaiRes, worldRes] = await Promise.all([
                    fetch('/universities_thai.json'),
                    fetch('/universities_and_domains_world.json').catch(() => null) // Handle missing file gracefully
                ]);

                let universities = [];

                // Process Thai Universities
                if (thaiRes.ok) {
                    const thaiData = await thaiRes.json();
                    if (thaiData && Array.isArray(thaiData.records)) {
                        const thaiUnis = thaiData.records.map(record => record[2]).filter(Boolean);
                        universities = [...universities, ...thaiUnis];
                    }
                }

                // Process World Universities
                if (worldRes && worldRes.ok) {
                    const worldData = await worldRes.json();
                    if (Array.isArray(worldData)) {
                        const worldUnis = worldData.map(uni => uni.name).filter(Boolean);
                        universities = [...universities, ...worldUnis];
                    }
                }

                // Deduplicate and Sort
                const uniqueUnis = [...new Set(universities)].sort((a, b) => a.localeCompare(b, 'th'));
                setAllUniversities(uniqueUnis);

            } catch (err) {
                console.error("Failed to load universities:", err);
            }
        };

        fetchUniversities();
    }, []);

    // Update query when value prop changes (e.g. initial load)
    useEffect(() => {
        setQuery(value || "");
    }, [value]);

    // Handle outside click to close dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInputChange = (e) => {
        const userInput = e.target.value;
        setQuery(userInput);
        onChange(userInput); // Allow custom input

        if (userInput.trim().length > 0) {
            const filtered = allUniversities.filter(uni =>
                uni.toLowerCase().includes(userInput.toLowerCase())
            );
            setSuggestions(filtered.slice(0, 50)); // Limit suggestions
            setIsOpen(true);
        } else {
            setSuggestions([]);
            setIsOpen(false);
        }
    };

    const handleSelect = (uni) => {
        setQuery(uni);
        onChange(uni);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (query.trim().length > 0) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <School size={18} />
                </div>
                {query && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            onChange("");
                            setIsOpen(false);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Dropdown Suggestions */}
            {isOpen && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {suggestions.map((uni, index) => (
                        <li
                            key={index}
                            onClick={() => handleSelect(uni)}
                            className="px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm text-gray-700 transition-colors flex items-center justify-between group"
                        >
                            <span>{uni}</span>
                            {query === uni && <Check size={16} className="text-indigo-600" />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
