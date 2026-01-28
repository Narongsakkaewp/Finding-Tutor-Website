import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Trash2, Eye, Filter, Loader2, Flag } from 'lucide-react';
import MyPostDetails from './MyPostDetails'; // Import MyPostDetails

export default function AdminDashboard() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, resolved, ignored, all
    const [actionLoading, setActionLoading] = useState(null);
    const [viewingPost, setViewingPost] = useState(null); // State for viewing full post

    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await fetch(`http://localhost:5000/api/admin/reports?user_id=${currentUser?.user_id}`);
            if (!res.ok) throw new Error("Unauthorized");
            const data = await res.json();
            setReports(data);
        } catch (err) {
            console.error(err);
            // alert("ไม่สามารถเข้าถึงข้อมูลได้ (เฉพาะแอดมิน)");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (reportId, status) => {
        setActionLoading(reportId);
        try {
            await fetch(`http://localhost:5000/api/admin/reports/${reportId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            setReports(prev => prev.map(r => r.report_id === reportId ? { ...r, status } : r));
        } catch (err) {
            alert("Error updating status");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeletePost = async (report) => {
        if (!window.confirm("คุณแน่ใจว่าต้องการลบโพสต์นี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;

        setActionLoading(report.report_id);
        try {
            const res = await fetch(`http://localhost:5000/api/admin/posts`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: report.post_id, post_type: report.post_type })
            });

            if (res.ok) {
                // Auto resolve report locally
                setReports(prev => prev.map(r =>
                    (r.post_id === report.post_id && r.post_type === report.post_type)
                        ? { ...r, status: 'resolved' }
                        : r
                ));
                alert("ลบโพสต์เรียบร้อยแล้ว");
            } else {
                alert("ลบโพสต์ไม่สำเร็จ");
            }
        } catch (err) {
            alert("Error deleting post");
        } finally {
            setActionLoading(null);
        }
    };

    const filteredReports = reports.filter(r => filter === 'all' ? true : r.status === filter);

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                            <ShieldAlert size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                            <p className="text-gray-500 text-sm">จัดการรายงานความไม่เหมาะสม</p>
                        </div>
                    </div>

                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        {['pending', 'resolved', 'ignored', 'all'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {f === 'pending' ? 'รอตรวจสอบ' : f === 'resolved' ? 'แก้ไขแล้ว' : f === 'ignored' ? 'ยกเลิก' : 'ทั้งหมด'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="grid gap-4">
                    {filteredReports.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed text-gray-400">
                            <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                            <p>ไม่มีรายการที่ต้องตรวจสอบ</p>
                        </div>
                    ) : (
                        filteredReports.map((report) => (
                            <div key={report.report_id} className="bg-white rounded-xl shadow-sm border p-5 transition hover:shadow-md">
                                <div className="flex flex-col md:flex-row gap-5">

                                    {/* Report Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                        ${report.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                        'bg-gray-100 text-gray-600'}`}>
                                                {report.status}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(report.created_at).toLocaleString('th-TH')}
                                            </span>
                                        </div>

                                        <div className="flex items-start gap-2 mb-3">
                                            <Flag size={18} className="text-red-500 mt-0.5 shrink-0" />
                                            <div>
                                                <span className="font-bold text-gray-800">เหตุผล: {report.reason}</span>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    ผู้รายงาน: {report.reporter_name} {report.reporter_lastname} (ID: {report.reporter_id})
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setViewingPost(report)}
                                            className="bg-gray-50 rounded-lg p-4 border border-gray-100 cursor-pointer hover:bg-white hover:shadow-md hover:border-blue-200 transition-all group relative"
                                        >
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Eye size={16} className="text-blue-500" />
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                                                {(report.post_type === 'student_post' || report.post_type === 'student') ? '🎓 โพสต์นักเรียน' : '📚 โพสต์ติวเตอร์'}
                                                <span className="font-normal text-gray-400 text-xs">ID: {report.post_id}</span>
                                            </h4>
                                            <div className="text-gray-900 font-medium mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">{report.post_title}</div>
                                            <div className="text-xs text-gray-500 line-clamp-2">{report.post_content}</div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 min-w-[140px]">
                                        {report.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateStatus(report.report_id, 'ignored')}
                                                    disabled={!!actionLoading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
                                                >
                                                    <XCircle size={16} /> ยกเลิก
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePost(report)}
                                                    disabled={!!actionLoading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 text-sm font-medium transition"
                                                >
                                                    {actionLoading === report.report_id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                                    ลบโพสต์
                                                </button>
                                            </>
                                        )}
                                        {report.status !== 'pending' && (
                                            <div className="text-center text-sm text-gray-400 py-2">
                                                ดำเนินการแล้ว
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
            {/* View Full Post Overlay */}
            {viewingPost && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-fade-in">
                    <MyPostDetails
                        postId={viewingPost.post_id}
                        postType={viewingPost.post_type} // 'student' or 'tutor' from API fix
                        onBack={() => setViewingPost(null)}
                        me={currentUser?.user_id} // Pass admin ID, though mostly read-only
                    />
                </div>
            )}
        </div>
    );
}
