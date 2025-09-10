import React from 'react';

const Notification = ({
  message = 'นี่คือข้อความแจ้งเตือนตัวอย่าง 🚀', // ข้อความ default
  type = 'info',
  onClose
}) => {
  const bgColor = {
    success: 'bg-green-100 border-green-400 text-green-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
  }[type];

  return (
    <div
      className={`border px-4 py-3 rounded relative mb-4 ${bgColor} m-4 md:m-6 lg:m-8`}
      role="alert"
    >
      <span className="block sm:inline">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-0 bottom-0 right-0 px-4 py-3 text-xl font-bold"
          aria-label="close"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default Notification;