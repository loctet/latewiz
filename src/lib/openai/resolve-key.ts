import {
  allowEnvKeyFallback,
  getUserSecret,
} from "@/lib/server/vault";

export function isPlausibleOpenAiApiKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed !== "" &&
    trimmed.startsWith("sk-") &&
    trimmed.length >= 24 &&
    /^sk-[a-zA-Z0-9_-]+$/.test(trimmed)
  );
}

/**
 * Resolve OpenAI key for a request.
 * Multi-user: prefer vault (via resolveUserOpenAiKey). Env fallback only when
 * ALLOW_ENV_KEY_FALLBACK=true (solo local dev).
 */
export function resolveOpenAiApiKey(
  headerKey?: string | null,
  bodyKey?: string | null
): string | null {
  const candidates = [headerKey, bodyKey];
  if (allowEnvKeyFallback()) {
    candidates.push(process.env.OPENAI_API_KEY);
  }
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed && isPlausibleOpenAiApiKey(trimmed)) {
      return trimmed;
    }
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
