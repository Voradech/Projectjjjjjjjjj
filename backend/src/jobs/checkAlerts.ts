import { pool } from "../db/pool";
import { getKlines, Kline } from "../services/price.service";
import axios from "axios";
import { sendAlertEmail } from "../services/mail.service";
import { io } from "../server";

let isChecking = false;

/* ================= Prediction Cache ================= */

let cachedPrediction:
  | { direction: "UP" | "DOWN"; confidence: number }
  | null = null;

let lastPredictionTime = 0;
const PREDICTION_TTL = 5 * 60 * 1000; // 5 นาที

/* ================= Email Cooldown ================= */

const emailCooldown = new Map<string, number>();
const EMAIL_COOLDOWN_MS = 60 * 1000; // 1 นาทีต่อ user

/* ================= EMA ================= */

const calculateEMA = (prices: number[], period: number) => {
  if (prices.length < period) return [];

  const k = 2 / (period + 1);
  const emaArray: number[] = [];

  const sma =
    prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  emaArray[period - 1] = sma;

  for (let i = period; i < prices.length; i++) {
    emaArray[i] =
      prices[i] * k + emaArray[i - 1] * (1 - k);
  }

  return emaArray;
};

/* ================= Prediction ================= */

const getPredictionResult = async (): Promise<{
  direction: "UP" | "DOWN";
  confidence: number;
}> => {
  const response = await axios.post(
    "http://localhost:8001/predict",
    { horizon: 1, use_latest_data: true },
    { timeout: 10000 }
  );

  return {
    direction: response.data.prediction.direction,
    confidence: Math.abs(
      response.data.prediction.predicted_return_pct
    ),
  };
};

/* ================= Main ================= */

export const checkAlerts = async () => {
  if (isChecking) return;
  isChecking = true;

  const startTime = Date.now();

  try {
    /* ---------- Global Toggle ---------- */

    const { rows: systemRows } = await pool.query(
      `SELECT global_alert_enabled FROM system_settings LIMIT 1`
    );

    if (!systemRows.length || !systemRows[0].global_alert_enabled) {
      return;
    }

    /* ---------- Market Data ---------- */

    const baseKlines: Kline[] = await getKlines({
      interval: "1m",
      limit: 30,
    });

    if (baseKlines.length < 15) return;

    const currentPrice =
      baseKlines[baseKlines.length - 1].close;

    /* ---------- Active Alerts ---------- */

    const { rows: alerts } = await pool.query(
      `SELECT * FROM alerts WHERE is_active = true`
    );

    if (!alerts.length) return;

    /* ---------- Preload Users (IMPORTANT FIX) ---------- */

    const { rows: users } = await pool.query(
      `SELECT id, email FROM users`
    );

    const userMap = new Map(
      users.map((u) => [u.id, u.email])
    );

    /* ---------- Prediction Cache ---------- */

    let prediction:
      | { direction: "UP" | "DOWN"; confidence: number }
      | null = null;

    const hasPredictionAlert = alerts.some(
      (a) =>
        a.type === "PREDICT_UP" ||
        a.type === "PREDICT_DOWN"
    );

    if (hasPredictionAlert) {
      const now = Date.now();

      if (
        cachedPrediction &&
        now - lastPredictionTime < PREDICTION_TTL
      ) {
        prediction = cachedPrediction;
      } else {
        try {
          const fresh = await getPredictionResult();
          cachedPrediction = fresh;
          lastPredictionTime = now;
          prediction = fresh;
        } catch {
          prediction = cachedPrediction;
        }
      }
    }

    /* ================= Loop ================= */

    for (const alert of alerts) {
      let triggered = false;

      // PRICE_UP
      if (
        alert.type === "PRICE_UP" &&
        alert.target_price !== null &&
        currentPrice >= alert.target_price
      ) triggered = true;

      // PRICE_DOWN
      if (
        alert.type === "PRICE_DOWN" &&
        alert.target_price !== null &&
        currentPrice <= alert.target_price
      ) triggered = true;

      // VOLATILITY
      if (alert.type === "VOLATILITY") {
        const minutes = alert.time_window;
        const percentage = alert.percentage;

        if (
          minutes &&
          percentage &&
          minutes <= baseKlines.length
        ) {
          const slice = baseKlines.slice(-minutes);

          const change =
            ((slice[slice.length - 1].close -
              slice[0].open) /
              slice[0].open) *
            100;

          if (Math.abs(change) >= percentage)
            triggered = true;
        }
      }

      // TREND_CHANGE
      if (alert.type === "TREND_CHANGE") {
        const closes = baseKlines.map((k) => k.close);

        const ema7 = calculateEMA(closes, 7);
        const ema14 = calculateEMA(closes, 14);

        const prev = closes.length - 2;
        const curr = closes.length - 1;

        if (
          ema7[prev] !== undefined &&
          ema14[prev] !== undefined &&
          (
            (ema7[prev] < ema14[prev] &&
              ema7[curr] > ema14[curr]) ||
            (ema7[prev] > ema14[prev] &&
              ema7[curr] < ema14[curr])
          )
        ) {
          triggered = true;
        }
      }

      // PREDICT_UP
      if (
        alert.type === "PREDICT_UP" &&
        prediction &&
        prediction.direction === "UP" &&
        prediction.confidence >=
          (alert.confidence_threshold ?? 0)
      ) triggered = true;

      // PREDICT_DOWN
      if (
        alert.type === "PREDICT_DOWN" &&
        prediction &&
        prediction.direction === "DOWN" &&
        prediction.confidence >=
          (alert.confidence_threshold ?? 0)
      ) triggered = true;

      /* ---------- TRIGGER ---------- */

      if (triggered) {

        // Insert notification
        const result = await pool.query(
          `INSERT INTO notifications (user_id, alert_id, message)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [
            alert.user_id,
            alert.id,
            `BTC hit ${currentPrice} (${alert.type})`,
          ]
        );

        const notification = result.rows[0];

        // Realtime
        io.to(`user_${alert.user_id}`).emit(
          "new_notification",
          notification
        );

        /* ---------- Email (Improved) ---------- */

        try {
          const email = userMap.get(alert.user_id);

          if (email) {
            const now = Date.now();
            const lastSent = emailCooldown.get(alert.user_id);

            if (
              !lastSent ||
              now - lastSent > EMAIL_COOLDOWN_MS
            ) {
              await sendAlertEmail(
                email,
                `BTC hit ${currentPrice} (${alert.type})`
              );

              emailCooldown.set(alert.user_id, now);
            }
          }
        } catch (mailErr) {
          console.log("Email failed:", mailErr);
        }

        // Disable alert
        await pool.query(
          `UPDATE alerts SET is_active = false WHERE id = $1`,
          [alert.id]
        );
      }
    }

    console.log(
      `✅ checkAlerts finished in ${Date.now() - startTime} ms`
    );

  } catch (error) {
    console.error("❌ checkAlerts error:", error);
  } finally {
    isChecking = false;
  }
};