import type { LlmProvider } from "./index";

export function openaiProvider(): LlmProvider {
  return {
    name: "openai",
    async complete({ system, prompt }) {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}
