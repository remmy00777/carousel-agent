# Carousel Agent

AI-powered Instagram content agent platform. Users create agents for their brand-owned Instagram accounts; each agent discovers high-performing content signals in its niche through compliant sources, analyzes why they work, writes fully original carousel scripts, renders on-brand slide images, and schedules/publishes them — either with human approval (default) or fully automated.

## Product summary

One agent = one niche + one Instagram account + one posting schedule. The agent has six skills that run as background jobs:

| Skill | Job | What it does |
|---|---|---|
| 1. Trend discovery | `discover` | Collects public content signals from approved sources (official IG Graph API `business_discovery` + Hashtag Search, RSS feeds, URL metadata, manual uploads) and ranks them by engagement x recency x niche relevance |
| 2. Viral analysis | `analyze` | LLM extracts hook style, emotional angle, pain point, structure, CTA, topic cluster, visual pattern, and a reusable strategic insight per top post |
| 3. Script generation | `script` | LLM writes an original carousel: title slide, body slides, CTA slide, caption, hashtags, alt text, rationale — with an originality guard that rejects output sharing 10+ consecutive words with the source |
| 4. Asset generation | `assets` | Renders each slide through the agent's brand template (SVG → PNG via sharp, 1080x1350) with 3 built-in templates (minimal / bold / gradient) and brand colors/handle |
| 5. Scheduling & publishing | `publish` / `publish-due` | Approval queue → scheduled publishing via the official Instagram Content Publishing API (graph adapter) or simulated publishing (mock adapter). A 5-minute sweep publishes due drafts |
| 6. Orchestration | `orchestrate` | Runs 1→4 end-to-end on the agent's cron schedule, with per-job run logs, BullMQ retries (3 attempts, exponential backoff), and failure reporting |

## Stack and why

- **Next.js 14 (App Router) + TypeScript** — UI and API in one deployable app, server components for data-heavy pages.
- **PostgreSQL + Prisma** — relational data (agents → sources → posts → insights → drafts → assets) with typed queries.
- **NextAuth (credentials, JWT)** — simple production-ready email/password auth; swap in OAuth providers later without touching the rest.
- **BullMQ + Redis** — battle-tested job queue with cron repeatables, retries, and backoff; the worker is a separate process so heavy rendering never blocks the web app.
- **Abstracted LLM layer** — `mock` (offline, deterministic), `anthropic`, or `openai` via one env var.
- **SVG → PNG via sharp** — no headless browser; fast, deterministic, runs anywhere.
- **Storage abstraction** — local filesystem for MVP, S3-compatible driver stub with a documented interface.
- **Docker Compose** — Postgres + Redis + web + worker in one command.

## System architecture

```
 Browser ── Next.js app (UI + API routes) ──┬── PostgreSQL (Prisma)
                                            ├── Redis ── BullMQ queue "agent-jobs"
                                            └── storage/ (slide PNGs, served at /api/assets/*)
 Worker process (npm run worker)
   ├── registers repeatable jobs: per-agent cron "orchestrate", 5-min "publish-due"
   ├── processes: orchestrate | discover | analyze | script | assets | publish
   └── uses: LLM provider (mock/anthropic/openai)
             Instagram adapter (mock/graph)  ← official Graph API only
             Storage driver (local/s3)
```

Draft lifecycle:
`DRAFT → (assets rendered) → PENDING_APPROVAL → (user approves) → SCHEDULED → PUBLISHING → PUBLISHED`
Auto mode skips approval: `DRAFT → SCHEDULED (+5 min) → PUBLISHED`. Failures land in `FAILED` with the error stored; edits reset to `DRAFT` for re-render.

## Database schema (prisma/schema.prisma)

`User` → `Agent` (niche, tone, audience, goals, cron, mode APPROVAL|AUTO, brand JSON) → `InstagramConnection` (encrypted token), `InspirationSource` (IG_HANDLE | HASHTAG | RSS | URL | MANUAL), `CollectedPost` (caption, metrics, engagement/rank scores, unique per agent+sourceUrl), `Insight` (1:1 with post), `CarouselDraft` (slides JSON, caption, hashtags, altTexts, status, schedule), `SlideAsset` (PNG per slide), `RunLog` (job status history).

## API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/register` | Create account |
| * | `/api/auth/[...nextauth]` | NextAuth login/session |
| GET/POST | `/api/agents` | List / create agents (create registers the cron job) |
| GET/PATCH/DELETE | `/api/agents/:id` | Read / update (re-schedules) / delete (unschedules) |
| POST/DELETE | `/api/agents/:id/sources` | Add / remove inspiration sources |
| POST | `/api/agents/:id/inspiration` | Manual inspiration upload (fallback when no API access) |
| POST | `/api/agents/:id/run` | Enqueue a stage: orchestrate/discover/analyze/script/assets |
| POST/DELETE | `/api/agents/:id/instagram` | Connect (encrypted token) / disconnect IG account |
| GET/PATCH | `/api/drafts/:id` | Read / approve / reject / edit a draft |
| POST | `/api/drafts/:id/publish` | Publish now |
| GET | `/api/assets/*` | Serve rendered slide PNGs (public — the Graph API fetches these URLs) |

All routes are session-guarded and ownership-checked except assets serving and auth/register.

## Quick start (local dev)

Prereqs: Node 20+, Docker (for Postgres + Redis).

```bash
cp .env.example .env            # set NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d db redis   # start Postgres + Redis only
npm install                     # also runs prisma generate
npm run db:push                 # create tables
npm run db:seed                 # demo user + finance agent + sample signals
npm run dev                     # web app on http://localhost:3000
npm run worker                  # in a second terminal — background jobs
```

Log in with **demo@example.com / demo1234**, open the seeded agent, click **Run full pipeline**, refresh after a few seconds, and review the generated carousel in the approval queue. Everything works offline with `LLM_PROVIDER=mock` and `IG_ADAPTER=mock`.

Tests and type checking:

```bash
npm test          # vitest: ranking, templates/rendering, LLM schemas, originality guard
npm run typecheck
```

## Full Docker deployment

```bash
cp .env.example .env   # compose reads NEXTAUTH_SECRET, LLM keys, etc. from it
docker compose up --build
```

This builds one image used by both `web` (migrates, seeds, serves on :3000) and `worker`, plus Postgres and Redis with persistent volumes. `web` and `worker` share the `assets` volume so rendered slides are served correctly. For real production: set a strong `NEXTAUTH_SECRET` and `APP_ENCRYPTION_KEY`, put the app behind HTTPS, set `PUBLIC_ASSET_BASE_URL` to your public origin, and switch `NEXTAUTH_URL` accordingly.

## Environment variables

See `.env.example` — every variable is documented there. The important ones: `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_ENCRYPTION_KEY`, `LLM_PROVIDER` (+ key), `IG_ADAPTER`, `STORAGE_DRIVER`, `PUBLIC_ASSET_BASE_URL`.

## Connecting real Instagram publishing

Works today with `IG_ADAPTER=mock` (simulated). For real publishing you need Meta approval — this is a platform requirement, not an app limitation:

1. **Account setup**: convert the Instagram account to Business or Creator and link it to a Facebook Page you manage.
2. **Meta app**: create an app at developers.facebook.com, add the *Instagram Graph API* product.
3. **Permissions**: request `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (and `instagram_manage_insights` for metrics). Development mode works for accounts with a role on the app; public use requires **App Review**.
4. **Token**: obtain a user access token via Facebook Login (or Graph API Explorer for dev), exchange it for a **long-lived token** (~60 days), and find your **IG User ID** (`GET /me/accounts` → page → `?fields=instagram_business_account`).
5. **App config**: set `IG_ADAPTER=graph` and `PUBLIC_ASSET_BASE_URL=https://your-domain` (the Graph API downloads slide images from public URLs, so the app must be publicly reachable or slides hosted on S3/CDN).
6. **Connect in UI**: paste the IG User ID + long-lived token on the agent page. Tokens are AES-256-GCM encrypted at rest.
7. **Production hardening (not in MVP)**: full Facebook-Login OAuth flow instead of token pasting, automatic token refresh before the 60-day expiry, and webhook-based publish confirmation.

Instagram also enforces a limit of ~50 API-published posts per 24h per account; a normal posting schedule stays far below it.

## Safety & compliance notes

- **Official APIs only.** Discovery uses `business_discovery` and Hashtag Search (public Business/Creator data Meta explicitly exposes); publishing uses the Content Publishing API. There is no scraping, no unofficial browser automation, no login simulation, no rate-limit evasion.
- **No content theft.** The analyzer extracts *patterns* (hook style, structure, angle); the writer is instructed to produce original copy, and an n-gram originality guard rejects scripts sharing 10+ consecutive words with the source. Source URLs are stored for provenance.
- **Human in the loop by default.** New agents start in APPROVAL mode; nothing is published without explicit user action. AUTO mode is opt-in.
- **Brand-owned accounts only.** The connection flow is designed for accounts the user controls; tokens are user-provided and encrypted at rest.
- **Graceful degradation.** Without IG credentials the app uses RSS/manual sources and simulated publishing — no functionality silently pretends to have published.

## Testing strategy

- **Unit (in repo, `npm test`)**: ranking math, SVG templates + PNG rasterization, mock-LLM schema conformance, JSON parsing, originality guard.
- **Integration (next step)**: skill functions against a disposable Postgres (e.g. testcontainers) with mock adapters; API route tests via `next-test-api-route-handler`.
- **E2E (next step)**: Playwright — register → create agent → add source → run pipeline → approve → verify mock publish.
- **Manual verification**: the seeded demo flow exercises every skill end-to-end offline.

## Example user workflow

1. Register, create agent “Finance Carousel Agent” (niche, tone, audience, goals, Mon/Wed/Fri 9:00, Approval mode, bold template + brand colors).
2. Add sources: a competitor handle, `#personalfinance`, an RSS feed; optionally paste manual inspiration posts.
3. Click **Run full pipeline** (or wait for the cron). Worker collects signals → ranks them → analyzes top 5 → writes 1 original carousel → renders 7 slides.
4. Review the draft: slide previews, script, caption, hashtags, rationale. Edit the caption, then **Approve & schedule** for tomorrow 9:00.
5. The publish sweep posts it via the Graph API (or marks it published in mock mode). Run history shows every job with status and messages.

## What works now vs. what needs credentials

| Capability | Mock mode (default) | Needs real credentials |
|---|---|---|
| Auth, agents, sources, manual inspiration | ✅ | — |
| RSS / URL discovery | ✅ real fetching | — |
| IG handle / hashtag discovery | ✅ simulated signals | Graph API token + `instagram_basic` |
| Analysis + script writing | ✅ deterministic mock LLM | Anthropic/OpenAI key for real quality |
| Slide rendering, approval queue, scheduling | ✅ fully real | — |
| Publishing to Instagram | ✅ simulated (`mock_media_*` ids) | Meta app + `instagram_content_publish` + App Review + public asset URLs |

## Project structure

```
prisma/schema.prisma, seed.ts        # schema + demo data
src/lib/                             # db, auth, crypto, queue, ranking
src/lib/llm/                         # provider abstraction: mock | anthropic | openai
src/lib/instagram/                   # adapter abstraction: mock | graph (official API)
src/lib/render/                      # SVG brand templates + sharp rasterizer
src/lib/storage/                     # local driver + S3 stub + public URL helper
src/skills/                          # the six agent skills (pure async functions)
src/worker/index.ts                  # BullMQ worker + schedule registration
src/app/api/                         # route handlers
src/app/, src/components/            # UI (dashboard, agent page, approval queue)
tests/                               # vitest unit tests
Dockerfile, docker-compose.yml       # deployment
```
