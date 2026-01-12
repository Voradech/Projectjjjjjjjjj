import { Router } from "express";
import Parser from "rss-parser";

const router = Router();

const parser = new Parser({
  headers: {
    "User-Agent": "Mozilla/5.0 (CryptoNewsBot)",
  },
});

router.get("/", async (req, res) => {
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

    const items: any[] = [];

    for (const f of feeds) {
      try {
        const feed = await parser.parseURL(f.url);
        items.push(
          ...(feed.items || []).map((it) => ({
            title: it.title || "",
            url: it.link || "",
            source: f.source,
            publishedAt: it.isoDate || it.pubDate,
          }))
        );
      } catch (e) {
        console.error("RSS error:", f.source);
      }
    }

    res.json({ items: items.slice(0, limit) });
  } catch (err) {
    res.status(500).json({ items: [] });
  }
});

export default router;
