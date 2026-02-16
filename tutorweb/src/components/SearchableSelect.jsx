import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = "Select...",
    disabled = false,
    className = "",
    icon: Icon = null
}) {
    const [query, setQuery] = useState(value || "");
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const wrapperRef = useRef(null);

    // Sync query with value prop
    useEffect(() => {
        setQuery(value || "");
    }, [value]);

    // Filter options when query or options change
    useEffect(() => {
        if (!query) {
            setFilteredOptions(options);
        } else {
            setFilteredOptions(
                options.filter(option =>
                    option.toLowerCase().includes(query.toLowerCase())
                )
            );
        }
    }, [query, options]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // If the user typed something that isn't a valid option, 
                // you might want to reset it or allow it. 
                // For province, we strictly want valid options usually, 
                // but let's keep it flexible or strictly match if needed.
                // For now, we leave the query as is, but maybe validation happens elsewhere.
                // Or better: Revert to 'value' if not a valid selection? 
                // Let's keep it simple: just close.
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInputChange = (e) => {
        setQuery(e.target.value);
        setIsOpen(true);
        // We generally don't call onChange here if we demand strict selection,
        // but if we allow semi-matching or clearing:
        if (e.target.value === "") {
            onChange("");
        }
    };

    const handleSelect = (option) => {
        setQuery(option);
        onChange(option);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-10 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}
                />

                {query && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            onChange("");
                            setIsOpen(false);
                        }}
                        className="absolute inset-y-0 right-8 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={14} />
                    </button>
                )}

                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && !disabled && (
                <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                    {filteredOptions.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-400 text-center">ไม่พบข้อมูล</li>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <li
                                key={index}
                                onClick={() => handleSelect(option)}
                                className={`px-4 py-2.5 cursor-pointer text-sm transition-colors flex items-center justify-between ${option === value
                                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <span>{option}</span>
                                {option === value && <Check size={16} />}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
