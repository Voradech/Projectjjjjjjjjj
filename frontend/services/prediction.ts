// src/services/prediction.ts
const API_BASE = "http://localhost:8001";

/* ======================
   TYPES
====================== */
export type PredictTrendResult = {
  model: string;
  predictions: Record<string, number>;
  trend: "UP" | "DOWN" | "SIDEWAY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type LSTMPredictionPoint = {
  time: number;
  predicted_return: number;
};

export type LSTMResult = {
  model: "lstm";
  horizon: string;
  trend: string;
  confidence: string;
  series: LSTMPredictionPoint[];
};

/* ======================
   RF / GB (single point)
====================== */
export async function predictTree(
  payload: any,
  model: "rf" | "gb" = "rf",
  horizon = 1
) {
  const res = await fetch(
    `${API_BASE}/predict?model=${model}&horizon=${horizon}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/* ======================
   LSTM (series)
====================== */
export async function predictLSTM(
  candles: any[],
  horizon = 1
): Promise<LSTMResult> {
  const res = await fetch(
    `${API_BASE}/predict/lstm?horizon=${horizon}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candles),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/* ======================
   TREND SUMMARY
====================== */
export async function predictTrend(
  rows: any[],
  model: "rf" | "gb" = "rf"
): Promise<PredictTrendResult> {
  const res = await fetch(
    `${API_BASE}/predict/trend?model=${model}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
