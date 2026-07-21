import { promises as fs } from "fs";
import path from "path";

export type CampaignStoreData = {
  campaigns: unknown[];
};

const STORE_KEY = "latewiz:scheduled-campaigns";
const STORE_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "scheduled-campaigns.json");

function firstEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function redisConfig(): { url: string; token: string } | null {
  // Vercel Upstash integration may prefix standard KV names.
  const url = firstEnv(
    "KV_REST_API_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_KV_REST_API_URL"
  );
  const token = firstEnv(
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_TOKEN"
  );
  if (!url || !token) return null;
  return { url, token };
}

export function getScheduledCampaignStorageMode():
  | "redis"
  | "filesystem"
  | "unavailable" {
  if (redisConfig()) return "redis";
  if (process.env.VERCEL === "1") return "unavailable";
  return "filesystem";
}

export function getScheduledCampaignStorageError(): string | null {
  if (getScheduledCampaignStorageMode() !== "unavailable") return null;
  return [
    "Scheduled campaigns need durable storage on Vercel.",
    "Add Upstash Redis / Vercel KV env vars such as:",
    "UPSTASH_REDIS_REST_KV_REST_API_URL + UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
    "(or KV_REST_API_URL + KV_REST_API_TOKEN).",
  ].join(" ");
}

async function redisCommand(
  config: { url: string; token: string },
  command: (string | number)[]
): Promise<unknown> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = (await res.json().catch(() => null)) as {
    result?: unknown;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(
      data?.error || `Redis command failed with HTTP ${res.status}`
    );
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data?.result;
}

async function readRedisStore(
  config: { url: string; token: string }
): Promise<CampaignStoreData> {
  const raw = await redisCommand(config, ["GET", STORE_KEY]);
  if (typeof raw !== "string" || !raw.trim()) {
    return { campaigns: [] };
  }
  try {
    const parsed = JSON.parse(raw) as CampaignStoreData;
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    };
  } catch {
    return { campaigns: [] };
  }
}

async function writeRedisStore(
  config: { url: string; token: string },
  store: CampaignStoreData
): Promise<void> {
  await redisCommand(config, [
    "SET",
    STORE_KEY,
    JSON.stringify(store),
  ]);
}

async function readFileStore(): Promise<CampaignStoreData> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CampaignStoreData;
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    };
  } catch {
    return { campaigns: [] };
  }
}

async function writeFileStore(store: CampaignStoreData): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function readCampaignStore(): Promise<CampaignStoreData> {
  const mode = getScheduledCampaignStorageMode();
  if (mode === "unavailable") {
    throw new Error(getScheduledCampaignStorageError()!);
  }
  if (mode === "redis") {
    return readRedisStore(redisConfig()!);
  }
  return readFileStore();
}

export async function writeCampaignStore(
  store: CampaignStoreData
): Promise<void> {
  const mode = getScheduledCampaignStorageMode();
  if (mode === "unavailable") {
    throw new Error(getScheduledCampaignStorageError()!);
  }
  if (mode === "redis") {
    await writeRedisStore(redisConfig()!, store);
    return;
  }
  await writeFileStore(store);
}
