import { NextRequest, NextResponse } from "next/server";
import {
  deleteGeneratedMediaFile,
  listGeneratedMediaFiles,
  saveGeneratedImageFile,
  saveGeneratedVideoFile,
} from "@/lib/server/generated-media-files";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const items = await listGeneratedMediaFiles(userId);
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        url: item.url,
        type: item.type ?? "image",
        captionDigest: item.captionDigest,
        createdAt: item.createdAt,
        filename: item.filename,
        durationSeconds: item.durationSeconds,
      })),
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("List generated media error:", err);
    return NextResponse.json(
      { error: "Failed to list media" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json()) as Record<string, unknown>;
    const videoUrl =
      typeof body.video_url === "string"
        ? body.video_url
        : typeof body.videoUrl === "string"
          ? body.videoUrl
          : null;
    const imageUrl =
      typeof body.image_url === "string"
        ? body.image_url
        : typeof body.imageUrl === "string"
          ? body.imageUrl
          : null;

    const captionDigest =
      typeof body.caption_digest === "string"
        ? body.caption_digest
        : typeof body.captionDigest === "string"
          ? body.captionDigest
          : "";
    const durationSeconds =
      typeof body.duration_seconds === "string"
        ? body.duration_seconds
        : typeof body.durationSeconds === "string"
          ? body.durationSeconds
          : undefined;

    if (videoUrl) {
      const entry = await saveGeneratedVideoFile(
        userId,
        videoUrl,
        captionDigest,
        durationSeconds
      );
      return NextResponse.json({ item: entry });
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "image_url or video_url is required" },
        { status: 400 }
      );
    }

    const entry = await saveGeneratedImageFile(userId, imageUrl, captionDigest);
    return NextResponse.json({ item: entry });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Save generated media error:", err);
    return NextResponse.json(
      { error: "Failed to save media" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteGeneratedMediaFile(userId, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Delete generated media error:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
