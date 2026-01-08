import { Router } from "express";
import { db } from "../db";
import bcrypt from "bcrypt";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // ดึง user จาก DB
    const result = await db.query(
      "SELECT id, username, password_hash, role FROM users WHERE username = $1",
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // เทียบรหัสผ่าน
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // ส่งข้อมูลกลับไปให้ Next.js
    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
