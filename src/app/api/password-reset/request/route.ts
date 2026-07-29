import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbReady } from "@/db";
import { user, verification } from "@/db/schema";
import { sendPasswordResetEmail } from "@/lib/server/send-password-reset-email";

function appOrigin(request: NextRequest): string {
  const fromEnv =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return fromEnv.replace(/\/$/, "");
    }
  }
  return request.nextUrl.origin;
}

/**
 * Password reset request that fails the HTTP response when email delivery fails.
 * Better Auth's built-in endpoint always returns 200 and swallows Resend errors.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      redirectTo?: string;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const redirectTo = body.redirectTo?.trim() || "/reset-password";
    const db = await dbReady();
    const [found] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    // Don't reveal whether the account exists.
    if (!found) {
      return NextResponse.json({
        status: true,
        message:
          "If this email exists in our system, check your inbox for a reset link.",
      });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const now = new Date();

    await db.insert(verification).values({
      id: randomUUID(),
      identifier: `reset-password:${token}`,
      value: found.id,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    const origin = appOrigin(request);
    const callbackURL = encodeURIComponent(redirectTo);
    const resetUrl = `${origin}/api/auth/reset-password/${token}?callbackURL=${callbackURL}`;

    const sent = await sendPasswordResetEmail({
      to: found.email,
      url: resetUrl,
      name: found.name,
    });

    if (!sent.ok) {
      // Clean up unused token so a failed send doesn't leave a dangling reset.
      await db
        .delete(verification)
        .where(eq(verification.identifier, `reset-password:${token}`));
      return NextResponse.json({ error: sent.message }, { status: 502 });
    }

    return NextResponse.json({
      status: true,
      message:
        "If this email exists in our system, check your inbox for a reset link.",
    });
  } catch (err) {
    console.error("Password reset request error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to request password reset",
      },
      { status: 500 }
    );
  }
}
