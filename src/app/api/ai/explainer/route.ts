import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateExplainerScript } from "@/lib/openai/explainer-script";
import { STANDALONE_RENDER_CAMPAIGN_ID } from "@/lib/render-jobs";
import { requireUserAiKeys } from "@/lib/server/ai-request-keys";
import { enqueueRenderJob } from "@/lib/server/render-jobs";
import { getBrandKit } from "@/lib/server/brand-kit";
import { getActiveWorkspaceId } from "@/lib/server/workspaces";
import { clampExplainerSeconds } from "@/lib/explainer-script";
import { SessionRequiredError } from "@/lib/server/session";

/** Split compose text into a title (first line) and body (the rest). */
function splitPostText(text: string): { title: string; body: string } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  const first = lines.find(Boolean) ?? "";
  const title = first.replace(/[#*_]/g, "").slice(0, 120);
  return { title, body: text.trim() };
}

/**
 * Queue an on-demand branded explainer video. Returns a job id; poll
 * GET /api/ai/explainer/[id] until status is "done" or "failed".
 */
export async function POST(request: NextRequest) {
  try {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<
      string,
      unknown
    >;
    const { userId, openaiApiKey } = await requireUserAiKeys(request, body);

    const captionContext =
      typeof body.caption_context === "string" ? body.caption_context.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const source = captionContext || prompt;
    if (!source) {
      return NextResponse.json(
        { error: "Write the post (or a topic) first: the explainer is built from it." },
        { status: 400 }
      );
    }

    const { title, body: postBody } = splitPostText(source);
    const targetSeconds =
      body.duration_seconds != null
        ? clampExplainerSeconds(body.duration_seconds)
        : (await getBrandKit(userId)).explainerSeconds;
    const { script, detail } = await generateExplainerScript({
      apiKey: openaiApiKey,
      title: title || prompt,
      body: postBody,
      aiInstruction: captionContext && prompt ? prompt : undefined,
      targetSeconds,
    });
    // Voiceover / images are paid with the keys of the workspace active now.
    const workspaceId = await getActiveWorkspaceId(userId);

    const job = await enqueueRenderJob({
      userId,
      campaignId: STANDALONE_RENDER_CAMPAIGN_ID,
      slotId: randomUUID(),
      payload: {
        template: "explainer",
        script,
        captionDigest: source.slice(0, 120),
        workspaceId,
      },
    });

    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      scenes: script.scenes.length,
      target_seconds: targetSeconds,
      detail,
    });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("POST /api/ai/explainer error:", error);
    return NextResponse.json(
      { error: "Failed to queue explainer video" },
      { status: 500 }
    );
  }
}
