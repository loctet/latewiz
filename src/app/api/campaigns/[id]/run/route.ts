import { NextRequest, NextResponse } from "next/server";
import { runScheduledCampaign } from "@/lib/server/scheduled-campaign-runner";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await runScheduledCampaign(id);
    return NextResponse.json({ result });
  } catch (error) {
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
