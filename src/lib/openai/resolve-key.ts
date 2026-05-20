export function isPlausibleOpenAiApiKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed !== "" &&
    trimmed.startsWith("sk-") &&
    trimmed.length >= 24 &&
    /^sk-[a-zA-Z0-9_-]+$/.test(trimmed)
  );
}

export function resolveOpenAiApiKey(
  headerKey?: string | null,
  bodyKey?: string | null
): string | null {
  const candidates = [headerKey, bodyKey, process.env.OPENAI_API_KEY];
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed && isPlausibleOpenAiApiKey(trimmed)) {
      return trimmed;
    }
  }
  return null;
}
