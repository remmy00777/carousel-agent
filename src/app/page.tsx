import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>AI Instagram Carousel Agents</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 560, margin: "0 auto 24px" }}>
          Create an AI agent for your brand-owned Instagram account. It studies what performs
          in your niche through compliant sources, writes original carousel scripts, renders
          on-brand slides, and schedules posts — with you in the approval loop.
        </p>
        <Link href="/register" className="btn">Create an account</Link>
        {"  "}
        <Link href="/login" className="btn secondary" style={{ marginLeft: 10 }}>Log in</Link>
      </div>
      <div className="grid">
        <div className="card"><h2>1. Discover</h2><p className="muted">Official Instagram Graph API, hashtags, RSS, and manual inspiration — no scraping, no unofficial automation.</p></div>
        <div className="card"><h2>2. Analyze &amp; write</h2><p className="muted">Extracts hooks, structures, and angles — then writes fully original slide-by-slide scripts with captions, hashtags, and alt text.</p></div>
        <div className="card"><h2>3. Render &amp; publish</h2><p className="muted">Brand-templated slide images, an approval queue, and compliant publishing through the official Content Publishing API.</p></div>
      </div>
    </main>
  );
}
