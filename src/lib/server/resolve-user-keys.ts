import "server-only";

import { allowEnvKeyFallback } from "@/lib/env-flags";
import { getUserSecret } from "@/lib/server/vault";
import {
  isPlausibleOpenAiApiKey,
  resolveOpenAiApiKey,
} from "@/lib/openai/resolve-key";
import {
  isPlausibleFalApiKey,
  resolveFalApiKey,
} from "@/lib/fal/resolve-key";

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

export async function resolveUserOpenAiKey(
  userId: string,
  headerKey?: string | null,
  bodyKey?: string | null
): Promise<string | null> {
  const fromRequest = resolveOpenAiApiKey(headerKey, bodyKey);
  if (fromRequest) return fromRequest;
  const fromVault = await getUserSecret(userId, "openai");
  if (fromVault && isPlausibleOpenAiApiKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env = process.env.OPENAI_API_KEY?.trim();
    if (env && isPlausibleOpenAiApiKey(env)) return env;
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
