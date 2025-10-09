import React from "react";
import { Link, NavLink } from "react-router-dom";
import { GraduationCap, Home, PlusSquare, CalendarDays } from "lucide-react";


const cls = (...arr) => arr.filter(Boolean).join(" ");


function TutorLayout({ children }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b">
                <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="inline-flex items-center gap-2 font-bold">
                        <GraduationCap className="h-5 w-5" /> TutorDash
                    </Link>


                    <nav className="flex items-center gap-1 text-sm">
                        <NavLink
                            to="/tutor"
                            end
                            className={({ isActive }) => cls(
                                "px-3 py-2 rounded-lg",
                                isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                            )}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Home className="h-4 w-4" /> หน้าหลัก
                            </span>
                        </NavLink>
                        <NavLink
                            to="/tutor/create-post"
                            className={({ isActive }) => cls(
                                "px-3 py-2 rounded-lg",
                                isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                            )}
                        >
                            <span className="inline-flex items-center gap-2">
                                <PlusSquare className="h-4 w-4" /> สร้างโพสต์รับสอน
                            </span>
                        </NavLink>
                        <NavLink
                            to="/tutor/schedule"
                            className={({ isActive }) => cls(
                                "px-3 py-2 rounded-lg",
                                isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                            )}
                        >
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" /> ตารางสอน
                            </span>
                        </NavLink>
                    </nav>
                </div>
            </header>


            <main className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}

export default TutorLayout;