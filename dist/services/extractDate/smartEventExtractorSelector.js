"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSmart = extractSmart;
// services/extractService.ts
const ruleEventExtractor_1 = require("./ruleEventExtractor");
const llmEventExtractor_1 = require("./llmEventExtractor");
const LLM_WAIT_MS = 15000;
/**
 * Strategy (fixed):
 * 1) Try LLM first with a strict 5s budget.
 * 2) If timed out / degraded / no events → run Rules.
 * 3) Return whichever produced events (Rules may also return empty; caller can handle upstream).
 */
async function extractSmart(input) {
    const overallStart = Date.now();
    console.log(`🧠 Strategy: LLM first (max ${LLM_WAIT_MS}ms), then Rules if needed.`);
    // 1) LLM attempt with hard 5s cap (extractLLM honors budgetMs via AbortController)
    const llmStart = Date.now();
    const llm = await (0, llmEventExtractor_1.extractLLM)({ ...input, budgetMs: LLM_WAIT_MS });
    const llmElapsed = Date.now() - llmStart;
    if (!llm.degraded && llm.events.length > 0) {
        console.log(`✅ Using LLM extraction (successful) in ${llmElapsed}ms; events=${llm.events.length}`);
        return llm;
    }
    const llmReason = llm.degraded
        ? (llm.warnings?.[0] ?? "llm degraded")
        : "llm returned no events";
    console.log(`⚠️ LLM not usable → ${llmReason}. Falling back to Rules.`);
    // 2) Rules fallback
    const rulesStart = Date.now();
    const rules = await (0, ruleEventExtractor_1.extractRules)(input);
    const rulesElapsed = Date.now() - rulesStart;
    console.log(`📜 Rules extraction completed in ${rulesElapsed}ms; events=${rules.events.length}`);
    console.log(`⏱️ Total extractSmart time: ${Date.now() - overallStart}ms`);
    return rules;
}
//# sourceMappingURL=smartEventExtractorSelector.js.map