import { NextRequest, NextResponse } from "next/server";
import {
  generateCampaignSlot,
  parseNicheFromBody,
  resolveOpenAiApiKey,
  type CampaignSlotBrief,
  type PreviousCampaignPost,
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
    const campaignGoal =
      typeof body.campaign_goal === "string"
        ? body.campaign_goal
        : typeof body.campaignGoal === "string"
          ? body.campaignGoal
          : "";

    const slotIndex = Math.max(
      0,
      Number(body.slot_index ?? body.slotIndex) || 0
    );
    const totalPosts = Math.max(
      1,
      Number(body.total_posts ?? body.totalPosts) || 1
    );
    const scheduledAt =
      typeof body.scheduled_at === "string"
        ? body.scheduled_at
        : typeof body.scheduledAt === "string"
          ? body.scheduledAt
          : new Date().toISOString();

    const campaignHint =
      typeof body.campaign_hint === "string"
        ? body.campaign_hint
        : typeof body.campaignHint === "string"
          ? body.campaignHint
          : undefined;

    const trendRaw = body.trend_snippets ?? body.trendSnippets;
    const trendSnippets = Array.isArray(trendRaw)
      ? trendRaw.map((s) => String(s))
      : typeof trendRaw === "string"
        ? trendRaw.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];

    const prevRaw = body.previous_posts ?? body.previousPosts;
    const previousPosts: PreviousCampaignPost[] = Array.isArray(prevRaw)
      ? prevRaw.map((p) => {
          const row = p as Record<string, string>;
          return {
            title: String(row.title ?? ""),
            body: String(row.body ?? ""),
            hashtags: String(row.hashtags ?? ""),
          };
        })
      : [];

    const briefRaw = body.slot_brief ?? body.slotBrief;
    const slotBrief =
      briefRaw && typeof briefRaw === "object"
        ? (briefRaw as {
            slotIndex?: number;
            phase?: string;
            beat?: string;
            subtopic?: string;
            angle?: string;
            keyPoint?: string;
            searchHint?: string;
          })
        : undefined;

    const coveredRaw = body.covered_subtopics ?? body.coveredSubtopics;
    const coveredSubtopics = Array.isArray(coveredRaw)
      ? coveredRaw.map((s) => String(s))
      : [];

    const result = await generateCampaignSlot(apiKey, niche, {
      campaignGoal,
      slotIndex,
      totalPosts,
      scheduledAt,
      previousPosts,
      campaignHint,
      trendSnippets,
      slotBrief:
        slotBrief?.subtopic?.trim()
          ? {
              slotIndex: slotIndex,
              phase:
                (slotBrief.phase as CampaignSlotBrief["phase"]) ?? "build",
              beat: String(slotBrief.beat ?? ""),
              subtopic: String(slotBrief.subtopic ?? ""),
              angle: String(slotBrief.angle ?? ""),
              keyPoint: String(slotBrief.keyPoint ?? ""),
              searchHint: String(slotBrief.searchHint ?? ""),
            }
          : undefined,
      coveredSubtopics,
    });

    const content = [result.post.body, result.post.hashtags]
      .filter(Boolean)
      .join("\n\n");

    return NextResponse.json({
      post: { ...result.post, content },
      source: result.source,
      detail: result.detail,
    });
  } catch (err) {
    console.error("Campaign slot error:", err);
    return NextResponse.json(
      { error: "Failed to generate campaign slot" },
      { status: 500 }
    );
  }
}
