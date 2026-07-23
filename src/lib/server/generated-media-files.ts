import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type GeneratedMediaEntry = {
  id: string;
  userId: string;
  filename: string;
  url: string;
  type: "image" | "video";
  captionDigest: string;
  createdAt: string;
  durationSeconds?: string;
};

const MAX_ENTRIES = 100;

function resolveMediaRoot(): string {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "latewiz-generated-media");
  }
  return path.join(process.cwd(), "data", "generated-media");
}

function safeUserSegment(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  if (!safe) throw new Error("Invalid user id");
  return safe;
}

function userDir(userId: string): string {
  return path.join(resolveMediaRoot(), safeUserSegment(userId));
}

function manifestPath(userId: string): string {
  return path.join(userDir(userId), "manifest.json");
}

function publicFileUrl(id: string): string {
  return `/api/media/generated/file/${encodeURIComponent(id)}`;
}

async function ensureUserDir(userId: string): Promise<string> {
  const dir = userDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readManifest(userId: string): Promise<GeneratedMediaEntry[]> {
  try {
    const raw = await fs.readFile(manifestPath(userId), "utf8");
    const parsed = JSON.parse(raw) as GeneratedMediaEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.id === "string" && e.userId === userId
    );
  } catch {
    return [];
  }
}

async function writeManifest(
  userId: string,
  entries: GeneratedMediaEntry[]
): Promise<void> {
  await ensureUserDir(userId);
  await fs.writeFile(
    manifestPath(userId),
    JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2),
    "utf8"
  );
}

async function downloadOrDecodeImage(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL");
    return Buffer.from(match[1], "base64");
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Failed to download image");
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function downloadOrDecodeVideo(sourceUrl: string): Promise<Buffer> {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:video\/\w+;base64,(.+)$/);
    if (!match) throw new Error("Invalid video data URL");
    return Buffer.from(match[1], "base64");
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Failed to download video");
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function saveGeneratedImageFile(
  userId: string,
  sourceUrl: string,
  captionDigest: string
): Promise<GeneratedMediaEntry> {
  const dir = await ensureUserDir(userId);
  const buffer = await downloadOrDecodeImage(sourceUrl);
  const id = randomUUID();
  const filename = `${id}.png`;
  await fs.writeFile(path.join(dir, filename), buffer);

  const entry: GeneratedMediaEntry = {
    id,
    userId,
    filename,
    url: publicFileUrl(id),
    type: "image",
    captionDigest: captionDigest.slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  const manifest = await readManifest(userId);
  await writeManifest(userId, [entry, ...manifest]);
  return entry;
}

export async function saveGeneratedVideoFile(
  userId: string,
  sourceUrl: string,
  captionDigest: string,
  durationSeconds?: string
): Promise<GeneratedMediaEntry> {
  const dir = await ensureUserDir(userId);
  const buffer = await downloadOrDecodeVideo(sourceUrl);
  const id = randomUUID();
  const filename = `${id}.mp4`;
  await fs.writeFile(path.join(dir, filename), buffer);

  const entry: GeneratedMediaEntry = {
    id,
    userId,
    filename,
    url: publicFileUrl(id),
    type: "video",
    captionDigest: captionDigest.slice(0, 200),
    createdAt: new Date().toISOString(),
    durationSeconds,
  };

  const manifest = await readManifest(userId);
  await writeManifest(userId, [entry, ...manifest]);
  return entry;
}

export async function listGeneratedMediaFiles(
  userId: string
): Promise<GeneratedMediaEntry[]> {
  await ensureUserDir(userId);
  const manifest = await readManifest(userId);
  const dir = userDir(userId);
  const valid: GeneratedMediaEntry[] = [];
  for (const entry of manifest) {
    try {
      await fs.access(path.join(dir, entry.filename));
      valid.push({
        ...entry,
        userId,
        url: publicFileUrl(entry.id),
        type: entry.type ?? (entry.filename.endsWith(".mp4") ? "video" : "image"),
      });
    } catch {
      /* file removed */
    }
  }
  if (valid.length !== manifest.length) {
    await writeManifest(userId, valid);
  }
  return valid;
}

export async function getGeneratedMediaFile(
  userId: string,
  id: string
): Promise<{ entry: GeneratedMediaEntry; absolutePath: string } | null> {
  const manifest = await readManifest(userId);
  const entry = manifest.find((e) => e.id === id);
  if (!entry) return null;
  const absolutePath = path.join(userDir(userId), entry.filename);
  try {
    await fs.access(absolutePath);
  } catch {
    return null;
  }
  return {
    entry: {
      ...entry,
      userId,
      url: publicFileUrl(entry.id),
      type: entry.type ?? (entry.filename.endsWith(".mp4") ? "video" : "image"),
    },
    absolutePath,
  };
}

export async function deleteGeneratedMediaFile(
  userId: string,
  id: string
): Promise<boolean> {
  const manifest = await readManifest(userId);
  const entry = manifest.find((e) => e.id === id);
  if (!entry) return false;
  try {
    await fs.unlink(path.join(userDir(userId), entry.filename));
  } catch {
    /* already gone */
  }
  await writeManifest(
    userId,
    manifest.filter((e) => e.id !== id)
  );
  return true;
}
