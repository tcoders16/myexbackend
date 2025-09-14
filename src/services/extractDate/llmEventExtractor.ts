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

import { z } from "zod";
import type { ExtractionResult, EventLite, ISO8601 } from "../../types/events";

import { asISO } from "../../types/events";
import { groqGenerateJSON } from "../../clients/groq";

const DEBUG_LLM = process.env.NODE_ENV !== "production";

function logChunk(label: string, s: string, max = 1200) {
  if (!DEBUG_LLM) return;
  const safe = typeof s === "string" ? s : String(s ?? "");
  const head = safe.slice(0, max);
  const more = safe.length > max ? ` …(+${safe.length - max} chars truncated)` : "";
  console.debug(label, head + more);
}

const LlmEvent = z.object({
  title: z.string().min(1),
  start: z.string().min(1).nullable().optional(),
  end: z.string().min(1).nullable().optional(),
  allDay: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const LlmOut = z.object({
  events: z.array(LlmEvent).default([]),
  warnings: z.array(z.string()).optional(),
});

export async function extractLLM(input: {
  text?: string;
  fileId?: string;
  timezone: string;
  referenceDate?: string;
  budgetMs?: number;
  model?: string;
}): Promise<ExtractionResult> {
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

    const respText = await groqGenerateJSON({
      prompt,
      model,
      signal: controller.signal,
      options: { temperature: 0, max_tokens: 900 },
    });

    logChunk("[extractLLM] raw LLM output", respText);

    const jsonStr = extractJsonBlock(respText);
    logChunk("[extractLLM] extracted JSON candidate", jsonStr);

    let parsed: z.infer<typeof LlmOut>;
    try {
      parsed = LlmOut.parse(JSON.parse(jsonStr));
    } catch (zerr: any) {
      console.warn("[extractLLM] schema/json parse failed", {
        message: zerr?.message,
        issues: zerr?.issues,
      });
      try { JSON.parse(jsonStr); } catch (nativeErr: any) {
        console.warn("[extractLLM] JSON.parse error", { message: nativeErr?.message });
      }
      if (DEBUG_LLM && typeof window !== "undefined") {
        (window as any).__LLM_LAST_RAW__ = respText;
        (window as any).__LLM_LAST_JSON__ = jsonStr;
      }
      return {
        events: [],
        degraded: true,
        warnings: [{ code: "LLM_BAD_JSON", message: "llm bad json/schema" }],
      };
    }

    const cleanEvents: EventLite[] = parsed.events
      .map((e) => sanitizeEvent(e, input.timezone))
      .filter(Boolean) as EventLite[];

    const warnObjs =
      parsed.warnings?.map((w) => ({ code: "LLM_WARNING", message: w })) ?? [];

    console.log("[extractLLM] success", { events: cleanEvents.length });
    return { events: cleanEvents, degraded: false, warnings: [{ code: "LLM_OK", message: "llm success" }] };
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    const reason = isTimeout ? `llm timeout after ${timeoutMs}ms` : (e?.message || "llm error");
    console.warn("[extractLLM] degraded", { reason });
    return {
      events: [],
      degraded: true,
      warnings: [{ code: isTimeout ? "LLM_TIMEOUT" : "LLM_ERROR", message: reason }],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(args: { text: string; timezone: string; referenceDate?: string }) {
  const { text, timezone, referenceDate } = args;
  return `You are an extraction engine. Extract ONLY genuine calendar-worthy items from the text.

RETURN FORMAT (minified JSON ONLY):
{"events":[{"title":"string","start":"ISO","end":"ISO?","allDay":"boolean?"}],"warnings":["string"]}

CONTEXT:
- timezone: ${timezone}
- referenceDate: ${referenceDate ?? "none"}

PARSING RULES
1) Dates:
   - Resolve relative dates/times (today, tomorrow, next Wednesday, “in 2 hours”) using referenceDate if provided.
   - Output ISO 8601 with timezone offset or Z. If time unknown for an all-day item, set allDay:true and omit time.
2) End time:
   - If explicit, use it. If duration is stated (e.g., “for 30m”), compute end.
   - If unknown, omit "end" (do NOT guess).
3) Title:
   - Short action-oriented label (e.g., “Sync with Alice”, “File court motion”, “Dentist appointment”).
   - Remove boilerplate like signatures, disclaimers, quoted headers.

EXTRACTION CRITERIA (STRICT — to avoid false positives)
Extract ONLY if at least ONE of the following is true:
- A meeting / call / appointment is proposed, scheduled, or confirmed (e.g., “meet”, “call”, “join”, “booked”, “scheduled”, “see you at 3pm”).
- A deadline or due-by date for a concrete task (e.g., “Submit report by Friday 5pm”).
- An event invitation / calendar intent (“send an invite”, “put this on calendar”, “schedule for…”).
- Explicit time window or date + intent (“kickoff on Sep 21 at 10am”, “demo next Tue 2–3pm”).

Do NOT extract if:
- It’s news, history, examples, or hypothetical (“if we met on Friday…”).
- It’s a past log with no follow-up action (“We met last week at 3pm”).
- It’s vague with no actionable intent (“Sometime this month we could chat”).
- It’s metadata (email footers, availability blocks without a chosen slot), auto-signatures, or disclaimers.
- It’s a quoted prior thread that is superseded by a newer message.

DO NOT create events from:
- Newsletters, job alerts, marketing, or listings with dates.
- Any email that lists job postings, sales, offers, or informational content.
- Dates that are headers or metadata with no explicit action to schedule.

CONFIDENCE & GATING
- Assign an internal confidence based on explicitness (invite/verb + time/date). If < 0.6, DO NOT create an event; instead add a warning "SKIPPED_LOW_CONF".
- If a sentence lists multiple candidate times, pick the one explicitly accepted/confirmed; otherwise skip with "AMBIGUOUS_TIME".

Extract ONLY if the text explicitly shows a scheduled/confirmed action 
(meeting, call, appointment, deadline). If there is no such intent, 
output {"events":[],"warnings":["NO_ACTION_INTENT"]}.

NORMALIZATION
- Deduplicate overlapping duplicates (same title ±15m).
- If only a date is given and phrased as a holiday/whole-day, set allDay:true.
- Keep titles ≤ 80 chars.

OUTPUT RULES
- Output ONLY the JSON (no prose, no code fences).
- Keep a "warnings" array; include reasons like "SKIPPED_LOW_CONF", "AMBIGUOUS_TIME", "NO_ACTION_INTENT".
- Schema must match exactly.

TEXT:
${text}`.trim();
}

function clampPositive(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function extractJsonBlock(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1).trim();
    try { JSON.parse(candidate); return candidate; } catch {}
  }
  return trimmed;
}

function sanitizeEvent(e: z.infer<typeof LlmEvent>, timezone: string): EventLite | null {
  const startISO = asISO(e.start as any);
  if (!startISO) return null;

  let endISO: ISO8601 | undefined;
  if (e.end != null) {
    const maybe = asISO(e.end as any);
    if (maybe && Date.parse(maybe) >= Date.parse(startISO)) endISO = maybe;
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