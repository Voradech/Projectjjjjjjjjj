import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASS || "root",
  database: process.env.DB_NAME || "predicton_db",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
