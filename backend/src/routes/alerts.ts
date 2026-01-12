 import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

/** health check */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, message: "alerts api working" });
});

/** create alert */
router.post("/", async (req, res) => {
  try {
    const { user_id, target_price, condition } = req.body;

    if (!user_id || !target_price || !condition) {
      return res.status(400).json({ message: "missing fields" });
    }

    await pool.query(
      `
      INSERT INTO alerts (user_id, symbol, target_price, condition)
      VALUES ($1, 'BTCUSDT', $2, $3)
      `,
      [user_id, target_price, condition]
    );

    res.json({ message: "alert created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "server error" });
  }
});

/** list alerts */
router.get("/", async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "user_id required" });
  }

  const result = await pool.query(
    `
    SELECT id, symbol, target_price, condition, created_at
    FROM alerts
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [user_id]
  );

  res.json(result.rows);
});

export default router;
