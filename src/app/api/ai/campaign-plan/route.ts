import { NextRequest, NextResponse } from "next/server";
import {
  buildCampaignSlotTimes,
  generateCampaignBatch,
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

    const postsPerDay = Math.max(
      1,
      Math.min(12, Number(body.posts_per_day ?? body.postsPerDay) || 3)
    );
    const planDays = Math.max(
      1,
      Math.min(31, Number(body.plan_days ?? body.planDays) || 7)
    );
    const startDate =
      typeof body.start_date === "string"
        ? body.start_date
        : typeof body.startDate === "string"
          ? body.startDate
          : new Date().toISOString().slice(0, 10);
    const timezone =
      typeof body.timezone === "string" ? body.timezone : "UTC";
    const windowStart =
      typeof body.window_start === "string"
        ? body.window_start
        : typeof body.windowStart === "string"
          ? body.windowStart
          : "09:00";
    const windowEnd =
      typeof body.window_end === "string"
        ? body.window_end
        : typeof body.windowEnd === "string"
          ? body.windowEnd
          : "18:00";

    const niche = parseNicheFromBody(body);
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
        ? trendRaw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const totalPosts = postsPerDay * planDays;
    const slotTimes = buildCampaignSlotTimes(
      startDate,
      planDays,
      postsPerDay,
      windowStart,
      windowEnd,
      timezone
    );

    const batch = await generateCampaignBatch(
      apiKey,
      niche,
      totalPosts,
      campaignHint,
      trendSnippets
    );

    const slots = slotTimes.map((scheduled_at, i) => {
      const post = batch.posts[i] ?? {
        title: `Post ${i + 1}`,
        body: "",
        hashtags: "",
      };
      const content = [post.body, post.hashtags].filter(Boolean).join("\n\n");
      return {
        scheduled_at,
        title: post.title,
        body: post.body,
        hashtags: post.hashtags,
        content,
      };
    });

    return NextResponse.json({
      slots,
      source: batch.source,
      detail: batch.detail,
      total_posts: totalPosts,
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Campaign plan error:", err);
    return NextResponse.json(
      { error: "Failed to plan campaign" },
      { status: 500 }
    );
  }
}
