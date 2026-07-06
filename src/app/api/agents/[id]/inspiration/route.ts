import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { currentUser } from "../../../../../lib/auth";
import { nicheKeywords, scorePost } from "../../../../../lib/ranking";

export const dynamic = "force-dynamic";

/** Manual inspiration upload — the compliant fallback when API access is unavailable. */
const ManualPost = z.object({
  caption: z.string().min(1).max(3000),
  topic: z.string().max(200).default(""),
  sourceUrl: z.string().url().optional(),
  author: z.string().max(100).optional(),
  likeCount: z.number().int().min(0).optional(),
  commentCount: z.number().int().min(0).optional(),
  postedAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = ManualPost.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const p = parsed.data;

  let manualSource = await db.inspirationSource.findFirst({
    where: { agentId: agent.id, type: "MANUAL" },
  });
  if (!manualSource) {
    manualSource = await db.inspirationSource.create({
      data: { agentId: agent.id, type: "MANUAL", value: "Manual uploads" },
    });
  }

  const postedAt = p.postedAt ? new Date(p.postedAt) : null;
  const scores = scorePost({ ...p, postedAt }, nicheKeywords(agent));
  const post = await db.collectedPost.create({
    data: {
      agentId: agent.id,
      sourceId: manualSource.id,
      sourceType: "MANUAL",
      sourceUrl: p.sourceUrl ?? `manual://${agent.id}/${Date.now()}`,
      author: p.author,
      caption: p.caption,
      topic: p.topic || p.caption.slice(0, 120),
      format: "manual",
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      postedAt,
      ...scores,
    },
  });
  return NextResponse.json({ post }, { status: 201 });
}
