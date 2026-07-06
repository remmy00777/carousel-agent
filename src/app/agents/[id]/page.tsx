import { notFound, redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentUser } from "../../../lib/auth";
import { RunControls } from "../../../components/RunControls";
import { SourceManager } from "../../../components/SourceManager";
import { InspirationForm } from "../../../components/InspirationForm";
import { ConnectInstagram } from "../../../components/ConnectInstagram";
import { DraftList, type DraftView } from "../../../components/DraftList";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const agent = await db.agent.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      igConnection: { select: { igUserId: true, username: true } },
      drafts: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { assets: { orderBy: { idx: "asc" }, select: { idx: true, storageKey: true } } },
      },
      runs: { orderBy: { startedAt: "desc" }, take: 10 },
      posts: { orderBy: { rankScore: "desc" }, take: 8, include: { insight: { select: { id: true } } } },
      _count: { select: { posts: true, insights: true, drafts: true } },
    },
  });
  if (!agent) notFound();

  const drafts: DraftView[] = agent.drafts.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    caption: d.caption,
    hashtags: d.hashtags,
    rationale: d.rationale,
    scheduledFor: d.scheduledFor?.toISOString() ?? null,
    publishedAt: d.publishedAt?.toISOString() ?? null,
    igMediaId: d.igMediaId,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
    slides: d.slides as unknown as { heading: string; body: string }[],
    assets: d.assets,
  }));

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{agent.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {agent.niche} · <span className={`badge ${agent.status}`}>{agent.status}</span>{" "}
            <span className="badge">{agent.mode === "AUTO" ? "Auto-publish" : "Approval mode"}</span>{" "}
            · cron <code>{agent.scheduleCron}</code>
          </p>
        </div>
        <div>
          <span className="stat"><span className="num">{agent._count.posts}</span> <span className="lbl">signals</span></span>
          <span className="stat"><span className="num">{agent._count.insights}</span> <span className="lbl">insights</span></span>
          <span className="stat"><span className="num">{agent._count.drafts}</span> <span className="lbl">drafts</span></span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Agent skills</h2>
        <RunControls agentId={agent.id} status={agent.status} />
        <p className="muted" style={{ marginBottom: 0 }}>
          Full pipeline: discover → analyze → write script → render assets. Requires Redis + the worker
          (<code>npm run worker</code>). The schedule runs it automatically.
        </p>
      </div>

      <div className="card">
        <h2>Instagram connection</h2>
        <ConnectInstagram agentId={agent.id} connection={agent.igConnection} />
      </div>

      <div className="card">
        <h2>Inspiration sources</h2>
        <SourceManager agentId={agent.id} sources={agent.sources.filter((s) => s.type !== "MANUAL")} />
        <h3>Manual inspiration</h3>
        <InspirationForm agentId={agent.id} />
      </div>

      <div className="card">
        <h2>Top collected signals</h2>
        {agent.posts.length === 0 ? (
          <p className="muted">Nothing collected yet — add sources and run Discover.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Topic / caption</th><th>Source</th><th>Engagement</th><th>Rank</th><th>Analyzed</th></tr></thead>
            <tbody>
              {agent.posts.map((p) => (
                <tr key={p.id}>
                  <td>{(p.topic || p.caption).slice(0, 90)}</td>
                  <td><span className="badge">{p.sourceType}</span></td>
                  <td>{p.likeCount ?? "–"} ♥ / {p.commentCount ?? "–"} 💬</td>
                  <td>{p.rankScore.toFixed(1)}</td>
                  <td>{p.insight ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={{ fontSize: 20 }}>Carousel drafts</h2>
      <DraftList drafts={drafts} />

      <div className="card">
        <h2>Run history</h2>
        {agent.runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Message</th></tr></thead>
            <tbody>
              {agent.runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.jobType}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td className="muted">{r.startedAt.toLocaleString()}</td>
                  <td className="muted">{r.message.slice(0, 200)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
