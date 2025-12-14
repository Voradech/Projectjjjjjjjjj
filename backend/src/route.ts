import express, { Request, Response } from "express";
import fetch from "node-fetch";
import type { BinanceKline, PriceCandle } from "./types";
import Parser from "rss-parser";

const router = express.Router();

/**
 * GET /api/price
 * query:
 *  - symbol (default BTCUSDT)
 *  - interval (default 1d)
 *  - limit (default 100)
 */
router.get("/price", async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || "BTCUSDT";
    const interval = (req.query.interval as string) || "1d";
    const limit = Number(req.query.limit || 100);

    const url =
      `https://api.binance.com/api/v3/klines` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${encodeURIComponent(interval)}` +
      `&limit=${Number.isFinite(limit) ? limit : 100}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        error: "Binance API error",
        status: response.status
      });
    }

    
    const data = (await response.json()) as BinanceKline[];

    const formatted: PriceCandle[] = data.map((item) => ({
      time: item[0],
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4])
    }));

    return res.json({
      symbol,
      interval,
      limit,
      candles: formatted
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch price data"
    });
  }
});
const parser = new Parser();

router.get("/news", async (req: Request, res: Response) => {
  try {
    const feeds = [
      { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
      { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    ];

    const results = await Promise.all(
      feeds.map(async (f) => {
        const feed = await parser.parseURL(f.url);
        return (feed.items || []).map((it) => ({
          title: it.title || "",
          url: (it.link as string) || "",
          source: f.source,
          publishedAt: (it.isoDate as string) || (it.pubDate as string) || undefined,
        }));
      })
    );

    const merged = results.flat().filter((x) => x.title && x.url);

    // กันซ้ำด้วย url
    const uniq = Array.from(new Map(merged.map((x) => [x.url, x])).values());

    // sort ใหม่ล่าสุดก่อน (ถ้ามี publishedAt)
    uniq.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

    const limit = Math.min(Number(req.query.limit || 20), 100);
    return res.json({ count: uniq.length, items: uniq.slice(0, limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch RSS news" });
  }
});

export default router;
