import { NextRequest, NextResponse } from "next/server";
import type { BrandKit } from "@/lib/brand-kit";
import { getBrandKit, saveBrandKit } from "@/lib/server/brand-kit";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    return NextResponse.json(await getBrandKit(userId));
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("GET /api/me/brand-kit error:", error);
    return NextResponse.json(
      { error: "Failed to load brand kit" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json().catch(() => null)) as
      | Partial<BrandKit>
      | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    return NextResponse.json(await saveBrandKit(userId, body));
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("PUT /api/me/brand-kit error:", error);
    return NextResponse.json(
      { error: "Failed to save brand kit" },
      { status: 500 }
    );
  }
}
