"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  useGenerateDraft,
  useGenerateImage,
  useGenerateVideo,
  useOpenAiStatus,
  isVideoGenerationConfigured,
  useImageWatermarkSettings,
  watermarkImageIfEnabled,
} from "@/hooks";
import { useAiStore } from "@/stores";
import type { AiMediaKind } from "@/lib/campaign-media";
import { savePostPrefill } from "@/lib/post-prefill";
import { NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS } from "@/lib/notebook-infographic-presets";
import { PageContainer } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Wand2,
  Copy,
  RefreshCw,
  Image as ImageIcon,
  Film,
  Loader2,
  PenLine,
  ChevronDown,
  SlidersHorizontal,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  AiImageReferencePicker,
  AiMediaModeSelect,
  ImagePromptStyleSelect,
  PostPromptStyleSelect,
  ResearchDepthSelect,
  VideoPromptStyleSelect,
  VideoProviderSelect,
} from "@/components/ai";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "witty", label: "Witty" },
  { value: "educational", label: "Educational" },
] as const;

export default function AiStudioPage() {
  const router = useRouter();
  const { data: status } = useOpenAiStatus();
  const draftMutation = useGenerateDraft();
  const imageMutation = useGenerateImage();
  const videoMutation = useGenerateVideo();
  const aiMediaKind = useAiStore((s) => s.aiMediaKind);
  const setAiMediaKind = useAiStore((s) => s.setAiMediaKind);
  const videoProvider = useAiStore((s) => s.videoProvider);
  const postPromptStyleId = useAiStore((s) => s.postPromptStyleId);
  const imageWatermarkSettings = useImageWatermarkSettings();

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedBody, setGeneratedBody] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState<
    string | undefined
  >();
  const [optionsOpen, setOptionsOpen] = useState(false);

  const configured = status?.openai_configured ?? false;
  const videoConfigured = isVideoGenerationConfigured(videoProvider, status);

  const infographicPresetValue = useMemo(() => {
    const m = NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.find(
      (p) => p.topic === topic.trim()
    );
    return m?.id ?? "__none__";
  }, [topic]);

  const hintPayload = [topic.trim(), tone ? `Tone: ${tone}` : ""]
    .filter(Boolean)
    .join("\n");

  const captionContext = useMemo(
    () =>
      [generatedTitle.trim(), generatedBody.trim(), generatedHashtags.trim()]
        .filter(Boolean)
        .join("\n\n"),
    [generatedTitle, generatedBody, generatedHashtags]
  );

  const hasCopy = Boolean(generatedTitle.trim() || generatedBody.trim());
  const hasMedia = Boolean(imageUrl || videoUrl);
  const hasOutput = hasCopy || hasMedia;
  const mediaPending = imageMutation.isPending || videoMutation.isPending;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or brief");
      return;
    }
    try {
      const r = await draftMutation.mutateAsync({
        hint: hintPayload,
        postPromptStyleId,
      });
      setGeneratedTitle(r.draft.title);
      setGeneratedBody(r.draft.body);
      setGeneratedHashtags(r.draft.hashtags);
      if (r.source === "stub") {
        toast.message("Using placeholder — add OpenAI key in Settings.");
      } else if (
        r.source === "openai+web" ||
        r.source === "openai+fallback-search"
      ) {
        toast.success("Caption generated with live web research.");
      } else if (r.source === "openai") {
        toast.message(
          "Caption generated without confirmed web search — results may be generic. Check Settings → Live web research."
        );
      }
      if (r.source === "fallback" && r.detail) {
        toast.error(r.detail);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const handleGenerateMedia = async () => {
    if (aiMediaKind === "video") {
      if (!videoConfigured) {
        toast.error(
          videoProvider === "fal-pika"
            ? "Add your fal.ai API key in Settings first."
            : "Add your OpenAI API key in Settings first."
        );
        return;
      }
      toast.message("Video generation can take 1–3 minutes…");
    } else if (!configured) {
      toast.error("Add your OpenAI API key in Settings first.");
      return;
    }
    try {
      const ctx = captionContext || undefined;
      if (aiMediaKind === "video") {
        const r = await videoMutation.mutateAsync({
          prompt: topic.trim() || undefined,
          captionContext: ctx,
        });
        if (r.video_url) {
          setVideoUrl(r.video_url);
          setImageUrl("");
          toast.success("Video ready — saved to your media library.");
        } else {
          toast.error(r.detail ?? "No video returned");
        }
      } else {
        const r = await imageMutation.mutateAsync({
          prompt: topic.trim() || undefined,
          captionContext: ctx,
          referenceImageUrl,
        });
        if (r.image_url) {
          const stamped = await watermarkImageIfEnabled(
            r.image_url,
            imageWatermarkSettings
          );
          setImageUrl(stamped);
          setVideoUrl("");
          toast.success("Image ready — saved to your media library.");
        } else {
          toast.error(r.detail ?? "No image returned");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Media generation failed");
    }
  };

  const copyAll = async () => {
    const text = [generatedTitle, generatedBody, generatedHashtags]
      .filter(Boolean)
      .join("\n\n");
    if (!text.trim()) {
      toast.error("Nothing to copy yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const openInComposer = () => {
    if (!hasOutput && !topic.trim()) {
      toast.error("Generate a caption or media first");
      return;
    }
    savePostPrefill({
      title: generatedTitle,
      body: [generatedBody, generatedHashtags].filter(Boolean).join("\n\n"),
      aiHint: hintPayload,
      imageUrls: imageUrl.trim() ? [imageUrl.trim()] : undefined,
      videoUrls: videoUrl.trim() ? [videoUrl.trim()] : undefined,
    });
    router.push("/dashboard/compose");
  };

  return (
    <PageContainer className="max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            AI Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft a caption, generate media, then send it to the composer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/niche">
              <Target className="mr-1.5 h-3.5 w-3.5" />
              Niche
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={openInComposer}
            disabled={!hasOutput && !topic.trim()}
          >
            Open in composer
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!configured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
          OpenAI is not configured.{" "}
          <Link
            href="/dashboard/settings"
            className="font-medium underline underline-offset-2"
          >
            Add your API key
          </Link>
          {" · "}
          <Link
            href="/dashboard/niche"
            className="font-medium underline underline-offset-2"
          >
            Set niche
          </Link>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Controls */}
        <aside className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4 lg:sticky lg:top-4">
          <div className="space-y-1.5">
            <Label htmlFor="studio-topic" className="text-xs">
              Topic or brief
            </Label>
            <Textarea
              id="studio-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this post be about?"
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tone</Label>
            <div className="flex flex-wrap gap-1">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    tone === t.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Infographic preset</Label>
            <Select
              value={infographicPresetValue}
              onValueChange={(id) => {
                if (id === "__none__") return;
                const p = NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.find(
                  (x) => x.id === id
                );
                if (p) setTopic(p.topic);
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Optional preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Custom topic</SelectItem>
                {NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setOptionsOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={optionsOpen}
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Generation options
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  optionsOpen && "rotate-180"
                )}
              />
            </button>

            {optionsOpen && (
              <div className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <PostPromptStyleSelect
                  variant="compose"
                  compact
                  campaignGoal={topic.trim()}
                />
                <ResearchDepthSelect compact />
                <AiMediaModeSelect
                  compact
                  value={aiMediaKind}
                  onValueChange={(k: AiMediaKind) => setAiMediaKind(k)}
                />
                {aiMediaKind === "image" ? (
                  <>
                    <ImagePromptStyleSelect compact />
                    <AiImageReferencePicker
                      compact
                      value={referenceImageUrl}
                      onChange={setReferenceImageUrl}
                      existingImageUrl={imageUrl || null}
                    />
                  </>
                ) : (
                  <>
                    <VideoProviderSelect compact />
                    <VideoPromptStyleSelect compact />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Button
              onClick={handleGenerate}
              disabled={draftMutation.isPending}
              className="w-full"
            >
              {draftMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate caption
            </Button>
            <Button
              onClick={handleGenerateMedia}
              disabled={
                mediaPending ||
                (aiMediaKind === "video" ? !videoConfigured : !configured)
              }
              variant="secondary"
              className="w-full"
            >
              {mediaPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : aiMediaKind === "video" ? (
                <Film className="mr-2 h-4 w-4" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              {aiMediaKind === "video" ? "Generate video" : "Generate image"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Uses your topic, caption (if any), and niche profile.
              {aiMediaKind === "video"
                ? " Video can take several minutes."
                : " Notebook infographic is the default image style."}
            </p>
          </div>
        </aside>

        {/* Output canvas */}
        <section className="min-h-[28rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div>
              <p className="text-sm font-medium">Preview</p>
              <p className="text-xs text-muted-foreground">
                Edit freely before sending to compose
              </p>
            </div>
            {hasOutput && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={copyAll}
                  disabled={!hasCopy}
                >
                  <Copy className="mr-1.5 h-3 w-3" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={handleGenerate}
                  disabled={draftMutation.isPending || !topic.trim()}
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 h-3 w-3",
                      draftMutation.isPending && "animate-spin"
                    )}
                  />
                  Regenerate
                </Button>
              </div>
            )}
          </div>

          {!hasOutput ? (
            <div className="flex h-[min(28rem,60vh)] flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium">Nothing generated yet</p>
                <p className="text-xs text-muted-foreground">
                  Enter a brief on the left, then generate a caption and optional
                  image or video. Results show up here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 animate-in fade-in-0 duration-300">
              {(hasMedia || mediaPending) && (
                <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
                  {mediaPending ? (
                    <div className="flex aspect-video items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating{" "}
                      {aiMediaKind === "video" ? "video" : "image"}…
                    </div>
                  ) : videoUrl ? (
                    <video
                      src={videoUrl}
                      controls
                      className="max-h-80 w-full bg-black object-contain"
                    />
                  ) : imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="AI generated"
                      className="max-h-80 w-full object-contain"
                    />
                  ) : null}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="studio-title" className="text-xs">
                    Title
                  </Label>
                  <Input
                    id="studio-title"
                    value={generatedTitle}
                    onChange={(e) => setGeneratedTitle(e.target.value)}
                    placeholder="Generated title"
                    className="font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studio-body" className="text-xs">
                    Caption
                  </Label>
                  <Textarea
                    id="studio-body"
                    value={generatedBody}
                    onChange={(e) => setGeneratedBody(e.target.value)}
                    placeholder="Generated caption"
                    rows={8}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studio-tags" className="text-xs">
                    Hashtags
                  </Label>
                  <Input
                    id="studio-tags"
                    value={generatedHashtags}
                    onChange={(e) => setGeneratedHashtags(e.target.value)}
                    placeholder="#tags"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button onClick={openInComposer} className="sm:ml-auto">
                  <PenLine className="mr-2 h-4 w-4" />
                  Open in composer
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
