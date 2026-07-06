"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Source = { id: string; type: string; value: string; active: boolean };

const TYPE_HELP: Record<string, string> = {
  IG_HANDLE: "Public IG Business/Creator username (via official business_discovery)",
  HASHTAG: "Public hashtag (via official Hashtag Search API)",
  RSS: "RSS feed URL for niche trends",
  URL: "Web page URL (public title/description only)",
};

export function SourceManager({ agentId, sources }: { agentId: string; sources: Source[] }) {
  const router = useRouter();
  const [type, setType] = useState("IG_HANDLE");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/agents/${agentId}/sources`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add source");
      return;
    }
    setValue("");
    router.refresh();
  }

  async function remove(sourceId: string) {
    await fetch(`/api/agents/${agentId}/sources`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    router.refresh();
  }

  return (
    <div>
      {sources.length > 0 && (
        <table className="table">
          <thead><tr><th>Type</th><th>Value</th><th /></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td><span className="badge">{s.type}</span></td>
                <td>{s.value}</td>
                <td><button className="btn secondary small" onClick={() => remove(s.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={add} className="row" style={{ marginTop: 12 }}>
        <div>
          <label className="label">Source type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="IG_HANDLE">Instagram handle</option>
            <option value="HASHTAG">Hashtag</option>
            <option value="RSS">RSS feed</option>
            <option value="URL">Web URL</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label className="label">Value</label>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} required placeholder="e.g. financecreator or #personalfinance or https://…" />
        </div>
        <div style={{ flex: 0 }}>
          <button className="btn" disabled={busy}>Add</button>
        </div>
      </form>
      <p className="muted">{TYPE_HELP[type]}</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
