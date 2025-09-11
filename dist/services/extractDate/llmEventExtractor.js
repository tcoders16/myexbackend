"use strict";
// =============================
// services/llmEventExtractor.ts
// -----------------------------
// LLM-based extractor using Ollama.
// - Strict prompt (JSON only)
// - Zod validation
// - Sanitizes + normalizes fields
// - Timeout via AbortController
// - Clean logging + warnings
// =============================
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLLM = extractLLM;
const zod_1 = require("zod");
const ollama_1 = require("../../clients/ollama");
const events_1 = require("../../types/events");
// --- Debug helpers ---
const DEBUG_LLM = process.env.NODE_ENV !== "production"; // flip to a custom flag if you prefer
function logChunk(label, s, max = 1200) {
    if (!DEBUG_LLM)
        return;
    const safe = typeof s === "string" ? s : String(s ?? "");
    const head = safe.slice(0, max);
    const more = safe.length > max ? ` …(+${safe.length - max} chars truncated)` : "";
    console.debug(label, head + more);
}
// -------- JSON schema guard (Zod) --------
// NOTE: LLMs often emit `end: null`, so allow string | null | undefined.
const LlmEvent = zod_1.z.object({
    title: zod_1.z.string().min(1),
    start: zod_1.z.string().min(1).nullable().optional(), // ISO 8601 expected (validated later)
    end: zod_1.z.string().min(1).nullable().optional(), // allow null/undefined
    allDay: zod_1.z.boolean().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
});
// LLM may include a freeform warnings array (strings). We'll map to {code,message}.
const LlmOut = zod_1.z.object({
    events: zod_1.z.array(LlmEvent).default([]),
    warnings: zod_1.z.array(zod_1.z.string()).optional(),
});
// -------- Public API --------
async function extractLLM(input) {
    const raw = (input.text ?? "").trim();
    // If no text, degrade so caller can fallback to rules.
    if (!raw) {
        const warn = "empty text";
        console.warn("[extractLLM] skipped:", warn);
        return { events: [], degraded: true, warnings: [{ code: "EMPTY_TEXT", message: warn }] };
    }
    // Setup timeout protection
    const controller = new AbortController();
    const timeoutMs = clampPositive(input.budgetMs ?? 6000, 1000, 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // Pick model (env override → default)
    const model = input.model ?? process.env.LLM_MODEL ?? "phi3:mini";
    try {
        // Build a strict prompt to force JSON only
        const prompt = buildPrompt({
            text: raw,
            timezone: input.timezone,
            referenceDate: input.referenceDate,
        });
        console.log("[extractLLM] start", {
            model,
            budgetMs: timeoutMs,
            tz: input.timezone,
            ref: input.referenceDate ?? null,
            chars: raw.length,
        });
        // Uncomment if you want to see full prompt (can be verbose/PII)
        // logChunk("[extractLLM] prompt", prompt, 2000);
        // Ask the LLM (deterministic: temperature 0)
        const respText = await (0, ollama_1.ollamaGenerateJSON)({
            prompt,
            model,
            signal: controller.signal,
            options: { temperature: 0 },
        });
        // 1) Log raw model output (truncated)
        logChunk("[extractLLM] raw LLM output", respText);
        // Many models add prose or code fences → try to extract only the JSON block
        const jsonStr = extractJsonBlock(respText);
        // 2) Log extracted JSON candidate (truncated)
        logChunk("[extractLLM] extracted JSON candidate", jsonStr);
        // Parse + validate against Zod schema
        let parsed;
        try {
            parsed = LlmOut.parse(JSON.parse(jsonStr));
        }
        catch (zerr) {
            console.warn("[extractLLM] schema/json parse failed", {
                message: zerr?.message,
                // if Zod error, show issues for exact field/paths
                issues: (zerr && zerr.issues) ? zerr.issues : undefined,
            });
            // Try native JSON.parse separately to surface exact position
            try {
                JSON.parse(jsonStr);
            }
            catch (nativeErr) {
                console.warn("[extractLLM] JSON.parse error", { message: nativeErr?.message });
            }
            // Optional: save last strings on window for quick copy in DevTools
            if (DEBUG_LLM && typeof window !== "undefined") {
                window.__LLM_LAST_RAW__ = respText;
                window.__LLM_LAST_JSON__ = jsonStr;
                console.info("[extractLLM] saved to window.__LLM_LAST_RAW__/__LLM_LAST_JSON__");
            }
            // Degrade gracefully so caller can fallback to rules
            return {
                events: [],
                degraded: true,
                warnings: [{ code: "LLM_BAD_JSON", message: "llm bad json/schema" }],
            };
        }
        // Sanitize + map to our internal EventLite
        const cleanEvents = parsed.events
            .map((e) => sanitizeEvent(e, input.timezone))
            .filter(Boolean);
        // Map raw string warnings (if any) to structured warnings
        const warnObjs = parsed.warnings?.map((w) => ({ code: "LLM_WARNING", message: w })) ?? [];
        console.log("[extractLLM] success", { events: cleanEvents.length });
        // Return real warnings (not a hardcoded "OK")
        return { events: cleanEvents, degraded: false };
    }
    catch (e) {
        // Timeout or generic LLM error → degrade and let caller fallback
        const isTimeout = e?.name === "AbortError";
        const reason = isTimeout ? `llm timeout after ${timeoutMs}ms` : (e?.message || "llm error");
        console.warn("[extractLLM] degraded", { reason });
        return {
            events: [],
            degraded: true,
            warnings: [{ code: isTimeout ? "LLM_TIMEOUT" : "LLM_ERROR", message: reason }],
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
// -------- Helpers --------
// Prompt instructs the model to return ONLY minified JSON with a tiny schema.
// Keep it simple + strict to reduce invalid outputs.
function buildPrompt(args) {
    const { text, timezone, referenceDate } = args;
    return `
You are an extraction engine. Extract calendar events from the given text.
- Resolve relative dates using the reference date if provided.
- Output ONLY valid, minified JSON with this exact schema:
{"events":[{"title":"string","start":"ISO","end":"ISO?","allDay":"boolean?"}],"warnings":["string"]}

Rules:
- "start" and "end" must be ISO 8601 (include timezone offset or Z).
- If unsure about end time, omit "end" or set it to null.
- If the date is clearly all-day, set "allDay": true.
- Do NOT include any additional fields or explanations.
- Do NOT include code fences.

Context:
- timezone: ${timezone}
- referenceDate: ${referenceDate ?? "none"}

TEXT:
${text}
`.trim();
}
// clamp helper so budget is within sane bounds
function clampPositive(n, min, max) {
    return Math.max(min, Math.min(n, max));
}
/** Extract a JSON object from a response that might include prose or code fences. */
function extractJsonBlock(s) {
    const trimmed = s.trim();
    // Already looks like a JSON object
    if (trimmed.startsWith("{") && trimmed.endsWith("}"))
        return trimmed;
    // Pull content out of ```json ...``` or ``` ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch)
        return fenceMatch[1].trim();
    // Fallback: try to slice first {...last}
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
        const candidate = trimmed.slice(first, last + 1).trim();
        try {
            JSON.parse(candidate);
            return candidate;
        }
        catch { /* ignore */ }
    }
    // Give up: caller will handle parse failure and degrade
    return trimmed;
}
// Sanitize + brand fields; return null if critical issues (e.g., bad start)
function sanitizeEvent(e, timezone) {
    // Validate/brand start
    const startISO = (0, events_1.asISO)(e.start); // start can be string | null | undefined now
    if (!startISO)
        return null; // ← drops items like { start: null }
    // Validate end if provided (allow null/undefined); also ensure end >= start
    let endISO;
    if (e.end != null) {
        const maybe = (0, events_1.asISO)(e.end);
        if (maybe && Date.parse(maybe) >= Date.parse(startISO)) {
            endISO = maybe;
        }
    }
    const confidence = typeof e.confidence === "number" ? e.confidence : 0.6;
    return {
        title: e.title.trim() || "Untitled",
        start: startISO,
        end: endISO,
        allDay: e.allDay ?? false,
        timezone,
        source: "llm",
        confidence,
    };
}
//# sourceMappingURL=llmEventExtractor.js.map