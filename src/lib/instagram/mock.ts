import type { DiscoveredMedia, InstagramAdapter } from "./types";

/**
 * Mock adapter for local development and demos. Produces deterministic,
 * clearly-fake sample signals (example.com URLs) and simulates publishing.
 */

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const HOOK_BANK = [
  "The 5 mistakes everyone makes with",
  "How I would restart from zero:",
  "Nobody talks about this side of",
  "3 signs you are doing it wrong:",
  "The beginner's roadmap to",
];

function sampleMedia(query: string, kind: string): DiscoveredMedia[] {
  const q = query.replace(/^[#@]/, "");
  return Array.from({ length: 3 }, (_, i) => {
    const seed = hash(`${q}:${i}`);
    const daysAgo = (seed % 10) + 1;
    return {
      sourceUrl: `https://example.com/mock-ig/${kind}/${encodeURIComponent(q)}/${i}`,
      author: kind === "handle" ? q : `creator_${seed % 1000}`,
      caption: `${HOOK_BANK[seed % HOOK_BANK.length]} ${q}. Here is what actually moves the needle (save this).`,
      mediaType: "CAROUSEL_ALBUM",
      likeCount: 500 + (seed % 9000),
      commentCount: 20 + (seed % 400),
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    };
  });
}

export function mockAdapter(): InstagramAdapter {
  return {
    name: "mock",
    async businessDiscovery(_auth, username) {
      return sampleMedia(username, "handle");
    },
    async hashtagTopMedia(_auth, hashtag) {
      return sampleMedia(hashtag, "hashtag");
    },
    async publishCarousel(_auth, imageUrls, _caption) {
      if (imageUrls.length < 2) throw new Error("Carousel needs at least 2 slides");
      // Simulate success; real publishing requires the graph adapter + credentials.
      return { id: `mock_media_${Date.now()}` };
    },
  };
}
