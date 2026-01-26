import axios from "axios";

const API_BASE = "http://localhost:8001";

// ---------- TYPES ----------
export type ModelType = "rf" | "gb" | "lstm" | "ensemble";

export interface PriceInput {
  open: number;
  high: number;
  low: number;
  volume: number;
  quote_asset_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
  sentiment?: number;
}

export interface Candle extends PriceInput {
  time: number;
  close: number;
}
export type TrendResult = {
  model: string;
  horizon: string;
  signal: "BUY" | "SELL" | "HOLD";
  trend?: "UP" | "DOWN";
  confidence?: number;
  explain?: string;
  results?: {
    rf: TrendResult;
    gb: TrendResult;
    lstm: TrendResult;
  };
};

// ---------- CORE FUNCTION ----------
export async function predictTrend(
  model: ModelType,
  payload: PriceInput,
  options?: {
    candles?: Candle[];
    horizon?: number;
  }
): Promise<TrendResult> {
  const horizon = options?.horizon ?? 1;

  // ---------- LSTM ----------
  if (model === "lstm") {
    if (!options?.candles || options.candles.length <= 30) {
      throw new Error("LSTM requires candle history (>30)");
    }

    const res = await axios.post(
      `${API_BASE}/predict/lstm`,
      options.candles,
      { params: { horizon } }
    );

    return res.data;
  }

  // ---------- RF / GB ----------
  if (model === "rf" || model === "gb") {
    const res = await axios.post(
      `${API_BASE}/predict`,
      payload,
      {
        params: {
          model,
          horizon,
        },
      }
    );

    return res.data;
  }

  // ---------- ENSEMBLE (future ready) ----------
  if (model === "ensemble") {
    const [rf, gb, lstm] = await Promise.all([
      predictTrend("rf", payload, { horizon }),
      predictTrend("gb", payload, { horizon }),
      predictTrend("lstm", payload, {horizon} ),
    ]);

    return {
      model: "ensemble",
      horizon: `t+${horizon}`,
      signal: rf.signal,
      results: { rf, gb, lstm },
    };
  }

  throw new Error("Invalid model type");
}
