import { NextRequest, NextResponse } from "next/server";
import {
  deleteGeneratedMediaFile,
  listGeneratedMediaFiles,
  saveGeneratedImageFile,
} from "@/lib/server/generated-media-files";

export async function GET() {
  try {
    const items = await listGeneratedMediaFiles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("List generated media error:", err);
    return NextResponse.json(
      { error: "Failed to list media" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const imageUrl =
      typeof body.image_url === "string"
        ? body.image_url
        : typeof body.imageUrl === "string"
          ? body.imageUrl
          : null;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }
    const captionDigest =
      typeof body.caption_digest === "string"
        ? body.caption_digest
        : typeof body.captionDigest === "string"
          ? body.captionDigest
          : "";

    const entry = await saveGeneratedImageFile(imageUrl, captionDigest);
    return NextResponse.json({ item: entry });
  } catch (err) {
    console.error("Save generated media error:", err);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteGeneratedMediaFile(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete generated media error:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
