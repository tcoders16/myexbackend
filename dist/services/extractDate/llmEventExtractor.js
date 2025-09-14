"use strict";
// =============================
// services/llmEventExtractor.ts
// -----------------------------
// LLM-based extractor using Groq (OpenAI-compatible).
// - Strict prompt (JSON only)
// - Zod validation
// - Sanitizes + normalizes fields
// - Timeout via AbortController
// - Clean logging + warnings
// =============================
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLLM = extractLLM;
const zod_1 = require("zod");
const groq_1 = require("../../clients/groq"); // ← or "../../clients/groq" if that's where you put it
const events_1 = require("../../types/events");
const DEBUG_LLM = process.env.NODE_ENV !== "production";
function logChunk(label, s, max = 1200) {
    if (!DEBUG_LLM)
        return;
    const safe = typeof s === "string" ? s : String(s ?? "");
    const head = safe.slice(0, max);
    const more = safe.length > max ? ` …(+${safe.length - max} chars truncated)` : "";
    console.debug(label, head + more);
}
const LlmEvent = zod_1.z.object({
    title: zod_1.z.string().min(1),
    start: zod_1.z.string().min(1).nullable().optional(),
    end: zod_1.z.string().min(1).nullable().optional(),
    allDay: zod_1.z.boolean().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
});
const LlmOut = zod_1.z.object({
    events: zod_1.z.array(LlmEvent).default([]),
    warnings: zod_1.z.array(zod_1.z.string()).optional(),
});
async function extractLLM(input) {
    const raw = (input.text ?? "").trim();
    if (!raw) {
        const warn = "empty text";
        console.warn("[extractLLM] skipped:", warn);
        return { events: [], degraded: true, warnings: [{ code: "EMPTY_TEXT", message: warn }] };
    }
    const controller = new AbortController();
    const timeoutMs = clampPositive(input.budgetMs ?? 6000, 1000, 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // ✅ Groq model pick (env → prop → default)
    const model = process.env.GROQ_MODEL ?? input.model ?? "llama-3.1-8b-instant";
    try {
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
        const respText = await (0, groq_1.groqGenerateJSON)({
            prompt,
            model,
            signal: controller.signal,
            options: { temperature: 0, max_tokens: 900 },
        });
        logChunk("[extractLLM] raw LLM output", respText);
        const jsonStr = extractJsonBlock(respText);
        logChunk("[extractLLM] extracted JSON candidate", jsonStr);
        let parsed;
        try {
            parsed = LlmOut.parse(JSON.parse(jsonStr));
        }
        catch (zerr) {
            console.warn("[extractLLM] schema/json parse failed", {
                message: zerr?.message,
                issues: zerr?.issues,
            });
            try {
                JSON.parse(jsonStr);
            }
            catch (nativeErr) {
                console.warn("[extractLLM] JSON.parse error", { message: nativeErr?.message });
            }
            if (DEBUG_LLM && typeof window !== "undefined") {
                window.__LLM_LAST_RAW__ = respText;
                window.__LLM_LAST_JSON__ = jsonStr;
            }
            return {
                events: [],
                degraded: true,
                warnings: [{ code: "LLM_BAD_JSON", message: "llm bad json/schema" }],
            };
        }
        const cleanEvents = parsed.events
            .map((e) => sanitizeEvent(e, input.timezone))
            .filter(Boolean);
        const warnObjs = parsed.warnings?.map((w) => ({ code: "LLM_WARNING", message: w })) ?? [];
        console.log("[extractLLM] success", { events: cleanEvents.length });
        return { events: cleanEvents, degraded: false, warnings: [{ code: "LLM_OK", message: "llm success" }] };
    }
    catch (e) {
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
function clampPositive(n, min, max) {
    return Math.max(min, Math.min(n, max));
}
function extractJsonBlock(s) {
    const trimmed = s.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}"))
        return trimmed;
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence)
        return fence[1].trim();
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
        const candidate = trimmed.slice(first, last + 1).trim();
        try {
            JSON.parse(candidate);
            return candidate;
        }
        catch { }
    }
    return trimmed;
}
function sanitizeEvent(e, timezone) {
    const startISO = (0, events_1.asISO)(e.start);
    if (!startISO)
        return null;
    let endISO;
    if (e.end != null) {
        const maybe = (0, events_1.asISO)(e.end);
        if (maybe && Date.parse(maybe) >= Date.parse(startISO))
            endISO = maybe;
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