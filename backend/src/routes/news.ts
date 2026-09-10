import { Request, Response, Router } from "express";
import Parser from "rss-parser";

const router = Router();
const parser = new Parser({ timeout: 5000 });

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;

    const feeds = [
      {
        source: "CoinDesk",
        url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
      },
      {
        source: "Cointelegraph",
        url: "https://cointelegraph.com/rss",
      },
    ];

    let items: any[] = [];

    for (const f of feeds) {
      try {
        const feed = await parser.parseURL(f.url);

        const mapped = (feed.items || []).map((it) => ({
          title: it.title || "",
          url: it.link || "",
          source: f.source,
          publishedAt: new Date(it.isoDate || it.pubDate || 0),
        }));

        items = items.concat(mapped);
      } catch (err) {
        console.error("RSS error:", f.source);
      }
    }

    // ✅ sort newest first
    items.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );

    return res.json({
      items: items.slice(0, limit),
    });
  } catch (err) {
    console.error("News API error:", err);
    return res.status(500).json({ items: [] });
  }
});

export default router;