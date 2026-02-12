import { Request, Response } from "express";
import { pool } from "../db/pool";

export const createAlert = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const { type, target_price, percentage, time_window } = req.body;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!type) {
      return res.status(400).json({ message: "Alert type required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO alerts 
       (user_id, type, target_price, percentage, time_window)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        user.id,
        type,
        target_price || null,
        percentage || null,
        time_window || null,
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