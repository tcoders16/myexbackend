// controllers/extractController.ts
import { ExtractBody } from "../schemas/extract.schema";
import { sendOk, sendErr } from "../lib/http";
import type { Request, Response } from "express";
import { extractSmart } from "../services/extractDate/smartEventExtractorSelector";
import { latestByIp } from "../state/latestResults";

export async function postExtract(req: Request, res: Response) {
  const parsed = ExtractBody.safeParse(req.body);
  if (!parsed.success) {
    return sendErr(res, "E_BAD_INPUT", "Invalid body", parsed.error.flatten(), 422);
  }


  try {
    const data = await extractSmart(parsed.data); // -> { events, degraded, ... }

    // ✅ stash by requester IP (simple for local dev)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
            || req.socket.remoteAddress
            || "unknown";
    latestByIp.set(ip, { at: Date.now(), payload: { ok: true, data } });

    return sendOk(res, data);
  } catch (e: any) {
    return sendErr(res, "E_EXTRACT", e?.message ?? "Extraction failed", undefined, 500);
  }
}