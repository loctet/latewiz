import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledCampaigns } from "@/lib/server/scheduled-campaign-runner";

export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return true;
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return auth === expected;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueScheduledCampaigns();
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Run scheduled campaign cron error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process scheduled campaigns",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
