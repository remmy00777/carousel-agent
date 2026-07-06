import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { currentUser } from "../../../../../lib/auth";
import { encrypt } from "../../../../../lib/crypto";

export const dynamic = "force-dynamic";

/**
 * Connect an Instagram Business/Creator account.
 * MVP: the user pastes their IG User ID + a long-lived access token obtained
 * through Meta's official flow (Graph API Explorer or your Meta app's OAuth).
 * Production: replace with a full Facebook Login OAuth flow (see README).
 */
const Body = z.object({
  igUserId: z.string().min(3).max(50),
  username: z.string().max(100).default(""),
  accessToken: z.string().min(10).max(1000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { igUserId, username, accessToken } = parsed.data;

  const connection = await db.instagramConnection.upsert({
    where: { agentId: agent.id },
    create: { agentId: agent.id, igUserId, username, accessTokenEnc: encrypt(accessToken) },
    update: { igUserId, username, accessTokenEnc: encrypt(accessToken) },
  });
  return NextResponse.json({
    connection: { igUserId: connection.igUserId, username: connection.username },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agent = await db.agent.findFirst({ where: { id: params.id, userId: user.id } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.instagramConnection.deleteMany({ where: { agentId: agent.id } });
  return NextResponse.json({ ok: true });
}
