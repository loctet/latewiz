import { NextRequest, NextResponse } from "next/server";
import {
  generatePostImage,
  parseNicheFromBody,
  resolveOpenAiApiKey,
} from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const headerKey = request.headers.get("x-openai-api-key");
    const apiKey = resolveOpenAiApiKey(
      headerKey,
      typeof body.openaiApiKey === "string" ? body.openaiApiKey : null
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

    const result = await generatePostImage(
      apiKey,
      niche,
      prompt,
      captionContext
    );

    let imageUrl = result.url;
    if (!imageUrl && result.b64_json) {
      imageUrl = `data:image/png;base64,${result.b64_json}`;
    }

    return NextResponse.json({
      image_url: imageUrl,
      source: result.source,
      detail: result.detail,
    });
  } catch (err) {
    console.error("AI image error:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
