"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSmart = extractSmart;
// services/extractService.ts
const llmEventExtractor_1 = require("./llmEventExtractor");
const LLM_WAIT_MS = 15000;
/**
 * LLM-only extraction:
 * - Calls the LLM extractor with a hard time budget.
 * - Never falls back to rules.
 * - Returns whatever the LLM returned (even if 0 events).
 */
async function extractSmart(input) {
    const t0 = Date.now();
    console.log(`🧠 LLM-only strategy (max ${LLM_WAIT_MS}ms).`);
    const llm = await (0, llmEventExtractor_1.extractLLM)({ ...input, budgetMs: LLM_WAIT_MS });
    console.log(`✔️ LLM extraction finished in ${Date.now() - t0}ms; events=${llm.events.length} degraded=${llm.degraded ?? false}`);
    // If no events → mark degraded + push a warning
    if (llm.events.length === 0 && !llm.degraded) {
        return {
            ...llm,
            degraded: true,
            warnings: [
                ...(llm.warnings ?? []),
                {
                    code: "NO_RETURN_EVENT",
                    message: "LLM returned 0 events",
                },
            ],
        };
    }
    return llm;
}
//# sourceMappingURL=smartEventExtractorSelector.js.map