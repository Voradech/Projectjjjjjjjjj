import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/pool";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { authRequired } from "../middlewares/authRequired";

export const authRouter = Router();

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd, // prod ต้อง https
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge:
      Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14) * 24 * 60 * 60 * 1000,
  };
}

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body as {
      email?: string;
      password?: string;
      username?: string;
    };

    if (!email || !password || !username) {
      return res.status(400).json({ message: "email/password/username required" });
    }

    const passwordHash = await hashPassword(password);

  const emailNorm = email.trim().toLowerCase();

const result = await pool.query(
  `INSERT INTO users (email, password_hash, username)
   VALUES ($1, $2, $3)
   RETURNING id, email, username, created_at`,
  [emailNorm, passwordHash, username]
);
    return res.status(201).json({ user: result.rows[0] });
  } catch (e: any) {
    console.error("REGISTER ERROR:", e);

    if (e.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }

    return res.status(500).json({ message: "Server error" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password)
      return res.status(400).json({ message: "email/password required" });

    const userRes = await pool.query(
      `SELECT id, email, password_hash FROM users WHERE email=$1`,
      [email.toLowerCase()]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const payload = { sub: user.id, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = sha256(refreshToken);
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);

    // ใช้ interval แบบ integer ชัวร์กว่า
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * interval '1 day'))`,
      [user.id, tokenHash, days]
    );

    res.cookie("refreshToken", refreshToken, refreshCookieOptions());
    return res.json({ accessToken });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token)
      return res.status(401).json({ message: "Missing refresh token" });

    const payload = verifyRefreshToken(token);
    if (!payload || typeof payload !== "object") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenHash = sha256(token);

    const dbRes = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (dbRes.rowCount === 0) {
      return res.status(401).json({ message: "Refresh token revoked/expired" });
    }

    const newAccess = signAccessToken({
      sub: payload.sub,
      email: payload.email,
    });
    return res.json({ accessToken: newAccess });
  } catch (e) {
    console.error("REFRESH ERROR:", e);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;

    if (token) {
      const tokenHash = sha256(token);
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at=NOW()
         WHERE token_hash=$1 AND revoked_at IS NULL`,
        [tokenHash]
      );
    }

    res.clearCookie("refreshToken", { path: "/" });
    return res.json({ message: "Logged out" });
  } catch (e) {
    console.error("LOGOUT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

authRouter.get("/me", authRequired, async (req, res) => {
  const user = (req as any).user as { sub: string; email: string };
  return res.json({ id: user.sub, email: user.email });
});
