import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

const Booking = () => {
  const [selectedEvents, setSelectedEvents] = useState([]);

  // สมมติข้อมูลกิจกรรม
  const events = [
    { title: "ติว React", date: "2025-08-20" },
    { title: "ติว Differential Equations", date: "2025-08-22" },
  ];

  const handleDateClick = (info) => {
    const filtered = events.filter((event) => event.date === info.dateStr);
    setSelectedEvents(filtered);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50">
      {/* Calendar */}
      <div className="grid-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          dateClick={handleDateClick}
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
        />
      </div>

      {/* Event details */}
      <div className="grid-1 bg-white shadow-md rounded-xl p-4">
        <h2 className="text-lg font-bold mb-2">กิจกรรม</h2>
        {selectedEvents.length === 0 ? (
          <p className="text-gray-500"></p>
        ) : (
          <ul className="list-disc pl-5 space-y-2">
            {selectedEvents.map((event, idx) => (
              <li key={idx} className="text-gray-700">
                {event.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Booking;
