# LateWiz

**Your social media scheduling wizard.** Schedule posts across 13 platforms with a single, beautiful interface.

**Live site:** [latewiz.com](https://latewiz.com)

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fzernio-dev%2Flatewiz&env=LATE_API_KEY&envDescription=Your%20Zernio%20API%20key%20from%20zernio.com&envLink=https%3A%2F%2Fzernio.com%2Fdashboard%2Fapi-keys&project-name=latewiz&repository-name=latewiz"><img src="https://vercel.com/button" alt="Deploy with Vercel" height="32"></a>
<a href="https://railway.app/template/latewiz?referralCode=late"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="32"></a>

![LateWiz Screenshot](./docs/screenshot.png?v=2)

## Features

- **13 Platforms** - Instagram, TikTok, YouTube, LinkedIn, Pinterest, X/Twitter, Facebook, Threads, Bluesky, Snapchat, Google Business, Reddit, Telegram
- **Visual Calendar** - See all your scheduled content at a glance
- **Smart Queue** - Set up posting times and let LateWiz handle the rest
- **Media Uploads** - Support for images and videos up to 5GB
- **Platform-Specific Settings** - TikTok privacy, YouTube titles, Pinterest boards, and more
- **Dark Mode** - Easy on the eyes, day or night
- **Open Source** - MIT licensed, self-host anywhere

## Quick Start

### Option 1: One-Click Deploy (Recommended)

Click the "Deploy with Vercel" button above, enter your [Zernio API key](https://zernio.com/dashboard/api-keys), and you're done.

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/zernio-dev/latewiz.git
cd latewiz

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your Zernio API key to .env.local
# LATE_API_KEY=sk_...

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 3: Docker

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t latewiz .
docker run -p 3000:3000 -e LATE_API_KEY=sk_... latewiz
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `LATE_API_KEY` | Yes* | Your Zernio API key. Get one at [zernio.com](https://zernio.com/dashboard/api-keys) |
| `OPENAI_API_KEY` | No | Server fallback for AI captions and images (users can also add a key in Settings) |
| `OPENAI_TEXT_MODEL` | No | Model for Responses API text + web search (default: `gpt-4o-mini`; `gpt-4.1-mini` or `gpt-5.5` recommended for best search) |
| `OPENAI_NATIVE_WEB_SEARCH` | No | Set to `false` to skip OpenAI built-in web search and use fallback only |
| `OPENAI_WEB_SEARCH_REQUIRED` | No | Set to `true` to force the model to run web search on every generation |
| `OPENAI_WEB_SEARCH_CONTEXT_SIZE` | No | `low`, `medium`, or `high` — how much search context the model sees |
| `WEB_SEARCH_ALLOWED_DOMAINS` | No | Comma-separated allowlist (e.g. `sec.gov,coindesk.com`) for trusted sources only |
| `OPENAI_WEB_SEARCH_RECENCY_DAYS` | No | Prompt hint for how recent sources should be (default: `14`) |
| `TAVILY_API_KEY` | No | Fallback web search if OpenAI Responses web search fails ([tavily.com](https://tavily.com)) |
| `SERPER_API_KEY` | No | Second fallback search provider ([serper.dev](https://serper.dev)) |
| `WEB_SEARCH_ENABLED` | No | Set to `false` to disable Tavily/Serper fallback |
| `WEB_SEARCH_MAX_RESULTS` | No | Max fallback sources injected into prompts (default: `5`, max `10`) |
| `NEXT_PUBLIC_APP_URL` | No | Your app's public URL (for OAuth callbacks) |
| `NEXT_PUBLIC_APP_NAME` | No | Custom app name (default: LateWiz) |

*If not set, users will be prompted to enter their own API key.

## Getting a Zernio API Key

1. Sign up at [zernio.com](https://zernio.com)
2. Go to [API Keys](https://zernio.com/dashboard/api-keys)
3. Create a new API key
4. Copy the key (starts with `sk_`)

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Zernio Node SDK](https://github.com/zernio-dev/late-node) - API client

## Project Structure

```
latewiz/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # Dashboard routes
│   │   │   ├── compose/        # Post composer
│   │   │   ├── calendar/       # Calendar view
│   │   │   ├── accounts/       # Connected accounts
│   │   │   ├── queue/          # Queue management
│   │   │   └── settings/       # User settings
│   │   ├── callback/           # OAuth callbacks
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── accounts/           # Account components
│   │   ├── posts/              # Post components
│   │   └── shared/             # Shared components
│   ├── hooks/                  # React hooks
│   ├── lib/
│   │   └── late-api/           # Zernio API utilities
│   └── stores/                 # Zustand stores
├── docs/                       # Documentation
└── docker/                     # Docker configuration
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Type check
npx tsc --noEmit
```

## Support

- [LateWiz Live Site](https://latewiz.com)
- [Zernio Documentation](https://docs.zernio.com)
- [GitHub Issues](https://github.com/zernio-dev/latewiz/issues)
- [Telegram Community](https://t.me/latewiz)

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

Built with [Zernio](https://zernio.com) - The Social Media Scheduling API
