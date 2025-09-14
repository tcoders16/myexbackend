// services/extractService.ts
import { extractLLM } from "./llmEventExtractor";
import type { ExtractionResult } from "../../types/events";
import type{ WarningCode } from "../../types/events"; // adjust path if different

const LLM_WAIT_MS = 15_000;

/**
 * LLM-only extraction:
 * - Calls the LLM extractor with a hard time budget.
 * - Never falls back to rules.
 * - Returns whatever the LLM returned (even if 0 events).
 */
export async function extractSmart(input: {
  text?: string;
  fileId?: string;
  timezone: string;
  referenceDate?: string;
  llmFirst?: boolean;   // ignored
  budgetMs?: number;    // ignored; we enforce LLM_WAIT_MS
}): Promise<ExtractionResult> {
  const t0 = Date.now();
  console.log(`🧠 LLM-only strategy (max ${LLM_WAIT_MS}ms).`);

  const llm = await extractLLM({ ...input, budgetMs: LLM_WAIT_MS });
  console.log(
    `✔️ LLM extraction finished in ${Date.now() - t0}ms; events=${llm.events.length} degraded=${llm.degraded ?? false}`
  );

  // If no events → mark degraded + push a warning
  if (llm.events.length === 0 && !llm.degraded) {
    return {
      ...llm,
      degraded: true,
      warnings: [
        ...(llm.warnings ?? []),
        {
          code: "NO_RETURN_EVENT" as WarningCode,
          message: "LLM returned 0 events",
        },
      ],
    };
  }

  return llm;
}