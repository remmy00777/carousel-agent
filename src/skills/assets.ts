import { db } from "../lib/db";
import { renderSlideSVG, type Slide } from "../lib/render/templates";
import { svgToPng } from "../lib/render/renderer";
import { getStorage } from "../lib/storage";

/**
 * Skill 4 — Carousel Asset Generation.
 * Renders each slide of a script through the agent's brand template
 * (SVG -> PNG via sharp) and stores the files via the storage driver.
 * Approval mode -> PENDING_APPROVAL; Auto mode -> SCHEDULED immediately.
 */

export async function generateAssets(
  agentId: string,
  draftId?: string
): Promise<{ rendered: number; notes: string[] }> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const drafts = await db.carouselDraft.findMany({
    where: draftId ? { id: draftId, agentId } : { agentId, status: "DRAFT" },
    orderBy: { createdAt: "asc" },
  });

  const storage = getStorage();
  const notes: string[] = [];
  let rendered = 0;

  for (const draft of drafts) {
    const slides = draft.slides as unknown as Slide[];
    if (!Array.isArray(slides) || slides.length < 2) {
      notes.push(`Draft ${draft.id}: invalid slides payload, skipped`);
      continue;
    }
    try {
      for (let i = 0; i < slides.length; i++) {
        const svg = renderSlideSVG(slides[i], i, slides.length, agent.brand);
        const png = await svgToPng(svg);
        const key = `agents/${agentId}/drafts/${draft.id}/slide-${String(i + 1).padStart(2, "0")}.png`;
        await storage.put(key, png);
        await db.slideAsset.upsert({
          where: { draftId_idx: { draftId: draft.id, idx: i } },
          create: { draftId: draft.id, idx: i, storageKey: key },
          update: { storageKey: key },
        });
        rendered++;
      }
      // Remove stale assets if the slide count shrank after an edit
      await db.slideAsset.deleteMany({ where: { draftId: draft.id, idx: { gte: slides.length } } });

      if (draft.status === "DRAFT") {
        const next =
          agent.mode === "AUTO"
            ? { status: "SCHEDULED" as const, scheduledFor: new Date(Date.now() + 5 * 60_000) }
            : { status: "PENDING_APPROVAL" as const };
        await db.carouselDraft.update({ where: { id: draft.id }, data: next });
      }
    } catch (e) {
      notes.push(`Draft ${draft.id}: render failed — ${(e as Error).message}`);
    }
  }

  return { rendered, notes };
}
