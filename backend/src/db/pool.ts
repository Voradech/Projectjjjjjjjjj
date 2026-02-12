import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();


export const pool = new Pool({
  host:'dpg-d6675bf5r7bs73cc9eh0-a.singapore-postgres.render.com',
  port: 5432,
  user: 'admin',
  password: 'aTDZtYx7W3dG5vxSvN6xp5HTEpsaNbcN',
  database: 'predicton_db_eyaa',
  ssl: { rejectUnauthorized: false }
});
