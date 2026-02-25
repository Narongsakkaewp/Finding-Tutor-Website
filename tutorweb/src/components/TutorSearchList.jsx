import React, { useEffect, useState } from "react";
import { Star, MapPin, User, Search, DollarSign, ExternalLink } from "lucide-react";

// --------------------------- Components: ProfileImage --------------------------- (Duplicate from Home.jsx or import it if shared)
import { API_BASE } from '../config';
// Use simple img with fallback for now as logic is simple here
export default function TutorSearchList({ searchKey, onOpen }) {
    const [tutors, setTutors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let ignore = false;
        async function fetchTutors() {
            try {
                setLoading(true);
                setError("");

                // Use generic Tutor Search API
                const url = `${API_BASE}/api/tutors?search=${encodeURIComponent(searchKey || "")}&limit=20`;
                const res = await fetch(url);

                if (!res.ok) throw new Error("Failed to fetch tutors");

                const data = await res.json();
                const items = data.items || [];

                if (!ignore) setTutors(items);
            } catch (err) {
                if (!ignore) setError(err.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        if (searchKey) {
            fetchTutors();
        } else {
            setTutors([]);
            setLoading(false);
        }

        return () => { ignore = true; };
    }, [searchKey]);

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
            ))}
        </div>
    );

    if (error) return <div className="p-8 text-center text-rose-500 bg-rose-50 rounded-xl border border-rose-100">{error}</div>;

    if (tutors.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-gray-200 text-center">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
                <Search className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">ไม่พบติวเตอร์สำหรับ "{searchKey}"</h3>
            <p className="text-gray-500">ลองค้นหาด้วยคำอื่น หรือดูประกาศหาครูแทน</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tutors.map((tutor) => (
                <div
                    key={tutor.id}
                    className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border border-gray-100 transition-all cursor-pointer group flex flex-col h-full"
                    onClick={() => {
                        // Adapt data for Modal
                        const item = {
                            id: tutor.id.replace('t-', ''), // Remove 't-' prefix if needed by Modal logic
                            dbTutorId: tutor.dbTutorId,
                            name: tutor.name,
                            nickname: tutor.nickname,
                            image: tutor.image,
                            subject: tutor.subject,
                            price: tutor.price,
                            location: tutor.city, // api returns city
                            about_me: tutor.about_me,
                            education: tutor.education,
                            teaching_experience: tutor.teaching_experience,
                            contact_info: tutor.contact_info,
                            phone: tutor.phone,
                            email: tutor.email,
                            rating: tutor.rating,
                            reviews: tutor.reviews
                        };
                        onOpen?.(item);
                    }}
                >
                    <div className="flex items-start gap-4 mb-4">
                        <img
                            src={tutor.image || (process.env.PUBLIC_URL + "/blank_avatar.jpg")}
                            alt={tutor.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => { e.target.src = process.env.PUBLIC_URL + "/blank_avatar.jpg"; }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                    {tutor.name}
                                </h3>
                                {/* Rating or Badge */}
                            </div>

                            {tutor.nickname && <div className="text-sm text-gray-500">({tutor.nickname})</div>}

                            <div className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-2 max-w-full truncate">
                                {tutor.subject}
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto space-y-3 pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-2">
                            {(tutor.city?.startsWith("Online:") || tutor.city === "Online") ? (
                                <>
                                    <User size={16} className="text-indigo-500" />
                                    <span className="truncate max-w-[120px] text-indigo-600 font-medium">{tutor.city}</span>
                                </>
                            ) : (
                                <>
                                    <MapPin size={16} className="text-gray-400" />
                                    <span className="truncate max-w-[120px] text-gray-600">{tutor.city || "Online"}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Action Button (Fake) */}
                    <button className="w-full py-2 rounded-xl bg-gray-50 text-gray-600 text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        ดูประวัติ
                    </button>
                </div>
            ))}
        </div>
    );
}
