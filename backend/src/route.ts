import express from "express";
import fetch from "node-fetch";
import type { BinanceKline, PriceCandle } from "./types";

const router = express.Router();

/**
 * GET /api/price
 * query:
 *  - symbol (default BTCUSDT)
 *  - interval (default 1d)
 *  - limit (default 100)
 */
router.get("/price", async (req, res) => {
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

export default router;
