"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const pool_1 = require("../db/pool");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const auth_controller_1 = require("../controllers/auth.controller");
exports.authRouter = (0, express_1.Router)();
function sha256(input) {
    return crypto_1.default.createHash("sha256").update(input).digest("hex");
}
function refreshCookieOptions() {
    return {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14) * 24 * 60 * 60 * 1000,
    };
}
exports.authRouter.post("/register", async (req, res) => {
    try {
        const { email, password, username } = req.body;
        if (!email || !password || !username) {
            return res
                .status(400)
                .json({ message: "email/password/username required" });
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        const emailNorm = email.trim().toLowerCase();
        const result = await pool_1.pool.query(`INSERT INTO users (email, password_hash, username)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`, [emailNorm, passwordHash, username]);
        return res.status(201).json({ user: result.rows[0] });
    }
    catch (e) {
        console.error("REGISTER ERROR:", e);
        if (e.code === "23505") {
            return res.status(409).json({ message: "Email already exists" });
        }
        return res.status(500).json({ message: "Server error" });
    }
});
/* ================= login ================= */
exports.authRouter.post("/login", async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "username/password required" });
        }
        const userRes = await pool_1.pool.query(`
    SELECT id, email, role, password_hash
    FROM users
    WHERE LOWER(username) = $1
      OR LOWER(email) = $1
    `, [username.toLowerCase()]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(401).json({ message: "Invalid username" });
        }
        const ok = await (0, password_1.verifyPassword)(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ message: "Invalid password" });
        }
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        await pool_1.pool.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + interval '14 days')`, [user.id, sha256(refreshToken)]);
        //  Set accessToken cookie
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "none",
            secure: true,
            path: "/",
            maxAge: 60 * 60 * 1000,
            domain: process.env.DOMAIN,
        });
        //  Set refreshToken cookie
        res.cookie("refreshToken", refreshToken, refreshCookieOptions());
        return res.json({ role: user.role });
    }
    catch (e) {
        console.error("LOGIN ERROR:", e);
        return res.status(500).json({ message: "Server error" });
    }
});
/* ================= refresh ================= */
exports.authRouter.post("/refresh", async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ message: "Missing refresh token" });
        }
        const payload = (0, jwt_1.verifyRefreshToken)(token);
        if (!payload || typeof payload !== "object") {
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        const tokenHash = sha256(token);
        const dbRes = await pool_1.pool.query(`SELECT id FROM refresh_tokens
      WHERE token_hash=$1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`, [tokenHash]);
        if (dbRes.rowCount === 0) {
            return res
                .status(401)
                .json({ message: "Refresh token revoked or expired" });
        }
        const newAccessToken = (0, jwt_1.signAccessToken)({
            sub: payload.sub,
            email: payload.email,
            role: payload.role,
        });
        // ✅ Set accessToken cookie
        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 1000,
        });
        // ✅ เพิ่มบรรทัดนี้! Refresh role cookie ด้วย
        res.cookie("role", payload.role, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 1000,
        });
        return res.json({ message: "refreshed" });
    }
    catch (e) {
        console.error("REFRESH ERROR:", e);
        return res.status(401).json({ message: "Invalid refresh token" });
    }
});
exports.authRouter.post("/logout", async (req, res) => {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.clearCookie("role");
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await pool_1.pool.query(`UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE token_hash = $1 AND revoked_at IS NULL`, [sha256(token)]);
        }
        res.clearCookie("refreshToken", { path: "/" });
        return res.json({ message: "Logged out" });
    }
    catch (e) {
        console.error("LOGOUT ERROR:", e);
        return res.status(500).json({ message: "Server error" });
    }
});
exports.authRouter.get("/me", auth_controller_1.me);
