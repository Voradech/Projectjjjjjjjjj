"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const requireAdmin = (req, res, next) => {
    const user = req.user; // มาจาก auth middleware ของคุณ
    if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin only" });
    }
    next();
};
exports.requireAdmin = requireAdmin;
