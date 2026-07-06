"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunControls({ agentId, status }: { agentId: string; status: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(stage: string) {
    setBusy(true);
    setMsg("");
    setError("");
    const res = await fetch(`/api/agents/${agentId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Failed to enqueue job");
    else setMsg(`Enqueued "${stage}" — refresh in a few seconds to see results.`);
  }

  async function togglePause() {
    setBusy(true);
    await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: status === "ACTIVE" ? "PAUSED" : "ACTIVE" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <button className="btn" disabled={busy} onClick={() => run("orchestrate")}>▶ Run full pipeline</button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={() => run("discover")}>Discover</button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={() => run("analyze")}>Analyze</button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={() => run("script")}>Write script</button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={() => run("assets")}>Render assets</button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={togglePause}>
        {status === "ACTIVE" ? "Pause schedule" : "Resume schedule"}
      </button>{" "}
      <button className="btn secondary small" disabled={busy} onClick={() => router.refresh()}>↻ Refresh</button>
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
