import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";
import alertsRouter from "./routes/alerts";
import { checkAlerts } from "./jobs/checkAlerts";

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api", priceRouter);
app.use("/auth", authRouter);
app.use("/api/alerts", alertsRouter);

setInterval(() => {
  checkAlerts().catch(console.error);
}, 10_000);
app.listen(8000, () => {
  console.log("Backend running on port 8000");
});
//หลัก


//เจน1
/*import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";
import { alertRouter } from "./routes/alerts";

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/price", priceRouter);
app.use("/api/auth", authRouter);
app.use("/api/alerts", alertRouter);

app.listen(8000, () => {
  console.log("Backend running on port 8000");
});*/







