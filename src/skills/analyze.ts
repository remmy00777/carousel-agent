import { db } from "../lib/db";
import { getLlm, parseJsonLoose } from "../lib/llm";
import { InsightSchema } from "../lib/llm/schemas";

/**
 * Skill 2 — Viral Post Analysis.
 * Takes the highest-ranked unanalyzed posts and extracts strategic patterns
 * (hook style, emotional angle, pain point, structure, CTA, topic cluster,
 * visual pattern, reusable insight). Patterns only — copy is never reused.
 */

const SYSTEM = `You are an expert Instagram content strategist. You analyze why public posts performed well, extracting reusable strategic patterns — never copying their wording. Return ONLY a valid JSON object with exactly these keys:
hookStyle, emotionalAngle, painPoint, structure, cta, topicCluster, visualPattern, strategicInsight (all strings), score (number 0-100 rating how useful this pattern is for the agent's niche).`;

export async function analyze(agentId: string, batchSize = 5): Promise<{ analyzed: number; notes: string[] }> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const posts = await db.collectedPost.findMany({
    where: { agentId, insight: null },
    orderBy: { rankScore: "desc" },
    take: batchSize,
  });

  const llm = getLlm();
  const notes: string[] = [];
  let analyzed = 0;

  for (const post of posts) {
    const prompt = `Agent profile:
NICHE: ${agent.niche}
Tone: ${agent.tone}
Audience: ${agent.audience}
Goals: ${agent.goals}

Post to analyze (public signal):
TOPIC: ${post.topic || post.caption.slice(0, 100)}
Caption/summary: ${post.caption.slice(0, 1200)}
Format: ${post.format}
Likes: ${post.likeCount ?? "unknown"} | Comments: ${post.commentCount ?? "unknown"}
Posted: ${post.postedAt?.toISOString() ?? "unknown"}

Analyze why this performed (or would perform) well for this niche and return the JSON object.`;

    try {
      let raw = await llm.complete({ task: "analyze", system: SYSTEM, prompt });
      let parsed = InsightSchema.safeParse(parseJsonLoose(raw));
      if (!parsed.success) {
        raw = await llm.complete({
          task: "analyze",
          system: SYSTEM,
          prompt: `${prompt}\n\nYour previous output failed validation: ${parsed.error.message}. Return ONLY the corrected JSON object.`,
        });
        parsed = InsightSchema.safeParse(parseJsonLoose(raw));
      }
      if (!parsed.success) {
        notes.push(`Post ${post.id}: invalid analysis JSON, skipped`);
        continue;
      }
      await db.insight.create({ data: { agentId, postId: post.id, ...parsed.data } });
      analyzed++;
    } catch (e) {
      notes.push(`Post ${post.id}: ${(e as Error).message}`);
    }
  }

  return { analyzed, notes };
}
