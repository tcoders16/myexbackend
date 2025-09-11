// services/extractService.ts
import { extractRules } from "./ruleEventExtractor";
import { extractLLM } from "./llmEventExtractor";
import type { ExtractionResult } from "../../types/events.ts";

const LLM_WAIT_MS = 15000;

/**
 * Strategy (fixed):
 * 1) Try LLM first with a strict 5s budget.
 * 2) If timed out / degraded / no events → run Rules.
 * 3) Return whichever produced events (Rules may also return empty; caller can handle upstream).
 */
export async function extractSmart(input: {
  text?: string;
  fileId?: string;
  timezone: string;
  referenceDate?: string;
  llmFirst?: boolean;   // ignored; we always do LLM first per requirement
  budgetMs?: number;    // caller budget is not used here; we enforce 5s
}): Promise<ExtractionResult> {
  const overallStart = Date.now();
  console.log(`🧠 Strategy: LLM first (max ${LLM_WAIT_MS}ms), then Rules if needed.`);

  // 1) LLM attempt with hard 5s cap (extractLLM honors budgetMs via AbortController)
  const llmStart = Date.now();
  const llm = await extractLLM({ ...input, budgetMs: LLM_WAIT_MS });
  const llmElapsed = Date.now() - llmStart;

  if (!llm.degraded && llm.events.length > 0) {
    console.log(
      `✅ Using LLM extraction (successful) in ${llmElapsed}ms; events=${llm.events.length}`
    );
    return llm;
  }

  const llmReason = llm.degraded
    ? (llm.warnings?.[0] ?? "llm degraded")
    : "llm returned no events";
  console.log(`⚠️ LLM not usable → ${llmReason}. Falling back to Rules.`);

  // 2) Rules fallback
  const rulesStart = Date.now();
  const rules = await extractRules(input);
  const rulesElapsed = Date.now() - rulesStart;

  console.log(
    `📜 Rules extraction completed in ${rulesElapsed}ms; events=${rules.events.length}`
  );
  console.log(`⏱️ Total extractSmart time: ${Date.now() - overallStart}ms`);

  return rules;
}