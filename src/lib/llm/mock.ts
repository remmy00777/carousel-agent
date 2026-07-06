import type { LlmProvider } from "./index";

/**
 * Deterministic offline provider so the full pipeline runs without API keys.
 * Skills embed "TOPIC:" and "NICHE:" markers in prompts; the mock keys off those.
 */

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function extract(prompt: string, marker: string, fallback: string): string {
  const m = prompt.match(new RegExp(`${marker}\\s*(.+)`));
  return (m?.[1] ?? fallback).trim().slice(0, 80);
}

export function mockProvider(): LlmProvider {
  return {
    name: "mock",
    async complete({ task, prompt }) {
      const topic = extract(prompt, "TOPIC:", "your niche");
      const niche = extract(prompt, "NICHE:", "general");

      if (task === "analyze") {
        return JSON.stringify({
          hookStyle: "Bold claim with a curiosity gap",
          emotionalAngle: "Fear of leaving easy results on the table",
          painPoint: `Audience feels overwhelmed and unsure where to start with ${topic}`,
          structure: "Hook, numbered steps, proof point, CTA",
          cta: "Save this post and follow for more",
          topicCluster: topic,
          visualPattern: "High-contrast, text-first slides with one idea per slide",
          strategicInsight: `Posts about "${topic}" perform when they promise one concrete outcome and deliver short, numbered, skimmable steps rather than abstract advice.`,
          score: 60 + (hash(topic) % 36),
        });
      }

      // task === "script"
      const nicheWords = niche
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      const hashtags = Array.from(
        new Set([...nicheWords.map((w) => `#${w}`), "#learnontiktok".replace("tiktok", "ig"), "#carouseltips", "#growthtips"])
      ).slice(0, 12);
      const slides = [
        { heading: `The truth about ${topic}`, body: "Most people get this wrong. Swipe to see the simple system that actually works." },
        { heading: "Why most advice fails", body: "Generic tips ignore the one thing that matters: consistency beats intensity every single time." },
        { heading: "Step 1: Start smaller than feels useful", body: "Pick one action so small you cannot fail. Momentum is built, not found." },
        { heading: "Step 2: Track one number", body: "You cannot improve what you do not measure. Choose a single metric and review it weekly." },
        { heading: "Step 3: Systemize the boring parts", body: "Templates, checklists, and defaults remove decision fatigue and keep you moving." },
        { heading: "The compounding effect", body: "Small, repeated wins stack. In 90 days the gap between doing and planning becomes obvious." },
        { heading: "Save this for later", body: "Follow for more practical breakdowns, and share this with someone who needs the push." },
      ];
      return JSON.stringify({
        title: `The truth about ${topic}`,
        slides,
        caption: `Everyone overcomplicates ${topic}.\n\nHere is the simple 3-step system that actually works:\n1. Start smaller than feels useful\n2. Track one number\n3. Systemize the boring parts\n\nSave this post so you can come back to it, and follow for more practical breakdowns.`,
        hashtags,
        altTexts: slides.map((s, i) => `Slide ${i + 1}: ${s.heading}. ${s.body}`),
        rationale: `Uses a bold-claim hook and numbered-steps structure, which the analyzed posts in this niche reward. Copy is original and pattern-based, not paraphrased from any source.`,
      });
    },
  };
}
