import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAiStore } from "@/stores/ai-store";
import type { DraftResult, NicheProfile } from "@/lib/openai/types";
import type { CampaignSlotBrief } from "@/lib/openai";
import type { VideoProvider } from "@/lib/video-providers";
import { generatedMediaKeys } from "./use-generated-media";

function aiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

export function useOpenAiStatus() {
  return useQuery({
    queryKey: ["openai-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai/status", {
        headers: aiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to check OpenAI status");
      return res.json() as Promise<{
        openai_configured: boolean;
        fal_configured?: boolean;
        vault_ready?: boolean;
        has_zernio?: boolean;
        scheduled_campaigns_configured?: boolean;
        scheduled_campaign_storage?:
          | "sqlite"
          | "postgres"
          | "redis"
          | "filesystem"
          | "unavailable";
        default_video_provider?: VideoProvider;
        video_providers_configured?: Record<VideoProvider, boolean>;
        web_search_mode?: "openai_native" | "tavily_serper" | "disabled";
        web_search_configured?: boolean;
        web_search_enabled?: boolean;
      }>;
    },
    staleTime: 30_000,
  });
}

export function isVideoGenerationConfigured(
  provider: VideoProvider,
  status?: {
    openai_configured?: boolean;
    fal_configured?: boolean;
    video_providers_configured?: Record<VideoProvider, boolean>;
  } | null
): boolean {
  if (!status) return false;
  if (status.video_providers_configured?.[provider] != null) {
    return status.video_providers_configured[provider];
  }
  return provider === "fal-pika"
    ? Boolean(status.fal_configured)
    : Boolean(status.openai_configured);
}

export function useGenerateDraft() {
  const niche = useAiStore((s) => s.niche);
  const postPromptStyleId = useAiStore((s) => s.postPromptStyleId);
  const postPromptTemplates = useAiStore((s) => s.postPromptTemplates);

  return useMutation({
    mutationFn: async (
      params?: string | { hint?: string; postPromptStyleId?: string }
    ) => {
      const hint = typeof params === "string" ? params : params?.hint;
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          hint,
          niche,
          post_prompt_style_id:
            (typeof params === "object" ? params?.postPromptStyleId : undefined) ??
            postPromptStyleId,
          post_prompt_templates: postPromptTemplates,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Draft generation failed"
        );
      }
      return res.json() as Promise<{
        draft: DraftResult;
        source: string;
        detail?: string | null;
      }>;
    },
  });
}

export function useGenerateImage() {
  const niche = useAiStore((s) => s.niche);
  const imagePromptStyleId = useAiStore((s) => s.imagePromptStyleId);
  const imagePromptTemplates = useAiStore((s) => s.imagePromptTemplates);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      prompt?: string;
      captionContext?: string;
      promptStyleId?: string;
      referenceImageUrl?: string;
      referenceImageUrls?: string[];
    }) => {
      const referenceImageUrls =
        params.referenceImageUrls ??
        (params.referenceImageUrl?.trim()
          ? [params.referenceImageUrl.trim()]
          : undefined);

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          prompt: params.prompt,
          caption_context: params.captionContext,
          prompt_style_id:
            params.promptStyleId ?? imagePromptStyleId,
          prompt_templates: imagePromptTemplates,
          reference_image_urls: referenceImageUrls,
          niche,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Image generation failed"
        );
      }
      const data = (await res.json()) as {
        image_url: string | null;
        source: string;
        detail?: string | null;
      };
      if (data.image_url) {
        const digest = (params.captionContext ?? params.prompt ?? "")
          .slice(0, 120);
        try {
          const saveRes = await fetch("/api/media/generated", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: data.image_url,
              caption_digest: digest,
            }),
          });
          if (saveRes.ok) {
            const saved = (await saveRes.json()) as {
              item: { url: string };
            };
            data.image_url = saved.item.url;
          }
          queryClient.invalidateQueries({ queryKey: generatedMediaKeys.all });
        } catch {
          /* generation succeeded; gallery save is best-effort */
        }
      }
      return data;
    },
  });
}

export function useGenerateVideo() {
  const niche = useAiStore((s) => s.niche);
  const videoPromptStyleId = useAiStore((s) => s.videoPromptStyleId);
  const videoPromptTemplates = useAiStore((s) => s.videoPromptTemplates);
  const videoProvider = useAiStore((s) => s.videoProvider);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      prompt?: string;
      captionContext?: string;
      promptStyleId?: string;
      videoProvider?: VideoProvider;
    }) => {
      const res = await fetch("/api/ai/generate-video", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          prompt: params.prompt,
          caption_context: params.captionContext,
          prompt_style_id:
            params.promptStyleId ?? videoPromptStyleId,
          prompt_templates: videoPromptTemplates,
          video_provider: params.videoProvider ?? videoProvider,
          niche,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Video generation failed"
        );
      }
      const data = (await res.json()) as {
        video_url: string | null;
        source: string;
        detail?: string | null;
        duration_seconds?: string;
      };
      if (data.video_url) {
        const digest = (params.captionContext ?? params.prompt ?? "")
          .slice(0, 120);
        const needsSave =
          data.video_url.startsWith("data:") ||
          data.video_url.startsWith("http");
        if (needsSave) {
          try {
            const saveRes = await fetch("/api/media/generated", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                video_url: data.video_url,
                caption_digest: digest,
                duration_seconds: data.duration_seconds,
              }),
            });
            if (saveRes.ok) {
              const saved = (await saveRes.json()) as {
                item: { url: string };
              };
              data.video_url = saved.item.url;
            }
            queryClient.invalidateQueries({
              queryKey: generatedMediaKeys.all,
            });
          } catch {
            /* generation succeeded; gallery save is best-effort */
          }
        } else {
          queryClient.invalidateQueries({
            queryKey: generatedMediaKeys.all,
          });
        }
      }
      return data;
    },
  });
}

export interface CampaignSlot {
  scheduled_at: string;
  title: string;
  body: string;
  hashtags: string;
  content: string;
  generationStatus?: "pending_generation" | "processing" | "generated" | "failed" | "cancelled";
  image_url?: string | null;
  video_url?: string | null;
  /** Appended to AI prompt when regenerating this slot */
  aiInstruction?: string;
  /** Image style for this slot's image generation */
  imagePromptStyleId?: string;
  /** Video style for this slot's video generation */
  videoPromptStyleId?: string;
  /** Optional reference image for image-to-image generation */
  reference_image_url?: string | null;
  brief?: CampaignSlotBrief;
  detail?: string | null;
  generatedAt?: string | null;
  postId?: string | null;
  lastError?: string | null;
}

export function useGenerateCampaignSlot() {
  const niche = useAiStore((s) => s.niche);
  const postPromptTemplates = useAiStore((s) => s.postPromptTemplates);

  return useMutation({
    mutationFn: async (params: {
      campaignGoal: string;
      slotIndex: number;
      totalPosts: number;
      scheduledAt: string;
      previousPosts: { title: string; body: string; hashtags: string }[];
      campaignHint?: string;
      trendSnippets?: string[];
      slotBrief?: {
        slotIndex: number;
        phase: string;
        beat: string;
        subtopic: string;
        angle: string;
        keyPoint: string;
        searchHint: string;
      };
      coveredSubtopics?: string[];
      postPromptStyleId?: string;
      isListMode?: boolean;
    }) => {
      const res = await fetch("/api/ai/campaign-slot", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          campaign_goal: params.campaignGoal,
          slot_index: params.slotIndex,
          total_posts: params.totalPosts,
          scheduled_at: params.scheduledAt,
          previous_posts: params.previousPosts,
          campaign_hint: params.campaignHint,
          trend_snippets: params.trendSnippets,
          slot_brief: params.slotBrief,
          covered_subtopics: params.coveredSubtopics,
          post_prompt_style_id: params.postPromptStyleId,
          post_prompt_templates: postPromptTemplates,
          is_list_mode: params.isListMode,
          niche,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Slot generation failed"
        );
      }
      return res.json() as Promise<{
        post: CampaignSlot;
        source: string;
        detail?: string | null;
      }>;
    },
  });
}

export function useGenerateCampaignOutline() {
  const niche = useAiStore((s) => s.niche);

  return useMutation({
    mutationFn: async (params: {
      campaignGoal: string;
      totalPosts: number;
      campaignHint?: string;
      trendSnippets?: string[];
    }) => {
      const res = await fetch("/api/ai/campaign-outline", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          campaign_goal: params.campaignGoal,
          total_posts: params.totalPosts,
          campaign_hint: params.campaignHint,
          trend_snippets: params.trendSnippets,
          niche,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Outline generation failed"
        );
      }
      return res.json() as Promise<{
        beats: {
          slotIndex: number;
          phase: string;
          beat: string;
          subtopic: string;
          angle: string;
          keyPoint: string;
          searchHint: string;
        }[];
        source: string;
        detail?: string | null;
      }>;
    },
  });
}

export function useCampaignPlan() {
  const niche = useAiStore((s) => s.niche);

  return useMutation({
    mutationFn: async (params: {
      postsPerDay: number;
      planDays: number;
      startDate: string;
      timezone: string;
      windowStart: string;
      windowEnd: string;
      campaignHint?: string;
      trendSnippets?: string[];
    }) => {
      const res = await fetch("/api/ai/campaign-plan", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          posts_per_day: params.postsPerDay,
          plan_days: params.planDays,
          start_date: params.startDate,
          timezone: params.timezone,
          window_start: params.windowStart,
          window_end: params.windowEnd,
          campaign_hint: params.campaignHint,
          trend_snippets: params.trendSnippets,
          niche,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Campaign planning failed"
        );
      }
      return res.json() as Promise<{
        slots: CampaignSlot[];
        source: string;
        detail?: string | null;
        total_posts: number;
      }>;
    },
  });
}

/** Upload a data URL or remote URL as a File to Zernio media storage */
export async function urlToFile(
  url: string,
  filename?: string
): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  const type = blob.type || "application/octet-stream";
  const defaultName = type.startsWith("video/")
    ? "ai-video.mp4"
    : "ai-image.png";
  return new File([blob], filename ?? defaultName, { type });
}

export type { NicheProfile };
