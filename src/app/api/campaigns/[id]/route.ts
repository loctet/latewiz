import { NextRequest, NextResponse } from "next/server";
import {
  deleteScheduledCampaign,
  getScheduledCampaign,
  saveScheduledCampaign,
} from "@/lib/server/scheduled-campaign-store";
import type { ScheduledCampaignInput } from "@/lib/scheduled-campaigns";
import { storageErrorMessage } from "@/lib/server/api-error";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const campaign = await getScheduledCampaign(id, userId);
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Get scheduled campaign error:", error);
    return NextResponse.json(
      {
        error: storageErrorMessage(
          error,
          "Failed to fetch scheduled campaign"
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const body = (await request.json()) as ScheduledCampaignInput;
    const existing = await getScheduledCampaign(id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const campaign = await saveScheduledCampaign({ ...body, id, userId });
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Update scheduled campaign error:", error);
    return NextResponse.json(
      {
        error: storageErrorMessage(
          error,
          "Failed to update scheduled campaign"
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const ok = await deleteScheduledCampaign(id, userId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Delete scheduled campaign error:", error);
    return NextResponse.json(
      {
        error: storageErrorMessage(
          error,
          "Failed to delete scheduled campaign"
        ),
      },
      { status: 500 }
    );
  }
}
