import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getGeneratedMediaFile } from "@/lib/server/generated-media-files";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const found = await getGeneratedMediaFile(userId, id);
    if (!found) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await fs.readFile(found.absolutePath);
    const ext = path.extname(found.entry.filename).toLowerCase();
    const contentType =
      found.entry.type === "video" || ext === ".mp4"
        ? "video/mp4"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${found.entry.filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Serve generated media error:", err);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}
