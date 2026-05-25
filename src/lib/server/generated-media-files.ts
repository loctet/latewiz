import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type GeneratedMediaEntry = {
  id: string;
  filename: string;
  url: string;
  type: "image" | "video";
  captionDigest: string;
  createdAt: string;
  durationSeconds?: string;
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "generated");
const MANIFEST_PATH = path.join(UPLOAD_DIR, "manifest.json");
const MAX_ENTRIES = 100;

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function readManifest(): Promise<GeneratedMediaEntry[]> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as GeneratedMediaEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeManifest(entries: GeneratedMediaEntry[]): Promise<void> {
  await ensureUploadDir();
  await fs.writeFile(
    MANIFEST_PATH,
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

export async function saveGeneratedImageFile(
  sourceUrl: string,
  captionDigest: string
): Promise<GeneratedMediaEntry> {
  await ensureUploadDir();
  const buffer = await downloadOrDecodeImage(sourceUrl);
  const id = randomUUID();
  const filename = `${id}.png`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);

  const entry: GeneratedMediaEntry = {
    id,
    filename,
    url: `/uploads/generated/${filename}`,
    type: "image",
    captionDigest: captionDigest.slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  const manifest = await readManifest();
  await writeManifest([entry, ...manifest]);
  return entry;
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

export async function saveGeneratedVideoFile(
  sourceUrl: string,
  captionDigest: string,
  durationSeconds?: string
): Promise<GeneratedMediaEntry> {
  await ensureUploadDir();
  const buffer = await downloadOrDecodeVideo(sourceUrl);
  const id = randomUUID();
  const filename = `${id}.mp4`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);

  const entry: GeneratedMediaEntry = {
    id,
    filename,
    url: `/uploads/generated/${filename}`,
    type: "video",
    captionDigest: captionDigest.slice(0, 200),
    createdAt: new Date().toISOString(),
    durationSeconds,
  };

  const manifest = await readManifest();
  await writeManifest([entry, ...manifest]);
  return entry;
}

export async function listGeneratedMediaFiles(): Promise<GeneratedMediaEntry[]> {
  await ensureUploadDir();
  const manifest = await readManifest();
  const valid: GeneratedMediaEntry[] = [];
  for (const entry of manifest) {
    try {
      await fs.access(path.join(UPLOAD_DIR, entry.filename));
      valid.push({
        ...entry,
        type: entry.type ?? (entry.filename.endsWith(".mp4") ? "video" : "image"),
      });
    } catch {
      /* file removed */
    }
  }
  if (valid.length !== manifest.length) {
    await writeManifest(valid);
  }
  return valid;
}

export async function deleteGeneratedMediaFile(id: string): Promise<boolean> {
  const manifest = await readManifest();
  const entry = manifest.find((e) => e.id === id);
  if (!entry) return false;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, entry.filename));
  } catch {
    /* already gone */
  }
  await writeManifest(manifest.filter((e) => e.id !== id));
  return true;
}
