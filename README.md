# LateWiz

**Your social media scheduling wizard.** Multi-user accounts with encrypted per-user API vaults. Schedule posts across 13 platforms — AI and publishing always use **each user’s** Zernio and OpenAI keys.

**Live site:** [latewiz.com](https://latewiz.com)

## Multi-user model

1. Create a LateWiz account (email/password or Google).
2. Onboarding: set your **niche** (Biology, SaaS, Fitness, Crypto, or custom) and paste **your** Zernio + OpenAI keys.
3. Keys are stored in an AES-256-GCM vault on the server (`VAULT_MASTER_KEY`).
4. Compose, campaigns, and cron decrypt **that user’s** keys only — never the host’s `.env` API keys.

> Hosted multi-user no longer relies on a shared `LATE_API_KEY` / `OPENAI_API_KEY`. Those are optional for solo local dev via `ALLOW_ENV_KEY_FALLBACK=true`.

## Quick Start

### Local development

```bash
git clone https://github.com/zernio-dev/latewiz.git
cd latewiz
npm install
cp .env.example .env.local
```

Fill in at least:

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | e.g. `http://localhost:3000` |
| `VAULT_MASTER_KEY` | `openssl rand -hex 32` (64 hex chars) |
| `NEXT_PUBLIC_APP_URL` | Same as Better Auth URL |

SQLite is automatic: the app creates `data/latewiz.db` on first request (override with `SQLITE_PATH`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, complete onboarding.

### Deploy

**Recommended for SQLite:** Docker, Railway, a VPS, or any host with a **persistent disk**. Point cron at `/api/cron/campaigns` with `Authorization: Bearer $CRON_SECRET`.

**Vercel note:** serverless disks are ephemeral. Without a persistent DB, accounts are stored in `/tmp` and **login will fail** after signup (“Invalid email or password”). For Vercel you **must** use [Turso](https://turso.tech):

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Also set `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://latewiz.com`).

Password reset needs email delivery:

```
RESEND_API_KEY=re_...
EMAIL_FROM=LateWiz <noreply@yourdomain.com>
```

Prefer Docker/Railway/a VPS with a persistent disk if you want a simple local SQLite file instead of Turso.

Optional Google OAuth:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

### Vault key rotation

1. Generate a new `VAULT_MASTER_KEY`.
2. Decrypt each `user_secrets` row with the old key and re-encrypt with the new key (run a one-off script).
3. Update the env var and redeploy. Users do not need to re-enter keys if re-encryption succeeds.

## Features

- **Multi-user accounts** — Better Auth sessions; isolated campaigns per user
- **Encrypted vault** — Zernio, OpenAI, fal keys per user
- **SQLite** — single local file, no Postgres required
- **Niche-first AI** — Biology, SaaS, Fitness, Crypto presets (or custom)
- **13 Platforms** — Instagram, TikTok, YouTube, LinkedIn, and more via Zernio
- **Campaign planner** — Deferred slots run with the campaign owner’s vault keys
- **Mixed-media campaigns** — Per-post text, image, AI video (Sora/Pika) or branded explainer
- **Brand kit** — Logo, colors, font, theme and signature applied to explainer videos
- **Open Source** — MIT licensed

## Explainer videos (render worker)

Explainer posts are rendered from HTML with [HyperFrames](https://hyperframes.heygen.com)
by a separate worker process. Vercel functions cannot run Chrome or FFmpeg, so the
worker runs on any machine with **Node.js 22+**, **FFmpeg** on `PATH`, and access
to the app database (local SQLite, or Turso with `USE_TURSO=true`). No HyperFrames
account is needed.

```bash
npm run render-worker            # poll forever
npm run render-worker -- --once  # handle at most one job
```

Flow, for deferred campaigns only:

1. The cron runner reaches an explainer slot, writes its copy, asks OpenAI for a scene
   script, and queues a row in `render_jobs`.
2. The worker renders `video-templates/explainer` with the user's brand kit and stores
   the MP4 in `generated_media`.
3. The next cron run publishes the post with the video.

Immediate campaigns can render every explainer first (campaign page → Render explainers),
then send all posts with finished videos to Zernio. Give deferred campaigns enough
`generationLeadMinutes` for a render (about 2–3 minutes per minute of video).

What an explainer is made of:

- **Script**: OpenAI writes a beginner-first teaching arc (hook, why it matters, simple
  definition and analogy, step by step, worked example, myth, recap, try it today) sized
  to the chosen length (default 1:30, set in the brand kit or per generation).
  Narration is cleaned for speech: no URLs, @handles, hashtags or emojis.
- **Visuals**: each scene picks one of 18 animated visual kinds (icon hero, flow,
  cycle, compare, equation, analogy, bar/line chart, stat, pictogram, checklist,
  timeline, chat, phone mockup, code, definition, quote) drawn with HTML/SVG and
  ~240 Lucide icons in the brand colors. AI background images are optional (brand kit).
- **Audio**: OpenAI TTS voiceover with word-synced captions, plus synthesized whoosh /
  pop / chime sound effects.

Template files: `video-templates/explainer/` (`explainer.js` scenes and timeline,
`visuals.js` visual kinds, `explainer.css`). After editing, run `npx hyperframes check`
from that folder. Regenerate the icon set with `node scripts/build-explainer-icons.mjs`.

| Variable | Default | Description |
|----------|---------|-------------|
| `RENDER_QUALITY` | `looks` | `draft`, `looks` or `delivery` |
| `RENDER_FPS` | `24` | Frames per second (`30` is about 20% slower to render) |
| `RENDER_POLL_MS` | `15000` | Poll interval when the queue is empty |
| `HYPERFRAMES_PACKAGE` | `hyperframes@0.9.41` | CLI package passed to `npx` |
| `OPENAI_EXPLAINER_MODEL` | `gpt-4.1` | Model that writes explainer scripts (app and cron) |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | Voiceover model (worker) |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (≥32 chars) |
| `BETTER_AUTH_URL` | Yes | Public origin for auth callbacks |
| `VAULT_MASTER_KEY` | Yes | 32-byte key as 64 hex chars or base64 |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `TURSO_DATABASE_URL` | **Yes on Vercel** | Turso/libSQL URL (persistent SQLite) |
| `TURSO_AUTH_TOKEN` | **Yes on Vercel** | Turso auth token |
| `RESEND_API_KEY` | For password reset | Sends reset emails via [Resend](https://resend.com) |
| `EMAIL_FROM` | With Resend | e.g. `LateWiz <noreply@yourdomain.com>` |
| `SQLITE_PATH` | No | Local SQLite file path (default `./data/latewiz.db`) |
| `CRON_SECRET` | Recommended | Protects deferred campaign cron |
| `ALLOW_ENV_KEY_FALLBACK` | No | `true` allows `LATE_API_KEY` / `OPENAI_API_KEY` for solo local only |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google sign-in |
| `OPENAI_TEXT_MODEL` | No | Standard text model (default `gpt-4o-mini`) |
| `OPENAI_DEEP_TEXT_MODEL` | No | Deep research model (default `o4-mini-deep-research`; or `o3-deep-research`) |
| `OPENAI_DEEP_BACKGROUND` | No | Run deep research in background + poll (default `true`) |
| `OPENAI_DEEP_MAX_WAIT_MS` | No | Max wait for deep research (default `480000`) |
| `TAVILY_API_KEY` / `SERPER_API_KEY` | No | Web-search fallbacks (server-wide) |

## Getting API keys

1. **Zernio** — [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys) (`sk_…`)
2. **OpenAI** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (`sk-…`)
3. Add both in LateWiz **Settings → Encrypted API vault** (or during onboarding)

## Tech Stack

- [Next.js 16](https://nextjs.org/) · [Better Auth](https://www.better-auth.com/) · [Drizzle](https://orm.drizzle.team/) · SQLite (`better-sqlite3`)
- [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/) · [TanStack Query](https://tanstack.com/query) · [Zustand](https://zustand-demo.pmnd.rs/)
- [Zernio Node SDK](https://github.com/zernio-dev/late-node)

## License

MIT
