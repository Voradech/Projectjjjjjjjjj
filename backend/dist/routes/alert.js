"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const mail_service_1 = require("../services/mail.service");
const server_1 = require("../server");
const authRequired_1 = require("../middlewares/authRequired");
const alert_controller_1 = require("../controllers/alert.controller");
const router = (0, express_1.Router)();
router.post("/", authRequired_1.authRequired, alert_controller_1.createAlert);
router.get("/", authRequired_1.authRequired, alert_controller_1.getMyAlerts);
router.get("/notifications", authRequired_1.authRequired, alert_controller_1.getMyNotifications);
router.patch("/:id", authRequired_1.authRequired, alert_controller_1.updateAlert);
router.delete("/:id", authRequired_1.authRequired, alert_controller_1.deleteAlert);
router.post("/test-alert", authRequired_1.authRequired, async (req, res) => {
    try {
        const userId = req.user.id;
        // 🔹 ดึง email user
        const { rows } = await pool_1.pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
        const email = rows[0]?.email;
        const message = `🚨 TEST ALERT: BTC is testing at ${Date.now()}`;
        // 🔹 Insert notification
        const result = await pool_1.pool.query(`INSERT INTO notifications (user_id, message)
       VALUES ($1, $2)
       RETURNING *`, [userId, message]);
        const notification = result.rows[0];
        // 🔹 ยิง realtime
        server_1.io.to(`user_${userId}`).emit("new_notification", notification);
        // 🔹 ส่งเมล
        if (email) {
            await (0, mail_service_1.sendAlertEmail)(email, message);
        }
        res.json({ message: "Test alert sent 🚀" });
    }
    catch (err) {
        console.error("Test alert error:", err);
        res.status(500).json({ message: "Error sending test alert" });
    }
});
exports.default = router;
