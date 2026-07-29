import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureDbReady } from "@/db";

/**
 * Apply a new password using the reset token from the email link.
 * Uses Better Auth's resetPassword so hashing/account updates stay consistent.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const body = (await request.json()) as {
      token?: string;
      newPassword?: string;
    };
    const token = body.token?.trim();
    const newPassword = body.newPassword ?? "";

    if (!token) {
      return NextResponse.json(
        { error: "Missing reset token. Request a new link." },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const result = await auth.api.resetPassword({
      body: {
        token,
        newPassword,
      },
    });

    if (!result?.status) {
      return NextResponse.json(
        { error: "Could not reset password. The link may be invalid or expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: true,
      message: "Password updated. You can sign in now.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reset password";
    const lower = message.toLowerCase();
    const status =
      lower.includes("token") ||
      lower.includes("expired") ||
      lower.includes("invalid")
        ? 400
        : 500;
    console.error("Password reset confirm error:", err);
    return NextResponse.json(
      {
        error: lower.includes("token")
          ? "This reset link is invalid or has expired. Request a new one."
          : message,
      },
      { status }
    );
  }
}
