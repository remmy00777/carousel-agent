import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { currentUser } from "../../../../../lib/auth";
import { enqueue } from "../../../../../lib/queue";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const draft = await db.carouselDraft.findFirst({
    where: { id: params.id, agent: { userId: user.id } },
    include: { assets: true },
  });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (draft.status === "PUBLISHED") {
    return NextResponse.json({ error: "Already published" }, { status: 409 });
  }
  if (draft.assets.length < 2) {
    return NextResponse.json({ error: "No rendered assets. Run the assets stage first." }, { status: 400 });
  }

  await db.carouselDraft.update({
    where: { id: draft.id },
    data: { status: "SCHEDULED", scheduledFor: new Date(), error: null },
  });
  try {
    await enqueue("publish", { draftId: draft.id, agentId: draft.agentId });
  } catch {
    return NextResponse.json(
      { error: "Job queue unreachable. Make sure Redis is running and the worker is started." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
