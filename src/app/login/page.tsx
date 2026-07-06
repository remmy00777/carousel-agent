"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setError("Invalid email or password");
    else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="auth-box">
      <div className="card">
        <h2>Log in</h2>
        <form onSubmit={submit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <p><button className="btn" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button></p>
        </form>
        <p className="muted">No account? <Link href="/register">Register</Link></p>
      </div>
    </main>
  );
}
