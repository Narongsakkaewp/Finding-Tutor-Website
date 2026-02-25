// tutorweb/src/components/ManageMyPosts.jsx
// Component for managing tutor's own posts
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    MapPin, Users, DollarSign, CalendarCheck, Edit, Trash2, MoreHorizontal, ArrowLeft
} from "lucide-react";
import TutorPostForm from "./TutorPostForm";
import { API_BASE } from '../config';

/* ---------- helpers ---------- */
function pickUser() {
    try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
}
function pickTutorId() {
    const u = pickUser();
    return u.user_id || localStorage.getItem("tutorId") || "";
}
function extractList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.docs)) return data.docs;
    return [];
}

const normalizeTutorPost = (p = {}) => {
    const full = (p.authorId?.name || p.name || "").trim();
    let first = p.first_name || "";
    let last = p.last_name || "";

    if (!first && full) {
        const parts = full.split(" ");
        first = parts.shift() || "";
        last = parts.join(" ");
    }

    const targetLevel = p.target_student_level || (p.meta && p.meta.target_student_level) || (p.meta && p.meta.level) || "ไม่ระบุ";

    return {
        id: p.id ?? p._id ?? p.tutor_post_id,
        owner_id: p.tutor_id ?? p.user_id ?? p.owner_id ?? p.authorId?.id,
        createdAt: p.createdAt || p.created_at || p.created || new Date().toISOString(),
        subject: p.subject || p.title || "",
        description: p.content || p.description || "",
        meta: {
            target_student_level: targetLevel,
            teaching_days: p.meta?.teaching_days ?? p.teaching_days ?? "",
            teaching_time: p.meta?.teaching_time ?? p.teaching_time ?? "",
            location: p.meta?.location ?? p.location ?? "",
            price: typeof (p.meta?.price ?? p.price) === "number" ? (p.meta?.price ?? p.price) : Number(p.meta?.price ?? p.price ?? 0),
            contact_info: p.meta?.contact_info ?? p.contact_info ?? "",
        },
        fav_count: Number(p.fav_count ?? 0),
        favorited: !!p.favorited,
        join_count: Number(p.join_count ?? 0),
        joined: !!p.joined,
        pending_me: !!p.pending_me,
        group_size: Number(p.group_size ?? p.meta?.group_size ?? 0),
        post_type: "tutor",
        user: p.user || {
            first_name: first,
            last_name: last,
            profile_image: p.profile_image || p.authorId?.avatarUrl || "/../blank_avatar.jpg",
            email: p.email || "",
            phone: p.phone || ""
        },
    };
};

/* ---------- UI Components ---------- */
function Modal({ open, onClose, children, title }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-base text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 transition-colors">
                        <XIcon size={18} />
                    </button>
                </div>
                <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}

// Helper Icon for Modal
const XIcon = ({ size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

function PostActionMenu({ isOpen, onClose, onEdit, onDelete }) {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => {
                        onEdit();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                >
                    <Edit size={18} />
                    <span>แก้ไขโพสต์</span>
                </button>
                <button
                    onClick={() => {
                        onDelete();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
                >
                    <Trash2 size={18} />
                    <span>ลบโพสต์</span>
                </button>
            </div>
        </>
    );
}

function Badge({ icon: Icon, text, color = "blue" }) {
    const colors = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        rose: "bg-rose-50 text-rose-700 border-rose-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        purple: "bg-purple-50 text-purple-700 border-purple-100",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[color]}`}>
            {Icon && <Icon size={12} />}
            {text}
        </span>
    );
}

export default function ManageMyPosts({ onBack }) {
    const user = pickUser();
    const tutorId = useMemo(() => pickTutorId(), []);

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [menuOpenId, setMenuOpenId] = useState(null);

    // Edit State
    const [editingPost, setEditingPost] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchMyPosts = useCallback(async () => {
        if (!tutorId) return;
        try {
            setLoading(true);
            setError("");
            // Filter by me=${tutorId} AND tutorId=${tutorId} for server-side filtering
            const url = `${API_BASE}/api/tutor-posts?page=1&limit=200&me=${tutorId}&tutorId=${tutorId}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = extractList(data);
            // Ensure we only see our own posts (double check)
            const normalized = list.map(normalizeTutorPost).filter(p => String(p.owner_id) === String(tutorId));
            setPosts(normalized);
        } catch (e) {
            console.error("fetchMyPosts error:", e);
            setError("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }, [tutorId]);

    useEffect(() => {
        fetchMyPosts();
    }, [fetchMyPosts]);

    const handleDelete = async (postId) => {
        if (!window.confirm("คุณต้องการลบประกาศนี้ใช่หรือไม่?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/tutor-posts/${postId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: tutorId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "ลบไม่สำเร็จ");
            alert("ลบประกาศเรียบร้อยแล้ว");
            fetchMyPosts();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEditClick = (post) => {
        setEditingPost(post);
        setIsEditModalOpen(true);
        setMenuOpenId(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <h1 className="text-2xl font-bold text-gray-800">จัดการประกาศของคุณ</h1>
                    <div className="ml-auto text-sm text-gray-500">
                        ทั้งหมด {posts.length} รายการ
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-10 text-gray-500">กำลังโหลด...</div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                        <p className="text-gray-500 text-lg">คุณยังไม่มีประกาศรับสอน</p>
                        <p className="text-gray-400 text-sm mt-2">เริ่มสร้างประกาศเพื่อให้นักเรียนค้นหาคุณเจอได้เลย!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => (
                            <div key={post.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-900 mb-1">{post.subject}</h3>
                                        <p className="text-sm text-gray-500 mb-3">
                                            ประกาศเมื่อ: {new Date(post.createdAt).toLocaleDateString("th-TH")}
                                        </p>
                                        <div className="text-gray-700 text-sm mb-4 line-clamp-2">
                                            {post.description}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Badge icon={Users} text={post.meta.target_student_level?.split(',')[0]} color="purple" />
                                            <Badge icon={MapPin} text={post.meta.location} color="blue" />
                                            <Badge icon={DollarSign} text={`${post.meta.price} ฿/ชม.`} color="emerald" />
                                        </div>
                                    </div>

                                    {/* Action Menu */}
                                    <div className="relative ml-4">
                                        <button
                                            onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                                        >
                                            <MoreHorizontal size={20} />
                                        </button>
                                        <PostActionMenu
                                            isOpen={menuOpenId === post.id}
                                            onClose={() => setMenuOpenId(null)}
                                            onEdit={() => handleEditClick(post)}
                                            onDelete={() => handleDelete(post.id)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Edit Modal */}
                <Modal
                    open={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditingPost(null);
                    }}
                    title="แก้ไขประกาศรับสอน"
                >
                    {editingPost && (
                        <TutorPostForm
                            tutorId={tutorId}
                            initialData={editingPost}
                            onClose={() => {
                                setIsEditModalOpen(false);
                                setEditingPost(null);
                            }}
                            onSuccess={() => {
                                alert("บันทึกการแก้ไขสำเร็จ");
                                fetchMyPosts();
                            }}
                        />
                    )}
                </Modal>

            </div>
        </div>
    );
}
