const ZERNIO_API_BASE =
  process.env.ZERNIO_API_URL ?? "https://zernio.com/api/v1";

export class ZernioApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ZernioApiError";
  }
}

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function zernioRequest<T>(
  apiKey: string,
  path: string,
  options: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const query = buildQuery(options.query);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullPath = `${normalizedPath}${query}`;

  const isBrowser = typeof window !== "undefined";
  const url = isBrowser
    ? `/api/zernio?path=${encodeURIComponent(fullPath)}`
    : `${ZERNIO_API_BASE}${fullPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  if (isBrowser) {
    headers["X-Zernio-Api-Key"] = apiKey;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const errBody = data as { error?: string; message?: string } | null;
    const message =
      errBody?.error ??
      errBody?.message ??
      `Zernio API error (${res.status})`;
    throw new ZernioApiError(message, res.status, data);
  }

  return data as T;
}
