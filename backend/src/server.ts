import express from "express";
import cors from "cors";
import priceRouter from "./route";

const app = express();
const PORT = 3001;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api", priceRouter);

// health check
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// start server
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
