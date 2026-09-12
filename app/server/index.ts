import "dotenv/config";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(cors());
app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

const distPath = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(distPath, { recursive: true });
app.use(express.static(distPath));

app.listen(port, () => {
  console.log(`world-news api listening on :${port}`);
});