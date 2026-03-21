import dotenv from "dotenv";
dotenv.config();

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

// Routes
app.use(copilotRoute);
app.use(executeRoute);

// Health check (no auth needed)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "zt-copilot-engine" });
});

app.listen(PORT, () => {
  console.log(`ZT Copilot Engine running on port ${PORT}`);
});

export default app;
