"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CRON_PRESETS = [
  { label: "Mon/Wed/Fri at 9:00", value: "0 9 * * 1,3,5" },
  { label: "Every day at 9:00", value: "0 9 * * *" },
  { label: "Weekly (Monday 9:00)", value: "0 9 * * 1" },
];

export function AgentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    niche: "",
    tone: "friendly, expert, practical",
    audience: "",
    goals: "",
    scheduleCron: CRON_PRESETS[0].value,
    mode: "APPROVAL" as "APPROVAL" | "AUTO",
    brand: { template: "minimal" as const, bg: "#0f172a", fg: "#f8fafc", accent: "#38bdf8", handle: "" },
  });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setBrand = (k: string, v: string) => setForm((f) => ({ ...f, brand: { ...f.brand, [k]: v } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create agent");
      return;
    }
    if (data.warning) setWarning(data.warning);
    router.push(`/agents/${data.agent.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>Agent profile</h2>
      <label className="label">Agent name</label>
      <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Finance Carousel Agent" />
      <label className="label">Niche</label>
      <input className="input" value={form.niche} onChange={(e) => set("niche", e.target.value)} required placeholder="e.g. personal finance for young professionals" />
      <label className="label">Tone</label>
      <input className="input" value={form.tone} onChange={(e) => set("tone", e.target.value)} />
      <label className="label">Audience</label>
      <input className="input" value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="who are you talking to?" />
      <label className="label">Content goals</label>
      <input className="input" value={form.goals} onChange={(e) => set("goals", e.target.value)} placeholder="e.g. grow followers, drive saves" />

      <div className="row">
        <div>
          <label className="label">Posting schedule</label>
          <select className="input" value={form.scheduleCron} onChange={(e) => set("scheduleCron", e.target.value)}>
            {CRON_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={form.mode} onChange={(e) => set("mode", e.target.value)}>
            <option value="APPROVAL">Approval (recommended) — you review every post</option>
            <option value="AUTO">Auto — publish without review</option>
          </select>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Brand template</h2>
      <div className="row">
        <div>
          <label className="label">Template</label>
          <select className="input" value={form.brand.template} onChange={(e) => setBrand("template", e.target.value)}>
            <option value="minimal">Minimal</option>
            <option value="bold">Bold</option>
            <option value="gradient">Gradient</option>
          </select>
        </div>
        <div>
          <label className="label">Background</label>
          <input className="input" type="color" value={form.brand.bg} onChange={(e) => setBrand("bg", e.target.value)} />
        </div>
        <div>
          <label className="label">Text</label>
          <input className="input" type="color" value={form.brand.fg} onChange={(e) => setBrand("fg", e.target.value)} />
        </div>
        <div>
          <label className="label">Accent</label>
          <input className="input" type="color" value={form.brand.accent} onChange={(e) => setBrand("accent", e.target.value)} />
        </div>
        <div>
          <label className="label">Handle on slides</label>
          <input className="input" value={form.brand.handle} onChange={(e) => setBrand("handle", e.target.value)} placeholder="@yourbrand" />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {warning && <p className="notice">{warning}</p>}
      <p><button className="btn" disabled={busy}>{busy ? "Creating…" : "Create agent"}</button></p>
    </form>
  );
}
