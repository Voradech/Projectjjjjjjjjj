import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import adminRouter from "./routes/admin";
import "./jobs/cron";
import cors from "cors";
import cookieParser from "cookie-parser";
import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";
import { checkAlerts } from "./jobs/checkAlerts";
import { Request, Response } from "express";
import { pool } from "./db/pool";
import routes from "./route";
import alertsRouter from "./routes/alert";
import newsRouter from "./routes/news";

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(" Client connected:", socket.id);
  socket.on("join", (userId: number) => {
    socket.join(`user_${userId}`);
    console.log("User joined room:", userId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use("/api/alerts", alertsRouter);

app.get("/test-alert", async (req, res) => {
  await checkAlerts();
  res.json({ message: "Check executed" });
});
// ================= Routes =================
app.use("/route", routes);
app.use("/auth", authRouter);
app.use("/alerts", alertsRouter);
app.use("/price", priceRouter);
app.use("/api/admin", adminRouter);
app.use("/api/news", newsRouter)
// ================= Health Check =================
app.get("/", async (_req: Request, res: Response) => {
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

// ================= Cron =================
setInterval(() => {
  checkAlerts().catch(console.error);
}, 10_000);

// ================= Start Server =================
server.listen(8000, () => {
  console.log("🚀 Backend running on port 8000");
});