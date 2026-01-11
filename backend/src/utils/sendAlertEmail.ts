import { mailer } from "./mailer";

export async function sendAlertEmail(
  to: string,
  price: number,
  condition: string
) {
  const text =
    condition === "above"
      ? `ราคา BTC สูงกว่า ${price}`
      : `ราคา BTC ต่ำกว่า ${price}`;

  await mailer.sendMail({
    from: `"PredictBitcoin" <${process.env.SMTP_USER}>`,
    to,
    subject: "🔔 Bitcoin Price Alert",
    html: `
      <h2>แจ้งเตือนราคา Bitcoin</h2>
      <p>${text}</p>
      <p>เช็คระบบได้ที่ PredictBitcoin</p>
    `,
  });
}
