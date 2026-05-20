import { NextRequest, NextResponse } from "next/server";
import {
  generateDraft,
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
    const hint =
      typeof body.hint === "string" ? body.hint : undefined;

    const draft = await generateDraft(apiKey, niche, hint);
    return NextResponse.json({ draft, source: draft.source, detail: draft.detail });
  } catch (err) {
    console.error("AI draft error:", err);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
