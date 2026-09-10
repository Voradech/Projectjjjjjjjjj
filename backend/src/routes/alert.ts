import { Router } from "express";
import { pool } from "../db/pool";
import { sendAlertEmail } from "../services/mail.service";
import { io } from "../server";
import { authRequired } from "../middlewares/authRequired";
import {
  getMyNotifications,
  deleteAlert,
  getMyAlerts,
  createAlert,
  updateAlert,
} from "../controllers/alert.controller";

const router = Router();

router.post("/", authRequired, createAlert);
router.get("/", authRequired, getMyAlerts);
router.get("/notifications", authRequired, getMyNotifications);
router.patch("/:id", authRequired, updateAlert);
router.delete("/:id", authRequired, deleteAlert);

// Test alert — triggers a notification + email for the logged-in user
router.post("/test-alert", authRequired, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const message = `🚨 TEST ALERT: BTC is testing at ${new Date().toISOString()}`;

    const result = await pool.query(
      `INSERT INTO notifications (user_id, message)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, message]
    );

    // Realtime push
    io.to(`user_${userId}`).emit("new_notification", result.rows[0]);

    // Email notification
    if (email) {
      await sendAlertEmail(email, message);
    }

    res.json({ message: "Test alert sent 🚀" });
  } catch (err) {
    console.error("Test alert error:", err);
    res.status(500).json({ message: "Error sending test alert" });
  }
});

export default router;