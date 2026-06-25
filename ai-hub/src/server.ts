import "dotenv/config";
import express from "express";
import path from "node:path";
import { generateRouter } from "./api/generate.js";

const app = express();
app.use(express.json({ limit: "20mb" }));

// Отдача сохранённых файлов.
const storageDir = path.resolve(process.env.STORAGE_PATH || "./data/output");
app.use("/files", express.static(storageDir));

app.use("/api", generateRouter());

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.log(`AVSound AI-hub: http://localhost:${PORT}`);
  console.log("POST /api/generate | POST /api/estimate | GET /api/history");
});
