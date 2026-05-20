import { useMutation, useQuery } from "@tanstack/react-query";
import { useAiStore } from "@/stores/ai-store";
import type { DraftResult, NicheProfile } from "@/lib/openai/types";

function aiHeaders(openaiApiKey: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (openaiApiKey) {
    headers["X-OpenAI-Api-Key"] = openaiApiKey;
  }
  return headers;
}

export function useOpenAiStatus() {
  const openaiApiKey = useAiStore((s) => s.openaiApiKey);

  return useQuery({
    queryKey: ["openai-status", !!openaiApiKey],
    queryFn: async () => {
      const res = await fetch("/api/ai/status", {
        headers: aiHeaders(openaiApiKey),
      });
      if (!res.ok) throw new Error("Failed to check OpenAI status");
      return res.json() as Promise<{ openai_configured: boolean }>;
    },
    staleTime: 30_000,
  });
}

export function useGenerateDraft() {
  const openaiApiKey = useAiStore((s) => s.openaiApiKey);
  const niche = useAiStore((s) => s.niche);

  return useMutation({
    mutationFn: async (hint?: string) => {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: aiHeaders(openaiApiKey),
        body: JSON.stringify({ hint, niche }),
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
  const openaiApiKey = useAiStore((s) => s.openaiApiKey);
  const niche = useAiStore((s) => s.niche);
  const addGeneratedMedia = useAiStore((s) => s.addGeneratedMedia);

  return useMutation({
    mutationFn: async (params: {
      prompt?: string;
      captionContext?: string;
    }) => {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: aiHeaders(openaiApiKey),
        body: JSON.stringify({
          prompt: params.prompt,
          caption_context: params.captionContext,
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
        addGeneratedMedia({
          url: data.image_url,
          captionDigest: digest,
        });
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
  image_url?: string | null;
}

export function useCampaignPlan() {
  const openaiApiKey = useAiStore((s) => s.openaiApiKey);
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
        headers: aiHeaders(openaiApiKey),
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
export async function urlToFile(url: string, filename = "ai-image.png"): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], filename, { type });
}

export type { NicheProfile };
