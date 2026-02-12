import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const authRequired = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ message: "No access token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
  console.log("Decoded token:", decoded);
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
    console.log("Decoded token:", decoded);
    console.log("Cookies:", req.cookies);
    return res.status(401).json({ message: "Invalid token payload" });
  } catch (err) {
    console.log("Error verifying token:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};




