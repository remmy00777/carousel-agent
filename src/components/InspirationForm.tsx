"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Manual inspiration upload — the compliant fallback when API access is unavailable. */
export function InspirationForm({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/agents/${agentId}/inspiration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caption,
        topic,
        sourceUrl: sourceUrl || undefined,
        likeCount: likes ? Number(likes) : undefined,
        commentCount: comments ? Number(comments) : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      return;
    }
    setCaption(""); setTopic(""); setSourceUrl(""); setLikes(""); setComments("");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="label">Post caption / summary (describe what the post says — used for pattern analysis only)</label>
      <textarea className="input" value={caption} onChange={(e) => setCaption(e.target.value)} required maxLength={3000} />
      <div className="row">
        <div>
          <label className="label">Topic</label>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div>
          <label className="label">Source URL (optional)</label>
          <input className="input" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
        <div>
          <label className="label">Likes (optional)</label>
          <input className="input" type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} />
        </div>
        <div>
          <label className="label">Comments (optional)</label>
          <input className="input" type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <p><button className="btn secondary" disabled={busy}>Add inspiration</button></p>
    </form>
  );
}
