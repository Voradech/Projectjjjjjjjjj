import { Request, Response } from "express";
import { pool } from "../db/pool";

/* ================= GET ================= */

export const getSystemAlertStatus = async (_: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT global_alert_enabled 
     FROM system_settings 
     WHERE id = 1`
  );

  // ถ้ายังไม่มี row → สร้าง default ให้เลย
  if (!rows.length) {
    await pool.query(
      `INSERT INTO system_settings (id, global_alert_enabled)
       VALUES (1, true)`
    );

    return res.json({ global_alert_enabled: true });
  }

  res.json(rows[0]);
};

/* ================= UPDATE ================= */

export const updateSystemAlertStatus = async (
  req: Request,
  res: Response
) => {
  const { enabled } = req.body;

  // 🔒 กัน null / undefined
  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      message: "enabled must be boolean",
    });
  }

  // 🔥 UPSERT กันพัง
  await pool.query(
    `
    INSERT INTO system_settings (id, global_alert_enabled, updated_at)
    VALUES (1, $1, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      global_alert_enabled = EXCLUDED.global_alert_enabled,
      updated_at = NOW()
    `,
    [enabled]
  );

  res.json({
    message: "System alert updated",
    enabled,
  });
};