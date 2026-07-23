import { NextRequest, NextResponse } from "next/server";
import {
  listScheduledCampaigns,
  saveScheduledCampaign,
} from "@/lib/server/scheduled-campaign-store";
import type { ScheduledCampaignInput } from "@/lib/scheduled-campaigns";
import { storageErrorMessage } from "@/lib/server/api-error";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const campaigns = await listScheduledCampaigns(userId);
    return NextResponse.json({ campaigns });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("List scheduled campaigns error:", error);
    return NextResponse.json(
      {
        error: storageErrorMessage(
          error,
          "Failed to list scheduled campaigns"
        ),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json()) as ScheduledCampaignInput;
    const campaign = await saveScheduledCampaign({ ...body, userId });
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Save scheduled campaign error:", error);
    return NextResponse.json(
      {
        error: storageErrorMessage(
          error,
          "Failed to save scheduled campaign"
        ),
      },
      { status: 500 }
    );
  }
}
