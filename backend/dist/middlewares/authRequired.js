"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authRequired = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ message: "No access token" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
        console.log("Decoded token:", decoded);
        if (typeof decoded === "object" &&
            "sub" in decoded &&
            "email" in decoded &&
            "role" in decoded) {
            req.user = {
                id: decoded.sub,
                email: decoded.email,
                role: decoded.role,
            };
            return next();
        }
        console.log("Decoded token:", decoded);
        console.log("Cookies:", req.cookies);
        return res.status(401).json({ message: "Invalid token payload" });
    }
    catch (err) {
        console.log("Error verifying token:", err);
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.authRequired = authRequired;
