import express from "express";
import cors from "cors";
import router from "./route";

const app = express();
const PORT = Number(process.env.PORT || 8000);

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api", router);

// health check
app.get("/", (_req, res) => {
  res.send("Backend is running 🚀");
});

// start
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
