import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { mockProvider } from "./mock";

export type LlmTask = "analyze" | "script";

export interface LlmProvider {
  name: string;
  complete(args: { task: LlmTask; system: string; prompt: string }): Promise<string>;
}

/** Provider factory driven by LLM_PROVIDER env (mock | anthropic | openai). */
export function getLlm(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  if (p === "anthropic") return anthropicProvider();
  if (p === "openai") return openaiProvider();
  return mockProvider();
}

/** Tolerant JSON extraction: strips code fences, falls back to first {...} block. */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("LLM did not return parseable JSON");
  }
}
