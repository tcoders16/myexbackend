// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";

import { router as extractRouter } from "./routes/extract";
import googleRouter from "./routes/googleRoutes/googleRoutes";
import { ALL } from "dns";

const app = express();


app.use(
  cors({
    origin: "*" ,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    maxAge: 600, // cache preflight for 10 minutes
  })
);

app.use(express.json({ limit: "25mb" }));

app.get("/api/healthz", (_req, res) => res.json({ ok: true }));


app.use((req, _res, next) => {
  console.log(`[srv] ${req.method} ${req.url}`);
  next();
});
// Routes
app.use("/api/extract", extractRouter); // rules-only
app.use("/api/google", googleRouter);   // Google Calendar integration

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});