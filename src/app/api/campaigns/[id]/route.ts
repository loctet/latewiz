import { NextRequest, NextResponse } from "next/server";
import {
  deleteScheduledCampaign,
  getScheduledCampaign,
  saveScheduledCampaign,
} from "@/lib/server/scheduled-campaign-store";
import type { ScheduledCampaignInput } from "@/lib/scheduled-campaigns";
import { storageErrorMessage } from "@/lib/server/api-error";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaign = await getScheduledCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
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
    const { id } = await context.params;
    const body = (await request.json()) as ScheduledCampaignInput;
    const campaign = await saveScheduledCampaign({ ...body, id });
    return NextResponse.json({ campaign });
  } catch (error) {
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

export async function DELETE(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ok = await deleteScheduledCampaign(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
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
