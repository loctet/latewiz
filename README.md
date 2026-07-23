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

**Vercel note:** serverless disks are ephemeral. Without a mounted volume the DB resets between deploys (falls back to `/tmp/latewiz.db`). Prefer Docker/Railway if you need durable multi-user data with a simple SQLite file.

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
- **Open Source** — MIT licensed

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (≥32 chars) |
| `BETTER_AUTH_URL` | Yes | Public origin for auth callbacks |
| `VAULT_MASTER_KEY` | Yes | 32-byte key as 64 hex chars or base64 |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `SQLITE_PATH` | No | SQLite file path (default `./data/latewiz.db`) |
| `CRON_SECRET` | Recommended | Protects deferred campaign cron |
| `ALLOW_ENV_KEY_FALLBACK` | No | `true` allows `LATE_API_KEY` / `OPENAI_API_KEY` for solo local only |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google sign-in |
| `OPENAI_TEXT_MODEL` | No | Text model (default `gpt-4o-mini`) |
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
