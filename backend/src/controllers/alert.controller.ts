import { Request, Response } from "express";
import { pool } from "../db/pool";

export const createAlert = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const { type, target_price, percentage, time_window, confidence_threshold } = req.body;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!type) {
      return res.status(400).json({ message: "Alert type required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO alerts 
       (user_id, type, target_price, percentage, time_window, confidence_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user.id,
        type,
        target_price ? Number(target_price) : null,
        percentage ? Number(percentage) : null,
        time_window ? Number(time_window) : null,
        confidence_threshold ? Number(confidence_threshold) : null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("createAlert error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyAlerts = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT * FROM alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("getMyAlerts error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("getMyNotifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteAlert = async (req: Request, res: Response) => {
  const alertId = req.params.id;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const result = await pool.query(
    `DELETE FROM alerts 
     WHERE id = $1 AND user_id = $2`,
    [alertId, user.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Alert not found" });
  }

  res.json({ message: "Alert deleted" });
};

export const updateAlert = async (req: Request, res: Response) => {
  const { is_active } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await pool.query(
    `UPDATE alerts
     SET is_active = $1
     WHERE id = $2 AND user_id = $3`,
    [is_active, req.params.id, user.id]
  );

  res.json({ message: "Alert updated" });
};
