import jwt, { JwtPayload } from "jsonwebtoken";

/* ================= TYPES ================= */
export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: "admin" | "user";
}

/* ================= SIGN ================= */

export function signAccessToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: "1h",
  });
}

export function signRefreshToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: "14d",
  });
}

/* ================= VERIFY ================= */

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET!
  ) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET!
  ) as AuthTokenPayload;
}
