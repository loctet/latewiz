import type { NicheProfile } from "@/lib/openai/types";
import { generatePikaVideo } from "@/lib/fal/pika-video";
import {
  type VideoProvider,
  parseVideoProvider,
  isVideoProviderConfigured,
} from "@/lib/video-providers";
import { generateSoraVideo } from "./sora-video";

export type { VideoProvider };
export { parseVideoProvider, isVideoProviderConfigured };

export async function generatePostVideo(
  provider: VideoProvider,
  openaiApiKey: string | null,
  falApiKey: string | null,
  niche: NicheProfile,
  explicitPrompt?: string,
  captionContext?: string,
  promptStyleId?: string,
  templateOverrides?: Record<string, string>
): Promise<{
  url: string | null;
  video_id: string | null;
  source: string;
  detail: string | null;
  duration_seconds?: string;
  provider: VideoProvider;
}> {
  if (!isVideoProviderConfigured(provider, openaiApiKey, falApiKey)) {
    const detail =
      provider === "fal-pika"
        ? "Add a fal.ai API key in Settings or set FAL_KEY on the server."
        : "Add an OpenAI API key in Settings or set OPENAI_API_KEY on the server.";
    return {
      url: null,
      video_id: null,
      source: "unconfigured",
      detail,
      provider,
    };
  }

  const result =
    provider === "fal-pika"
      ? await generatePikaVideo(
          falApiKey,
          niche,
          explicitPrompt,
          captionContext,
          promptStyleId,
          templateOverrides
        )
      : await generateSoraVideo(
          openaiApiKey,
          niche,
          explicitPrompt,
          captionContext,
          promptStyleId,
          templateOverrides
        );

  return { ...result, provider };
}
