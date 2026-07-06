/**
 * Heuristic ranking of collected content signals.
 * rankScore = log10(1 + engagement) * recency * relevance * 100
 */

export function engagementScore(likeCount = 0, commentCount = 0): number {
  return (likeCount ?? 0) + (commentCount ?? 0) * 3;
}

/** Exponential decay with a 14-day half-life. Unknown dates get a neutral 0.6. */
export function recencyFactor(postedAt?: Date | null): number {
  if (!postedAt) return 0.6;
  const days = (Date.now() - postedAt.getTime()) / 86_400_000;
  if (days < 0) return 1;
  return Math.max(0.05, Math.pow(0.5, days / 14));
}

/** Keyword-overlap relevance in [0.3, 1]. */
export function relevanceFactor(text: string, keywords: string[]): number {
  const kws = keywords.filter((k) => k.length > 2);
  if (kws.length === 0) return 0.5;
  const t = text.toLowerCase();
  const hits = kws.filter((k) => t.includes(k.toLowerCase())).length;
  return 0.3 + 0.7 * Math.min(1, hits / Math.max(2, kws.length / 2));
}

export function rankScore(engagement: number, recency: number, relevance: number): number {
  return Math.log10(1 + Math.max(0, engagement)) * recency * relevance * 100;
}

/** Derive relevance keywords from an agent's niche + goals. */
export function nicheKeywords(agent: { niche: string; goals?: string | null }): string[] {
  const text = `${agent.niche} ${agent.goals ?? ""}`;
  const stop = new Set(["with", "that", "this", "from", "your", "their", "about", "more", "into", "have"]);
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !stop.has(w))
    )
  ).slice(0, 12);
}

export function scorePost(post: {
  likeCount?: number | null;
  commentCount?: number | null;
  postedAt?: Date | null;
  caption?: string;
  topic?: string;
}, keywords: string[]): { engagementScore: number; rankScore: number } {
  const eng = engagementScore(post.likeCount ?? 0, post.commentCount ?? 0);
  const rec = recencyFactor(post.postedAt ?? undefined);
  const rel = relevanceFactor(`${post.topic ?? ""} ${post.caption ?? ""}`, keywords);
  return { engagementScore: eng, rankScore: rankScore(eng, rec, rel) };
}
