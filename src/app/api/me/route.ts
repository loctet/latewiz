import { NextRequest, NextResponse } from "next/server";
import {
  SessionRequiredError,
  getSessionFromRequest,
} from "@/lib/server/session";
import { getVaultStatus, getUserSecret } from "@/lib/server/vault";
import {
  getUserProfile,
  isNicheConfigured,
} from "@/lib/server/user-profile";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const [vault, profile] = await Promise.all([
      getVaultStatus(session.user.id),
      getUserProfile(session.user.id),
    ]);

    const nicheConfigured = profile ? isNicheConfigured(profile.niche) : false;
    const onboardingComplete =
      Boolean(profile?.onboardingCompleted) &&
      vault.hasZernio &&
      nicheConfigured;

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
      vault,
      niche: profile?.niche ?? null,
      contentPrefs: profile?.contentPrefs ?? null,
      onboardingCompleted: onboardingComplete,
      needsOnboarding: !onboardingComplete,
    });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("GET /api/me error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

/** Unlock Zernio key into the browser for Late SDK (session-authenticated only). */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      kinds?: string[];
    };
    const kinds = Array.isArray(body.kinds) ? body.kinds : ["zernio"];
    const secrets: Record<string, string | null> = {};

    for (const kind of kinds) {
      if (kind === "zernio" || kind === "openai" || kind === "fal") {
        // Only zernio is returned to the client for Late SDK. AI keys stay server-side.
        if (kind !== "zernio") {
          secrets[kind] = null;
          continue;
        }
        secrets[kind] = await getUserSecret(session.user.id, kind);
      }
    }

    return NextResponse.json({ secrets });
  } catch (error) {
    console.error("POST /api/me unlock error:", error);
    return NextResponse.json({ error: "Failed to unlock secrets" }, { status: 500 });
  }
}
