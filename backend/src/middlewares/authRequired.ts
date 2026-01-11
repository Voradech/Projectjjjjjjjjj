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




//เจน1
/*import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

export function authRequired(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}*/



