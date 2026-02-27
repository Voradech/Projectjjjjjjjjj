"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSystemAlertStatus = exports.getSystemAlertStatus = void 0;
const pool_1 = require("../db/pool");
/* ================= GET ================= */
const getSystemAlertStatus = async (_, res) => {
    const { rows } = await pool_1.pool.query(`SELECT global_alert_enabled 
     FROM system_settings 
     WHERE id = 1`);
    // ถ้ายังไม่มี row → สร้าง default ให้เลย
    if (!rows.length) {
        await pool_1.pool.query(`INSERT INTO system_settings (id, global_alert_enabled)
       VALUES (1, true)`);
        return res.json({ global_alert_enabled: true });
    }
    res.json(rows[0]);
};
exports.getSystemAlertStatus = getSystemAlertStatus;
/* ================= UPDATE ================= */
const updateSystemAlertStatus = async (req, res) => {
    const { enabled } = req.body;
    // 🔒 กัน null / undefined
    if (typeof enabled !== "boolean") {
        return res.status(400).json({
            message: "enabled must be boolean",
        });
    }
    // 🔥 UPSERT กันพัง
    await pool_1.pool.query(`
    INSERT INTO system_settings (id, global_alert_enabled, updated_at)
    VALUES (1, $1, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      global_alert_enabled = EXCLUDED.global_alert_enabled,
      updated_at = NOW()
    `, [enabled]);
    res.json({
        message: "System alert updated",
        enabled,
    });
};
exports.updateSystemAlertStatus = updateSystemAlertStatus;
