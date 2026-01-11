import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import priceRouter from "./routes/price";
import { authRouter } from "./routes/auth";

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api", priceRouter);
app.use("/auth", authRouter);


app.listen(8000, () => {
  console.log("Backend running on port 8000");
});
