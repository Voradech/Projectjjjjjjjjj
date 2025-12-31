import jwt, { type SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
import ms from "ms";

dotenv.config();

export type JwtPayload = { sub: string; email: string };

function mustGetEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${key}`);
  return v;
}

const accessSecret = mustGetEnv("JWT_ACCESS_SECRET");
const refreshSecret = mustGetEnv("JWT_REFRESH_SECRET");

function assertTtlFormat(ttl: string) {
 
  if (!/^\d+(ms|s|m|h|d|w|y)$/.test(ttl)) {
    throw new Error(`Invalid TTL format: ${ttl} (expected like "15m", "1h", "7d")`);
  }
}

function ttlToSeconds(ttl: string): number {
  assertTtlFormat(ttl);
  const value = ms(ttl as ms.StringValue); 
  return Math.floor(value / 1000);
}

const accessTTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const refreshTTL = process.env.REFRESH_TOKEN_TTL ?? "14d";

const accessOptions: SignOptions = { expiresIn: ttlToSeconds(accessTTL) };
const refreshOptions: SignOptions = { expiresIn: ttlToSeconds(refreshTTL) };

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, accessSecret, accessOptions);
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, refreshSecret, refreshOptions);
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, accessSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, refreshSecret) as JwtPayload;
  } catch {
    return null;
  }
}
