"use client";

import { useEffect, useState } from "react";
import { fetchNews } from "../../services/news";
import { Newspaper, Calendar, ExternalLink, Loader2, Globe } from "lucide-react";

export default function NewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Format Date Function
  function formatThaiDate(utc?: string) {
    if (!utc) return "";
    return new Date(utc).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    fetchNews(30)
      .then(setItems)
      .catch((err) => console.error(err)) // กัน Error พังหน้าจอ
      .finally(() => setLoading(false));
  }, []);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center text-white">
        <Loader2 size={48} className="animate-spin text-emerald-400 mb-4" />
        <p className="text-gray-400 animate-pulse">Fetching latest crypto news...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#020617] text-white p-6 md:p-12 overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute w-[800px] h-[800px] bg-indigo-500/10 blur-3xl rounded-full top-[-200px] left-[-200px] pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 blur-3xl rounded-full bottom-[-100px] right-[-100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-10 border-b border-white/10 pb-6">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Newspaper className="text-emerald-400" size={36} />
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Bitcoin & Crypto News
            </span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm ml-1">
            อัปเดตข่าวสารล่าสุดจากโลกคริปโต
          </p>
        </header>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((n, i) => (
            <a
              key={n.url || i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-xl overflow-hidden transition-all duration-300 hover:bg-white/[0.08] hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              {/* Decoration Circle on Hover */}
              <div className="absolute -right-10 -top-10 w-20 h-20 bg-emerald-500/20 blur-xl rounded-full group-hover:bg-emerald-400/30 transition-all duration-500" />

              {/* Icon Top Right */}
              <div className="absolute top-4 right-4 opacity-0 transform translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <ExternalLink className="text-emerald-400" size={20} />
              </div>

              {/* Content */}
              <div className="flex flex-col h-full justify-between">
                <div>
                  {/* Source Badge */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-gray-300 mb-3 group-hover:border-emerald-500/30 group-hover:text-emerald-300 transition-colors">
                    <Globe size={12} />
                    {n.source || "Unknown Source"}
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-lg font-semibold leading-relaxed group-hover:text-emerald-50 transition-colors line-clamp-3">
                    {n.title}
                  </h2>
                </div>

                {/* Footer: Date */}
                <div className="mt-6 flex items-center text-xs text-gray-500 border-t border-white/5 pt-4 group-hover:border-white/10">
                  <Calendar size={14} className="mr-2 text-emerald-500/70" />
                  {n.publishedAt ? formatThaiDate(n.publishedAt) : "N/A"}
                </div>
              </div>
            </a>
          ))}
        </div>
        
        {/* Empty State (เผื่อไม่มีข่าว) */}
        {!loading && items.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p>ไม่พบข่าวสารในขณะนี้</p>
          </div>
        )}
      </div>
    </div>
  );
}