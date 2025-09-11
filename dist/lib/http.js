"use strict";
// =============================
// lib/http.ts
// -----------------------------
// Provides helper functions to send consistent API responses.
// Every response is wrapped in either:
//   { ok: true, data, meta? }   → success
//   { ok: false, error }        → failure
// =============================
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErr = exports.sendOk = void 0;
/**
 * Send a successful response.
 * - `data` is the main payload (typed with generics).
 * - `meta` is optional extra info (e.g., pagination).
 */
const sendOk = (res, data, meta) => res.json({ ok: true, data, meta });
exports.sendOk = sendOk;
/**
 * Send an error response.
 * - `code` is a short machine-readable error code (e.g. "E_BAD_INPUT").
 * - `message` is human-readable.
 * - `details` can hold validation errors or debugging info.
 * - `status` sets the HTTP status (default 400).
 */
const sendErr = (res, code, message, details, status = 400) => res.status(status).json({
    ok: false,
    error: { code, message, details },
});
exports.sendErr = sendErr;
//# sourceMappingURL=http.js.map