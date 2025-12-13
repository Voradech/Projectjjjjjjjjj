const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from backend" });
});

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
});
