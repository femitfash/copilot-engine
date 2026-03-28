import dotenv from "dotenv";
dotenv.config();

// Node version guard — native fetch requires Node v18+
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error(`\n❌  Copilot Engine requires Node.js v18+ (found v${process.versions.node})`);
  console.error(`    Install: https://nodejs.org  or  run: nvm use 18\n`);
  process.exit(1);
}

import express from "express";
import cors from "cors";
import { validateToken } from "./auth/validate-token";
import copilotRoute from "../routes/copilot";
import executeRoute from "../routes/execute";

const app = express();
const PORT = process.env.PORT || 3100;

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:4000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "10mb" }));

// Auth middleware for all /api routes
app.use("/api", validateToken);

// Routes — factory-generated routers mounted at their base paths
app.use("/api/copilot", copilotRoute);
app.use("/api/copilot", executeRoute);

// Health check (no auth needed)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "copilot-engine", mode: "standalone" });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  Copilot Engine — http://localhost:${PORT}      ║
║  Mode: standalone                            ║
║  Health check: GET /health                   ║
╚══════════════════════════════════════════════╝
`);
});

export default app;
