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
import { JwtPayload } from "jsonwebtoken";
export const authRouter = Router();

/* ================= utils ================= */

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

/* ================= register ================= */

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body as {
      email?: string;
      password?: string;
      username?: string;
    };

    if (!email || !password || !username) {
      return res
        .status(400)
        .json({ message: "email/password/username required" });
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

/* ================= login ================= */

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body as {
      username?: string;
      password?: string;
      role?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ message: "username/password required" });
    }

    const userRes = await pool.query(
      `
  SELECT id, email, role, password_hash
  FROM users
  WHERE LOWER(username) = $1
     OR LOWER(email) = $1
  `,
      [username.toLowerCase()]
    );
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + interval '14 days')`,
      [user.id, sha256(refreshToken)]
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 นาที
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions());

    return res.json({ role: user.role });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ================= refresh ================= */

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const payload = verifyRefreshToken(token);
    if (!payload || typeof payload !== "object") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenHash = sha256(token);

    const dbRes = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE token_hash=$1
         AND revoked_at IS NULL3
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (dbRes.rowCount === 0) {
      return res
        .status(401)
        .json({ message: "Refresh token revoked or expired" });
    }

    const newAccessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (e) {
    console.error("REFRESH ERROR:", e);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* ================= logout ================= */

authRouter.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;

    if (token) {
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [sha256(token)]
      );
    }

    res.clearCookie("refreshToken", { path: "/" });
    return res.json({ message: "Logged out" });
  } catch (e) {
    console.error("LOGOUT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ================= me ================= */

authRouter.get("/me", authRequired, (req, res) => {
  res.json(req.user);
});

export interface AuthPayload extends JwtPayload {
  id: string;
  email: string;
  role: "admin" | "user";
}
