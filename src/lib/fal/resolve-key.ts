export function isPlausibleFalApiKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length >= 20 && /^[a-zA-Z0-9:_-]+$/.test(trimmed);
}

export function resolveFalApiKey(
  headerKey?: string | null,
  bodyKey?: string | null
): string | null {
  const candidates = [
    headerKey,
    bodyKey,
    process.env.FAL_KEY,
    process.env.FAL_API_KEY,
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed && isPlausibleFalApiKey(trimmed)) {
      return trimmed;
    }
  }
  return null;
}
