import { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";

export function requireRole(role: "admin" | "user") {
  return async (req: Request, res: Response, next: NextFunction) => {
     if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};