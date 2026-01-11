import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRouter from "./routes/admin";
import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);

app.use("/api", priceRouter);
app.use("/admin", adminRouter);

app.listen(8000, () => {
  console.log("Backend running on port 8000");
});
