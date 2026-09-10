import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  })
  : new Pool({
    host: process.env.DB_HOST || "dpg-daa7hr5g1s2s73ccq5qg-a.singapore-postgres.render.com",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || process.env.DB_PASS || "CA2rFItphx4LKBaQLIAnFOCNXUcPEyVY",
    database: process.env.DB_NAME || "predicton_db_ltdv",
    ssl: (process.env.DB_HOST === "localhost" || process.env.DB_HOST === "127.0.0.1" || process.env.DB_HOST === "db")
      ? false
      : { rejectUnauthorized: false },
  });
