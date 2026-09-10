import { Router } from "express";
import { getKlines } from "../services/price.service";

const router = Router();

router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol ?? "BTCUSDT");
    const interval = String(req.query.interval ?? "1d");
    const limit = Number(req.query.limit ?? 1);

    const candles = await getKlines({ symbol, interval, limit });

    res.json({ symbol, interval, candles });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
