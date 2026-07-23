import { NextRequest, NextResponse } from "next/server";
import { runScheduledCampaign } from "@/lib/server/scheduled-campaign-runner";
import { getScheduledCampaign } from "@/lib/server/scheduled-campaign-store";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const campaign = await getScheduledCampaign(id, userId);
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const result = await runScheduledCampaign(id);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Run scheduled campaign error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run scheduled campaign",
      },
      { status: 500 }
    );
  }
}
