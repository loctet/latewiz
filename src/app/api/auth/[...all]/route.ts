import { auth } from "@/lib/auth";
import { ensureDbReady, isEphemeralVercelDb } from "@/db";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handlers = toNextJsHandler(auth);

async function withDb(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>
) {
  if (isEphemeralVercelDb()) {
    // Still allow the request, but surface a clear error for mutations that need persistence.
    const url = new URL(request.url);
    const isWrite =
      request.method !== "GET" &&
      !url.pathname.includes("/get-session") &&
      !url.pathname.endsWith("/ok");
    if (isWrite) {
      console.error(
        "[latewiz] Auth write on ephemeral Vercel DB — configure Turso (TURSO_DATABASE_URL)."
      );
    }
  }

  await ensureDbReady();
  return handler(request);
}

export async function GET(request: NextRequest) {
  return withDb(request, (req) => handlers.GET(req));
}

export async function POST(request: NextRequest) {
  return withDb(request, async (req) => {
    if (isEphemeralVercelDb()) {
      const path = req.nextUrl.pathname;
      if (
        path.includes("/sign-up") ||
        path.includes("/sign-in") ||
        path.includes("/request-password-reset") ||
        path.includes("/forget-password") ||
        path.includes("/reset-password")
      ) {
        return NextResponse.json(
          {
            message:
              "This deployment has no persistent database. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel, then redeploy. Local SQLite on /tmp cannot keep accounts between requests.",
          },
          { status: 503 }
        );
      }
    }
    return handlers.POST(req);
  });
}
