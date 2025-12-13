// services/predict.ts
import { apiFetch } from "./api";

export type PredictPayload = {
  open: number;
  high: number;
  low: number;
  volume: number;
  quote_asset_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
};

export function predictRF(payload: PredictPayload) {
  return apiFetch<{
    predicted_close: number;
  }>("/predict?model=rf", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function predictGB(payload: PredictPayload) {
  return apiFetch<{
    predicted_close: number;
  }>("/predict?model=gb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMetrics() {
  return apiFetch("/metrics");
}
