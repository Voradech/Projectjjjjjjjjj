"use client";

import { useState } from "react";

export default function AlertPage() {
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("above");
  const [message, setMessage] = useState("");

  const createAlert = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_price: Number(price),
          condition,
        }),
      });

      if (!res.ok) throw new Error("request failed");
      setMessage(" ตั้งแจ้งเตือนเรียบร้อยแล้ว");
    } catch (err) {
      setMessage("ไม่สามารถเชื่อมต่อ backend ได้");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050B1E] via-[#0B1638] to-[#020617] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8">
        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          ตั้งแจ้งเตือนราคา BTC
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          ระบบจะแจ้งเตือนคุณทางอีเมลเมื่อราคาถึงเงื่อนไขที่ตั้งไว้
        </p>

        {/* Price Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">
            ราคาที่ต้องการแจ้งเตือน (USD)
          </label>
          <input
            type="number"
            placeholder="เช่น 50000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {/* Condition */}
        <div className="mb-6">
          <label className="block text-sm text-gray-300 mb-1">
            เงื่อนไขราคา
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="above">ราคามากกว่า</option>
            <option value="below">ราคาน้อยกว่า</option>
          </select>
        </div>

        {/* Button */}
        <button
          onClick={createAlert}
          className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 transition-all duration-200 shadow-lg shadow-emerald-500/30"
        >
          ตั้งแจ้งเตือน
        </button>

        {/* Message */}
        {message && (
          <p className="mt-4 text-center text-sm text-gray-200">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
