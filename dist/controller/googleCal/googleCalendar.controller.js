"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventCtrl = createEventCtrl;
exports.listUpcomingCtrl = listUpcomingCtrl;
const googleCalendar_service_1 = require("../../services/postGoogle/googleCalendar.service");
// Service instance → does the actual calls to Google API
const gcal = new googleCalendar_service_1.GoogleCalendarService();
/**
 * POST /api/google/events
 * Purpose: Create a new event in Google Calendar
 * - Needs Authorization header: "Bearer <accessToken>"
 * - Body must contain { event, calendarId? }
 */
// src/controllers/googleCalendar.controller.ts
async function createEventCtrl(req, res) {
    console.log("[ctrl] /api/google/events hit");
    try {
        const bearer = req.headers.authorization || "";
        const accessToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
        const { event, calendarId = "primary" } = (req.body || {});
        // 🔊 DEBUG
        console.log("[google:createEvent] hit");
        console.log("[google:createEvent] token", accessToken ? accessToken.slice(0, 12) + "…" : "(missing)");
        console.log("[google:createEvent] input", JSON.stringify({ calendarId, event }, null, 2));
        if (!accessToken) {
            console.log("[google:createEvent] 401 Missing access token");
            return res.status(401).json({ ok: false, error: "Missing access token" });
        }
        if (!event?.start) {
            console.log("[google:createEvent] 400 missing start");
            return res.status(400).json({ ok: false, error: "event.start required" });
        }
        // synthesize default end if missing
        if (!event.end?.dateTime && !event.end?.date) {
            if (event.start.date) {
                event.end = { date: event.start.date, timeZone: event.start.timeZone };
            }
            else if (event.start.dateTime) {
                const startMs = Date.parse(event.start.dateTime);
                const endMs = startMs + 60 * 60 * 1000;
                event.end = { dateTime: new Date(endMs).toISOString(), timeZone: event.start.timeZone };
            }
            console.log("[google:createEvent] synthesized end", event.end);
        }
        try {
            const created = await gcal.createEvent(accessToken, event, calendarId);
            console.log("[google:createEvent] success", { id: created.id, link: created.htmlLink });
            return res.json({ ok: true, id: created.id, htmlLink: created.htmlLink });
        }
        catch (e) {
            const msg = String(e?.message || e);
            console.warn("[google:createEvent] error:", msg);
            if (/Unauthorized/i.test(msg) || /401/.test(msg)) {
                return res.status(401).json({ ok: false, error: "TOKEN_EXPIRED" });
            }
            return res.status(500).json({ ok: false, error: msg });
        }
    }
    catch (err) {
        console.error("[google:createEvent] fatal:", err);
        return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
}
/**
 * GET /api/google/events/upcoming?max=10
 * Purpose: List a few upcoming events from Google Calendar
 * - Needs Authorization header: "Bearer <accessToken>"
 * - Optional query param: max (default 10)
 */
async function listUpcomingCtrl(req, res) {
    try {
        // 1. Extract token
        const bearer = req.headers.authorization || "";
        const accessToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
        if (!accessToken) {
            return res.status(401).json({ ok: false, error: "Missing access token" });
        }
        // 2. Parse "max" query param (default = 10)
        const max = Number(req.query.max ?? 10);
        // 3. Call Google API through service
        const data = await gcal.listUpcoming(accessToken, max);
        // 4. Return list of events
        return res.json({ ok: true, data });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
}
//# sourceMappingURL=googleCalendar.controller.js.map