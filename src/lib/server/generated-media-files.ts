import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { dbReady, isEphemeralVercelDb } from "@/db";
import { generatedMedia } from "@/db/schema";

export type GeneratedMediaEntry = {
  id: string;
  userId: string;
  filename: string;
  url: string;
  type: "image" | "video";
  captionDigest: string;
  createdAt: string;
  durationSeconds?: string;
  contentType?: string;
};

const MAX_ENTRIES = 100;

type StoredMediaRow = {
  id: string;
  userId: string;
  filename: string;
  mediaType: "image" | "video";
  contentType: string;
  captionDigest: string;
  durationSeconds: string | null;
  createdAt: Date | number | string;
};

function publicFileUrl(id: string): string {
  return `/api/media/generated/file/${encodeURIComponent(id)}`;
}

function assertDurableStorage(): void {
  if (isEphemeralVercelDb()) {
    throw new Error(
      "Generated images cannot be stored on this deployment. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel."
    );
  }
}

function extensionFor(contentType: string, kind: "image" | "video"): string {
  const subtype = contentType.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (subtype === "jpeg") return "jpg";
  if (
    subtype === "png" ||
    subtype === "webp" ||
    subtype === "gif" ||
    subtype === "mp4" ||
    subtype === "webm"
  ) {
    return subtype;
  }
  return kind === "video" ? "mp4" : "png";
}

function toIso(value: Date | number | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function asBuffer(value: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value);
}

function toEntry(row: StoredMediaRow): GeneratedMediaEntry {
  const type =
    row.mediaType === "video" || row.filename.endsWith(".mp4")
      ? "video"
      : "image";
  return {
    id: row.id,
    userId: row.userId,
    filename: row.filename,
    url: publicFileUrl(row.id),
    type,
    contentType: row.contentType,
    captionDigest: row.captionDigest,
    createdAt: toIso(row.createdAt),
    durationSeconds: row.durationSeconds ?? undefined,
  };
}

const mediaColumns = {
  id: generatedMedia.id,
  userId: generatedMedia.userId,
  filename: generatedMedia.filename,
  mediaType: generatedMedia.mediaType,
  contentType: generatedMedia.contentType,
  captionDigest: generatedMedia.captionDigest,
  durationSeconds: generatedMedia.durationSeconds,
  createdAt: generatedMedia.createdAt,
};

async function decodeMedia(
  sourceUrl: string,
  kind: "image" | "video"
): Promise<{ buffer: Buffer; contentType: string }> {
  const fallback = kind === "video" ? "video/mp4" : "image/png";
  const trimmed = sourceUrl.trim();

  if (trimmed.startsWith("data:")) {
    const match =
      /^data:([^;,]+)?(?:;charset=[^;,]+)?(?:;base64)?,([\s\S]+)$/i.exec(
        trimmed
      );
    if (!match?.[2]) throw new Error(`Invalid ${kind} data URL`);
    const contentType = match[1]?.trim() || fallback;
    const isBase64 = /;base64/i.test(trimmed.slice(0, match[0].indexOf(",")));
    const payload = match[2].replace(/\s+/g, "");
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (!buffer.length) throw new Error(`Empty ${kind} data URL`);
    return { buffer, contentType };
  }

  const ownedId = generatedMediaIdFromUrl(trimmed);
  if (ownedId) {
    throw new Error(
      "Pass image bytes or a remote URL. App media links are already stored."
    );
  }

  const res = await fetch(trimmed);
  if (!res.ok) throw new Error(`Failed to download ${kind}`);
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const contentType =
    headerType && headerType !== "application/octet-stream"
      ? headerType
      : fallback;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error(`Downloaded ${kind} was empty`);
  return { buffer, contentType };
}

async function trimUserMedia(userId: string): Promise<void> {
  const database = await dbReady();
  const rows = await database
    .select({ id: generatedMedia.id })
    .from(generatedMedia)
    .where(eq(generatedMedia.userId, userId))
    .orderBy(desc(generatedMedia.createdAt));
  const extra = rows.slice(MAX_ENTRIES).map((row) => row.id);
  if (extra.length === 0) return;
  await database
    .delete(generatedMedia)
    .where(inArray(generatedMedia.id, extra));
}

async function insertMedia(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  kind: "image" | "video";
  captionDigest: string;
  durationSeconds?: string;
}): Promise<GeneratedMediaEntry> {
  assertDurableStorage();
  const database = await dbReady();
  const id = randomUUID();
  const filename = `${id}.${extensionFor(params.contentType, params.kind)}`;
  const createdAt = new Date();
  await database.insert(generatedMedia).values({
    id,
    userId: params.userId,
    filename,
    mediaType: params.kind,
    contentType: params.contentType,
    captionDigest: params.captionDigest.slice(0, 200),
    durationSeconds: params.durationSeconds,
    bytes: params.buffer,
    createdAt,
  });
  await trimUserMedia(params.userId);
  return toEntry({
    id,
    userId: params.userId,
    filename,
    mediaType: params.kind,
    contentType: params.contentType,
    captionDigest: params.captionDigest.slice(0, 200),
    durationSeconds: params.durationSeconds ?? null,
    createdAt,
  });
}

export function generatedMediaIdFromUrl(sourceUrl: string): string | null {
  const match = sourceUrl.match(
    /\/api\/media\/generated\/file\/([^/?#]+)/i
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function saveGeneratedImageFile(
  userId: string,
  sourceUrl: string,
  captionDigest: string
): Promise<GeneratedMediaEntry> {
  const decoded = await decodeMedia(sourceUrl, "image");
  return insertMedia({
    userId,
    buffer: decoded.buffer,
    contentType: decoded.contentType.startsWith("image/")
      ? decoded.contentType
      : "image/png",
    kind: "image",
    captionDigest,
  });
}

export async function saveGeneratedVideoFile(
  userId: string,
  sourceUrl: string,
  captionDigest: string,
  durationSeconds?: string
): Promise<GeneratedMediaEntry> {
  const decoded = await decodeMedia(sourceUrl, "video");
  return insertMedia({
    userId,
    buffer: decoded.buffer,
    contentType: decoded.contentType.startsWith("video/")
      ? decoded.contentType
      : "video/mp4",
    kind: "video",
    captionDigest,
    durationSeconds,
  });
}

export async function listGeneratedMediaFiles(
  userId: string
): Promise<GeneratedMediaEntry[]> {
  const database = await dbReady();
  const rows = await database
    .select(mediaColumns)
    .from(generatedMedia)
    .where(eq(generatedMedia.userId, userId))
    .orderBy(desc(generatedMedia.createdAt));
  return rows.map((row) => toEntry(row));
}

export async function getGeneratedMediaFile(
  userId: string,
  id: string
): Promise<{ entry: GeneratedMediaEntry; bytes: Buffer; contentType: string } | null> {
  const database = await dbReady();
  const rows = await database
    .select()
    .from(generatedMedia)
    .where(and(eq(generatedMedia.userId, userId), eq(generatedMedia.id, id)))
    .limit(1);
  const row = rows[0];
  if (!row?.bytes) return null;
  const bytes = asBuffer(row.bytes as Buffer | Uint8Array);
  if (!bytes.length) return null;
  return {
    entry: toEntry(row),
    bytes,
    contentType: row.contentType,
  };
}

export async function deleteGeneratedMediaFile(
  userId: string,
  id: string
): Promise<boolean> {
  const database = await dbReady();
  const existing = await database
    .select({ id: generatedMedia.id })
    .from(generatedMedia)
    .where(and(eq(generatedMedia.userId, userId), eq(generatedMedia.id, id)))
    .limit(1);
  if (!existing[0]) return false;
  await database
    .delete(generatedMedia)
    .where(and(eq(generatedMedia.userId, userId), eq(generatedMedia.id, id)));
  return true;
}

/** Turn an app media URL back into bytes so image edits can use it as a reference. */
export async function materializeGeneratedMediaUrl(
  userId: string,
  sourceUrl: string
): Promise<string> {
  const id = generatedMediaIdFromUrl(sourceUrl);
  if (!id) return sourceUrl;
  const found = await getGeneratedMediaFile(userId, id);
  if (!found) return sourceUrl;
  const mime = found.contentType || "image/png";
  return `data:${mime};base64,${found.bytes.toString("base64")}`;
}
