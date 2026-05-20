import { NextRequest, NextResponse } from "next/server";
import {
  defaultNicheProfile,
  generateDraft,
  resolveOpenAiApiKey,
  type NicheProfile,
} from "@/lib/openai";

function parseNiche(body: Record<string, unknown>): NicheProfile {
  const n = (body.niche as Record<string, string>) ?? {};
  const defaults = defaultNicheProfile();
  return {
    topic: String(n.topic ?? defaults.topic),
    audience: String(n.audience ?? defaults.audience),
    geography: String(n.geography ?? defaults.geography),
    toneNotes: String(n.tone_notes ?? n.toneNotes ?? defaults.toneNotes),
    forbiddenTopics: String(
      n.forbidden_topics ?? n.forbiddenTopics ?? defaults.forbiddenTopics
    ),
    complianceNotes: String(
      n.compliance_notes ?? n.complianceNotes ?? defaults.complianceNotes
    ),
    extraInstructions: String(
      n.extra_instructions ?? n.extraInstructions ?? defaults.extraInstructions
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const headerKey = request.headers.get("x-openai-api-key");
    const apiKey = resolveOpenAiApiKey(
      headerKey,
      typeof body.openaiApiKey === "string" ? body.openaiApiKey : null
    );
    const niche = parseNiche(body);
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
