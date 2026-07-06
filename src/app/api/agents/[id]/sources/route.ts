import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { currentUser } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

const CreateSource = z.object({
  type: z.enum(["IG_HANDLE", "HASHTAG", "RSS", "URL", "MANUAL"]),
  value: z.string().min(1).max(500),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = CreateSource.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const source = await db.inspirationSource.create({
    data: { agentId: agent.id, ...parsed.data },
  });
  return NextResponse.json({ source }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = z.object({ sourceId: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  await db.inspirationSource.deleteMany({ where: { id: body.data.sourceId, agentId: agent.id } });
  return NextResponse.json({ ok: true });
}
