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
    const promptStyleId =
      typeof body.prompt_style === "string"
        ? body.prompt_style
        : typeof body.promptStyle === "string"
          ? body.promptStyle
          : typeof body.prompt_style_id === "string"
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

    const result = await generatePostImage(
      apiKey,
      niche,
      prompt,
      captionContext,
      promptStyleId,
      templateOverrides
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
