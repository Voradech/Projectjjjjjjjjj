import express from "express";
import cors from "cors";

import priceRouter from "./routes/price";
import authRouter from "./routes/auth";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", priceRouter);
app.use("/api/auth", authRouter);

app.listen(8000, () => {
  console.log("Backend running on port 8000");
});
