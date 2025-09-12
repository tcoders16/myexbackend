// src/routes/extract.ts
import { Router } from "express";
import { postExtract } from "../controller/extractController";
import { latestByIp } from "../state/latestResults";

// Create an isolated router for all /api/extract endpoints
export const router = Router();

/**
 * POST /api/extract
 * - Validates the body with Zod (inside the controller)
 * - Delegates to the service (rules/LLM depending on your controller)
 * - Responds with { ok, data } or { ok:false, error }
 */
router.post("/", postExtract);

router.get("/latest", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
          || req.socket.remoteAddress
          || "unknown";
  const rec = latestByIp.get(ip);
  if (!rec) return res.json({ ok: true, data: { events: [], degraded: false } });
  res.json(rec.payload);
});