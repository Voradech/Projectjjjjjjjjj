import { Router } from "express";

const router = Router();

router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol ?? "BTCUSDT").toUpperCase();
    const interval = String(req.query.interval ?? "1d");
    const limit = Math.min(Number(req.query.limit ?? 1000), 1000); // max 1000
    const endTime = req.query.endTime ? Number(req.query.endTime) : undefined; // ms

    const params = new URLSearchParams({
      symbol,
      interval,
      limit: String(limit),
    });
    if (endTime && Number.isFinite(endTime)) params.set("endTime", String(endTime));

    const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
    const r = await fetch(url);

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "binance_error", detail: text });
    }

    const data = (await r.json()) as any[];
    const candles = data.map((k) => ({
      time: Number(k[0]), // ms
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    }));

    return res.json({ symbol, interval, limit, candles });
  } catch (e: any) {
    return res.status(500).json({ error: "server_error", detail: e?.message ?? String(e) });
  }
});

export default router;
