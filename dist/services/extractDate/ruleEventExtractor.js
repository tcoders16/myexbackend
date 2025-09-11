"use strict";
// =============================
// services/extractRules.ts
// -----------------------------
// Rules-based extractor (no AI).
// Uses chrono-node to find datetimes and builds EventLite objects.
// =============================
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRules = extractRules;
const text_1 = require("../../lib/text");
const chrono_1 = require("../../lib/chrono");
const events_1 = require("../../types/events");
/**
 * Extracts events using deterministic rules (chrono, regex, heuristics).
 * - Input: text (or fileId later), timezone, optional referenceDate.
 * - Output: ExtractionResult with EventLite[].
 */
async function extractRules(input) {
    // --- 1) Guard: empty input ---
    const raw = (input.text ?? "").trim();
    if (!raw) {
        return { events: [], degraded: false, warnings: [{ code: "EMPTY_TEXT", message: "empty text" }] };
    }
    // --- 2) Normalize text ---
    const text = (0, text_1.normalizeText)(raw);
    // --- 3) Parse dates with chrono ---
    const hits = (0, chrono_1.parseDates)(text, input.referenceDate);
    // --- 4) Build EventLite objects ---
    const events = hits
        .filter(h => isValidISO(h.startISO) && (!h.endISO || isValidISO(h.endISO)))
        .map(h => ({
        title: guessTitleNear(text, h.index),
        start: (0, events_1.asISO)(h.startISO), // ← brand it
        end: h.endISO ? (0, events_1.asISO)(h.endISO) : undefined, // ← brand it
        timezone: input.timezone,
        source: "rules",
        confidence: 0.75,
    }))
        // Enforce invariant: end >= start
        .filter(e => !e.end || Date.parse(e.end) >= Date.parse(e.start));
    // --- 5) Return structured result ---
    return { events, degraded: false };
}
// =============================
// Helpers
// =============================
/** Checks if a string is a valid ISO date. */
function isValidISO(s) {
    if (!s)
        return false;
    const t = Date.parse(s);
    return Number.isFinite(t);
}
/**
 * Heuristic: grab the text line near the datetime index.
 * This becomes the EventLite.title.
 */
function guessTitleNear(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").pop() || "";
    const title = line.trim().replace(/^[-•*\s]+/, ""); // strip bullets/dashes
    return title || "Untitled";
}
//# sourceMappingURL=ruleEventExtractor.js.map