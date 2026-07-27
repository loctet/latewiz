/**
 * OpenAI Deep Research via the Responses API.
 * @see https://developers.openai.com/api/docs/guides/deep-research
 *
 * Models: o3-deep-research | o4-mini-deep-research
 * Requires at least one data tool (web_search, with web_search_preview fallback).
 * Structured JSON is NOT supported — research returns prose; format in a second pass.
 */

import {
  extractOutputTextFromResponse,
  resolveTextModel,
} from "./responses";
import { DEFAULT_DEEP_RESEARCH_MODEL } from "@/lib/research-depth";

export { DEFAULT_DEEP_RESEARCH_MODEL };

export type DeepResearchResult = {
  ok: boolean;
  outputText: string;
  usedWebSearch: boolean;
  detail: string | null;
  responseId: string | null;
  status: string | null;
};

function resolveDeepResearchModel(): string {
  const raw =
    process.env.OPENAI_DEEP_TEXT_MODEL?.trim() ||
    process.env.OPENAI_DEEP_RESEARCH_MODEL?.trim() ||
    DEFAULT_DEEP_RESEARCH_MODEL;
  // Strip inline comments / whitespace from .env values
  const cleaned = raw.replace(/\s+#.*$/, "").trim();
  // Migrated aliases shut off 2026-07-23
  if (
    /^(o3-deep-research|o4-mini-deep-research)(-|$)/i.test(cleaned)
  ) {
    console.warn(
      `[deep-research] ${cleaned} is deprecated; using ${DEFAULT_DEEP_RESEARCH_MODEL}`
    );
    return DEFAULT_DEEP_RESEARCH_MODEL;
  }
  return cleaned || DEFAULT_DEEP_RESEARCH_MODEL;
}

function candidateDeepModels(preferred: string): string[] {
  const list = [preferred, DEFAULT_DEEP_RESEARCH_MODEL, "gpt-5.5-pro"];
  return [...new Set(list.filter(Boolean))];
}

function resolveMaxToolCalls(): number {
  const raw = process.env.OPENAI_DEEP_MAX_TOOL_CALLS?.trim();
  if (!raw) return 40;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 40;
  return Math.min(100, Math.floor(n));
}

function useBackgroundMode(): boolean {
  const flag = process.env.OPENAI_DEEP_BACKGROUND?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

function maxWaitMs(): number {
  const raw = process.env.OPENAI_DEEP_MAX_WAIT_MS?.trim();
  const n = raw ? Number(raw) : 480_000;
  if (!Number.isFinite(n) || n < 30_000) return 480_000;
  return Math.min(3_600_000, Math.floor(n));
}

function pollIntervalMs(): number {
  const raw = process.env.OPENAI_DEEP_POLL_MS?.trim();
  const n = raw ? Number(raw) : 4_000;
  if (!Number.isFinite(n) || n < 1_000) return 4_000;
  return Math.min(30_000, Math.floor(n));
}

function responseUsedWebSearch(data: Record<string, unknown>): boolean {
  const output = data.output;
  if (!Array.isArray(output)) return false;
  return output.some((item) => {
    const type = (item as Record<string, unknown>).type;
    return type === "web_search_call" || type === "web_search_preview_call";
  });
}

async function fetchResponseById(
  apiKey: string,
  responseId: string
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  detail: string | null;
}> {
  try {
    const res = await fetch(
      `https://api.openai.com/v1/responses/${responseId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const bodyRaw = await res.text();
    if (!res.ok) {
      let detail = bodyRaw.slice(0, 400);
      try {
        const err = JSON.parse(bodyRaw) as { error?: { message?: string } };
        if (err.error?.message) detail = err.error.message;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        status: res.status,
        data: null,
        detail: `OpenAI Responses GET HTTP ${res.status}: ${detail}`,
      };
    }
    return {
      ok: true,
      status: res.status,
      data: JSON.parse(bodyRaw) as Record<string, unknown>,
      detail: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, status: 0, data: null, detail: msg.slice(0, 400) };
  }
}

async function pollUntilComplete(
  apiKey: string,
  responseId: string
): Promise<DeepResearchResult> {
  const deadline = Date.now() + maxWaitMs();
  const interval = pollIntervalMs();

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const polled = await fetchResponseById(apiKey, responseId);
    if (!polled.ok || !polled.data) {
      return {
        ok: false,
        outputText: "",
        usedWebSearch: false,
        detail: polled.detail,
        responseId,
        status: null,
      };
    }

    const status = String(polled.data.status ?? "");
    if (status === "completed") {
      const outputText = extractOutputTextFromResponse(polled.data);
      return {
        ok: Boolean(outputText.trim()),
        outputText,
        usedWebSearch: responseUsedWebSearch(polled.data),
        detail: outputText.trim()
          ? null
          : "Deep research completed but returned empty output",
        responseId,
        status,
      };
    }
    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "incomplete"
    ) {
      const errObj = polled.data.error as { message?: string } | undefined;
      const errMsg =
        typeof errObj?.message === "string"
          ? errObj.message
          : `Deep research ended with status ${status}`;
      return {
        ok: false,
        outputText: "",
        usedWebSearch: responseUsedWebSearch(polled.data),
        detail: errMsg.slice(0, 400),
        responseId,
        status,
      };
    }
  }

  return {
    ok: false,
    outputText: "",
    usedWebSearch: false,
    detail: `Deep research timed out after ${Math.round(maxWaitMs() / 1000)}s (response ${responseId})`,
    responseId,
    status: "timeout",
  };
}

async function runDeepResearchOnce(params: {
  apiKey: string;
  instructions: string;
  input: string;
  model: string;
  background: boolean;
  maxToolCalls: number;
}): Promise<DeepResearchResult> {
  const toolTypes = ["web_search", "web_search_preview"] as const;
  let lastFail: DeepResearchResult | null = null;

  for (const toolType of toolTypes) {
    const body: Record<string, unknown> = {
      model: params.model,
      instructions: params.instructions,
      input: params.input,
      tools: [{ type: toolType }],
      background: params.background,
      max_tool_calls: params.maxToolCalls,
    };

    try {
      console.info(
        `[deep-research] starting model=${params.model} tool=${toolType} background=${params.background}`
      );
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(
          params.background ? 120_000 : maxWaitMs()
        ),
      });

      const bodyRaw = await res.text();
      if (!res.ok) {
        let detail = bodyRaw.slice(0, 400);
        try {
          const err = JSON.parse(bodyRaw) as { error?: { message?: string } };
          if (err.error?.message) detail = err.error.message;
        } catch {
          /* ignore */
        }
        lastFail = {
          ok: false,
          outputText: "",
          usedWebSearch: false,
          detail: `OpenAI Deep Research HTTP ${res.status}: ${detail}`,
          responseId: null,
          status: null,
        };
        console.warn(`[deep-research] ${toolType} failed:`, lastFail.detail);
        if (
          toolType === "web_search" &&
          /tool|web_search|unsupported|unknown/i.test(detail)
        ) {
          continue;
        }
        return lastFail;
      }

      const data = JSON.parse(bodyRaw) as Record<string, unknown>;
      const responseId = typeof data.id === "string" ? data.id : null;
      const status = String(data.status ?? "");

      if (params.background && responseId && status !== "completed") {
        if (status === "failed" || status === "cancelled") {
          const errObj = data.error as { message?: string } | undefined;
          return {
            ok: false,
            outputText: "",
            usedWebSearch: false,
            detail:
              (typeof errObj?.message === "string" && errObj.message) ||
              `Deep research ${status}`,
            responseId,
            status,
          };
        }
        console.info(
          `[deep-research] polling response ${responseId} (status=${status})`
        );
        return pollUntilComplete(params.apiKey, responseId);
      }

      const outputText = extractOutputTextFromResponse(data);
      return {
        ok: Boolean(outputText.trim()),
        outputText,
        usedWebSearch: responseUsedWebSearch(data),
        detail: outputText.trim()
          ? null
          : "Deep research returned empty output",
        responseId,
        status: status || "completed",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      lastFail = {
        ok: false,
        outputText: "",
        usedWebSearch: false,
        detail: msg.slice(0, 400),
        responseId: null,
        status: null,
      };
      console.warn(`[deep-research] ${toolType} exception:`, lastFail.detail);
      return lastFail;
    }
  }

  return (
    lastFail ?? {
      ok: false,
      outputText: "",
      usedWebSearch: false,
      detail: "Deep research failed",
      responseId: null,
      status: null,
    }
  );
}

/**
 * Run OpenAI Deep Research with a web search tool.
 * Uses background mode + polling by default (tasks can take several minutes).
 * Retries successor models when o3/o4 deep-research aliases are deprecated.
 */
export async function runDeepResearch(params: {
  apiKey: string;
  instructions: string;
  input: string;
  model?: string;
}): Promise<DeepResearchResult> {
  const preferred = params.model?.trim() || resolveDeepResearchModel();
  const models = candidateDeepModels(preferred);
  const background = useBackgroundMode();
  const maxToolCalls = resolveMaxToolCalls();
  let lastFail: DeepResearchResult | null = null;

  for (const model of models) {
    const result = await runDeepResearchOnce({
      apiKey: params.apiKey,
      instructions: params.instructions,
      input: params.input,
      model,
      background,
      maxToolCalls,
    });
    if (result.ok) return result;
    lastFail = result;
    const detail = result.detail ?? "";
    if (/deprecat|model_not_found|does not exist|invalid.?model/i.test(detail)) {
      console.warn(
        `[deep-research] model ${model} unavailable (${detail.slice(0, 120)}); trying next`
      );
      continue;
    }
    if (/quota|billing|insufficient/i.test(detail)) {
      return {
        ...result,
        detail: `${detail} — Deep model: ${model}. Check OpenAI billing/quota, or set OPENAI_DEEP_TEXT_MODEL.`,
      };
    }
    // Other errors: still try one more candidate model
    continue;
  }

  return (
    lastFail ?? {
      ok: false,
      outputText: "",
      usedWebSearch: false,
      detail: "Deep research failed",
      responseId: null,
      status: null,
    }
  );
}

/** Enrich a brief into a detailed deep-research prompt (OpenAI docs recommend this). */
export async function rewritePromptForDeepResearch(params: {
  apiKey: string;
  brief: string;
  model?: string;
}): Promise<{ prompt: string; detail: string | null }> {
  const model = params.model?.trim() || resolveTextModel();

  const instructions = `You will be given a research task. Produce a detailed set of instructions for an OpenAI deep research model. Do NOT complete the research yourself.

GUIDELINES:
1. Maximize specificity — include the subject and time window (e.g. last 24 hours) from the brief.
2. Ask for specific figures, levels, % moves, catalysts, risks, and outlook when relevant.
3. Prefer reliable, up-to-date sources (exchanges, major news, filings, primary data).
4. Request a structured analyst-style report with clear section headings.
5. If the brief is not in English, tell the researcher to respond in that language.
6. Do not invent facts the user did not provide; mark unspecified dimensions as open-ended.
7. Phrase the research request in the first person.
8. CRITICAL — stay on the user's primary subject. Do NOT switch to a different asset, market, or news theme.
9. CRITICAL — stay objective: do NOT tailor research to a personal brand niche, target audience persona, geography marketing angle, or content-calendar voice. Research the subject itself as an institutional analyst would.`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input: params.brief,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      return {
        prompt: params.brief,
        detail: `Prompt rewrite HTTP ${res.status}`,
      };
    }

    const data = JSON.parse(bodyRaw) as Record<string, unknown>;
    const text = extractOutputTextFromResponse(data).trim();
    return {
      prompt: text || params.brief,
      detail: text ? null : "Prompt rewrite returned empty; using original brief",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "rewrite failed";
    return { prompt: params.brief, detail: msg.slice(0, 200) };
  }
}

export function buildDeepResearchSystemInstructions(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Today's date (UTC): ${today}.`,
    "You are a professional research analyst. Your ONLY job is to WRITE THE FULL REPORT NOW.",
    "Hard requirements:",
    "- Output a complete institutional research report of at least 4500 characters.",
    "- Use clear markdown section headings (## Heading).",
    "- Include quantitative facts, catalysts, risks, and outlook when available.",
    "- Include markdown tables when comparing metrics or competitors.",
    "- Research ONLY the primary subject given by the user — do not switch topics.",
    "- Stay objective: do NOT bias toward a personal brand niche or marketing persona.",
    "Strictly forbidden:",
    "- Do NOT ask clarifying questions.",
    "- Do NOT offer options like \"I can rewrite\" / \"Would you like me to\".",
    "- Do NOT write a short social teaser or hashtags.",
    "- Do NOT apologize or narrate what you are about to do — write the report itself.",
    "Do not invent prices, dates, or events. If evidence is thin, say so explicitly.",
  ].join("\n");
}
