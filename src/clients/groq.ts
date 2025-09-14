
import fetch from "node-fetch";

/**
 * ENV you must set on the backend:
 * - GROQ_API_KEY           required
 * - GROQ_MODEL             optional (defaults to "llama-3.1-8b-instant")
 */
const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

type OpenAIChatCompletion = {
  choices?: Array<{
    message?: { role?: string; content?: string };
  }>;
};

/** 
 * Generate JSON from Groq (OpenAI-compatible) using your prompt.
 * Returns the raw assistant content string (which should be JSON per your prompt).
 */
export async function groqGenerateJSON(args: {
  prompt: string;
  model?: string;
  signal?: AbortSignal;
  options?: { temperature?: number; max_tokens?: number };
}): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY in server environment");
  }

  const { prompt, model = DEFAULT_MODEL, signal, options } = args;

  const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
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
          content:
            "You are an event extraction engine. Reply ONLY with valid minified JSON. No code fences. No prose.",
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

async function safeText(r: any) {
  try { return await r.text(); } catch { return ""; }
}