import type { JwtPayload } from "jsonwebtoken";

/* ================= Binance types ================= */

export type BinanceKline = [
  number,      // open time
  string,      // open
  string,      // high
  string,      // low
  string,      // close
  string,      // volume
  number | string, // close time
  string,      // quote asset volume
  number,      // number of trades
  string,      // taker buy base asset volume
  string,      // taker buy quote asset volume
  string       // ignore
];

export type PriceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

/* ================= Auth types ================= */

export interface AuthPayload extends JwtPayload {
  sub: string;        // JWT standard: subject = user.id (stored as string)
  id?: string;        // backward compat
  email: string;
  username?: string;
  role: "admin" | "user";
}

/* ================= Express augmentation ================= */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
        role: "admin" | "user";
      };
    }
  }
}

export {};
