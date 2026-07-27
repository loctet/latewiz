import { NextRequest, NextResponse } from "next/server";
import {
  generateDraft,
  parseNicheFromBody,
} from "@/lib/openai";
import { normalizeCustomPostPromptStyles } from "@/lib/post-prompt-catalog";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserAiKeys } from "@/lib/server/ai-request-keys";

/** Deep research can take several minutes (background + poll). */
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { openaiApiKey } = await requireUserAiKeys(request, body);
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key required. Add yours in Settings — AI runs on your account.",
        },
        { status: 400 }
      );
    }
    const niche = parseNicheFromBody(body);
    const hint = typeof body.hint === "string" ? body.hint : undefined;
    const postPromptStyleId =
      typeof body.post_prompt_style_id === "string"
        ? body.post_prompt_style_id
        : typeof body.postPromptStyleId === "string"
          ? body.postPromptStyleId
          : undefined;

    const researchDepthId =
      typeof body.research_depth_id === "string"
        ? body.research_depth_id
        : typeof body.researchDepthId === "string"
          ? body.researchDepthId
          : undefined;

    const customPostPromptStyles = normalizeCustomPostPromptStyles(
      body.custom_post_prompt_styles ?? body.customPostPromptStyles
    );

    const draft = await generateDraft(
      openaiApiKey,
      niche,
      hint,
      postPromptStyleId,
      typeof body.post_prompt_templates === "object" &&
        body.post_prompt_templates &&
        !Array.isArray(body.post_prompt_templates)
        ? (body.post_prompt_templates as Record<string, string>)
        : typeof body.postPromptTemplates === "object" &&
            body.postPromptTemplates &&
            !Array.isArray(body.postPromptTemplates)
          ? (body.postPromptTemplates as Record<string, string>)
          : undefined,
      researchDepthId,
      customPostPromptStyles
    );
    return NextResponse.json({
      draft,
      source: draft.source,
      detail: draft.detail,
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("AI draft error:", err);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
