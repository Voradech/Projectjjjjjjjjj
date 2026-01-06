import express from "express";
import cors from "cors";
import router from "./route";
import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8000);
app.use(cookieParser());

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// routes

app.use("/auth", authRouter);
app.use("/api", router);
app.use("/api", priceRouter);
// health check
app.get("/", (_req, res) => {
  res.send("Backend is running ");
});
app.get("/health", (_, res) => res.json({ ok: true }));



// start
app.listen(PORT, () => {
  console.log(` Backend running at http://localhost:${PORT}`);
});
