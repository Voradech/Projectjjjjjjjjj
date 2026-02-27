"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(role) {
    return async (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
}
;
