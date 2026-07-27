import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import { toAbsoluteAppUrl } from "@/lib/server/app-url";

export type GeneratedReportEntry = {
  id: string;
  userId: string;
  publicToken: string;
  filename: string;
  title: string;
  createdAt: string;
  /** Relative public path */
  url: string;
};

const MAX_ENTRIES = 80;
const TOKEN_INDEX = "token-index.json";

function resolveReportsRoot(): string {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "latewiz-generated-reports");
  }
  return path.join(process.cwd(), "data", "generated-reports");
}

function safeUserSegment(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  if (!safe) throw new Error("Invalid user id");
  return safe;
}

function userDir(userId: string): string {
  return path.join(resolveReportsRoot(), safeUserSegment(userId));
}

function manifestPath(userId: string): string {
  return path.join(userDir(userId), "manifest.json");
}

function tokenIndexPath(): string {
  return path.join(resolveReportsRoot(), TOKEN_INDEX);
}

function publicReportPath(token: string): string {
  return `/api/reports/public/${encodeURIComponent(token)}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readManifest(userId: string): Promise<GeneratedReportEntry[]> {
  try {
    const raw = await fs.readFile(manifestPath(userId), "utf8");
    const parsed = JSON.parse(raw) as GeneratedReportEntry[];
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
  entries: GeneratedReportEntry[]
): Promise<void> {
  await ensureDir(userDir(userId));
  await fs.writeFile(
    manifestPath(userId),
    JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2),
    "utf8"
  );
}

type TokenIndex = Record<string, { userId: string; id: string }>;

async function readTokenIndex(): Promise<TokenIndex> {
  try {
    const raw = await fs.readFile(tokenIndexPath(), "utf8");
    const parsed = JSON.parse(raw) as TokenIndex;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTokenIndex(index: TokenIndex): Promise<void> {
  await ensureDir(resolveReportsRoot());
  await fs.writeFile(tokenIndexPath(), JSON.stringify(index, null, 2), "utf8");
}

function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function saveGeneratedReportPdf(params: {
  userId: string;
  pdfBuffer: Buffer;
  title: string;
}): Promise<{ entry: GeneratedReportEntry; absoluteUrl: string }> {
  const { userId, pdfBuffer, title } = params;
  const dir = userDir(userId);
  await ensureDir(dir);

  const id = randomUUID();
  const publicToken = newPublicToken();
  const filename = `${id}.pdf`;
  await fs.writeFile(path.join(dir, filename), pdfBuffer);

  const entry: GeneratedReportEntry = {
    id,
    userId,
    publicToken,
    filename,
    title: title.slice(0, 200) || "Research report",
    createdAt: new Date().toISOString(),
    url: publicReportPath(publicToken),
  };

  const manifest = await readManifest(userId);
  const pruned = manifest.slice(0, MAX_ENTRIES - 1);
  // Drop token index entries for pruned reports
  const index = await readTokenIndex();
  for (const old of manifest.slice(MAX_ENTRIES - 1)) {
    delete index[old.publicToken];
  }
  index[publicToken] = { userId, id };
  await writeTokenIndex(index);
  await writeManifest(userId, [entry, ...pruned]);

  return {
    entry,
    absoluteUrl: toAbsoluteAppUrl(entry.url),
  };
}

export async function getGeneratedReportByPublicToken(
  token: string
): Promise<{ entry: GeneratedReportEntry; absolutePath: string } | null> {
  const safe = token?.trim();
  if (!safe) return null;
  const index = await readTokenIndex();
  const ref = index[safe];
  if (!ref?.userId || !ref.id) return null;

  const manifest = await readManifest(ref.userId);
  const entry = manifest.find((e) => e.id === ref.id && e.publicToken === safe);
  if (!entry) return null;

  const absolutePath = path.join(userDir(ref.userId), entry.filename);
  try {
    await fs.access(absolutePath);
  } catch {
    return null;
  }

  return {
    entry: {
      ...entry,
      url: publicReportPath(entry.publicToken),
    },
    absolutePath,
  };
}

export async function listGeneratedReports(
  userId: string
): Promise<GeneratedReportEntry[]> {
  const manifest = await readManifest(userId);
  const dir = userDir(userId);
  const valid: GeneratedReportEntry[] = [];
  for (const entry of manifest) {
    try {
      await fs.access(path.join(dir, entry.filename));
      valid.push({
        ...entry,
        url: publicReportPath(entry.publicToken),
      });
    } catch {
      /* missing file */
    }
  }
  if (valid.length !== manifest.length) {
    await writeManifest(userId, valid);
  }
  return valid;
}
