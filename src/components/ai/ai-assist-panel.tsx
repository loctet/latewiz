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
  type UploadedMedia,
} from "@/hooks";
import { useAiStore } from "@/stores";
import type { AiMediaKind } from "@/lib/campaign-media";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2, ImageIcon, Film } from "lucide-react";
import Link from "next/link";
import { AiMediaModeSelect } from "./ai-media-mode-select";
import { ImagePromptStyleSelect } from "./image-prompt-style-select";
import { VideoPromptStyleSelect } from "./video-prompt-style-select";
import { VideoProviderSelect } from "./video-provider-select";

interface AiAssistPanelProps {
  content: string;
  onContentChange: (content: string) => void;
  media: UploadedMedia[];
  onMediaChange: (media: UploadedMedia[]) => void;
  hint?: string;
}

export function AiAssistPanel({
  content,
  onContentChange,
  media,
  onMediaChange,
  hint,
}: AiAssistPanelProps) {
  const [assistEnabled, setAssistEnabled] = useState(true);
  const aiMediaKind = useAiStore((s) => s.aiMediaKind);
  const setAiMediaKind = useAiStore((s) => s.setAiMediaKind);
  const videoProvider = useAiStore((s) => s.videoProvider);
  const { data: status } = useOpenAiStatus();
  const videoConfigured = isVideoGenerationConfigured(videoProvider, status);
  const draftMutation = useGenerateDraft();
  const imageMutation = useGenerateImage();
  const videoMutation = useGenerateVideo();
  const uploadMutation = useUploadMedia();

  const configured = status?.openai_configured ?? false;

  const applyDraft = async () => {
    try {
      const r = await draftMutation.mutateAsync(hint);
      const parts = [r.draft.body, r.draft.hashtags].filter(Boolean);
      onContentChange(parts.join("\n\n"));
      if (r.source === "stub") {
        toast.message("Using placeholder — add your OpenAI key in Settings.");
      } else if (r.source === "fallback" && r.detail) {
        toast.error(r.detail);
      } else {
        toast.success("Caption generated");
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
        });
        if (!r.image_url) {
          toast.error(r.detail ?? "No image returned");
          return;
        }
        const file = await urlToFile(r.image_url);
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
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Assist</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="ai-assist"
            checked={assistEnabled}
            onCheckedChange={setAssistEnabled}
          />
          <Label htmlFor="ai-assist" className="text-xs text-muted-foreground">
            Enabled
          </Label>
        </div>
      </div>

      {!configured && (
        <p className="text-xs text-muted-foreground">
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

      {assistEnabled && (
        <>
          <AiMediaModeSelect
            value={aiMediaKind}
            onValueChange={(k: AiMediaKind) => setAiMediaKind(k)}
          />
          {aiMediaKind === "image" ? (
            <ImagePromptStyleSelect />
          ) : (
            <>
              <VideoProviderSelect />
              <VideoPromptStyleSelect />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyDraft}
              disabled={draftMutation.isPending}
            >
              {draftMutation.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-3 w-3" />
              )}
              Suggest caption
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generateMedia}
              disabled={
                mediaPending ||
                (aiMediaKind === "video" ? !videoConfigured : !configured)
              }
            >
              {mediaPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : aiMediaKind === "video" ? (
                <Film className="mr-2 h-3 w-3" />
              ) : (
                <ImageIcon className="mr-2 h-3 w-3" />
              )}
              {aiMediaKind === "video" ? "Generate video" : "Generate image"}
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/dashboard/ai-studio">Open AI Studio</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
