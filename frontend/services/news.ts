const API = process.env.NEXT_PUBLIC_API_URL;

if (!API) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};


export async function fetchNews(limit = 20): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${API}/api/news?limit=${limit}`);

    if (!res.ok) {
      console.error("API error:", res.status);
      return [];
    }

    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error("fetchNews error:", err);
    return [];
  }
}