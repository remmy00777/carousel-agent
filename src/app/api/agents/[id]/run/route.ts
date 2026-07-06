import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { currentUser } from "../../../../../lib/auth";
import { enqueue, type JobName } from "../../../../../lib/queue";

export const dynamic = "force-dynamic";

const Body = z.object({
  stage: z.enum(["orchestrate", "discover", "analyze", "script", "assets"]).default("orchestrate"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });

  try {
    await enqueue(parsed.data.stage as JobName, { agentId: agent.id });
  } catch {
    return NextResponse.json(
      { error: "Job queue unreachable. Make sure Redis is running and the worker is started (npm run worker)." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, enqueued: parsed.data.stage });
}
