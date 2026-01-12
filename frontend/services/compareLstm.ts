// compareLstm.ts (B: pull actual from Binance)

export type Candle = {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_asset_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
};

export type ComparePoint = {
  time: number;
  actual_close: number;
  predicted_close: number;
};

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${String(v)}`);
  return n;
}

function normalizeTime(t: unknown): number {
  const n = toNumber(t);
  return n > 1_000_000_000_000 ? Math.floor(n / 1000) : Math.floor(n);
}

// Binance kline: [ openTime(ms), open, high, low, close, volume, closeTime(ms), quoteVol, trades, takerBuyBase, takerBuyQuote, ... ]
export function normalizeCandle(raw: any): Candle {
  if (!Array.isArray(raw)) {
    throw new Error("Expected Binance kline array but got object");
  }

  return {
    time: normalizeTime(raw[0]),
    open: toNumber(raw[1]),
    high: toNumber(raw[2]),
    low: toNumber(raw[3]),
    close: toNumber(raw[4]),
    volume: toNumber(raw[5]),
    quote_asset_volume: toNumber(raw[7]),
    trades: toNumber(raw[8]),
    taker_buy_base: toNumber(raw[9]),
    taker_buy_quote: toNumber(raw[10]),
  };
}

export async function fetchActualCandles(params?: {
  symbol?: string;
  interval?: string;
  limit?: number;
}): Promise<Candle[]> {
  const symbol = params?.symbol ?? "BTCUSDT";
  const interval = params?.interval ?? "1d";
  const limit = params?.limit ?? 220;

  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance API failed: ${res.status} ${text}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No candles from Binance");
  }

  return rows.map(normalizeCandle);
}

export async function fetchLstmCompareSeries(candles: Candle[], horizon: number): Promise<ComparePoint[]> {
  const mlBase = process.env.NEXT_PUBLIC_ML_API;
/*   if (!mlBase) throw new Error("Missing env: NEXT_PUBLIC_ML_API"); */
 console.log(mlBase)

  const res = await fetch(`${mlBase}/compare/lstm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candles),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML API failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const series: ComparePoint[] = json.series ?? [];
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error("No series returned from /compare/lstm");
  }

  return series;
}
