"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractBody = void 0;
const zod_1 = require("zod");
// =============================
//  ExtractBody schema
// -----------------------------
// Defines the expected request body for POST /api/extract.
// - Either `text` (raw string) OR `fileId` (uploaded file reference) is required.
// - Includes optional timezone and referenceDate fields.
// - Used both for runtime validation (Zod) AND TypeScript type inference.
// =============================
exports.ExtractBody = zod_1.z.object({
    /**
     * Raw text to parse (e.g. "Meeting next Tuesday 10am").
     * Optional, but must be non-empty string if provided.
     */
    text: zod_1.z.string().min(1).optional(),
    /**
     * UUID string for a pre-uploaded file containing text.
     * Optional, but must be a valid UUID if provided.
     */
    fileId: zod_1.z.string().uuid().optional(),
    /**
     * IANA timezone identifier (e.g., "America/Toronto").
     * Defaults to "America/Toronto" if not specified.
     * Ensures extracted events are localized correctly.
     */
    timezone: zod_1.z.string().default("America/Toronto"),
    /**
     * Optional ISO 8601 datetime string used as an anchor date.
     * Example: "2025-09-01T00:00:00Z"
     * Useful for resolving relative phrases like "next Tuesday".
     */
    referenceDate: zod_1.z.string().datetime().optional(),
})
    /**
     * Refinement rule:
     * - Must provide at least one of `text` or `fileId`.
     * - If both are missing → validation error.
     */
    .refine(b => b.text || b.fileId, { message: "Provide `text` or `fileId`" });
//# sourceMappingURL=extract.schema.js.map