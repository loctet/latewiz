"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  useGenerateDraft,
  useGenerateImage,
  useGenerateVideo,
  useOpenAiStatus,
  isVideoGenerationConfigured,
  useUploadMedia,
  urlToFile,
  useImageWatermarkSettings,
  watermarkImageIfEnabled,
  type UploadedMedia,
} from "@/hooks";
import { useAiStore } from "@/stores";
import type { AiMediaKind } from "@/lib/campaign-media";
import { toast } from "sonner";
import {
  notifyDeepResearchStarting,
  notifyDraftGenerationResult,
} from "@/lib/ai-draft-feedback";
import {
  ChevronDown,
  Loader2,
  Sparkles,
  Wand2,
  ImageIcon,
  Film,
  SlidersHorizontal,
  FileText,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AiMediaModeSelect } from "./ai-media-mode-select";
import { AiImageReferencePicker } from "./ai-image-reference-picker";
import { ImagePromptStyleSelect } from "./image-prompt-style-select";
import { VideoPromptStyleSelect } from "./video-prompt-style-select";
import { VideoProviderSelect } from "./video-provider-select";
import { PostPromptStyleSelect } from "./post-prompt-style-select";
import { ResearchDepthSelect } from "./research-depth-select";

interface AiAssistPanelProps {
  content: string;
  onContentChange: (content: string) => void;
  media: UploadedMedia[];
  onMediaChange: (media: UploadedMedia[]) => void;
  hint?: string;
}

/**
 * Resolve what Deep / Suggest caption should research.
 * Priority: Options research topic → compose box → external hint → niche (server).
 */
function buildDraftHint(params: {
  content: string;
  researchTopic: string;
  hint?: string;
}): string | undefined {
  const topic = params.researchTopic.trim();
  const draft = params.content.trim();
  const brief = params.hint?.trim();

  if (topic) {
    if (draft && draft !== topic) {
      return [
        `Research topic: ${topic}`,
        "",
        "Additional context from the compose box (use only if relevant to the research topic):",
        draft.slice(0, 2500),
      ].join("\n");
    }
    return `Research topic: ${topic}`;
  }

  if (draft) {
    return [
      "Research topic / brief from the composer (PRIMARY SUBJECT — stay on this):",
      draft.slice(0, 3000),
    ].join("\n");
  }

  if (brief) return `Research topic: ${brief}`;
  return undefined;
}

export function AiAssistPanel({
  content,
  onContentChange,
  media,
  onMediaChange,
  hint,
}: AiAssistPanelProps) {
  const [assistEnabled, setAssistEnabled] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [researchTopic, setResearchTopic] = useState("");
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const [lastDetail, setLastDetail] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<
    string | undefined
  >();
  const aiMediaKind = useAiStore((s) => s.aiMediaKind);
  const setAiMediaKind = useAiStore((s) => s.setAiMediaKind);
  const videoProvider = useAiStore((s) => s.videoProvider);
  const imageWatermarkSettings = useImageWatermarkSettings();
  const { data: status } = useOpenAiStatus();
  const videoConfigured = isVideoGenerationConfigured(videoProvider, status);
  const postPromptStyleId = useAiStore((s) => s.postPromptStyleId);
  const draftMutation = useGenerateDraft();
  const imageMutation = useGenerateImage();
  const videoMutation = useGenerateVideo();
  const uploadMutation = useUploadMedia();

  const configured = status?.openai_configured ?? false;
  const draftHint = buildDraftHint({ content, researchTopic, hint });

  const applyDraft = async () => {
    const depthId = useAiStore.getState().researchDepthId;
    const nicheTopic = useAiStore.getState().niche.topic.trim();
    const resolved = buildDraftHint({ content, researchTopic, hint });

    if (depthId === "deep" && !resolved && !nicheTopic) {
      toast.error("Add a research topic first", {
        description:
          "Type a topic in the compose box, or open Options → Research topic. Deep research needs a clear subject.",
      });
      setOptionsOpen(true);
      return;
    }

    try {
      notifyDeepResearchStarting();
      const r = await draftMutation.mutateAsync({
        hint: resolved,
        postPromptStyleId,
        researchDepthId: depthId,
      });
      const parts = [r.draft.body, r.draft.hashtags].filter(Boolean);
      onContentChange(parts.join("\n\n"));
      setLastPdfUrl(r.draft.pdfUrl?.trim() || null);
      setLastSource(r.source);
      setLastDetail(r.detail ?? r.draft.detail ?? null);
      notifyDraftGenerationResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const generateMedia = async () => {
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
      const captionContext = content.trim() || undefined;
      if (aiMediaKind === "video") {
        const r = await videoMutation.mutateAsync({
          captionContext,
          prompt: researchTopic.trim() || hint,
        });
        if (!r.video_url) {
          toast.error(r.detail ?? "No video returned");
          return;
        }
        const file = await urlToFile(r.video_url, "ai-video.mp4");
        const uploaded = await uploadMutation.mutateAsync(file);
        onMediaChange([...media.filter((m) => m.type !== "video"), uploaded]);
        toast.success("AI video added to post");
      } else {
        const r = await imageMutation.mutateAsync({
          captionContext,
          prompt: researchTopic.trim() || hint,
          referenceImageUrl,
        });
        if (!r.image_url) {
          toast.error(r.detail ?? "No image returned");
          return;
        }
        const stamped = await watermarkImageIfEnabled(
          r.image_url,
          imageWatermarkSettings
        );
        const file = await urlToFile(stamped);
        const uploaded = await uploadMutation.mutateAsync(file);
        onMediaChange([...media.filter((m) => m.type !== "image"), uploaded]);
        toast.success("AI image added to post");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Media generation failed"
      );
    }
  };

  const mediaPending =
    imageMutation.isPending ||
    videoMutation.isPending ||
    uploadMutation.isPending;

  return (
    <div className="rounded-lg border border-dashed border-primary/25 bg-primary/[0.04]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium">AI Assist</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <Switch
            id="ai-assist"
            checked={assistEnabled}
            onCheckedChange={setAssistEnabled}
            className="scale-90"
          />
          <Label
            htmlFor="ai-assist"
            className="text-xs text-muted-foreground sr-only sm:not-sr-only"
          >
            {assistEnabled ? "On" : "Off"}
          </Label>
        </div>

        {assistEnabled && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={applyDraft}
              disabled={draftMutation.isPending}
            >
              {draftMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3 w-3" />
              )}
              Suggest caption
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={generateMedia}
              disabled={
                mediaPending ||
                (aiMediaKind === "video" ? !videoConfigured : !configured)
              }
            >
              {mediaPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : aiMediaKind === "video" ? (
                <Film className="mr-1.5 h-3 w-3" />
              ) : (
                <ImageIcon className="mr-1.5 h-3 w-3" />
              )}
              {aiMediaKind === "video" ? "Generate video" : "Generate image"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setOptionsOpen((o) => !o)}
              aria-expanded={optionsOpen}
            >
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              Options
              <ChevronDown
                className={cn(
                  "ml-0.5 h-3 w-3 transition-transform duration-200",
                  optionsOpen && "rotate-180"
                )}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              asChild
            >
              <Link href="/dashboard/ai-studio">Studio</Link>
            </Button>
          </div>
        )}
      </div>

      {assistEnabled && (lastPdfUrl || lastSource) && (
        <div className="space-y-1.5 px-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {lastSource === "openai+deep-research" ? (
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                Deep research used
              </span>
            ) : lastSource ? (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                Standard generation (not deep)
              </span>
            ) : null}
            {lastPdfUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                asChild
              >
                <a href={lastPdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-1.5 h-3 w-3" />
                  Full report (PDF)
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                </a>
              </Button>
            ) : null}
          </div>
          {lastSource !== "openai+deep-research" && lastDetail ? (
            <p className="text-[11px] leading-snug text-amber-800/90 dark:text-amber-100/80">
              Why: {lastDetail.slice(0, 280)}
            </p>
          ) : null}
        </div>
      )}

      {!configured && assistEnabled && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          OpenAI not configured.{" "}
          <Link href="/dashboard/settings" className="underline text-primary">
            Add your API key
          </Link>
          ,{" "}
          <Link href="/dashboard/niche" className="underline text-primary">
            set your niche
          </Link>
          , or use server OPENAI_API_KEY.
        </p>
      )}

      {assistEnabled && optionsOpen && (
        <div className="space-y-3 border-t border-primary/15 px-3 py-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="space-y-1.5">
            <Label htmlFor="research-topic" className="text-xs">
              Research topic
            </Label>
            <Input
              id="research-topic"
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              placeholder='e.g. "Bitcoin ETF flows this week" — overrides the compose box as the subject'
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Empty compose box → uses this topic or your niche. Filled compose
              box → that text is the subject (unless you set a research topic
              here). Deep research may take several minutes and adds a PDF link.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PostPromptStyleSelect
              variant="compose"
              compact
              campaignGoal={draftHint ?? researchTopic ?? ""}
            />
            <ResearchDepthSelect compact />
            <AiMediaModeSelect
              compact
              value={aiMediaKind}
              onValueChange={(k: AiMediaKind) => setAiMediaKind(k)}
            />
          </div>
          {aiMediaKind === "image" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ImagePromptStyleSelect compact />
              <AiImageReferencePicker
                compact
                value={referenceImageUrl}
                onChange={setReferenceImageUrl}
                mediaSources={media}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <VideoProviderSelect compact />
              <VideoPromptStyleSelect compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
