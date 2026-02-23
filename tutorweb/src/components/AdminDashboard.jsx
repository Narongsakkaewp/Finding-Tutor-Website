import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Trash2, Eye, Filter, Loader2, Flag, User, Ban, Timer, Search, MoreHorizontal } from 'lucide-react';
import MyPostDetails from './MyPostDetails';

export default function AdminDashboard() {
    // Reports State
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, resolved, ignored, all
    const [actionLoading, setActionLoading] = useState(null);
    const [viewingPost, setViewingPost] = useState(null);

    // Users State
    const [activeTab, setActiveTab] = useState('reports'); // 'reports', 'users'
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);

    // User Action Modal State
    const [selectedUser, setSelectedUser] = useState(null); // User to act on
    const [suspendDays, setSuspendDays] = useState(7);
    const [showSuspendModal, setShowSuspendModal] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (activeTab === 'reports') {
            fetchReports();
        } else {
            fetchUsers();
        }
    }, [activeTab]);

    // --- Reports Logic ---
    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await fetch(`http://localhost:5000/api/admin/reports?user_id=${currentUser?.user_id}`);
            if (!res.ok) throw new Error("Unauthorized");
            const data = await res.json();
            setReports(data);
        } catch (err) {
            console.error(err);
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

    // --- Users Logic ---
    const fetchUsers = async () => {
        try {
            setUsersLoading(true);
            const res = await fetch(`http://localhost:5000/api/admin/users?user_id=${currentUser?.user_id}&search=${userSearch}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUsersLoading(false);
        }
    };

    const handleSearchUsers = (e) => {
        e.preventDefault();
        fetchUsers();
    };

    const handleUserAction = async (userId, action, days = null) => {
        // action: 'active', 'suspended', 'banned', 'delete'
        if (action === 'delete') {
            if (!window.confirm("คุณแน่ใจว่าต้องการลบผู้ใช้นี้? ข้อมูลทั้งหมดจะหายไป")) return;
            try {
                const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, { method: 'DELETE' });
                if (res.ok) {
                    setUsers(prev => prev.filter(u => u.user_id !== userId));
                    alert("ลบผู้ใช้สำเร็จ");
                }
            } catch (err) { alert("เกิดข้อผิดพลาด"); }
            return;
        }

        // Suspend/Ban/Activate
        try {
            const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action, suspendDays: days })
            });
            if (res.ok) {
                // Determine new status and suspended_until locally for immediate UI update
                let newUntil = null;
                if (action === 'suspended' && days) {
                    const d = new Date();
                    d.setDate(d.getDate() + parseInt(days));
                    newUntil = d.toISOString();
                }

                setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: action, suspended_until: newUntil } : u));
                setShowSuspendModal(false);
            }
        } catch (err) { console.error(err); alert("Update failed"); }
    };

    const openSuspendModal = (user) => {
        setSelectedUser(user);
        setSuspendDays(7);
        setShowSuspendModal(true);
    };


    const filteredReports = reports.filter(r => filter === 'all' ? true : r.status === filter);

    if (loading && activeTab === 'reports' && reports.length === 0) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                            <ShieldAlert size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                            <p className="text-gray-500 text-sm">จัดการระบบและรายงาน</p>
                        </div>
                    </div>

                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            รายการแจ้งปัญหา
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            จัดการผู้ใช้งาน
                        </button>
                    </div>
                </div>

                {/* VIEW: REPORTS */}
                {activeTab === 'reports' && (
                    <>
                        <div className="flex justify-end mb-4">
                            <div className="flex items-center bg-white border rounded-lg p-1 shadow-sm">
                                {['pending', 'resolved', 'ignored', 'all'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === f ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {f === 'pending' ? 'รอตรวจสอบ' : f === 'resolved' ? 'แก้ไขแล้ว' : f === 'ignored' ? 'ยกเลิก' : 'ทั้งหมด'}
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                                    onClick={() => {
                                                        if (report.post_type === 'profile') {
                                                            window.open(`/profile/${report.reported_user_id}`, '_blank');
                                                        } else {
                                                            setViewingPost(report);
                                                        }
                                                    }}
                                                    className="bg-gray-50 rounded-lg p-4 border border-gray-100 cursor-pointer hover:bg-white hover:shadow-md hover:border-blue-200 transition-all group relative"
                                                >
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Eye size={16} className="text-blue-500" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                                                        {(report.post_type === 'student_post' || report.post_type === 'student') ? '🎓 โพสต์นักเรียน' :
                                                            (report.post_type === 'tutor_post' || report.post_type === 'tutor') ? '📚 โพสต์ติวเตอร์' :
                                                                (report.post_type === 'profile') ? '👤 ผู้ใช้งาน' : 'อื่นๆ'}
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
                    </>
                )}

                {/* VIEW: USERS */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-4 border-b bg-gray-50/50 flex gap-2">
                            <form onSubmit={handleSearchUsers} className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อ หรือ อีเมล..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm"
                                />
                            </form>
                            <button onClick={fetchUsers} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
                                ค้นหา
                            </button>
                        </div>

                        {/* User Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="p-4 font-semibold">User</th>
                                        <th className="p-4 font-semibold">Role</th>
                                        <th className="p-4 font-semibold">Status</th>
                                        <th className="p-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {usersLoading ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-400">Loading...</td></tr>
                                    ) : users.length === 0 ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-400">ไม่พบผู้ใช้งาน</td></tr>
                                    ) : (
                                        users.map(u => (
                                            <tr key={u.user_id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{u.name} {u.lastname}</div>
                                                    <div className="text-xs text-gray-500">{u.email}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                                        (u.type === 'tutor' || u.role === 'tutor') ? 'bg-indigo-100 text-indigo-600' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {u.role || u.type || 'Student'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${u.status === 'banned' ? 'bg-red-100 text-red-600' :
                                                            u.status === 'suspended' ? 'bg-orange-100 text-orange-600' :
                                                                'bg-green-100 text-green-600'
                                                            }`}>
                                                            {u.status === 'banned' ? <XCircle size={12} /> :
                                                                u.status === 'suspended' ? <Timer size={12} /> :
                                                                    <CheckCircle size={12} />}
                                                            {u.status || 'Active'}
                                                        </span>
                                                        {u.status === 'suspended' && u.suspended_until && (
                                                            <span className="text-[10px] text-orange-500 font-medium">
                                                                ถึง: {new Date(u.suspended_until).toLocaleDateString('th-TH')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {u.status !== 'active' ? (
                                                            <button
                                                                onClick={() => handleUserAction(u.user_id, 'active')}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg border border-transparent hover:border-green-100 transition"
                                                                title="ปลดแบน/คืนสถานะปกติ"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => openSuspendModal(u)}
                                                                    className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-100 transition"
                                                                    title="ระงับการใช้งานชั่วคราว"
                                                                >
                                                                    <Timer size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUserAction(u.user_id, 'banned')}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition"
                                                                    title="แบนถาวร"
                                                                >
                                                                    <Ban size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => handleUserAction(u.user_id, 'delete')}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            title="ลบผู้ใช้"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* View Full Post Overlay */}
            {viewingPost && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-fade-in">
                    <MyPostDetails
                        postId={viewingPost.post_id}
                        postType={viewingPost.post_type}
                        onBack={() => setViewingPost(null)}
                        me={currentUser?.user_id}
                    />
                </div>
            )}

            {/* Suspend Modal */}
            {showSuspendModal && selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ระงับการใช้งาน</h3>
                        <p className="text-gray-500 mb-4">
                            คุณกำลังจะระงับการใช้งานผู้ใช้: <span className="font-bold text-gray-800">{selectedUser.name} {selectedUser.lastname}</span>
                        </p>

                        <div className="space-y-3 mb-6">
                            <label className="block text-sm font-medium text-gray-700">ระบุจำนวนวัน</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[3, 7, 30].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSuspendDays(d)}
                                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${suspendDays === d ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                                    >
                                        {d} วัน
                                    </button>
                                ))}
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={suspendDays}
                                        onChange={(e) => setSuspendDays(parseInt(e.target.value) || 0)}
                                        className="w-full h-full pl-2 pr-1 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-500 text-center text-sm"
                                        placeholder="กำหนดเอง"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSuspendModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => handleUserAction(selectedUser.user_id, 'suspended', suspendDays)}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-sm shadow-orange-200 transition"
                            >
                                ยืนยันระงับใช้งาน
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
