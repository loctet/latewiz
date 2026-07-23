import {
  allowEnvKeyFallback,
  getUserSecret,
} from "@/lib/server/vault";

export function isPlausibleZernioKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.startsWith("sk_") && trimmed.length >= 16;
}

export async function resolveUserZernioKey(
  userId: string,
  headerKey?: string | null
): Promise<string | null> {
  if (headerKey && isPlausibleZernioKey(headerKey)) {
    return headerKey.trim();
  }
  const fromVault = await getUserSecret(userId, "zernio");
  if (fromVault && isPlausibleZernioKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env = process.env.LATE_API_KEY?.trim();
    if (env && isPlausibleZernioKey(env)) return env;
  }
  return null;
}
