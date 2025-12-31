import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authRequired(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing access token" });
    try {
        const playload = verifyAccessToken(token);
        (req as any).userId = playload;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid /Expired Token" });
    }
}
