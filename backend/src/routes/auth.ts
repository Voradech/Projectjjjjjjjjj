import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/pool";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  AuthTokenPayload,
} from "../utils/jwt";
import { me } from "../controllers/auth.controller";

export const authRouter = Router();

export interface AuthPayload extends AuthTokenPayload {}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function getCookieOptions(maxAgeMs?: number) {
  const isProduction = process.env.NODE_ENV === "production" && !!process.env.DOMAIN;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    ...(isProduction && process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

/* ================= Register ================= */
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
      [emailNorm, passwordHash, username.trim()]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (e: any) {
    console.error("REGISTER ERROR:", e);
    if (e.code === "23505") {
      return res.status(409).json({ message: "Email or username already exists" });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

/* ================= Login ================= */
authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ message: "username/password required" });
    }

    const userRes = await pool.query(
      `
      SELECT id, email, username, role, password_hash
      FROM users
      WHERE LOWER(username) = $1
        OR LOWER(email) = $1
      `,
      [username.trim().toLowerCase()]
    );
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid username or email" });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const payload: AuthTokenPayload = {
      sub: String(user.id),
      email: user.email,
      username: user.username,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + interval '14 days')`,
      [user.id, sha256(refreshToken)]
    );

    // Set accessToken cookie (1 hour)
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));

    // Set refreshToken cookie (14 days)
    const refreshTTL = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14) * 24 * 60 * 60 * 1000;
    res.cookie("refreshToken", refreshToken, getCookieOptions(refreshTTL));

    return res.json({
      message: "Login success",
      role: user.role,
      username: user.username,
      email: user.email,
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ================= Refresh ================= */
authRouter.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const payload = verifyRefreshToken(token) as AuthPayload;

    const newAccessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
    });

    res.cookie("accessToken", newAccessToken, getCookieOptions(60 * 60 * 1000));

    return res.json({ message: "refreshed" });
  } catch (e) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* ================= Logout ================= */
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

    const cookieOptions = getCookieOptions();
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.clearCookie("role", cookieOptions);

    return res.json({ message: "Logged out" });
  } catch (e) {
    console.error("LOGOUT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

authRouter.get("/me", me);
