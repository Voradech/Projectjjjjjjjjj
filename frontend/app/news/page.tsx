"use client";

import { useEffect, useState } from "react";
import { fetchNews } from "../../services/news";

export default function NewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function formatThaiDate(utc?: string) {
    if (!utc) return "";

    return new Date(utc).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    fetchNews(30)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading news...</div>;

  return (
    <div className="p-6 space-y-4  bg-white">
      <h1 className="text-xl font-semibold text-white">Bitcoin News</h1>

      {items.map((n, i) => (
        <a
          key={n.url || i}
          href={n.url}
          target="_blank"
          className="block border p-4 rounded-lg hover:underline "
        >
          <div className="font-medium">{n.title}</div>
          <div className="text-sm opacity-70 space-y-2">
            {n.source}
            {n.publishedAt && ` • ${formatThaiDate(n.publishedAt)}`}
          </div>

        </a>
      ))}
    </div>
  );
}
