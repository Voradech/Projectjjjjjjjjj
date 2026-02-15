import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", 
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendAlertEmail = async (
  to: string,
  message: string
) => {
  await transporter.sendMail({
    from: `"BTC Alert" <${process.env.EMAIL_USER}>`,
    to,
    subject: "BTC Alert Triggered 🚨",
    html: `
      <h2>BTC Alert Triggered</h2>
      <p>${message}</p>
    `,
  });
};