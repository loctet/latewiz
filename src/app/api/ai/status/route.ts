import { NextRequest, NextResponse } from "next/server";
import {
  isNativeWebSearchPreferred,
  isOpenAiConfigured,
  resolveOpenAiApiKey,
} from "@/lib/openai";
import { resolveFalApiKey } from "@/lib/fal/resolve-key";
import {
  isVideoProviderConfigured,
  parseVideoProvider,
  type VideoProvider,
} from "@/lib/video-providers";
import {
  isWebSearchConfigured,
  isWebSearchEnabled,
} from "@/lib/web-search";

export async function GET(request: NextRequest) {
  const headerKey = request.headers.get("x-openai-api-key");
  const key = resolveOpenAiApiKey(headerKey);
  const falKey = resolveFalApiKey(request.headers.get("x-fal-api-key"));
  const openaiConfigured = isOpenAiConfigured(key);
  const falConfigured = Boolean(falKey);
  const videoProviders: VideoProvider[] = ["openai-sora", "fal-pika"];
  const video_providers_configured = Object.fromEntries(
    videoProviders.map((p) => [
      p,
      isVideoProviderConfigured(p, key, falKey),
    ])
  ) as Record<VideoProvider, boolean>;
  const nativePreferred = isNativeWebSearchPreferred();
  const fallbackSearch = isWebSearchEnabled();

  let web_search_mode: "openai_native" | "tavily_serper" | "disabled" =
    "disabled";
  if (openaiConfigured && nativePreferred) {
    web_search_mode = "openai_native";
  } else if (fallbackSearch) {
    web_search_mode = "tavily_serper";
  }

  return NextResponse.json({
    openai_configured: openaiConfigured,
    fal_configured: falConfigured,
    default_video_provider: parseVideoProvider(undefined),
    video_providers_configured,
    web_search_mode,
    web_search_configured:
      web_search_mode !== "disabled" ||
      (openaiConfigured && nativePreferred),
    web_search_enabled:
      web_search_mode === "openai_native" || web_search_mode === "tavily_serper",
  });
}
