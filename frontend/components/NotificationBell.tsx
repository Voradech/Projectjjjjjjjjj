"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  const handleNew = () => {
    setCount((prev) => prev + 1);
  };

  return (
    <div className="relative cursor-pointer">
      <Bell className="text-white w-6 h-6" />

      {count > 0 && (
        <span className="absolute -top-2 -right-2 
          bg-red-500 text-white text-xs 
          w-5 h-5 flex items-center 
          justify-center rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}