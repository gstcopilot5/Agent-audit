const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "working" });
});

app.post("/audit", (req, res) => {
  const { url } = req.body;

  res.json({
    url,
    score: 78,
    issues: [
      "Missing meta tags",
      "Slow loading speed",
      "No alt text on images"
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0");
