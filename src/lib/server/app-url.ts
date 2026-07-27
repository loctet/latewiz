/**
 * Absolute origin for public links (PDF reports, OAuth).
 * Prefers NEXT_PUBLIC_APP_URL, then BETTER_AUTH_URL, then localhost.
 */
export function getAppOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return fromEnv.replace(/\/$/, "");
    }
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}`;
  }
  return "http://localhost:3000";
}

export function toAbsoluteAppUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getAppOrigin()}${path}`;
}
