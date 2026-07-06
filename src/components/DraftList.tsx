"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DraftView = {
  id: string;
  title: string;
  status: string;
  caption: string;
  hashtags: string[];
  rationale: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  igMediaId: string | null;
  error: string | null;
  createdAt: string;
  slides: { heading: string; body: string }[];
  assets: { idx: number; storageKey: string }[];
};

function DraftCard({ draft }: { draft: DraftView }) {
  const router = useRouter();
  const [caption, setCaption] = useState(draft.caption);
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScript, setShowScript] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    setError("");
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Request failed");
    else {
      if (data.warning) setMsg(data.warning);
      router.refresh();
    }
  }

  async function publishNow() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/drafts/${draft.id}/publish`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Publish failed");
    else {
      setMsg("Publish job enqueued.");
      router.refresh();
    }
  }

  const actionable = !["PUBLISHED", "PUBLISHING", "REJECTED"].includes(draft.status);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0 }}>{draft.title}</h2>
        <span className={`badge ${draft.status}`}>{draft.status.replace("_", " ")}</span>
      </div>
      <p className="muted">
        Created {new Date(draft.createdAt).toLocaleString()}
        {draft.scheduledFor && ` · scheduled ${new Date(draft.scheduledFor).toLocaleString()}`}
        {draft.publishedAt && ` · published ${new Date(draft.publishedAt).toLocaleString()}`}
        {draft.igMediaId && ` · media ${draft.igMediaId}`}
      </p>
      {draft.error && <p className="error">Last error: {draft.error}</p>}

      {draft.assets.length > 0 ? (
        <div className="slides-row">
          {draft.assets.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a.idx} src={`/api/assets/${a.storageKey}`} alt={`Slide ${a.idx + 1}`} />
          ))}
        </div>
      ) : (
        <p className="muted">No rendered slides yet — run the “Render assets” stage.</p>
      )}

      <button className="btn secondary small" onClick={() => setShowScript(!showScript)}>
        {showScript ? "Hide script" : "Show script"}
      </button>
      {showScript && (
        <div style={{ marginTop: 10 }}>
          <table className="table">
            <tbody>
              {draft.slides.map((s, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }} className="muted">Slide {i + 1}</td>
                  <td><strong>{s.heading}</strong><br />{s.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Rationale: {draft.rationale}</p>
          <p className="muted">{draft.hashtags.join(" ")}</p>
        </div>
      )}

      {actionable && (
        <>
          <label className="label">Caption</label>
          <textarea className="input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} />
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 0 }}>
              <button className="btn secondary small" disabled={busy || caption === draft.caption} onClick={() => patch({ action: "update", caption })}>
                Save caption
              </button>
            </div>
            <div>
              <label className="label">Schedule for (optional — defaults to now)</label>
              <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div style={{ flex: 0 }}>
              <button
                className="btn"
                disabled={busy || draft.assets.length < 2}
                onClick={() =>
                  patch({ action: "approve", ...(when ? { scheduledFor: new Date(when).toISOString() } : {}) })
                }
              >
                ✓ Approve &amp; schedule
              </button>
            </div>
            <div style={{ flex: 0 }}>
              <button className="btn secondary" disabled={busy || draft.assets.length < 2} onClick={publishNow}>
                Publish now
              </button>
            </div>
            <div style={{ flex: 0 }}>
              <button className="btn danger small" disabled={busy} onClick={() => patch({ action: "reject" })}>
                Reject
              </button>
            </div>
          </div>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function DraftList({ drafts }: { drafts: DraftView[] }) {
  if (drafts.length === 0) {
    return <p className="muted">No drafts yet. Run the pipeline to generate your first carousel.</p>;
  }
  return (
    <div>
      {drafts.map((d) => (
        <DraftCard key={d.id} draft={d} />
      ))}
    </div>
  );
}
