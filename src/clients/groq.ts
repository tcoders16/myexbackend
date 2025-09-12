// src/lib/ollama.ts  (now Groq-backed; keeping export names for compatibility)

import fetch from "node-fetch";
import  {Response} from "node-fetch";
/**
 * ENV expected:
 *  - GROQ_API_KEY          (required for Groq)
 *  - GROQ_MODEL            (optional, default: "llama-3.1-8b-instant")
 *  - GROQ_EMBED_MODEL      (optional; if absent we fallback to Ollama embeddings)
 *  - OLLAMA_URL            (optional fallback for embeddings; default http://localhost:11434)
 */

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ;
const GROQ_EMBED_MODEL = process.env.GROQ_EMBED_MODEL || ""; // leave blank if you don't want embeddings via Groq

const OLLAMA_URL = process.env.OLLAMA_URL ;

/* ---------------- Types ---------------- */

type OpenAIChatCompletion = {
  choices?: Array<{ message?: { role?: string; content?: string } }>;
};

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
};

/* ---------------- Embeddings ---------------- */

/**
 * Generate embeddings via Groq's OpenAI-compatible endpoint if GROQ_EMBED_MODEL is set.
 * Otherwise, fallback to local Ollama embeddings (model "nomic-embed-text" by default).
 */
export async function embedText(text: string, model = "nomic-embed-text"): Promise<number[]> {
  if (GROQ_API_KEY && GROQ_EMBED_MODEL) {
    // Try Groq embeddings first (if explicitly configured)
    const res: Response = await fetch(`${GROQ_API_BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_EMBED_MODEL, // e.g. if/when Groq exposes an embedding model for you
        input: text,
      }),
    });

    if (!res.ok) {
      const body = await safeText(res);
      throw new Error(`Groq embeddings error: ${res.status} ${res.statusText} — ${body}`);
    }

    const json = (await res.json()) as OpenAIEmbeddingResponse;
    const emb = json?.data?.[0]?.embedding;
    if (!emb) throw new Error("Groq embeddings: empty embedding");
    return emb;
  }

  // ---------- Fallback: Ollama local embeddings ----------
  const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });

  if (!r.ok) {
    const body = await safeText(r);
    throw new Error(`Ollama embed error: ${r.status} ${r.statusText} — ${body}`);
  }

  const data = (await r.json()) as { embedding: number[] };
  if (!data?.embedding) throw new Error("Ollama: empty embedding");
  return data.embedding;
}

/* ---------------- Text generation ---------------- */

/**
 * Kept the same name for compatibility with your existing imports.
 * Under the hood this now calls Groq's Chat Completions (OpenAI-compatible).
 */
export async function groqGenerateJSON(args: {
  prompt: string;
  model?: string;
  signal?: AbortSignal;
  options?: { temperature?: number; max_tokens?: number };
}): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY — set it in your backend environment.");
  }

  const { prompt, model = GROQ_MODEL, signal, options } = args;

  const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an event extraction engine. Reply ONLY with valid JSON. No code fences, no prose.",
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

  const json = (await res.json()) as OpenAIChatCompletion;
  const content = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq: empty completion");
  return content;
}

/* ---------------- Utils ---------------- */

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}