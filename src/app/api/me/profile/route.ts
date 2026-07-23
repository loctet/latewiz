import { NextRequest, NextResponse } from "next/server";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";
import {
  getUserProfile,
  upsertUserProfile,
} from "@/lib/server/user-profile";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const profile = await getUserProfile(userId);
    return NextResponse.json({
      niche: profile?.niche ?? defaultNicheProfile(),
      onboardingCompleted: profile?.onboardingCompleted ?? false,
    });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json()) as {
      niche?: Partial<NicheProfile>;
      onboardingCompleted?: boolean;
    };

    const existing = await getUserProfile(userId);
    const niche: NicheProfile = {
      ...defaultNicheProfile(),
      ...(existing?.niche ?? {}),
      ...(body.niche ?? {}),
    };

    const profile = await upsertUserProfile(userId, {
      niche,
      onboardingCompleted: body.onboardingCompleted,
    });

    return NextResponse.json({
      niche: profile.niche,
      onboardingCompleted: profile.onboardingCompleted,
    });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("PUT /api/me/profile error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
