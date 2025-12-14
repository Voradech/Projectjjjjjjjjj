export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function fetchNews(limit = 20): Promise<NewsItem[]> {
  const res = await fetch(`${API_BASE}/api/news?limit=${limit}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch news");
  const data = await res.json();
  return data.items || [];
}
