const API_BASE = process.env.NEXT_PUBLIC_ML_API || "http://localhost:8001";

export interface PriceInput {
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

export interface Candle extends PriceInput {
  time: number; // unix timestamp (sec)
}


export interface PredictionRequest {
  horizon: 1 | 7 | 14; // จำนวนวันที่ต้องการทำนาย
  use_latest_data?: boolean; // default: true
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  direction_accuracy: number;
}

export interface PredictionResult {
  current_price: number;
  current_date: string;
  predicted_price: number;
  predicted_date: string;
  predicted_return: number;
  predicted_return_pct: number;
  direction: "UP" | "DOWN";
  price_change: number;
  price_change_pct: number;
}

export interface PredictionMetadata {
  model_used: string;
  features_count: number;
  data_points_used: number;
  latest_data_date: string;
  prediction_timestamp: string;
}

export interface PredictionResponse {
  horizon: number;
  best_model: string;
  model_metrics: ModelMetrics;
  prediction: PredictionResult;
  metadata: PredictionMetadata;
  backtest_series: {
    date: string
    price: number
  }[];
}

export interface AvailableModel {
  horizon_days: number;
  best_model: string;
  best_model_metrics: ModelMetrics;
  all_models: string[];

}

export interface ModelsResponse {
  [key: string]: AvailableModel;
}

export interface AllMetrics {
  [horizonKey: string]: {
    [modelName: string]: ModelMetrics;
  };
}

// ============= API Functions =============

/**
 * ทำนายราคา Bitcoin ในอนาคต
 * @param horizon จำนวนวัน (1, 7, หรือ 14)
 * @returns ผลการทำนายพร้อมข้อมูลโมเดล
 */
export async function predictPrice(
  horizon: 1 | 7 | 14
): Promise<PredictionResponse> {
  const response = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      horizon,
      use_latest_data: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get prediction");
  }

  return response.json();
}

export async function getAvailableModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE}/models`);

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  return response.json();
}

export async function getAllMetrics(): Promise<AllMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);

  if (!response.ok) {
    throw new Error("Failed to fetch metrics");
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error("API is not healthy");
  }

  return response.json();
}

/**
 * ทำนายราคาสำหรับหลาย horizons พร้อมกัน
 * @param horizons array ของ horizon ที่ต้องการทำนาย
 */
export async function predictMultipleHorizons(
  horizons: (1 | 7 | 14)[]
): Promise<PredictionResponse[]> {
  const promises = horizons.map((h) => predictPrice(h));
  return Promise.all(promises);
}

// ============= Helper Functions =============

export function formatDirectionAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(2)}%`;
}

export function formatPriceChange(change: number, percentage: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}$${change.toFixed(2)} (${sign}${percentage.toFixed(2)}%)`;
}

export function formatReturnPct(returnPct: number): string {
  const sign = returnPct >= 0 ? "+" : "";
  return `${sign}${returnPct.toFixed(2)}%`;
}

/**
 * ตรวจสอบว่าโมเดลมีความแม่นยำดีพอหรือไม่
 * @param directionAccuracy ความแม่นยำในการทำนายทิศทาง (0-1)
 * @param threshold เกณฑ์ขั้นต่ำ (default: 0.55 = 55%)
 */
export function isModelReliable(
  directionAccuracy: number,
  threshold: number = 0.55
): boolean {
  return directionAccuracy >= threshold;
}


export function selectBestModel(metrics: {
  [modelName: string]: ModelMetrics;
}): string {
  let bestModel = "";
  let highestDirectionAcc = 0;

  Object.entries(metrics).forEach(([modelName, metric]) => {
    if (metric.direction_accuracy > highestDirectionAcc) {
      highestDirectionAcc = metric.direction_accuracy;
      bestModel = modelName;
    }
  });

  return bestModel;
}