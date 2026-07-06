import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { currentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const agents = await db.agent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { drafts: true, posts: true, insights: true } },
      drafts: { where: { status: "PENDING_APPROVAL" }, select: { id: true } },
    },
  });

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Your agents</h1>
        <Link href="/agents/new" className="btn">+ New agent</Link>
      </div>

      {agents.length === 0 && (
        <div className="card">
          <p>No agents yet. Create your first AI content agent to get started.</p>
        </div>
      )}

      <div className="grid">
        {agents.map((a) => (
          <div className="card" key={a.id}>
            <h2><Link href={`/agents/${a.id}`}>{a.name}</Link></h2>
            <p className="muted">{a.niche}</p>
            <p>
              <span className={`badge ${a.status}`}>{a.status}</span>{" "}
              <span className="badge">{a.mode === "AUTO" ? "Auto-publish" : "Approval mode"}</span>
              {a.drafts.length > 0 && <span className="badge PENDING_APPROVAL" style={{ marginLeft: 6 }}>{a.drafts.length} awaiting review</span>}
            </p>
            <p className="muted">
              {a._count.posts} signals · {a._count.insights} insights · {a._count.drafts} drafts · cron: <code>{a.scheduleCron}</code>
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
