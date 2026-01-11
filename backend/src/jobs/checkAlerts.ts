import { pool } from "../db/pool";
import fetch from "node-fetch";
import { sendAlertEmail } from "../utils/sendAlertEmail";

export async function checkAlerts() {
  // ดึงราคาปัจจุบัน
  const priceRes = await fetch("http://localhost:8000/api/price/BTCUSDT");
  const priceData = await priceRes.json();
  const currentPrice = priceData.price;

  const alerts = await pool.query(
    `
    SELECT a.*, u.email
    FROM alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.triggered_at IS NULL
    `
  );

  for (const alert of alerts.rows) {
    const hit =
      (alert.condition === "above" && currentPrice >= alert.target_price) ||
      (alert.condition === "below" && currentPrice <= alert.target_price);

    if (hit) {
      // ส่ง Email
      await sendAlertEmail(
        alert.email,
        alert.target_price,
        alert.condition
      );

      // mark ว่ายิงแล้ว
      await pool.query(
        `
        UPDATE alerts
        SET triggered_at = NOW()
        WHERE id = $1
        `,
        [alert.id]
      );

      console.log("EMAIL SENT:", alert.email);
    }
  }
}
