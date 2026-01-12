/* import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});



 */
import { Pool } from "pg";

export const pool = new Pool({
  host:'dpg-d5ia76khg0os738emi30-a.singapore-postgres.render.com',
  port: 5432,
  user: 'admin',
  password: 'CYoE9VuPmTeR43WrAWLrRGbfHXXK2ziA',
  database: 'predicton_db',
  ssl: { rejectUnauthorized: false }
});
