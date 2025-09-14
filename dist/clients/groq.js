"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groqGenerateJSON = groqGenerateJSON;
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * ENV you must set on the backend:
 * - GROQ_API_KEY           required
 * - GROQ_MODEL             optional (defaults to "llama-3.1-8b-instant")
 */
const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
/**
 * Generate JSON from Groq (OpenAI-compatible) using your prompt.
 * Returns the raw assistant content string (which should be JSON per your prompt).
 */
async function groqGenerateJSON(args) {
    if (!GROQ_API_KEY) {
        throw new Error("Missing GROQ_API_KEY in server environment");
    }
    const { prompt, model = DEFAULT_MODEL, signal, options } = args;
    const res = await (0, node_fetch_1.default)(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are an event extraction engine. Reply ONLY with valid minified JSON. No code fences. No prose.",
                },
                { role: "user", content: prompt },
            ],
            temperature: options?.temperature ?? 0,
            max_tokens: options?.max_tokens ?? 900,
        }),
    });
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Groq generate error: ${res.status} ${res.statusText} — ${body}`);
    }
    const json = (await res.json());
    const content = json?.choices?.[0]?.message?.content ?? "";
    if (!content)
        throw new Error("Groq: empty completion");
    return content;
}
async function safeText(r) {
    try {
        return await r.text();
    }
    catch {
        return "";
    }
}
//# sourceMappingURL=groq.js.map