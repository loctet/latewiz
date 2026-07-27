import type { WebSearchContext, WebSearchResult } from "./types";

function maxResults(newsIntent = false): number {
  const raw = process.env.WEB_SEARCH_MAX_RESULTS?.trim();
  const defaultLimit = newsIntent ? 10 : 5;
  const n = raw ? Number(raw) : defaultLimit;
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(10, Math.floor(n));
}

function envFlagEnabled(): boolean {
  const flag = process.env.WEB_SEARCH_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

export function isWebSearchConfigured(): boolean {
  const tavily = process.env.TAVILY_API_KEY?.trim();
  const serper = process.env.SERPER_API_KEY?.trim();
  return Boolean(tavily || serper);
}

export function isWebSearchEnabled(): boolean {
  return envFlagEnabled() && isWebSearchConfigured();
}

async function searchTavily(
  query: string,
  apiKey: string,
  limit: number,
  newsIntent = false
): Promise<{ results: WebSearchResult[]; answer?: string; error?: string }> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: limit,
        search_depth: newsIntent ? "advanced" : "basic",
        topic: newsIntent ? "news" : "general",
        include_answer: true,
        days: newsIntent ? 7 : undefined,
      }),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      return {
        results: [],
        error: `Tavily HTTP ${res.status}: ${bodyRaw.slice(0, 200)}`,
      };
    }

    const data = JSON.parse(bodyRaw) as {
      answer?: string;
      results?: { title?: string; url?: string; content?: string }[];
    };

    const results: WebSearchResult[] = (data.results ?? [])
      .map((row) => ({
        title: String(row.title ?? "Source").trim(),
        url: String(row.url ?? "").trim(),
        snippet: String(row.content ?? "").trim().slice(0, 500),
      }))
      .filter((r) => r.url && r.snippet);

    return {
      results,
      answer: data.answer?.trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { results: [], error: msg.slice(0, 200) };
  }
}

async function searchSerperNews(
  query: string,
  apiKey: string,
  limit: number
): Promise<{ results: WebSearchResult[]; error?: string }> {
  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: limit }),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      return {
        results: [],
        error: `Serper News HTTP ${res.status}: ${bodyRaw.slice(0, 200)}`,
      };
    }

    const data = JSON.parse(bodyRaw) as {
      news?: { title?: string; link?: string; snippet?: string }[];
    };

    const results: WebSearchResult[] = (data.news ?? [])
      .map((row) => ({
        title: String(row.title ?? "Source").trim(),
        url: String(row.link ?? "").trim(),
        snippet: String(row.snippet ?? "").trim().slice(0, 500),
      }))
      .filter((r) => r.url && r.snippet);

    return { results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { results: [], error: msg.slice(0, 200) };
  }
}

async function searchSerper(
  query: string,
  apiKey: string,
  limit: number
): Promise<{ results: WebSearchResult[]; error?: string }> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: limit }),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      return {
        results: [],
        error: `Serper HTTP ${res.status}: ${bodyRaw.slice(0, 200)}`,
      };
    }

    const data = JSON.parse(bodyRaw) as {
      organic?: { title?: string; link?: string; snippet?: string }[];
    };

    const results: WebSearchResult[] = (data.organic ?? [])
      .map((row) => ({
        title: String(row.title ?? "Source").trim(),
        url: String(row.link ?? "").trim(),
        snippet: String(row.snippet ?? "").trim().slice(0, 500),
      }))
      .filter((r) => r.url && r.snippet);

    return { results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { results: [], error: msg.slice(0, 200) };
  }
}

export type SearchWebOptions = {
  /** Prefer news APIs and return up to 10 recent headlines when configured. */
  newsIntent?: boolean;
  /** Override result cap (e.g. deep research). */
  maxResults?: number;
};

/** Run live web search when configured; otherwise return null. */
export async function searchWeb(
  query: string,
  options?: SearchWebOptions
): Promise<WebSearchContext | null> {
  if (!isWebSearchEnabled()) return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const newsIntent = Boolean(options?.newsIntent);
  const limit =
    options?.maxResults != null &&
    Number.isFinite(options.maxResults) &&
    options.maxResults > 0
      ? Math.min(10, Math.floor(options.maxResults))
      : maxResults(newsIntent);
  const searchedAt = new Date().toISOString();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const errors: string[] = [];

  if (newsIntent && serperKey) {
    const serperNews = await searchSerperNews(trimmed, serperKey, limit);
    if (serperNews.results.length > 0) {
      return {
        query: trimmed,
        searchedAt,
        results: serperNews.results.slice(0, limit),
        provider: "serper",
      };
    }
    if (serperNews.error) errors.push(serperNews.error);
  }

  if (tavilyKey) {
    const tavily = await searchTavily(trimmed, tavilyKey, limit, newsIntent);
    if (tavily.results.length > 0) {
      return {
        query: trimmed,
        searchedAt,
        results: tavily.results.slice(0, limit),
        provider: "tavily",
        answer: tavily.answer,
      };
    }
    if (tavily.error) errors.push(tavily.error);
  }

  if (serperKey) {
    const serper = await searchSerper(trimmed, serperKey, limit);
    if (serper.results.length > 0) {
      return {
        query: trimmed,
        searchedAt,
        results: serper.results.slice(0, limit),
        provider: "serper",
      };
    }
    if (serper.error) errors.push(serper.error);
  }

  if (errors.length) {
    return {
      query: trimmed,
      searchedAt,
      results: [],
      provider: "none",
      error: errors.join("; "),
    };
  }

  return {
    query: trimmed,
    searchedAt,
    results: [],
    provider: "none",
  };
}
