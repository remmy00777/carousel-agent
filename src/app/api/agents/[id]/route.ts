import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../lib/db";
import { currentUser } from "../../../../lib/auth";
import { scheduleAgentOrchestration, unscheduleAgent } from "../../../../lib/queue";

export const dynamic = "force-dynamic";

const UpdateAgent = z.object({
  name: z.string().min(1).max(100).optional(),
  niche: z.string().min(1).max(300).optional(),
  tone: z.string().max(300).optional(),
  audience: z.string().max(500).optional(),
  goals: z.string().max(500).optional(),
  scheduleCron: z.string().min(9).max(50).optional(),
  mode: z.enum(["APPROVAL", "AUTO"]).optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  brand: z
    .object({
      template: z.enum(["minimal", "bold", "gradient"]),
      bg: z.string(),
      fg: z.string(),
      accent: z.string(),
      handle: z.string(),
    })
    .partial()
    .optional(),
});

async function ownedAgent(id: string, userId: string) {
  return db.agent.findFirst({ where: { id, userId } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      sources: true,
      igConnection: { select: { username: true, igUserId: true, createdAt: true } },
      _count: { select: { posts: true, insights: true, drafts: true } },
    },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await ownedAgent(params.id, user.id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = UpdateAgent.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { brand, ...rest } = parsed.data;
  const updated = await db.agent.update({
    where: { id: agent.id },
    data: {
      ...rest,
      ...(brand ? { brand: { ...(agent.brand as object), ...brand } } : {}),
    },
  });

  let warning: string | undefined;
  try {
    if (updated.status === "PAUSED") {
      await unscheduleAgent(updated.id);
    } else if (rest.scheduleCron || rest.status === "ACTIVE") {
      await scheduleAgentOrchestration(updated.id, updated.scheduleCron);
    }
  } catch {
    warning = "Saved, but the scheduler (Redis) is unreachable.";
  }
  return NextResponse.json({ agent: updated, warning });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await ownedAgent(params.id, user.id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await unscheduleAgent(agent.id);
  } catch {
    // Redis down — deletion proceeds; stale repeatable job is skipped safely by the worker.
  }
  await db.agent.delete({ where: { id: agent.id } });
  return NextResponse.json({ ok: true });
}
