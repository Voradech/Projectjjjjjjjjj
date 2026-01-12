export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};

const API_BASE = "http://localhost:8000"; // backend ของคุณ

export async function fetchNews(limit = 20): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${API_BASE}/news?limit=${limit}`);

    if (!res.ok) return [];

    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error("fetchNews error:", err);
    return [];
  }
}
