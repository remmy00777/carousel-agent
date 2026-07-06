import Parser from "rss-parser";
import { db } from "../lib/db";
import { decrypt } from "../lib/crypto";
import { getInstagram, type DiscoveredMedia, type IgAuth } from "../lib/instagram";
import { nicheKeywords, scorePost } from "../lib/ranking";

/**
 * Skill 1 — Trend Discovery & Content Collection.
 * Pulls public content signals from the agent's approved sources
 * (IG business_discovery, IG hashtag search, RSS feeds, URL metadata,
 * manual uploads) and stores scored CollectedPost rows. Never scrapes
 * private data or bypasses platform protections.
 */

async function fetchRss(feedUrl: string): Promise<DiscoveredMedia[]> {
  const parser = new Parser({ timeout: 15_000 });
  const feed = await parser.parseURL(feedUrl);
  return (feed.items ?? []).slice(0, 15).map((item) => ({
    sourceUrl: item.link ?? `${feedUrl}#${item.guid ?? item.title}`,
    author: feed.title ?? undefined,
    caption: [item.title, item.contentSnippet?.slice(0, 400)].filter(Boolean).join(" — "),
    mediaType: "article",
    timestamp: item.isoDate,
  }));
}

async function fetchUrlMeta(url: string): Promise<DiscoveredMedia[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; CarouselAgent/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ??
    pick(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i) ??
    pick(/<title[^>]*>([^<]*)<\/title>/i);
  const desc =
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ??
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  if (!title && !desc) return [];
  return [
    {
      sourceUrl: url,
      caption: [title, desc].filter(Boolean).join(" — "),
      mediaType: "article",
    },
  ];
}

export async function discover(agentId: string): Promise<{ collected: number; notes: string[] }> {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { sources: true, igConnection: true },
  });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const ig = getInstagram();
  const keywords = nicheKeywords(agent);
  const notes: string[] = [];
  let collected = 0;

  let igAuth: IgAuth | null = null;
  if (agent.igConnection) {
    igAuth = {
      igUserId: agent.igConnection.igUserId,
      accessToken: decrypt(agent.igConnection.accessTokenEnc),
      username: agent.igConnection.username,
    };
  }

  for (const source of agent.sources.filter((s) => s.active)) {
    let items: DiscoveredMedia[] = [];
    try {
      switch (source.type) {
        case "RSS":
          items = await fetchRss(source.value);
          break;
        case "URL":
          items = await fetchUrlMeta(source.value);
          break;
        case "IG_HANDLE":
        case "HASHTAG": {
          if (!igAuth && ig.name === "graph") {
            notes.push(`Skipped ${source.type} "${source.value}": no Instagram connection`);
            continue;
          }
          const auth = igAuth ?? { igUserId: "mock", accessToken: "mock" };
          items =
            source.type === "IG_HANDLE"
              ? await ig.businessDiscovery(auth, source.value)
              : await ig.hashtagTopMedia(auth, source.value);
          break;
        }
        case "MANUAL":
          continue; // manual posts are stored at upload time
      }
    } catch (e) {
      notes.push(`Source "${source.value}" failed: ${(e as Error).message}`);
      continue;
    }

    for (const m of items) {
      const postedAt = m.timestamp ? new Date(m.timestamp) : null;
      const scores = scorePost(
        { likeCount: m.likeCount, commentCount: m.commentCount, postedAt, caption: m.caption, topic: "" },
        keywords
      );
      try {
        await db.collectedPost.upsert({
          where: { agentId_sourceUrl: { agentId, sourceUrl: m.sourceUrl } },
          create: {
            agentId,
            sourceId: source.id,
            sourceType: source.type,
            sourceUrl: m.sourceUrl,
            author: m.author,
            caption: m.caption ?? "",
            topic: (m.caption ?? "").slice(0, 120),
            format: m.mediaType ?? "unknown",
            likeCount: m.likeCount,
            commentCount: m.commentCount,
            postedAt,
            ...scores,
          },
          update: {
            likeCount: m.likeCount,
            commentCount: m.commentCount,
            ...scores,
          },
        });
        collected++;
      } catch (e) {
        notes.push(`Save failed for ${m.sourceUrl}: ${(e as Error).message}`);
      }
    }
  }

  return { collected, notes };
}
