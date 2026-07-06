import type { LlmProvider } from "./index";

export function anthropicProvider(): LlmProvider {
  return {
    name: "anthropic",
    async complete({ system, prompt }) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      return msg.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}
