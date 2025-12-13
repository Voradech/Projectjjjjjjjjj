import express from "express";

const app = express();
const PORT = 3001;

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
