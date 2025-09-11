// types/events.ts

/** Nominal brand to mark ISO-8601 strings at the type level */
export type ISO8601 = string & { readonly __brand: "ISO8601" };

/** Helper to brand a string after validation (runtime guard lives in zod schema) */
export const asISO = (s: string) => s as ISO8601;

/** Where the event came from */
export type EventSource = "rules" | "llm";

/** Machine-readable warnings that the UI/analytics can group on  */
export type WarningCode =
  | "RELATIVE_DATE"
  | "TIMEZONE_ASSUMED"
  | "END_BEFORE_START_DROPPED"
  | "BAD_ISO_DROPPED"
  | "EMPTY_TEXT"
  | "LLM_TIMEOUT"
  | "LLM_ABORTED"
  | "LLM_ERROR"
  | "LLM_OK"
  | "LLM_BAD_JSON"
  | "OTHER";

/** Structured warning (code is great for filtering; message for humans) */
export type ExtractionWarning = {
  code: WarningCode;
  message: string;
  /** optional context for debugging (e.g., original phrase, offsets) */
  context?: Record<string, unknown>;
};

/** Minimal event + a few high-value, optional fields used by calendars */
export type EventLite = {
  /** ICS SUMMARY */
  readonly title: string;

  /** ISO 8601 start (UTC or with offset), e.g. "2025-08-29T17:00:00Z" */
  readonly start: ISO8601;

  /** ISO 8601 end (>= start) */
  readonly end?: ISO8601;

  /** Treat as date-only in ICS output */
  readonly allDay?: boolean;

  /** IANA TZ, e.g., "America/Toronto" */
  readonly timezone?: string;

  /** Which extractor produced this event */
  readonly source?: EventSource;

  /** Confidence (0..1). Rules ~0.7–0.85; LLM returns its own */
  readonly confidence?: number;

  // Optional quality-of-life fields (safe to leave undefined)
  readonly location?: string;       // ICS LOCATION
  readonly description?: string;    // ICS DESCRIPTION / email snippet
  readonly url?: string;            // ICS URL (mail/web link)
};

/** Rich metadata for observability and UI badges */
export type ExtractionMeta = {
  /** Which path executed */
  strategy: "llm-first" | "rules-first" | "llm-then-rules" | "rules-then-llm";
  /** Timing stats */
  timings: {
    totalMs: number;
    llmMs?: number;
    rulesMs?: number;
  };
  /** Model info when LLM used */
  model?: string;
  /** IP or correlation id if you set it upstream */
  correlationId?: string;
  /** Reason why degraded, if any */
  degradedReason?: string;
};

/** Response envelope */
export type ExtractionResult = {
  readonly events: EventLite[];
  /** True if best path failed and we had to fallback or lost fidelity */
  readonly degraded: boolean;
  /** Machine-friendly + human-friendly warnings */
  readonly warnings?: ExtractionWarning[];
  /** Optional execution metadata (great for logs/QA/telemetry) */
  readonly meta?: ExtractionMeta;
};