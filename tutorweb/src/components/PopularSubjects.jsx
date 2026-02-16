// tutorweb/src/components/PopularSubjects.jsx
// Component to display popular subjects with icons and counts
import React, { useEffect, useState } from 'react';
import {
    BookOpen, Calculator, FlaskConical, Languages, Laptop,
    MapPin, Music, Palette, Trophy, Globe, TrendingUp
} from 'lucide-react';

const API_BASE = "http://localhost:5000";

// Map string icon names to Lucide components
const ICON_MAP = {
    'Calculator': Calculator,
    'FlaskConical': FlaskConical,
    'Languages': Languages,
    'Laptop': Laptop,
    'BookOpen': BookOpen,
    'MapPin': MapPin,
    'Music': Music,
    'Palette': Palette,
    'Trophy': Trophy,
    'Globe': Globe
};

export default function PopularSubjects({ onSelect }) {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPopular = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/search/popular`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setSubjects(data);
                }
            } catch (err) {
                console.error("Failed to fetch popular subjects:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPopular();
    }, []);

    if (loading) return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
            ))}
        </div>
    );

    if (subjects.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">วิชายอดฮิต</h2>
                    <p className="text-gray-500">วิชาที่กำลังเป็นที่นิยมในขณะนี้</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {subjects.map((item) => {
                    const Icon = ICON_MAP[item.icon] || BookOpen;
                    // Determine color classes based on item.color from backend or specific logic
                    const colorClasses = {
                        blue: "bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300",
                        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-300",
                        rose: "bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-300",
                        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-300",
                        amber: "bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-300",
                    }[item.color] || "bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300";

                    return (
                        <button
                            key={item.id}
                            onClick={() => onSelect && onSelect(item.name)}
                            className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 hover:shadow-md hover:-translate-y-1 group ${colorClasses}`}
                        >
                            <div className={`p-3 rounded-full mb-3 bg-white shadow-sm group-hover:scale-110 transition-transform`}>
                                <Icon size={28} strokeWidth={2} />
                            </div>
                            <span className="font-bold text-lg">{item.name}</span>
                            <span className="text-xs opacity-70 mt-1">{item.count} โพสต์/ค้นหา</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
