import { Router } from "express";

const router = Router();

// ✅ 1. กำหนด type ชัดเจน
export type Kline = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

// ✅ 2. ใส่ return type Promise<Kline[]>
export const getKlines = async ({
  symbol = "BTCUSDT",
  interval = "1d",
  limit = 1,
}: {
  symbol?: string;
  interval?: string;
  limit?: number;
} = {}): Promise<Kline[]> => {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.min(limit, 1000)),
  });

  const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
  const r = await fetch(url);

  if (!r.ok) {
    throw new Error("Binance error");
  }

  const data = await r.json();

  // ✅ 3. บอก type ของ k ให้ชัด
  return (data as any[]).map((k): Kline => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
  }));
};

export default router;