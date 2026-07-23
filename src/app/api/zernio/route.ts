import { NextRequest, NextResponse } from "next/server";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserZernioKey } from "@/lib/server/ai-request-keys";

const ZERNIO_API_BASE =
  process.env.ZERNIO_API_URL ?? "https://zernio.com/api/v1";

export async function GET(request: NextRequest) {
  return proxyZernio(request);
}

export async function POST(request: NextRequest) {
  return proxyZernio(request);
}

export async function PATCH(request: NextRequest) {
  return proxyZernio(request);
}

export async function DELETE(request: NextRequest) {
  return proxyZernio(request);
}

async function proxyZernio(request: NextRequest) {
  try {
    const { zernioApiKey: apiKey } = await requireUserZernioKey(request);

    const path = request.nextUrl.searchParams.get("path");
    if (!path || !path.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const url = `${ZERNIO_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };

    let body: string | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const raw = await request.text();
      if (raw) {
        body = raw;
        headers["Content-Type"] =
          request.headers.get("content-type") ?? "application/json";
      }
    }

    const res = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const text = await res.text();
    return new NextResponse(text || null, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("Zernio API key")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Zernio proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach Zernio API" },
      { status: 502 }
    );
  }
}
