import { db } from "../lib/db";
import { decrypt } from "../lib/crypto";
import { getInstagram } from "../lib/instagram";
import { assetPublicUrl } from "../lib/storage";
import { enqueue } from "../lib/queue";

/**
 * Skill 5 — Scheduling & Publishing.
 * Publishes approved carousels through the official Instagram Content
 * Publishing API (graph adapter) or simulates it (mock adapter).
 * `publishDue` sweeps the schedule queue every few minutes.
 */

export async function publishDraft(draftId: string): Promise<{ published: boolean; igMediaId?: string }> {
  const draft = await db.carouselDraft.findUnique({
    where: { id: draftId },
    include: { assets: { orderBy: { idx: "asc" } }, agent: { include: { igConnection: true } } },
  });
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  if (draft.status === "PUBLISHED") return { published: true, igMediaId: draft.igMediaId ?? undefined };
  if (draft.assets.length < 2) throw new Error("Draft has no rendered assets (need >= 2 slides)");

  const ig = getInstagram();

  if (ig.name === "graph") {
    if (!draft.agent.igConnection) {
      await db.carouselDraft.update({
        where: { id: draftId },
        data: { status: "FAILED", error: "No Instagram connection. Connect an IG Business/Creator account or use IG_ADAPTER=mock." },
      });
      throw new Error("No Instagram connection for graph publishing");
    }
    if (!process.env.PUBLIC_ASSET_BASE_URL) {
      await db.carouselDraft.update({
        where: { id: draftId },
        data: { status: "FAILED", error: "PUBLIC_ASSET_BASE_URL is required: the Graph API fetches slide images from public URLs." },
      });
      throw new Error("PUBLIC_ASSET_BASE_URL not set");
    }
  }

  await db.carouselDraft.update({ where: { id: draftId }, data: { status: "PUBLISHING", error: null } });

  try {
    const auth = draft.agent.igConnection
      ? {
          igUserId: draft.agent.igConnection.igUserId,
          accessToken: decrypt(draft.agent.igConnection.accessTokenEnc),
          username: draft.agent.igConnection.username,
        }
      : { igUserId: "mock", accessToken: "mock" };

    const imageUrls = draft.assets.map((a) => assetPublicUrl(a.storageKey));
    const caption = `${draft.caption}\n\n${draft.hashtags.join(" ")}`.slice(0, 2200);

    const result = await ig.publishCarousel(auth, imageUrls, caption);

    await db.carouselDraft.update({
      where: { id: draftId },
      data: { status: "PUBLISHED", publishedAt: new Date(), igMediaId: result.id },
    });
    return { published: true, igMediaId: result.id };
  } catch (e) {
    await db.carouselDraft.update({
      where: { id: draftId },
      data: { status: "FAILED", error: (e as Error).message.slice(0, 500) },
    });
    throw e; // let BullMQ retry
  }
}

/** Enqueue publish jobs for all scheduled drafts that are due. */
export async function publishDue(): Promise<{ enqueued: number }> {
  const due = await db.carouselDraft.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
    select: { id: true, agentId: true },
  });
  for (const d of due) {
    await enqueue("publish", { draftId: d.id, agentId: d.agentId });
  }
  return { enqueued: due.length };
}
