import { useState, useEffect, useCallback } from 'react';

/**
 * Hook สำหรับจัดการ Tab State โดยจะจำค่าไว้ใน sessionStorage
 * ป้องกันปัญหา Tab เด้งกลับไปค่าเริ่มต้นเมื่อ User กด Back
 * @param {string} pageKey ชื่อเฉพาะของหน้านั้นๆ (เช่น 'tutor_profile')
 * @param {string} defaultTab ค่า Tab เริ่มต้นหากไม่มีใน Storage
 */
export function useTabRestoration(pageKey, defaultTab) {
    const storageKey = `active_tab_${pageKey}`;

    const [activeTab, setActiveTabBase] = useState(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            return saved !== null ? saved : defaultTab;
        } catch (e) {
            return defaultTab;
        }
    });

    const setActiveTab = useCallback((newValue) => {
        setActiveTabBase(newValue);
        try {
            sessionStorage.setItem(storageKey, typeof newValue === 'function' ? newValue(activeTab) : newValue);
        } catch (e) {
            // Ignore sessionStorage errors
        }
    }, [activeTab, storageKey]);

    return [activeTab, setActiveTab];
}

/**
 * Hook สำหรับจัดการ Scroll Position โดยจะบันทึกตำแหน่งล่าสุดไว้
 * และเลื่อนกลับไปตำแหน่งเดิมเมื่อโหลดข้อมูลครบ
 * @param {string} pageKey ชื่อเฉพาะของหน้านั้นๆ
 * @param {Array} dependencies ตัวแปรสถานะที่ใช้ในการโหลดหน้าจอ (เมื่ออัปเดต จะพยายามคินค่า scroll)
 */
export function useScrollRestoration(pageKey, dependencies = []) {
    const storageKey = `scroll_pos_${pageKey}`;

    // เซฟตำแหน่ง Scroll ทุกครั้งที่มีการเลื่อนหน้าจอ
    useEffect(() => {
        let scrollTimeout;
        const handleScroll = () => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                sessionStorage.setItem(storageKey, window.scrollY.toString());
            }, 100);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, [storageKey]);

    // เลื่อน Scroll กลับไปตำแหน่งเดิมเมื่อ Component mount หรือ Dependencies ข้อมูลโหลดเสร็จ
    useEffect(() => {
        const storedScroll = sessionStorage.getItem(storageKey);
        if (storedScroll) {
            const pos = parseInt(storedScroll, 10);
            if (!isNaN(pos) && pos > 0) {
                // หน่วงเวลาเล็กน้อยเพื่อให้เบราว์เซอร์ Render DOM ครบก่อน
                const timer = setTimeout(() => {
                    window.scrollTo({
                        top: pos,
                        behavior: 'instant'
                    });
                }, 50);
                return () => clearTimeout(timer);
            }
        }
    }, dependencies);
}
