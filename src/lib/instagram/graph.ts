import type { DiscoveredMedia, IgAuth, InstagramAdapter } from "./types";

/**
 * Official Instagram Graph API adapter (Meta). Compliant paths only:
 * - business_discovery for public Business/Creator account media
 * - Hashtag Search API for public hashtag top media
 * - Content Publishing API for carousel publishing
 *
 * Requires: IG Business/Creator account linked to a Facebook Page, a Meta app,
 * and approved permissions (instagram_basic, instagram_content_publish,
 * instagram_manage_insights, pages_read_engagement). See README.
 */

const apiVersion = () => process.env.IG_GRAPH_API_VERSION ?? "v21.0";
const base = () => `https://graph.facebook.com/${apiVersion()}`;

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${base()}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${json.error?.message ?? `HTTP ${res.status}`}`);
  }
  return json;
}

async function graphPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    throw new Error(`Graph API error: ${json.error?.message ?? `HTTP ${res.status}`}`);
  }
  return json;
}

function mapMedia(m: any, author?: string): DiscoveredMedia {
  return {
    sourceUrl: m.permalink ?? `https://www.instagram.com/p/${m.id ?? "unknown"}/`,
    author,
    caption: m.caption ?? "",
    mediaType: m.media_type ?? "unknown",
    likeCount: typeof m.like_count === "number" ? m.like_count : undefined,
    commentCount: typeof m.comments_count === "number" ? m.comments_count : undefined,
    timestamp: m.timestamp,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function graphAdapter(): InstagramAdapter {
  return {
    name: "graph",

    async businessDiscovery(auth, username) {
      const clean = username.replace(/^@/, "");
      const fields = `business_discovery.username(${clean}){followers_count,media_count,media.limit(15){caption,like_count,comments_count,permalink,timestamp,media_type,media_product_type}}`;
      const json = await graphGet(`/${auth.igUserId}`, {
        fields,
        access_token: auth.accessToken,
      });
      const media: any[] = json.business_discovery?.media?.data ?? [];
      return media.map((m) => mapMedia(m, clean));
    },

    async hashtagTopMedia(auth, hashtag) {
      const q = hashtag.replace(/^#/, "");
      const search = await graphGet("/ig_hashtag_search", {
        user_id: auth.igUserId,
        q,
        access_token: auth.accessToken,
      });
      const hashtagId = search.data?.[0]?.id;
      if (!hashtagId) return [];
      const top = await graphGet(`/${hashtagId}/top_media`, {
        user_id: auth.igUserId,
        fields: "caption,comments_count,like_count,media_type,permalink,timestamp",
        limit: "15",
        access_token: auth.accessToken,
      });
      return (top.data ?? []).map((m: any) => mapMedia(m));
    },

    async publishCarousel(auth, imageUrls, caption) {
      if (imageUrls.length < 2 || imageUrls.length > 10) {
        throw new Error("Instagram carousels require 2-10 images");
      }
      // 1) Create item containers
      const children: string[] = [];
      for (const url of imageUrls) {
        const item = await graphPost(`/${auth.igUserId}/media`, {
          image_url: url,
          is_carousel_item: "true",
          access_token: auth.accessToken,
        });
        children.push(item.id);
      }
      // 2) Create carousel container
      const container = await graphPost(`/${auth.igUserId}/media`, {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption,
        access_token: auth.accessToken,
      });
      // 3) Wait for container to be ready
      for (let i = 0; i < 10; i++) {
        const status = await graphGet(`/${container.id}`, {
          fields: "status_code",
          access_token: auth.accessToken,
        });
        if (status.status_code === "FINISHED") break;
        if (status.status_code === "ERROR") throw new Error("Media container failed processing");
        await sleep(3000);
      }
      // 4) Publish
      const published = await graphPost(`/${auth.igUserId}/media_publish`, {
        creation_id: container.id,
        access_token: auth.accessToken,
      });
      return { id: published.id };
    },
  };
}
