import React from 'react';

const cards = [
  {
    title: 'Country Legends',
    date: 'Thursday, September 16 | 08:30 PM',
    location: 'New York, NY',
  },
  // เพิ่มข้อมูลอีก 2 ใบ (หรือวนซ้ำก็ได้)
];

function Card() {
  return (
    <div className="bg-white rounded overflow-hidden shadow-sm mb-4">
      <div className="bg-gray-100 h-32 flex items-center justify-center">
        <img src="https://via.placeholder.com/60x40?text=Image" alt="cover" className="opacity-50" />
      </div>
      <div className="p-4">
        <div className="flex items-center mb-2">
          <i className="bi bi-heart text-gray-400 mr-2"></i>
        </div>
        <div className="font-bold mb-1">Country Legends</div>
        <div className="flex items-center text-sm text-gray-700 mb-1">
          <i className="bi bi-calendar-event mr-2"></i>
          Thursday, September 16 | 08:30 PM
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <i className="bi bi-geo-alt mr-2"></i>
          New York, NY
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="px-8 py-6">
      <h2 className="font-bold text-2xl mb-4">ติวเตอร์ยอดฮิต</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card />
        <Card />
        <Card />
      </div>
      <h2 className="font-bold text-2xl mb-4">วิชาสุดฮิต</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card />
        <Card />
        <Card />
      </div>
    </div>
  );
}

export default Home;