import { NextRequest, NextResponse } from "next/server";
import {
  listScheduledCampaigns,
  saveScheduledCampaign,
} from "@/lib/server/scheduled-campaign-store";
import type { ScheduledCampaignInput } from "@/lib/scheduled-campaigns";

export async function GET() {
  try {
    const campaigns = await listScheduledCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("List scheduled campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to list scheduled campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScheduledCampaignInput;
    const campaign = await saveScheduledCampaign(body);
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Save scheduled campaign error:", error);
    return NextResponse.json(
      { error: "Failed to save scheduled campaign" },
      { status: 500 }
    );
  }
}
