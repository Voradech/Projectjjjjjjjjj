import { Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { getCookieOptions } from "../routes/auth";

export const me = async (req: Request, res: Response) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = verifyAccessToken(token);

    return res.json({
      id: payload.sub,
      email: payload.email,
      username: payload.username || "",
      role: payload.role,
    });
  } catch (err) {
    const cookieOptions = getCookieOptions();
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.clearCookie("role", cookieOptions);

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
