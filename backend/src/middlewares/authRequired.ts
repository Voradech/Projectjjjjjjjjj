import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const authRequired = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: "No access token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    if (
      typeof decoded === "object" &&
      "sub" in decoded &&
      "email" in decoded &&
      "role" in decoded
    ) {
      req.user = {
        id: decoded.sub as string,
        email: decoded.email as string,
        role: decoded.role as "admin" | "user",
      };
      return next();
    }

    return res.status(401).json({ message: "Invalid token payload" });
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};




