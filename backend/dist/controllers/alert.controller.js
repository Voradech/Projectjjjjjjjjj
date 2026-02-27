"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAlert = exports.deleteAlert = exports.getMyNotifications = exports.getMyAlerts = exports.createAlert = void 0;
const pool_1 = require("../db/pool");
const createAlert = async (req, res) => {
    try {
        const user = req.user;
        const { type, target_price, percentage, time_window } = req.body;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!type) {
            return res.status(400).json({ message: "Alert type required" });
        }
        const { rows } = await pool_1.pool.query(`INSERT INTO alerts 
       (user_id, type, target_price, percentage, time_window)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [
            user.id,
            type,
            target_price || null,
            percentage || null,
            time_window || null,
        ]);
        res.status(201).json(rows[0]);
    }
    catch (error) {
        console.error("createAlert error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.createAlert = createAlert;
const getMyAlerts = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { rows } = await pool_1.pool.query(`SELECT * FROM alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`, [user.id]);
        res.json(rows);
    }
    catch (error) {
        console.error("getMyAlerts error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getMyAlerts = getMyAlerts;
const getMyNotifications = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { rows } = await pool_1.pool.query(`SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`, [user.id]);
        res.json(rows);
    }
    catch (error) {
        console.error("getMyNotifications error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getMyNotifications = getMyNotifications;
const deleteAlert = async (req, res) => {
    const alertId = req.params.id;
    const userId = req.user.id;
    const result = await pool_1.pool.query(`DELETE FROM alerts 
     WHERE id = $1 AND user_id = $2`, [alertId, userId]);
    if (result.rowCount === 0) {
        return res.status(404).json({ message: "Alert not found" });
    }
    res.json({ message: "Alert deleted" });
};
exports.deleteAlert = deleteAlert;
const updateAlert = async (req, res) => {
    const { is_active } = req.body;
    await pool_1.pool.query(`UPDATE alerts
     SET is_active = $1
     WHERE id = $2 AND user_id = $3`, [is_active, req.params.id, req.user.id]);
    res.json({ message: "Alert updated" });
};
exports.updateAlert = updateAlert;
