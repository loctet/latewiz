"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  ChevronDown,
  Loader2,
  Sparkles,
  Wand2,
  ImageIcon,
  Film,
  SlidersHorizontal,
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

/** Prefer draft text from the composer; keep any external hint as extra context. */
function buildDraftHint(content: string, hint?: string): string | undefined {
  const draft = content.trim();
  const brief = hint?.trim();
  if (draft && brief && draft !== brief) {
    return `Brief: ${brief}\n\nExisting draft / notes to refine:\n${draft}`;
  }
  return draft || brief || undefined;
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
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
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
  const draftHint = buildDraftHint(content, hint);

  const applyDraft = async () => {
    try {
      const r = await draftMutation.mutateAsync({
        hint: draftHint,
        postPromptStyleId,
      });
      const parts = [r.draft.body, r.draft.hashtags].filter(Boolean);
      onContentChange(parts.join("\n\n"));
      if (r.source === "stub") {
        toast.message("Using placeholder — add your OpenAI key in Settings.");
      } else if (r.source === "fallback" && r.detail) {
        toast.error(r.detail);
      } else {
        toast.success(
          content.trim()
            ? "Caption suggested from your draft"
            : "Caption generated"
        );
      }
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
          prompt: hint,
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
          prompt: hint,
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
            <Button type="button" variant="ghost" size="sm" className="h-8" asChild>
              <Link href="/dashboard/ai-studio">Studio</Link>
            </Button>
          </div>
        )}
      </div>

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
        <div className="border-t border-primary/15 px-3 py-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid gap-3 sm:grid-cols-2">
            <PostPromptStyleSelect
              variant="compose"
              compact
              campaignGoal={draftHint ?? ""}
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
