import { Request, Response, NextFunction } from "express";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user; // มาจาก auth middleware ของคุณ

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  next();
};