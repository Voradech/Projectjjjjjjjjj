// services/prediction.ts

const API_BASE = "http://localhost:8001";

// ================= TYPES =================

export type ModelType = "rf" | "gb" | "lstm";
export type Horizon = 1 | 7 | 14;

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_asset_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
  sentiment?: number;
}

// ---------- RF / GB ----------
export interface TreePredictResponse {
  model: string;
  horizon: string;
  predicted_return: number;
  trend: "UP" | "DOWN";
}

// ---------- TREND (RF / GB multi-horizon) ----------
export interface TrendPredictResponse {
  model: string;
  predictions: Record<string, number>;
  trend: "UP" | "DOWN" | "SIDEWAY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// ---------- LSTM ----------
export interface LSTMPredictResponse {
  model: "lstm";
  horizon: string;
  trend: "UP" | "DOWN" | "SIDEWAY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  series: {
    time: number;
    predicted_return: number;
    trend: "UP" | "DOWN";
  }[];
}

// ================= API CALLS =================

// ---------- RF / GB (single horizon return) ----------
export async function predictTree(
  model: "rf" | "gb",
  candle: Candle,
  horizon: Horizon
): Promise<TreePredictResponse> {
  const res = await fetch(
    `${API_BASE}/predict?model=${model}&horizon=${horizon}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candle),
    }
  );

  if (!res.ok) {
    throw new Error("Tree prediction failed");
  }

  return res.json();
}

// ---------- RF / GB (trend decision support) ----------
export async function predictTrend(
  model: "rf" | "gb",
  candle: Candle
): Promise<TrendPredictResponse> {
  const res = await fetch(
    `${API_BASE}/predict/trend?model=${model}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candle),
    }
  );

  if (!res.ok) {
    throw new Error("Trend prediction failed");
  }

  return res.json();
}

// ---------- LSTM (series + trend) ----------
export async function predictLSTM(
  candles: Candle[],
  horizon: Horizon
): Promise<LSTMPredictResponse> {
  const res = await fetch(
    `${API_BASE}/predict/lstm?horizon=${horizon}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candles),
    }
  );

  if (!res.ok) {
    throw new Error("LSTM prediction failed");
  }

  return res.json();
}
export async function predictTrendWithHistory(
  model: "rf" | "gb",
  candles: Candle[]
): Promise<TrendPredictResponse> {
  const res = await fetch(
    `${API_BASE}/predict/trend?model=${model}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candles),
    }
  );

  if (!res.ok) {
    throw new Error("Trend prediction failed");
  }

  return res.json();
}
