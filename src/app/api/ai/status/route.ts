import { NextRequest, NextResponse } from "next/server";
import {
  isNativeWebSearchPreferred,
  isOpenAiConfigured,
} from "@/lib/openai";
import {
  isVideoProviderConfigured,
  parseVideoProvider,
  type VideoProvider,
} from "@/lib/video-providers";
import { isWebSearchEnabled } from "@/lib/web-search";
import { getSessionFromRequest } from "@/lib/server/session";
import { getVaultStatus } from "@/lib/server/vault";
import {
  resolveUserFalKey,
  resolveUserOpenAiKey,
} from "@/lib/server/resolve-user-keys";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  let openaiConfigured = false;
  let falConfigured = false;
  let vaultReady = false;
  let hasZernio = false;

  if (session?.user?.id) {
    const vault = await getVaultStatus(session.user.id);
    vaultReady = vault.hasOpenai && vault.hasZernio;
    hasZernio = vault.hasZernio;
    const key = await resolveUserOpenAiKey(
      session.user.id,
      request.headers.get("x-openai-api-key")
    );
    const falKey = await resolveUserFalKey(
      session.user.id,
      request.headers.get("x-fal-api-key")
    );
    openaiConfigured = isOpenAiConfigured(key);
    falConfigured = Boolean(falKey);
  }

  const videoProviders: VideoProvider[] = ["openai-sora", "fal-pika"];
  const video_providers_configured = Object.fromEntries(
    videoProviders.map((p) => [
      p,
      isVideoProviderConfigured(
        p,
        openaiConfigured ? "sk-configured" : null,
        falConfigured ? "fal-configured-key-value" : null
      ),
    ])
  ) as Record<VideoProvider, boolean>;

  // Recompute with actual key presence flags (providers only check boolean-ish)
  video_providers_configured["openai-sora"] = openaiConfigured;
  video_providers_configured["fal-pika"] = falConfigured;

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
    vault_ready: vaultReady,
    has_zernio: hasZernio,
    scheduled_campaigns_configured: vaultReady,
    scheduled_campaign_storage: "sqlite",
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
