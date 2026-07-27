import {
  buildFactualResearchInstructions,
  createResponseWithWebSearch,
  isNativeWebSearchPreferred,
  parseJsonFromModelOutput,
  resolveTextModel,
  resolveTextModelForDepth,
} from "./responses";
import {
  buildDeepResearchSystemInstructions,
  rewritePromptForDeepResearch,
  runDeepResearch,
} from "./deep-research";
import { buildNicheSystemInstructions } from "./niche-prompt";
import { SOCIAL_POST_FORMAT_INSTRUCTIONS } from "./sanitize-post-text";
import { buildTimelinessSystemInstructions } from "@/lib/web-search/content-research";
import { appendWebResearchToUserMessage } from "@/lib/web-search/content-research";
import type { ContentResearchParams } from "@/lib/web-search/build-query";
import {
  buildDeepResearchTaskInstructions,
  getResearchDepth,
  parseResearchDepthId,
  type ResearchDepthId,
} from "@/lib/research-depth";

export type TextGenerationResult<T> = {
  data: T | null;
  detail: string | null;
  source:
    | "openai+web"
    | "openai"
    | "openai+fallback-search"
    | "openai+deep-research";
};

function summarizeOpenAiError(status: number, bodyRaw: string): string {
  try {
    const data = JSON.parse(bodyRaw) as { error?: { message?: string } };
    const message = data?.error?.message?.trim();
    if (message) return `OpenAI HTTP ${status}: ${message}`;
  } catch {
    /* ignore */
  }
  return `OpenAI HTTP ${status}: ${bodyRaw.trim().slice(0, 240)}`;
}

async function chatCompletionsJson<T>(params: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<{ data: T | null; detail: string | null }> {
  const model =
    params.model?.trim() ||
    process.env.OPENAI_TEXT_MODEL?.trim() ||
    "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      max_tokens: params.maxTokens,
    }),
  });

  const bodyRaw = await res.text();
  if (!res.ok) {
    return { data: null, detail: summarizeOpenAiError(res.status, bodyRaw) };
  }

  const data = JSON.parse(bodyRaw) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { data: parseJsonFromModelOutput<T>(text), detail: null };
}

async function formatStructuredFromResearch<T>(params: {
  apiKey: string;
  taskInstructions: string;
  userInput: string;
  researchReport: string;
  researchParams?: ContentResearchParams;
  maxOutputTokens?: number;
}): Promise<TextGenerationResult<T>> {
  const formatModel = resolveTextModel();
  const objective = Boolean(params.researchParams?.ignoreNicheBias);
  const instructions = [
    params.taskInstructions,
    buildDeepResearchTaskInstructions(),
    SOCIAL_POST_FORMAT_INSTRUCTIONS,
    buildTimelinessSystemInstructions(),
    params.researchParams
      ? buildNicheSystemInstructions(params.researchParams.niche, {
          objectiveResearch: objective,
        })
      : "",
    "Use ONLY the Deep Research report below for timely facts. Do not invent additional news.",
    objective
      ? "Do not reshape the report to fit a personal niche, audience persona, or brand voice."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userInput = [
    params.userInput,
    "",
    "=== OPENAI DEEP RESEARCH REPORT (authoritative) ===",
    params.researchReport.slice(0, 48_000),
    "=== END REPORT ===",
    "",
    "Write the social post JSON now, following the structure and quality bar in the instructions.",
  ].join("\n");

  // Deep research models lack structured outputs — format with the standard text model.
  const chat = await chatCompletionsJson<T>({
    apiKey: params.apiKey,
    system: instructions,
    user: userInput,
    maxTokens: params.maxOutputTokens,
    model: formatModel,
  });

  if (chat.data) {
    return {
      data: chat.data,
      detail: chat.detail,
      source: "openai+deep-research",
    };
  }

  return {
    data: null,
    detail: chat.detail ?? "Failed to format deep research into a post",
    source: "openai+deep-research",
  };
}

/**
 * Generate structured JSON using OpenAI Responses API + web_search when possible.
 * Deep research mode: OpenAI o4-mini/o3-deep-research → then format to JSON.
 * Falls back to Tavily/Serper pre-fetch + Chat Completions, then plain Chat Completions.
 */
export async function generateStructuredContent<T>(params: {
  apiKey: string;
  taskInstructions: string;
  userInput: string;
  jsonSchema: { name: string; schema: Record<string, unknown> };
  researchParams?: ContentResearchParams;
  maxOutputTokens?: number;
  researchDepthId?: ResearchDepthId | string | null;
}): Promise<TextGenerationResult<T>> {
  const depthId = parseResearchDepthId(params.researchDepthId);
  const depth = getResearchDepth(depthId);

  // Deep research is always objective — never bias toward workspace niche/audience
  if (depthId === "deep") {
    const researchParams = params.researchParams
      ? { ...params.researchParams, ignoreNicheBias: true }
      : undefined;

    const rewritten = await rewritePromptForDeepResearch({
      apiKey: params.apiKey,
      brief: params.userInput,
    });

    const research = await runDeepResearch({
      apiKey: params.apiKey,
      instructions: buildDeepResearchSystemInstructions(),
      input: rewritten.prompt,
    });

    if (research.ok && research.outputText.trim()) {
      return formatStructuredFromResearch<T>({
        apiKey: params.apiKey,
        taskInstructions: params.taskInstructions,
        userInput: params.userInput,
        researchReport: research.outputText,
        researchParams,
        maxOutputTokens: params.maxOutputTokens,
      });
    }

    // Fall through to standard generation if deep research fails
    const deepFailDetail =
      research.detail ??
      "Deep research failed; falling back to standard generation";

    const fallback = await generateStructuredContentStandard<T>({
      ...params,
      researchParams,
      researchDepthId: "standard",
    });

    return {
      ...fallback,
      detail: fallback.detail
        ? `${deepFailDetail} | ${fallback.detail}`
        : deepFailDetail,
    };
  }

  return generateStructuredContentStandard<T>(params);
}

async function generateStructuredContentStandard<T>(params: {
  apiKey: string;
  taskInstructions: string;
  userInput: string;
  jsonSchema: { name: string; schema: Record<string, unknown> };
  researchParams?: ContentResearchParams;
  maxOutputTokens?: number;
  researchDepthId?: ResearchDepthId | string | null;
}): Promise<TextGenerationResult<T>> {
  const depthId = parseResearchDepthId(params.researchDepthId);
  const depth = getResearchDepth(depthId);
  const model = resolveTextModelForDepth(depthId);

  const instructions = [
    params.taskInstructions,
    SOCIAL_POST_FORMAT_INSTRUCTIONS,
    buildFactualResearchInstructions(),
    buildTimelinessSystemInstructions(),
    params.researchParams
      ? buildNicheSystemInstructions(params.researchParams.niche, {
          objectiveResearch: Boolean(params.researchParams.ignoreNicheBias),
        })
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let userInput = params.userInput;
  let usedFallbackSearch = false;
  if (params.researchParams) {
    const enriched = await appendWebResearchToUserMessage(params.userInput, {
      ...params.researchParams,
      researchDepthId: depthId,
    });
    userInput = enriched.message;
    usedFallbackSearch = enriched.usedWebSearch;
  }

  if (isNativeWebSearchPreferred()) {
    const native = await createResponseWithWebSearch({
      apiKey: params.apiKey,
      instructions,
      input: userInput,
      jsonSchema: params.jsonSchema,
      maxOutputTokens: params.maxOutputTokens,
      requireWebSearch: Boolean(params.researchParams),
      model,
      searchContextSize: depth.searchContextSize,
    });

    if (native.ok) {
      const parsed = parseJsonFromModelOutput<T>(native.outputText);
      if (parsed) {
        return {
          data: parsed,
          detail: null,
          source: native.usedWebSearch ? "openai+web" : "openai",
        };
      }
      return {
        data: null,
        detail: "OpenAI Responses returned unparseable JSON",
        source: native.usedWebSearch ? "openai+web" : "openai",
      };
    }
  }

  const chat = await chatCompletionsJson<T>({
    apiKey: params.apiKey,
    system: instructions,
    user: userInput,
    maxTokens: params.maxOutputTokens,
    model,
  });

  if (chat.data) {
    return {
      data: chat.data,
      detail: chat.detail,
      source: usedFallbackSearch ? "openai+fallback-search" : "openai",
    };
  }

  return { data: null, detail: chat.detail, source: "openai" };
}
