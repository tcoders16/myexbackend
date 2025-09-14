"use strict";
// =============================
// lib/text.ts
// -----------------------------
// Utility for cleaning up raw text before parsing.
// =============================
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
/**
 * Normalize raw text for consistent parsing.
 * - Convert Windows/Mac line endings to \n
 * - Replace tabs with spaces
 * - Trim whitespace
 */
function normalizeText(s) {
    return s
        .replace(/\r\n?/g, "\n") // normalize line endings
        .replace(/\t/g, "  ") // tabs → 2 spaces
        .trim();
}
//# sourceMappingURL=text.js.map