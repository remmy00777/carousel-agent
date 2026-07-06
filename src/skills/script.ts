import { db } from "../lib/db";
import { getLlm, parseJsonLoose } from "../lib/llm";
import { ScriptSchema, type ScriptData } from "../lib/llm/schemas";

/**
 * Skill 3 — Carousel Script Generation.
 * Turns the best unused insights into ORIGINAL carousel scripts:
 * slide-by-slide copy (title, body, CTA slides), caption, hashtags,
 * alt text, and a rationale. Includes an originality guard that rejects
 * output sharing long word sequences with the source post.
 */

const SYSTEM = `You are an expert Instagram copywriter. You write 100% original carousel copy. You may use the provided strategic patterns (hook style, structure, emotional angle) but you must NEVER copy or closely paraphrase the source material's wording. Return ONLY a valid JSON object with exactly these keys:
title (string), slides (array of 6-9 objects with heading and body; slide 1 is a scroll-stopping title slide, the last slide is a CTA slide), caption (string, 80-200 words, line breaks allowed), hashtags (array of 8-20 niche hashtag strings starting with #), altTexts (array, one accessibility description per slide), rationale (string, 2-3 sentences on the strategy used).
Rules: headings <= 10 words; slide bodies <= 55 words; no emojis in headings; no engagement-bait spam; no claims you cannot support.`;

/** True if a and b share any run of `n` consecutive words (case-insensitive). */
export function sharesLongSubstring(a: string, b: string, n = 10): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const wa = norm(a);
  const wb = norm(b).join(" ");
  if (wa.length < n) return false;
  for (let i = 0; i + n <= wa.length; i++) {
    if (wb.includes(wa.slice(i, i + n).join(" "))) return true;
  }
  return false;
}

function scriptText(s: ScriptData): string {
  return [s.title, ...s.slides.map((sl) => `${sl.heading} ${sl.body}`), s.caption].join(" ");
}

export async function generateScripts(agentId: string, maxDrafts = 1): Promise<{ drafts: number; notes: string[] }> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const insights = await db.insight.findMany({
    where: { agentId, drafts: { none: {} } },
    orderBy: { score: "desc" },
    take: maxDrafts,
    include: { post: true },
  });

  const llm = getLlm();
  const notes: string[] = [];
  let drafts = 0;

  for (const insight of insights) {
    const prompt = `Agent profile:
NICHE: ${agent.niche}
Tone: ${agent.tone}
Audience: ${agent.audience}
Goals: ${agent.goals}

Strategic insight to build from (patterns only — do not reuse source wording):
TOPIC: ${insight.topicCluster}
Hook style: ${insight.hookStyle}
Emotional angle: ${insight.emotionalAngle}
Audience pain point: ${insight.painPoint}
Structure that worked: ${insight.structure}
CTA that worked: ${insight.cta}
Strategic takeaway: ${insight.strategicInsight}

Write a fully original Instagram carousel for this agent and return the JSON object.`;

    try {
      let parsed: ReturnType<typeof ScriptSchema.safeParse> | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await llm.complete({
          task: "script",
          system: SYSTEM,
          prompt:
            attempt === 0
              ? prompt
              : `${prompt}\n\nYour previous output was invalid or too close to the source wording. Return ONLY corrected, fully original JSON.`,
        });
        const candidate = ScriptSchema.safeParse(parseJsonLoose(raw));
        if (!candidate.success) {
          parsed = candidate;
          continue;
        }
        // Originality guard vs. the source caption
        if (insight.post?.caption && sharesLongSubstring(scriptText(candidate.data), insight.post.caption)) {
          parsed = null;
          notes.push(`Insight ${insight.id}: attempt ${attempt + 1} too close to source, retrying`);
          continue;
        }
        parsed = candidate;
        break;
      }
      if (!parsed?.success) {
        notes.push(`Insight ${insight.id}: could not produce a valid original script, skipped`);
        continue;
      }

      const data = parsed.data;
      // Ensure altTexts aligns with slides
      const altTexts = data.slides.map(
        (s, i) => data.altTexts[i] ?? `Slide ${i + 1}: ${s.heading}. ${s.body}`
      );

      await db.carouselDraft.create({
        data: {
          agentId,
          insightId: insight.id,
          title: data.title,
          slides: data.slides,
          caption: data.caption,
          hashtags: data.hashtags,
          altTexts,
          rationale: data.rationale,
          status: "DRAFT",
        },
      });
      drafts++;
    } catch (e) {
      notes.push(`Insight ${insight.id}: ${(e as Error).message}`);
    }
  }

  return { drafts, notes };
}
