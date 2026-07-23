import { NextRequest, NextResponse } from "next/server";
import {
  generateCampaignOutline,
  parseNicheFromBody,
} from "@/lib/openai";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserAiKeys } from "@/lib/server/ai-request-keys";

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
    const campaignGoal =
      typeof body.campaign_goal === "string"
        ? body.campaign_goal
        : typeof body.campaignGoal === "string"
          ? body.campaignGoal
          : "";

    const totalPosts = Math.max(
      1,
      Number(body.total_posts ?? body.totalPosts) || 1
    );

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

    const result = await generateCampaignOutline(apiKey, niche, {
      campaignGoal,
      totalPosts,
      campaignHint,
      trendSnippets,
    });

    return NextResponse.json({
      beats: result.beats,
      source: result.source,
      detail: result.detail,
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Campaign outline error:", err);
    return NextResponse.json(
      { error: "Failed to generate campaign outline" },
      { status: 500 }
    );
  }
}
