"use client";

import { useEffect, useState } from "react";
import { fetchNews } from "../../services/news";
 
export default function NewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews(30)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading news...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bitcoin News</h1>

      {items.map((n, i) => (
        <a
          key={n.url || i}
          href={n.url}
          target="_blank"
          className="block border p-4 rounded-lg hover:underline"
        >
          <div className="font-medium">{n.title}</div>
          <div className="text-sm opacity-70">
            {n.source} {n.publishedAt ? `• ${n.publishedAt}` : ""}
          </div>
        </a>
      ))}
    </div>
  );
}
