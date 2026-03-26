import React, { useEffect, useRef, useState } from 'react';
import { School, Check, X } from 'lucide-react';

const THAI_SCHOOL_NAME_KEYS = [
    '\u0e0a\u0e37\u0e2d\u0e42\u0e23\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19 (\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22)',
    '\u0e0a\u0e37\u0e48\u0e2d\u0e42\u0e23\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19 (\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22)',
];

const extractThaiUniversities = (thaiData) => {
    if (!thaiData || !Array.isArray(thaiData.records)) return [];
    return thaiData.records.map((record) => record?.[2]).filter(Boolean);
};

const extractWorldUniversities = (worldData) => {
    if (!Array.isArray(worldData)) return [];
    return worldData.map((uni) => uni?.name).filter(Boolean);
};

const extractThaiSchools = (schoolData) => {
    if (!Array.isArray(schoolData)) return [];

    return schoolData
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            return (
                THAI_SCHOOL_NAME_KEYS.map((key) => item[key]).find(Boolean) ||
                item.school_name ||
                item.name ||
                null
            );
        })
        .filter(Boolean);
};

export default function UniversityPicker({
    value,
    onChange,
    placeholder = 'Search school or university',
    disabled = false,
    className = '',
}) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [allInstitutions, setAllInstitutions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const fetchInstitutions = async () => {
            try {
                const [thaiRes, worldRes, schoolRes] = await Promise.all([
                    fetch('/universities_thai.json'),
                    fetch('/universities_and_domains_world.json').catch(() => null),
                    fetch('/THAI_SCHOOL.json').catch(() => null),
                ]);

                let institutions = [];

                if (thaiRes.ok) {
                    const thaiData = await thaiRes.json();
                    institutions = [...institutions, ...extractThaiUniversities(thaiData)];
                }

                if (worldRes && worldRes.ok) {
                    const worldData = await worldRes.json();
                    institutions = [...institutions, ...extractWorldUniversities(worldData)];
                }

                if (schoolRes && schoolRes.ok) {
                    const schoolData = await schoolRes.json();
                    institutions = [...institutions, ...extractThaiSchools(schoolData)];
                }

                const uniqueInstitutions = [...new Set(institutions.map((item) => item.trim()).filter(Boolean))]
                    .sort((a, b) => a.localeCompare(b, 'th'));

                setAllInstitutions(uniqueInstitutions);
            } catch (err) {
                console.error('Failed to load institutions:', err);
            }
        };

        fetchInstitutions();
    }, []);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const userInput = e.target.value;
        setQuery(userInput);
        onChange(userInput);

        if (userInput.trim().length > 0) {
            const lowered = userInput.toLowerCase();
            const filtered = allInstitutions.filter((item) => item.toLowerCase().includes(lowered));
            setSuggestions(filtered.slice(0, 50));
            setIsOpen(true);
            return;
        }

        setSuggestions([]);
        setIsOpen(false);
    };

    const handleSelect = (institution) => {
        setQuery(institution);
        onChange(institution);
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
                            setQuery('');
                            onChange('');
                            setIsOpen(false);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {isOpen && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {suggestions.map((institution) => (
                        <li
                            key={institution}
                            onClick={() => handleSelect(institution)}
                            className="px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm text-gray-700 transition-colors flex items-center justify-between group"
                        >
                            <span>{institution}</span>
                            {query === institution && <Check size={16} className="text-indigo-600" />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
