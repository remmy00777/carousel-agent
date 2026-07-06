import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../lib/db";
import { currentUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["approve", "reject", "update"]),
  scheduledFor: z.string().datetime().optional(),
  caption: z.string().max(2200).optional(),
  title: z.string().max(200).optional(),
  slides: z.array(z.object({ heading: z.string().min(1), body: z.string() })).min(2).max(10).optional(),
});

async function ownedDraft(id: string, userId: string) {
  return db.carouselDraft.findFirst({
    where: { id, agent: { userId } },
    include: { assets: { orderBy: { idx: "asc" } } },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const draft = await ownedDraft(params.id, user.id);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const draft = await ownedDraft(params.id, user.id);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (draft.status === "PUBLISHED" || draft.status === "PUBLISHING") {
    return NextResponse.json({ error: "Draft is already publishing/published" }, { status: 409 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { action, scheduledFor, caption, title, slides } = parsed.data;

  if (action === "reject") {
    const updated = await db.carouselDraft.update({
      where: { id: draft.id },
      data: { status: "REJECTED" },
    });
    return NextResponse.json({ draft: updated });
  }

  if (action === "approve") {
    const hasAssets = draft.assets.length >= 2;
    const updated = await db.carouselDraft.update({
      where: { id: draft.id },
      data: {
        status: hasAssets ? "SCHEDULED" : "APPROVED",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
        error: null,
      },
    });
    return NextResponse.json({
      draft: updated,
      warning: hasAssets ? undefined : "Approved, but no assets rendered yet. Run the assets stage first.",
    });
  }

  // action === "update": edits reset the draft for re-render + re-approval
  const updated = await db.carouselDraft.update({
    where: { id: draft.id },
    data: {
      ...(caption !== undefined ? { caption } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(slides !== undefined ? { slides } : {}),
      status: slides !== undefined ? "DRAFT" : draft.status,
    },
  });
  return NextResponse.json({
    draft: updated,
    warning: slides !== undefined ? "Slides changed — re-run the assets stage to render new images." : undefined,
  });
}
