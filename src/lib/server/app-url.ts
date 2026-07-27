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

/** Prefer the live request host so local PDF links are not rewritten to a remote APP_URL. */
export function resolveRequestOrigin(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const originHeader = request.headers.get("origin")?.trim();
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      /* ignore */
    }
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) return null;

  const protoHeader = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto = protoHeader || (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export function toAbsoluteAppUrl(
  pathname: string,
  originOverride?: string | null
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const origin = (originOverride?.trim() || getAppOrigin()).replace(/\/$/, "");
  return `${origin}${path}`;
}
