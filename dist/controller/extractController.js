"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postExtract = postExtract;
// controllers/extractController.ts
const extract_schema_1 = require("../schemas/extract.schema");
const http_1 = require("../lib/http");
const smartEventExtractorSelector_1 = require("../services/extractDate/smartEventExtractorSelector");
const latestResults_1 = require("../state/latestResults");
async function postExtract(req, res) {
    const parsed = extract_schema_1.ExtractBody.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.sendErr)(res, "E_BAD_INPUT", "Invalid body", parsed.error.flatten(), 422);
    }
    try {
        const data = await (0, smartEventExtractorSelector_1.extractSmart)(parsed.data); // -> { events, degraded, ... }
        // ✅ stash by requester IP (simple for local dev)
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
            || req.socket.remoteAddress
            || "unknown";
        latestResults_1.latestByIp.set(ip, { at: Date.now(), payload: { ok: true, data } });
        return (0, http_1.sendOk)(res, data);
    }
    catch (e) {
        return (0, http_1.sendErr)(res, "E_EXTRACT", e?.message ?? "Extraction failed", undefined, 500);
    }
}
//# sourceMappingURL=extractController.js.map