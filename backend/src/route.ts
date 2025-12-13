import express from "express";
import fetch from "node-fetch";
import { BinanceKline } from "./types";

const router = express.Router();

router.get("/price", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=100"
    );

    const data = (await response.json()) as BinanceKline[];

    const formatted = data.map((item) => ({
      time: item[0],
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price data" });
  }
});

export default router;
