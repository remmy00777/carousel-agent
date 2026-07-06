import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../lib/db";
import { currentUser } from "../../../lib/auth";
import { scheduleAgentOrchestration } from "../../../lib/queue";

export const dynamic = "force-dynamic";

const BrandSchema = z.object({
  template: z.enum(["minimal", "bold", "gradient"]).default("minimal"),
  bg: z.string().default("#0f172a"),
  fg: z.string().default("#f8fafc"),
  accent: z.string().default("#38bdf8"),
  handle: z.string().default(""),
});

const CreateAgent = z.object({
  name: z.string().min(1).max(100),
  niche: z.string().min(1).max(300),
  tone: z.string().max(300).default("friendly, expert, practical"),
  audience: z.string().max(500).default(""),
  goals: z.string().max(500).default(""),
  scheduleCron: z.string().min(9).max(50).default("0 9 * * 1,3,5"),
  mode: z.enum(["APPROVAL", "AUTO"]).default("APPROVAL"),
  brand: BrandSchema.default({}),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agents = await db.agent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { drafts: true, posts: true } } },
  });
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = CreateAgent.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const agent = await db.agent.create({ data: { userId: user.id, ...parsed.data } });

  let warning: string | undefined;
  try {
    await scheduleAgentOrchestration(agent.id, agent.scheduleCron);
  } catch {
    warning = "Agent created, but the scheduler (Redis) is unreachable. Start Redis + worker to enable automation.";
  }
  return NextResponse.json({ agent, warning }, { status: 201 });
}
