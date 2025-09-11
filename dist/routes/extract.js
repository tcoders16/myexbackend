"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// src/routes/extract.ts
const express_1 = require("express");
const extractController_1 = require("../controller/extractController");
const latestResults_1 = require("../state/latestResults");
// Create an isolated router for all /api/extract endpoints
exports.router = (0, express_1.Router)();
/**
 * POST /api/extract
 * - Validates the body with Zod (inside the controller)
 * - Delegates to the service (rules/LLM depending on your controller)
 * - Responds with { ok, data } or { ok:false, error }
 */
exports.router.post("/", extractController_1.postExtract);
exports.router.get("/latest", (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "unknown";
    const rec = latestResults_1.latestByIp.get(ip);
    if (!rec)
        return res.json({ ok: true, data: { events: [], degraded: false } });
    res.json(rec.payload);
});
//# sourceMappingURL=extract.js.map