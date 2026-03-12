import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

const CommentSection = ({ postId, postType, postOwnerId, currentUser }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const commentInputRef = useRef(null);

    const fetchComments = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/comments/${postType}/${postId}`);
            if (!res.ok) throw new Error('ไม่สามารถโหลดความคิดเห็นได้');
            const data = await res.json();
            setComments(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
        // eslint-disable-next-line
    }, [postId, postType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser?.user_id) return;

        try {
            setIsSubmitting(true);
            const res = await fetch(`${API_BASE}/api/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    post_type: postType,
                    post_owner_id: postOwnerId,
                    user_id: currentUser.user_id,
                    comment_text: newComment.trim(),
                }),
            });

            if (!res.ok) throw new Error('ส่งความคิดเห็นไม่สำเร็จ');

            const data = await res.json();
            if (data.success && data.comment) {
                setComments([...comments, data.comment]);
                setNewComment('');
            } else {
                fetchComments(); // fallback
                setNewComment('');
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (!window.confirm("คุณต้องการลบความคิดเห็นนี้ใช่หรือไม่?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser?.user_id }),
            });

            if (!res.ok) throw new Error('ลบไม่สำเร็จ');

            setComments(comments.filter(c => c.comment_id !== commentId));
        } catch (err) {
            alert(err.message);
        }
    };

    const handleReply = (username) => {
        if (!username) return;
        setNewComment(prev => {
            const prefix = prev ? prev + " " : "";
            return prefix + `@${username} `;
        });
        commentInputRef.current?.focus();
    };

    return (
        // 🌟 ปรับ Wrapper ด้านนอกให้เป็น Card สีขาว มีกรอบและเงา เหมือนกับกล่องโพสต์เป๊ะๆ
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
            
            {/* Header ของคอมเมนต์ */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                <MessageSquare className="text-indigo-600" size={24} />
                <h3 className="text-xl font-bold text-gray-900">
                    ความคิดเห็น <span className="text-gray-500 text-base font-medium">({comments.length})</span>
                </h3>
            </div>

            {/* ส่วนแสดงสถานะการโหลด/Error */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 mb-6 border border-red-100">
                    <AlertCircle size={20} /><span>{error}</span>
                </div>
            ) : (
                /* ส่วนแสดงรายการคอมเมนต์ */
                <div className="space-y-6 mb-8">
                    {comments.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500 font-medium">ยังไม่มีความคิดเห็น</p>
                            {/* <p className="text-sm text-gray-400 mt-1">เริ่มการสนทนาเป็นคนแรกเลย!</p> */}
                        </div>
                    ) : (
                        comments.map((comment) => {
                            const profileImg = comment.profile_image || "/blank_avatar.jpg";
                            const isOwner = Number(currentUser?.user_id) === Number(comment.user_id);
                            const isPostOwner = Number(currentUser?.user_id) === Number(postOwnerId);
                            const displayName = comment.name ? `${comment.name} ${comment.lastname || ''}` : "ผู้ใช้";

                            const renderCommentText = (text) => {
                                const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
                                return parts.map((part, i) => {
                                    if (part.startsWith('@')) {
                                        return <span key={i} className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md">{part}</span>;
                                    }
                                    return <span key={i}>{part}</span>;
                                });
                            };

                            return (
                                <div key={comment.comment_id} className="flex gap-4 group">
                                    <img src={profileImg} alt="avatar" className="w-12 h-12 rounded-full object-cover shrink-0 border border-gray-100 shadow-sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="bg-gray-50 rounded-2xl rounded-tl-none p-4 inline-block w-full border border-gray-100">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-gray-900">{displayName}</span>
                                                    {comment.username && <span className="text-xs text-gray-500 font-medium">@{comment.username}</span>}
                                                    {Number(comment.user_id) === Number(postOwnerId) && (
                                                        <span className="bg-blue-100 text-blue-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">Owner</span>
                                                    )}
                                                </div>

                                                {(isOwner || isPostOwner) && (
                                                    <button
                                                        onClick={() => handleDelete(comment.comment_id)}
                                                        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white rounded-full shadow-sm border border-gray-100"
                                                        title="ลบคอมเมนต์"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-gray-700 text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                {renderCommentText(comment.comment_text)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4 mt-2 ml-2">
                                            <span className="text-xs text-gray-400 font-medium">
                                                {new Date(comment.created_at).toLocaleString('th-TH', {
                                                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                            {currentUser?.user_id && (
                                                <button
                                                    onClick={() => handleReply(comment.username || displayName.split(' ')[0])}
                                                    className="text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors"
                                                >
                                                    ตอบกลับ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Input Box */}
            {currentUser?.user_id ? (
                <div className="pt-4 border-t border-gray-100">
                    <form onSubmit={handleSubmit} className="flex gap-3 items-start relative">
                        <img
                            src={currentUser?.profile_picture_url || currentUser?.profile_image || "/blank_avatar.jpg"}
                            alt="my-avatar"
                            className="w-12 h-12 rounded-full object-cover shrink-0 border border-gray-200 shadow-sm"
                        />
                        <div className="flex-1 relative">
                            <textarea
                                ref={commentInputRef}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="แสดงความคิดเห็นของคุณ..."
                                className="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-2xl py-3.5 px-4 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none min-h-[55px] shadow-inner transition-all"
                                rows={Math.max(1, Math.min(5, newComment.split('\n').length))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim() || isSubmitting}
                                className={`absolute right-2 bottom-2.5 p-2.5 rounded-xl flex items-center justify-center transition-all
                                ${!newComment.trim() || isSubmitting
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-md'
                                }
                            `}
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Send size={18} className={newComment.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                                )}
                            </button>
                            <p className="text-[11px] text-gray-400 mt-2 ml-2 absolute">
                                กด <kbd className="bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Enter</kbd> เพื่อส่ง, <kbd className="bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Shift</kbd> + <kbd className="bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Enter</kbd> เพื่อขึ้นบรรทัดใหม่
                            </p>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-indigo-50/50 rounded-2xl p-6 text-center border border-indigo-100">
                    <p className="text-indigo-800 font-medium mb-2">เข้าสู่ระบบเพื่อร่วมวงสนทนา</p>
                </div>
            )}
        </div>
    );
};

export default CommentSection;