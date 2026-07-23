import {
  allowEnvKeyFallback,
  getUserSecret,
} from "@/lib/server/vault";

export function isPlausibleFalApiKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length >= 20 && /^[a-zA-Z0-9:_-]+$/.test(trimmed);
}

export function resolveFalApiKey(
  headerKey?: string | null,
  bodyKey?: string | null
): string | null {
  const candidates = [headerKey, bodyKey];
  if (allowEnvKeyFallback()) {
    candidates.push(process.env.FAL_KEY, process.env.FAL_API_KEY);
  }
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed && isPlausibleFalApiKey(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export async function resolveUserFalKey(
  userId: string,
  headerKey?: string | null,
  bodyKey?: string | null
): Promise<string | null> {
  const fromRequest = resolveFalApiKey(headerKey, bodyKey);
  if (fromRequest) return fromRequest;
  const fromVault = await getUserSecret(userId, "fal");
  if (fromVault && isPlausibleFalApiKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env =
      process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
    if (env && isPlausibleFalApiKey(env)) return env;
  }
  return null;
}
