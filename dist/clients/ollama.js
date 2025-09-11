"use strict";
// src/lib/ollama.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedText = embedText;
exports.ollamaGenerateJSON = ollamaGenerateJSON;
const node_fetch_1 = __importDefault(require("node-fetch"));
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
/**
 * Generate embeddings for a given text using Ollama.
 */
async function embedText(text, model = "nomic-embed-text") {
    const res = await (0, node_fetch_1.default)(`${OLLAMA_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            input: text,
        }),
    });
    if (!res.ok) {
        throw new Error(`Ollama embed error: ${res.statusText}`);
    }
    const data = (await res.json());
    return data.embedding;
}
/**
 * Run a completion with Ollama (optional).
 */
async function ollamaGenerateJSON(args) {
    const { prompt, model = "phi3:mini", signal, options } = args;
    const res = await (0, node_fetch_1.default)(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options,
        }),
    });
    if (!res.ok) {
        throw new Error(`ollama generate error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json());
    return data.response;
}
//# sourceMappingURL=ollama.js.map