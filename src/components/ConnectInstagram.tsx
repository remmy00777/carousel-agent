"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Conn = { igUserId: string; username: string } | null;

export function ConnectInstagram({ agentId, connection }: { agentId: string; connection: Conn }) {
  const router = useRouter();
  const [igUserId, setIgUserId] = useState("");
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/agents/${agentId}/instagram`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ igUserId, username, accessToken }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to connect");
      return;
    }
    setAccessToken("");
    router.refresh();
  }

  async function disconnect() {
    await fetch(`/api/agents/${agentId}/instagram`, { method: "DELETE" });
    router.refresh();
  }

  if (connection) {
    return (
      <div>
        <p>
          Connected: <strong>@{connection.username || connection.igUserId}</strong>{" "}
          <span className="badge ACTIVE">CONNECTED</span>
        </p>
        <button className="btn secondary small" onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <form onSubmit={connect}>
      <p className="muted">
        Connect a brand-owned Instagram <strong>Business or Creator</strong> account via the official
        Instagram Graph API. Paste your IG User ID and a long-lived access token from your Meta app
        (see README for the exact steps). Tokens are encrypted at rest. Without a connection, the app
        still works end-to-end using RSS/manual sources and simulated publishing.
      </p>
      <div className="row">
        <div>
          <label className="label">IG User ID</label>
          <input className="input" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourbrand" />
        </div>
        <div style={{ flex: 2 }}>
          <label className="label">Long-lived access token</label>
          <input className="input" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required />
        </div>
        <div style={{ flex: 0 }}>
          <button className="btn" disabled={busy}>Connect</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
