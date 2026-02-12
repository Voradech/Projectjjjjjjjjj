import { Router } from "express";
import { getKlines } from "../services/price.service"; // ← แนะนำให้แยกไฟล์

const router = Router();

router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol ?? "BTCUSDT").toUpperCase();
    const interval = String(req.query.interval ?? "1d");
    const limit = Math.min(Number(req.query.limit ?? 1000), 1000);

    const candles = await getKlines({
      symbol,
      interval,
      limit,
    });

    return res.json({ symbol, interval, limit, candles });
  } catch (e: any) {
    return res.status(500).json({
      error: "server_error",
      detail: e?.message ?? String(e),
    });
  }
});

export default router;
