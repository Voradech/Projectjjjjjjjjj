import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRouter from "./routes/admin";
import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";
import alertsRouter from "./routes/alerts";
import { checkAlerts } from "./jobs/checkAlerts";
import { Request, Response } from "express";
import { pool } from "./db/pool";
import newsRouter from "./routes/new";
import routes from "./route";
import "dotenv/config";
const app = express();

app.use(
  cors({ 
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(routes);
app.use(express.json());
app.use(cookieParser());
app.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW() as server_time");

    res.status(200).json({
      api: "running",
      database: {
        status: "ok",
        message: "Database connected",
        serverTime: result.rows[0].server_time,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      api: "running",
      database: {
        status: "error",
        message: "Database connection failed",
        error: error.message,
      },
    });
  }
});
app.use("/api/news", newsRouter);
app.use("/route", routes);
app.use("/auth", authRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api", priceRouter);
app.use("/admin", adminRouter);


setInterval(() => {
  checkAlerts().catch(console.error);
}, 10_000);
app.listen(8000, () => {
  console.log("Backend running on port 8000");
});




