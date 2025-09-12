// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { router as extractRouter } from "./routes/extract";
import googleRouter from "./routes/googleRoutes/googleRoutes";

const app = express();

// Trust reverse proxies (Vercel/Render/Fly/etc.)
app.set("trust proxy", 1);

// Security headers (sane defaults; keep frameguard off if you embed)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Rate limit (adjust to taste)
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
}));

// CORS (permissive; optionally replace "*" with process.env.ALLOW_ORIGIN)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

app.use(express.json({ limit: "25mb" }));

// Health
app.get("/api/healthz", (_req, res) => res.json({ ok: true }));

// Simple request log (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[srv] ${req.method} ${req.url}`);
    next();
  });
}

// Routes
app.use("/api/extract", extractRouter); // your extractor
app.use("/api/google", googleRouter);   // Google Calendar integration

// Not found
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

export default app; // helps some platforms/tools