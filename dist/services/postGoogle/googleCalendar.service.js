"use strict";
// src/services/googleCalendar.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarService = void 0;
// If Node 18+, fetch is built-in → you can delete this import.
// If Node < 18, you need node-fetch to make HTTP requests.
const node_fetch_1 = __importDefault(require("node-fetch"));
class GoogleCalendarService {
    fetchImpl;
    base = "https://www.googleapis.com/calendar/v3";
    constructor(fetchImpl = node_fetch_1.default) {
        this.fetchImpl = fetchImpl;
    }
    async createEvent(accessToken, event, calendarId = "primary") {
        if (!accessToken)
            throw new Error("Missing access token");
        if (!event?.start)
            throw new Error("Event must include start");
        const url = `${this.base}/calendars/${encodeURIComponent(calendarId)}/events`;
        // 12s timeout so the route never hangs forever
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 12_000);
        try {
            const resp = await this.fetchImpl(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(event),
                signal: ac.signal,
            });
            const text = await resp.text().catch(() => "");
            if (resp.status === 401) {
                // surface to controller so it can return TOKEN_EXPIRED
                throw new Error(`Unauthorized (token expired/invalid). ${text}`);
            }
            if (!resp.ok) {
                throw new Error(`Calendar insert failed (${resp.status}). ${text}`);
            }
            return JSON.parse(text);
        }
        catch (e) {
            // Helpful log: distinguish timeout vs other network errors
            const kind = e?.name === "AbortError" ? "timeout" : (e?.name || "network/error");
            console.error("[GoogleCalendarService] createEvent failed:", kind, e?.message || e);
            throw e;
        }
        finally {
            clearTimeout(to);
        }
    }
    async listUpcoming(accessToken, maxResults = 10) {
        if (!accessToken)
            throw new Error("Missing access token");
        const url = new URL(`${this.base}/calendars/primary/events`);
        url.searchParams.set("maxResults", String(maxResults));
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("timeMin", new Date().toISOString());
        // 8s timeout here is fine
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 8_000);
        try {
            const resp = await this.fetchImpl(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: ac.signal,
            });
            const text = await resp.text().catch(() => "");
            if (!resp.ok)
                throw new Error(`List events failed (${resp.status}). ${text}`);
            return JSON.parse(text);
        }
        finally {
            clearTimeout(to);
        }
    }
}
exports.GoogleCalendarService = GoogleCalendarService;
//# sourceMappingURL=googleCalendar.service.js.map