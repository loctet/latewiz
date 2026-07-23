import { NextRequest, NextResponse } from "next/server";
import { generatePostImage, parseNicheFromBody } from "@/lib/openai";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserAiKeys } from "@/lib/server/ai-request-keys";

function parseReferenceImageUrls(
  body: Record<string, unknown>
): string[] | undefined {
  const urls: string[] = [];
  const single =
    typeof body.reference_image_url === "string"
      ? body.reference_image_url
      : typeof body.referenceImageUrl === "string"
        ? body.referenceImageUrl
        : null;
  if (single?.trim()) urls.push(single.trim());

  const multi = body.reference_image_urls ?? body.referenceImageUrls;
  if (Array.isArray(multi)) {
    for (const item of multi) {
      if (typeof item === "string" && item.trim()) urls.push(item.trim());
    }
  }
  return urls.length > 0 ? urls : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { openaiApiKey: apiKey } = await requireUserAiKeys(request, body);
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key required. Add yours in Settings — AI runs on your account.",
        },
        { status: 400 }
      );
    }
    const niche = parseNicheFromBody(body);
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
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

    const referenceImageUrls = parseReferenceImageUrls(body);

    const result = await generatePostImage(
      apiKey,
      niche,
      prompt,
      captionContext,
      promptStyleId,
      templateOverrides,
      referenceImageUrls
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
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("AI image error:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
