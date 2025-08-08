import React, { useState } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ส่ง setIsAuthenticated ไปให้ Login/Register เพื่อเปลี่ยนสถานะหลังเข้าสู่ระบบ/ลงทะเบียน
  return (
    <div>
      {!isAuthenticated ? (
        <Index setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <>
          <Navbar />
          <Home />
          {/* ในอนาคตสามารถเพิ่ม Route หรือคอนเท้นอื่นๆได้ที่นี่ */}
        </>
      )}
    </div>
  );
}

export default App;