import { describe, expect, it } from "vitest";
import {
  engagementScore,
  nicheKeywords,
  rankScore,
  recencyFactor,
  relevanceFactor,
  scorePost,
} from "../src/lib/ranking";

describe("ranking", () => {
  it("weights comments more than likes", () => {
    expect(engagementScore(0, 100)).toBeGreaterThan(engagementScore(100, 0));
  });

  it("decays recency over time", () => {
    const fresh = recencyFactor(new Date());
    const old = recencyFactor(new Date(Date.now() - 60 * 86_400_000));
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBeGreaterThanOrEqual(0.05);
  });

  it("keeps relevance in [0.3, 1]", () => {
    expect(relevanceFactor("nothing related", ["finance", "money"])).toBeGreaterThanOrEqual(0.3);
    expect(relevanceFactor("finance money money finance", ["finance", "money"])).toBeLessThanOrEqual(1);
  });

  it("ranks relevant, engaging, recent posts higher", () => {
    const keywords = nicheKeywords({ niche: "personal finance investing", goals: "savings" });
    const hot = scorePost(
      { likeCount: 9000, commentCount: 400, postedAt: new Date(), caption: "investing and savings tips", topic: "finance" },
      keywords
    );
    const cold = scorePost(
      { likeCount: 10, commentCount: 0, postedAt: new Date(Date.now() - 90 * 86_400_000), caption: "unrelated topic", topic: "" },
      keywords
    );
    expect(hot.rankScore).toBeGreaterThan(cold.rankScore);
  });

  it("rankScore is 0 for zero engagement", () => {
    expect(rankScore(0, 1, 1)).toBe(0);
  });
});
