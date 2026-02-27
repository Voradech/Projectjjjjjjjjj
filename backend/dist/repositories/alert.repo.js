"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRepo = void 0;
// repositories/alert.repo.ts
const db_1 = require("../db");
exports.AlertRepo = {
    async getActiveAlerts() {
        const { rows } = await db_1.db.query(`
      SELECT a.*
      FROM alerts a
      JOIN user_alert_settings u
        ON u.user_id = a.user_id
      WHERE a.is_active = true
        AND u.alerts_enabled = true
    `);
        return rows;
    },
    async logAlert(alertId, data) {
        await db_1.db.query(`
      INSERT INTO alert_logs
        (alert_id, trigger_value, trigger_percent, trigger_trend, confidence)
      VALUES ($1, $2, $3, $4, $5)
      `, [
            alertId,
            data.value ?? null,
            data.percent ?? null,
            data.trend ?? null,
            data.confidence ?? null,
        ]);
    },
    async updateLastTriggered(alertId) {
        await db_1.db.query(`
      UPDATE alerts
      SET last_triggered_at = now()
      WHERE id = $1
      `, [alertId]);
    },
};
