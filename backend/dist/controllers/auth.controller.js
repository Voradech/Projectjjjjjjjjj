"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const login = async (req, res) => {
    const userRepo = req.userRepo;
    const { username, password } = req.body;
    const user = await userRepo.findByUsername(username);
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
    }, process.env.JWT_ACCESS_SECRET, { expiresIn: "1h" } // ✅ ให้ตรงกับ cookie
    );
    const cookieOptions = {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 1000,
        ...(process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
    };
    res.cookie("accessToken", token, cookieOptions);
    return res.json({
        message: "Login success",
        role: user.role,
        username: user.username,
        email: user.email,
    });
};
exports.login = login;
const me = async (req, res) => {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        return res.json({
            id: payload.sub,
            email: payload.email,
            username: payload.username,
            role: payload.role,
        });
    }
    catch {
        const cookieOptions = {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            ...(process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
        };
        res.clearCookie("accessToken", cookieOptions);
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.me = me;
