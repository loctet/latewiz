"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { ApiKeyModal } from "@/components/shared/api-key-modal";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { Logo } from "@/components/shared/logo";
import { PLATFORMS, PLATFORM_NAMES } from "@/lib/late-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  Clock,
  Image as ImageIcon,
  Share2,
  Server,
  Scale,
  ArrowRight,
  Moon,
  Sun,
  Github,
  Sparkles,
  Wand2,
  Film,
  Target,
  Bot,
  Search,
  CalendarClock,
  PenLine,
} from "lucide-react";
import { useTheme } from "next-themes";

export default function LandingPage() {
  const router = useRouter();
  const { apiKey, hasHydrated } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (hasHydrated && apiKey) {
      router.push("/dashboard");
    }
  }, [apiKey, hasHydrated, router]);

  if (!hasHydrated) {
    return null;
  }

  const aiFeatures = [
    {
      icon: Sparkles,
      title: "AI Studio",
      description:
        "Generate captions, hashtags, images, and videos from a topic — ready to schedule.",
    },
    {
      icon: CalendarClock,
      title: "Campaign Planner",
      description:
        "Build multi-post arcs with AI slot briefs, media, and timed publish windows.",
    },
    {
      icon: Target,
      title: "Niche voice",
      description:
        "Lock audience, language, and tone once — every generation stays on-brand.",
    },
    {
      icon: PenLine,
      title: "Compose assist",
      description:
        "One-click captions and media while you write, without leaving the composer.",
    },
    {
      icon: Search,
      title: "Research-backed posts",
      description:
        "Optional web search keeps captions fresher with current, sourced context.",
    },
    {
      icon: Bot,
      title: "AI auto-reply",
      description:
        "Scan comments and reply with rules-based AI so engagement never stalls.",
    },
    {
      icon: Wand2,
      title: "Image generation",
      description:
        "Styles, reference images, and watermarks for on-brand visuals at scale.",
    },
    {
      icon: Film,
      title: "Video generation",
      description:
        "Create short-form video with provider choice and prompt styles that fit your niche.",
    },
  ];

  const scheduleFeatures = [
    {
      icon: Calendar,
      title: "Visual Calendar",
      description: "See every scheduled post at a glance across your profiles.",
    },
    {
      icon: Clock,
      title: "Smart Queue",
      description: "Set posting windows once — LateWiz fills the rest.",
    },
    {
      icon: ImageIcon,
      title: "Media library",
      description: "Upload images and videos up to 5GB for reuse across posts.",
    },
    {
      icon: Share2,
      title: "13 platforms",
      description: "Instagram, TikTok, YouTube, X, LinkedIn, and more from one UI.",
    },
    {
      icon: Server,
      title: "Self-hostable",
      description: "Deploy on your infrastructure — Vercel, Docker, or bare metal.",
    },
    {
      icon: Scale,
      title: "MIT licensed",
      description: "Free forever, open source, no vendor lock-in.",
    },
  ];

  const faqs = [
    {
      question: "What is LateWiz?",
      answer:
        "LateWiz is a free, open-source social media tool that combines AI content generation with scheduling across 13 platforms via the Zernio API.",
    },
    {
      question: "What AI features are included?",
      answer:
        "AI Studio for captions, hashtags, images, and video; Campaign Planner for multi-post arcs; niche voice profiles; compose assist; optional web-researched drafts; and AI comment auto-reply.",
    },
    {
      question: "Do I need an OpenAI key?",
      answer:
        "For AI generation, yes — add your OpenAI key in Settings (or set OPENAI_API_KEY on the server). Scheduling and publishing still work with just your Zernio API key.",
    },
    {
      question: "Is LateWiz really free?",
      answer:
        "Yes. LateWiz is MIT licensed and free. You need a Zernio API key (free tier available) to connect social accounts, plus provider keys for AI if you use those features.",
    },
    {
      question: "What platforms are supported?",
      answer:
        "Instagram, TikTok, YouTube, X (Twitter), LinkedIn, Facebook, Pinterest, Threads, Bluesky, Snapchat, Telegram, Discord, and Slack.",
    },
    {
      question: "Can I self-host LateWiz?",
      answer:
        "Absolutely. Clone the repo, add your keys, and deploy anywhere — Vercel, Railway, Docker, or your own server.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Full-bleed atmosphere */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_color-mix(in_oklab,var(--primary)_12%,transparent),_transparent_50%)]" />
        <div className="landing-grid absolute inset-0 opacity-40 dark:opacity-25" />
        <div className="landing-orb absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl md:h-[560px] md:w-[560px]" />
        <div className="landing-orb absolute bottom-[-10%] left-[-8%] h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl [animation-delay:2s] md:h-[480px] md:w-[480px]" />
      </div>

      {/* Floating header */}
      <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border border-border/80 bg-background/75 px-4 shadow-sm backdrop-blur-md sm:h-16 sm:px-6">
          <a href="#top" className="cursor-pointer">
            <Logo size="md" />
          </a>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#ai"
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              AI
            </a>
            <a
              href="#schedule"
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Schedule
            </a>
            <a
              href="#faq"
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              FAQ
            </a>
            <a
              href="https://zernio.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://github.com/zernio-dev/latewiz"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button
              className="cursor-pointer"
              onClick={() => setShowApiKeyModal(true)}
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — brand first, full-bleed */}
      <section
        id="top"
        className="relative z-10 flex min-h-[calc(100svh-5rem)] flex-col justify-center px-4 pb-20 pt-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="landing-fade-up max-w-3xl">
            <div className="mb-8 flex items-center gap-3">
              <Logo size="lg" showText={false} />
              <span className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                LateWiz
              </span>
            </div>
          </div>

          <h1 className="landing-fade-up landing-delay-1 font-heading max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            AI content in,
            <br />
            <span className="text-primary">scheduled posts out</span>
          </h1>

          <p className="landing-fade-up landing-delay-2 mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Generate captions, images, and videos — then schedule across 13
            platforms. Open source, self-hostable, powered by Zernio.
          </p>

          <div className="landing-fade-up landing-delay-3 mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="cursor-pointer"
              onClick={() => setShowApiKeyModal(true)}
            >
              Start scheduling
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="cursor-pointer" asChild>
              <a
                href="https://github.com/zernio-dev/latewiz"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>

          {/* Atmospheric product stage — not a card stack */}
          <div
            className="landing-fade-up landing-delay-4 pointer-events-none mt-16 hidden select-none lg:block"
            aria-hidden
          >
            <div className="relative h-44 overflow-hidden rounded-none border-y border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-primary/5">
              <div className="absolute inset-0 flex items-end gap-6 px-8 pb-8">
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI draft
                  </div>
                  <div className="h-3 w-[80%] max-w-md rounded-sm bg-foreground/15" />
                  <div className="h-3 w-[60%] max-w-sm rounded-sm bg-foreground/10" />
                  <div className="h-3 w-[40%] max-w-xs rounded-sm bg-foreground/10" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex h-20 w-28 items-center justify-center border border-primary/30 bg-primary/10">
                    <ImageIcon className="h-8 w-8 text-primary/80" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Media
                  </span>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2 self-center">
                  <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Queued · 13 platforms
                  </div>
                  <div className="h-2 w-40 rounded-full bg-foreground/10">
                    <div className="h-2 w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section id="ai" className="relative z-10 scroll-mt-24 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              AI features
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Create the post. Then schedule it.
            </h2>
            <p className="mt-4 text-muted-foreground">
              From a single topic to a full campaign — LateWiz generates the
              words and visuals your niche expects.
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {aiFeatures.map((feature) => (
              <div key={feature.title} className="group">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-200 group-hover:bg-primary/20">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-heading mt-4 text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scheduling */}
      <section
        id="schedule"
        className="relative z-10 scroll-mt-24 border-y border-border/60 bg-muted/40 py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Scheduling
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything else you need to ship on time
            </h2>
            <p className="mt-4 text-muted-foreground">
              Calendar, queue, media, and multi-platform publishing — without
              leaving the wizard.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {scheduleFeatures.map((feature) => (
              <div
                key={feature.title}
                className="border-l-2 border-primary/40 pl-5 transition-colors duration-200 hover:border-primary"
              >
                <feature.icon className="h-5 w-5 text-primary" />
                <h3 className="font-heading mt-3 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-muted-foreground">
            Publish once · reach 13 platforms
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            {PLATFORMS.map((platform) => (
              <div
                key={platform}
                className="flex flex-col items-center gap-2"
                title={PLATFORM_NAMES[platform]}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted transition-colors duration-200 hover:bg-accent">
                  <PlatformIcon platform={platform} size="lg" showColor />
                </div>
                <span className="text-xs text-muted-foreground">
                  {PLATFORM_NAMES[platform]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 scroll-mt-24 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              FAQ
            </h2>
            <p className="mt-3 text-muted-foreground">
              Scheduling, AI keys, and self-hosting — covered.
            </p>
          </div>

          <Accordion type="single" collapsible className="mt-12 w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`}>
                <AccordionTrigger className="cursor-pointer font-heading text-left text-base hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Open source CTA */}
      <section className="relative z-10 pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden border border-border bg-gradient-to-br from-primary/15 via-background to-background px-8 py-14 text-center sm:px-12">
            <div className="landing-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
            <div className="relative">
              <Github className="mx-auto h-10 w-10 text-foreground" />
              <h2 className="font-heading mt-6 text-2xl font-bold sm:text-3xl">
                Open source. Yours to run.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                MIT licensed. Self-host, contribute, or fork — LateWiz stays
                under your control.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <iframe
                  src="https://ghbtns.com/github-btn.html?user=zernio-dev&repo=latewiz&type=star&count=true&size=large"
                  style={{ border: 0 }}
                  scrolling="0"
                  width="150"
                  height="30"
                  title="GitHub Stars"
                />
                <Button variant="outline" className="cursor-pointer" asChild>
                  <a
                    href="https://docs.zernio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the Docs
                  </a>
                </Button>
                <Button
                  className="cursor-pointer"
                  onClick={() => setShowApiKeyModal(true)}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">
            Built with{" "}
            <a
              href="https://zernio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer underline underline-offset-4 transition-colors duration-200 hover:text-foreground"
            >
              Zernio
            </a>{" "}
            API
          </p>
        </div>
      </footer>

      <ApiKeyModal open={showApiKeyModal} onOpenChange={setShowApiKeyModal} />
    </div>
  );
}
