import { pool } from "../db/pool";
import { getKlines, Kline } from "../services/price.service";
import axios from "axios";
import { sendAlertEmail } from "../services/mail.service";
import { io } from "../server";

let isChecking = false;

/* ================= Prediction Cache ================= */
let cachedPrediction: { direction: "UP" | "DOWN"; confidence: number } | null = null;
let lastPredictionTime = 0;
const PREDICTION_TTL = 60 * 1000;

/* ================= Email Cooldown ================= */
const emailCooldown = new Map<string, number>();
const EMAIL_COOLDOWN_MS = 60 * 1000;

/* ================= Helpers ================= */

const calculateEMA = (prices: number[], period: number) => {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaArray[period - 1] = sma;
  for (let i = period; i < prices.length; i++) {
    emaArray[i] = prices[i] * k + emaArray[i - 1] * (1 - k);
  }
  return emaArray;
};

// ฟังก์ชันสร้างข้อความแจ้งเตือน
const getAlertMessage = (type: string, price: number) => {
  const formattedPrice = price.toLocaleString(undefined, { minimumFractionDigits: 2 });
  switch (type) {
    case "PRICE_UP":
      return `🚀 ราคา BTC ทะลุเป้าหมายขาขึ้น! ปัจจุบันอยู่ที่ $${formattedPrice}`;
    case "PRICE_DOWN":
      return `⚠️ ราคา BTC ลดลงถึงเป้าหมายขาลง! ปัจจุบันอยู่ที่ $${formattedPrice}`;
    case "VOLATILITY":
      return `📉 แจ้งเตือน: พบความผันผวนของราคาผิดปกติ ($${formattedPrice})`;
    case "TREND_CHANGE":
      return `🔄 แจ้งเตือน: แนวโน้มราคา (EMA) มีการกลับตัวที่ราคา $${formattedPrice}`;
    case "PREDICT_UP":
      return `🤖 AI คาดการณ์: ราคามีแนวโน้ม "ขาขึ้น" (ราคาปัจจุบัน: $${formattedPrice})`;
    case "PREDICT_DOWN":
      return `🤖 AI คาดการณ์: ราคามีแนวโน้ม "ขาลง" (ราคาปัจจุบัน: $${formattedPrice})`;
    default:
      return `📢 แจ้งเตือนระบบ: BTC อยู่ที่ราคา $${formattedPrice}`;
  }
};

/* ================= Prediction ================= */

const getPredictionResult = async (): Promise<{ direction: "UP" | "DOWN"; confidence: number }> => {
  const response = await axios.post(
    "http://localhost:8001/predict",
    { horizon: 1, use_latest_data: true },
    { timeout: 10000 }
  );
  return {
    direction: response.data.prediction.direction,
    confidence: Math.abs(response.data.prediction.predicted_return_pct),
  };
};

/* ================= Main Logic ================= */

export const checkAlerts = async () => {
  if (isChecking) return;
  isChecking = true;

  try {
    const { rows: systemRows } = await pool.query(
      `SELECT global_alert_enabled FROM system_settings LIMIT 1`
    );
    if (!systemRows.length || !systemRows[0].global_alert_enabled) return;

    const baseKlines: Kline[] = await getKlines({ interval: "1m", limit: 30 });
    if (baseKlines.length < 15) return;

    const currentPrice = baseKlines[baseKlines.length - 1].close;

    const { rows: alerts } = await pool.query(`SELECT * FROM alerts WHERE is_active = true`);
    if (!alerts.length) return;

    const { rows: users } = await pool.query(`SELECT id, email FROM users`);
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    let prediction: { direction: "UP" | "DOWN"; confidence: number } | null = null;
    const hasPredictionAlert = alerts.some(a => a.type === "PREDICT_UP" || a.type === "PREDICT_DOWN");

    if (hasPredictionAlert) {
      const now = Date.now();
      if (cachedPrediction && now - lastPredictionTime < PREDICTION_TTL) {
        prediction = cachedPrediction;
      } else {
        try {
          prediction = await getPredictionResult();
          cachedPrediction = prediction;
          lastPredictionTime = now;
        } catch {
          prediction = cachedPrediction;
        }
      }
    }

    for (const alert of alerts) {
      let triggered = false;

      if (alert.type === "PRICE_UP" && alert.target_price !== null && currentPrice >= alert.target_price) triggered = true;
      if (alert.type === "PRICE_DOWN" && alert.target_price !== null && currentPrice <= alert.target_price) triggered = true;

      if (alert.type === "VOLATILITY" && alert.time_window && alert.percentage && alert.time_window <= baseKlines.length) {
        const slice = baseKlines.slice(-alert.time_window);
        const change = ((slice[slice.length - 1].close - slice[0].open) / slice[0].open) * 100;
        if (Math.abs(change) >= alert.percentage) triggered = true;
      }

      if (alert.type === "TREND_CHANGE") {
        const closes = baseKlines.map((k) => k.close);
        const ema7 = calculateEMA(closes, 7);
        const ema14 = calculateEMA(closes, 14);
        const prev = closes.length - 2;
        const curr = closes.length - 1;
        if (ema7[prev] !== undefined && ema14[prev] !== undefined &&
          ((ema7[prev] < ema14[prev] && ema7[curr] > ema14[curr]) || 
           (ema7[prev] > ema14[prev] && ema7[curr] < ema14[curr]))) {
          triggered = true;
        }
      }

      if (alert.type === "PREDICT_UP" && prediction?.direction === "UP" && prediction.confidence >= (alert.confidence_threshold ?? 0)) triggered = true;
      if (alert.type === "PREDICT_DOWN" && prediction?.direction === "DOWN" && prediction.confidence >= (alert.confidence_threshold ?? 0)) triggered = true;

      if (triggered) {
        const displayMessage = getAlertMessage(alert.type, currentPrice);

        // 1. Save Notification
        const result = await pool.query(
          `INSERT INTO notifications (user_id, alert_id, message) VALUES ($1, $2, $3) RETURNING *`,
          [alert.user_id, alert.id, displayMessage]
        );

        // 2. Realtime Socket.io
        io.to(`user_${alert.user_id}`).emit("new_notification", result.rows[0]);

        // 3. Send Email with Cooldown
        const email = userMap.get(alert.user_id);
        if (email) {
          const now = Date.now();
          const lastSent = emailCooldown.get(alert.user_id);

          if (!lastSent || now - lastSent > EMAIL_COOLDOWN_MS) {
            try {
              // ส่ง displayMessage ที่ถูกเจนใหม่เข้าไปแทนข้อความเดิม
              await sendAlertEmail(email, displayMessage); 
              emailCooldown.set(alert.user_id, now);
            } catch (mailErr) {
              console.error("Email failed:", mailErr);
            }
          }
        }

        // 4. Disable alert
      /*   await pool.query(`UPDATE alerts SET is_active = false WHERE id = $1`, [alert.id]); */
      }
    }
  } catch (error) {
    console.error("❌ checkAlerts error:", error);
  } finally {
    isChecking = false;
  }
};