"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertEmail = exports.transporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
exports.transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const sendAlertEmail = async (to, message) => {
    await exports.transporter.sendMail({
        from: `"BTC Alert" <${process.env.EMAIL_USER}>`,
        to,
        subject: "BTC Price Alert Notification",
        html: `
      <h2>BTC Alert Triggered</h2>
      <p>${message}</p>
    `,
    });
};
exports.sendAlertEmail = sendAlertEmail;
