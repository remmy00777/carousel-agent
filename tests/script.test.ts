import { describe, expect, it } from "vitest";
import { mockProvider } from "../src/lib/llm/mock";
import { parseJsonLoose } from "../src/lib/llm";
import { InsightSchema, ScriptSchema } from "../src/lib/llm/schemas";
import { sharesLongSubstring } from "../src/skills/script";

describe("llm pipeline", () => {
  it("mock analyze output satisfies InsightSchema", async () => {
    const raw = await mockProvider().complete({
      task: "analyze",
      system: "",
      prompt: "NICHE: personal finance\nTOPIC: budgeting basics",
    });
    const parsed = InsightSchema.safeParse(parseJsonLoose(raw));
    expect(parsed.success).toBe(true);
  });

  it("mock script output satisfies ScriptSchema with aligned altTexts", async () => {
    const raw = await mockProvider().complete({
      task: "script",
      system: "",
      prompt: "NICHE: personal finance\nTOPIC: emergency funds",
    });
    const parsed = ScriptSchema.parse(parseJsonLoose(raw));
    expect(parsed.slides.length).toBeGreaterThanOrEqual(5);
    expect(parsed.altTexts.length).toBe(parsed.slides.length);
    expect(parsed.hashtags.every((h) => h.startsWith("#"))).toBe(true);
  });

  it("parseJsonLoose strips code fences", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("originality guard detects long shared word runs", () => {
    const source = "the quick brown fox jumps over the lazy dog every single morning before sunrise in the field";
    expect(sharesLongSubstring(source, source)).toBe(true);
    expect(sharesLongSubstring("completely different original writing about another topic entirely with no overlap at all here", source)).toBe(false);
  });
});
