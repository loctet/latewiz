import { NextRequest, NextResponse } from "next/server";
import { parseNicheFromBody } from "@/lib/openai";
import { resolveOpenAiApiKey } from "@/lib/openai/resolve-key";
import { resolveFalApiKey } from "@/lib/fal/resolve-key";
import {
  generatePostVideo,
  parseVideoProvider,
} from "@/lib/video-generation";
import { saveGeneratedVideoFile } from "@/lib/server/generated-media-files";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const openaiApiKey = resolveOpenAiApiKey(
      request.headers.get("x-openai-api-key"),
      typeof body.openaiApiKey === "string" ? body.openaiApiKey : null
    );
    const falApiKey = resolveFalApiKey(
      request.headers.get("x-fal-api-key"),
      typeof body.falApiKey === "string"
        ? body.falApiKey
        : typeof body.fal_api_key === "string"
          ? body.fal_api_key
          : null
    );
    const provider = parseVideoProvider(
      body.video_provider ?? body.videoProvider
    );
    const niche = parseNicheFromBody(body);
    const prompt =
      typeof body.prompt === "string" ? body.prompt : undefined;
    const captionContext =
      typeof body.caption_context === "string"
        ? body.caption_context
        : typeof body.captionContext === "string"
          ? body.captionContext
          : undefined;
    const promptStyleId =
      typeof body.prompt_style_id === "string"
        ? body.prompt_style_id
        : typeof body.promptStyleId === "string"
          ? body.promptStyleId
          : undefined;

    const templateOverrides =
      body.prompt_templates &&
      typeof body.prompt_templates === "object" &&
      !Array.isArray(body.prompt_templates)
        ? (body.prompt_templates as Record<string, string>)
        : body.promptTemplates &&
            typeof body.promptTemplates === "object" &&
            !Array.isArray(body.promptTemplates)
          ? (body.promptTemplates as Record<string, string>)
          : undefined;

    const result = await generatePostVideo(
      provider,
      openaiApiKey,
      falApiKey,
      niche,
      prompt,
      captionContext,
      promptStyleId,
      templateOverrides
    );

    let videoUrl = result.url;
    if (
      videoUrl &&
      (videoUrl.startsWith("data:") || videoUrl.startsWith("http"))
    ) {
      const digest = (captionContext ?? prompt ?? "").slice(0, 120);
      const entry = await saveGeneratedVideoFile(
        videoUrl,
        digest,
        result.duration_seconds
      );
      videoUrl = entry.url;
    }

    return NextResponse.json({
      video_url: videoUrl,
      video_id: result.video_id,
      source: result.source,
      detail: result.detail,
      duration_seconds: result.duration_seconds,
      provider: result.provider,
    });
  } catch (err) {
    console.error("AI video error:", err);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    );
  }
}
