import { NextRequest, NextResponse } from "next/server";
import {
  BRAND_LOGO_MAX_BYTES,
  isBrandLogoContentType,
} from "@/lib/brand-kit";
import { getBrandLogo, setBrandLogo } from "@/lib/server/brand-kit";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof SessionRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const logo = await getBrandLogo(userId);
    if (!logo) {
      return NextResponse.json({ error: "No logo" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(logo.bytes), {
      status: 200,
      headers: {
        "Content-Type": logo.contentType,
        "Content-Length": String(logo.bytes.length),
        "Cache-Control": "private, max-age=300",
        // SVG logos are user content: never let them run script in our origin.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to load logo");
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a file in the \"file\" field" },
        { status: 400 }
      );
    }
    if (!isBrandLogoContentType(file.type)) {
      return NextResponse.json(
        { error: "Logo must be PNG, JPEG, WebP or SVG" },
        { status: 400 }
      );
    }
    if (file.size > BRAND_LOGO_MAX_BYTES) {
      return NextResponse.json(
        { error: `Logo must be ${BRAND_LOGO_MAX_BYTES / 1024} KB or smaller` },
        { status: 400 }
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(
      await setBrandLogo(userId, { bytes, contentType: file.type })
    );
  } catch (error) {
    return errorResponse(error, "Failed to save logo");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    return NextResponse.json(await setBrandLogo(userId, null));
  } catch (error) {
    return errorResponse(error, "Failed to remove logo");
  }
}
