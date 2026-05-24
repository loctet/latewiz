export type WebSearchToolConfig = {
  type: "web_search";
  filters?: { allowed_domains: string[] };
  search_context_size?: "low" | "medium" | "high";
  external_web_access?: boolean;
};

export type ResponsesCallParams = {
  apiKey: string;
  instructions: string;
  input: string;
  jsonSchema: { name: string; schema: Record<string, unknown> };
  requireWebSearch?: boolean;
  maxOutputTokens?: number;
};

export type ResponsesCallResult = {
  ok: boolean;
  status: number;
  outputText: string;
  usedWebSearch: boolean;
  detail: string | null;
};

export function resolveTextModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

export function isNativeWebSearchPreferred(): boolean {
  const flag = process.env.OPENAI_NATIVE_WEB_SEARCH?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

function parseAllowedDomains(): string[] {
  const raw = process.env.WEB_SEARCH_ALLOWED_DOMAINS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((d) => d.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
    .filter(Boolean)
    .slice(0, 100);
}

export function buildWebSearchTool(): WebSearchToolConfig {
  const tool: WebSearchToolConfig = { type: "web_search" };
  const domains = parseAllowedDomains();
  if (domains.length > 0) {
    tool.filters = { allowed_domains: domains };
  }
  const size = process.env.OPENAI_WEB_SEARCH_CONTEXT_SIZE?.trim();
  if (size === "low" || size === "medium" || size === "high") {
    tool.search_context_size = size;
  }
  const live = process.env.OPENAI_WEB_SEARCH_LIVE?.trim().toLowerCase();
  if (live === "false" || live === "0") {
    tool.external_web_access = false;
  }
  return tool;
}

export function buildFactualResearchInstructions(): string {
  const today = new Date().toISOString().slice(0, 10);
  const recencyDays = process.env.OPENAI_WEB_SEARCH_RECENCY_DAYS?.trim() || "14";
  return [
    `Today's date (UTC): ${today}.`,
    "You are a factual social content assistant.",
    "",
    "Before writing the post:",
    "1. Search the web for the latest verified information relevant to the niche and task.",
    `2. Prefer information published within the last ${recencyDays} days when timeliness matters.`,
    "3. Use trustworthy, recent sources; ignore outdated or low-credibility pages.",
    "4. Cross-check important claims across multiple sources when possible.",
    "5. If sources conflict or evidence is weak, use evergreen framing and avoid specific disputed facts.",
    "6. Do not invent statistics, dates, or news — only use what search supports.",
    "",
    "For social posts: weave timely insights naturally; do not paste URLs in the caption unless the brief asks.",
  ].join("\n");
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const output = data.output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    const row = item as Record<string, unknown>;
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const block of row.content) {
      const b = block as Record<string, unknown>;
      if (b.type === "output_text" && typeof b.text === "string") {
        parts.push(b.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function responseUsedWebSearch(data: Record<string, unknown>): boolean {
  const output = data.output;
  if (!Array.isArray(output)) return false;
  return output.some(
    (item) => (item as Record<string, unknown>).type === "web_search_call"
  );
}

export async function createResponseWithWebSearch(
  params: ResponsesCallParams
): Promise<ResponsesCallResult> {
  const model = resolveTextModel();
  const webTool = buildWebSearchTool();
  const requireSearch =
    params.requireWebSearch ??
    process.env.OPENAI_WEB_SEARCH_REQUIRED?.trim().toLowerCase() === "true";

  const body: Record<string, unknown> = {
    model,
    instructions: params.instructions,
    input: params.input,
    tools: [webTool],
    tool_choice: requireSearch ? "required" : "auto",
    text: {
      format: {
        type: "json_schema",
        name: params.jsonSchema.name,
        strict: true,
        schema: params.jsonSchema.schema,
      },
    },
  };

  if (params.maxOutputTokens != null) {
    body.max_output_tokens = params.maxOutputTokens;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      let detail = bodyRaw.slice(0, 400);
      try {
        const err = JSON.parse(bodyRaw) as {
          error?: { message?: string };
        };
        if (err.error?.message) detail = err.error.message;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        status: res.status,
        outputText: "",
        usedWebSearch: false,
        detail: `OpenAI Responses HTTP ${res.status}: ${detail}`,
      };
    }

    const data = JSON.parse(bodyRaw) as Record<string, unknown>;
    const outputText = extractOutputText(data);
    return {
      ok: true,
      status: res.status,
      outputText,
      usedWebSearch: responseUsedWebSearch(data),
      detail: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      ok: false,
      status: 0,
      outputText: "",
      usedWebSearch: false,
      detail: msg.slice(0, 400),
    };
  }
}

export function parseJsonFromModelOutput<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
