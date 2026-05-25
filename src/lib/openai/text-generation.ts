import {
  buildFactualResearchInstructions,
  createResponseWithWebSearch,
  isNativeWebSearchPreferred,
  parseJsonFromModelOutput,
} from "./responses";
import { buildNicheSystemInstructions } from "./niche-prompt";
import { SOCIAL_POST_FORMAT_INSTRUCTIONS } from "./sanitize-post-text";
import { buildTimelinessSystemInstructions } from "@/lib/web-search/content-research";
import { appendWebResearchToUserMessage } from "@/lib/web-search/content-research";
import type { ContentResearchParams } from "@/lib/web-search/build-query";

export type TextGenerationResult<T> = {
  data: T | null;
  detail: string | null;
  source: "openai+web" | "openai" | "openai+fallback-search";
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
}): Promise<{ data: T | null; detail: string | null }> {
  const model = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
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

/**
 * Generate structured JSON using OpenAI Responses API + web_search when possible.
 * Falls back to Tavily/Serper pre-fetch + Chat Completions, then plain Chat Completions.
 */
export async function generateStructuredContent<T>(params: {
  apiKey: string;
  taskInstructions: string;
  userInput: string;
  jsonSchema: { name: string; schema: Record<string, unknown> };
  researchParams?: ContentResearchParams;
  maxOutputTokens?: number;
}): Promise<TextGenerationResult<T>> {
  const instructions = [
    params.taskInstructions,
    SOCIAL_POST_FORMAT_INSTRUCTIONS,
    buildFactualResearchInstructions(),
    buildTimelinessSystemInstructions(),
    params.researchParams
      ? buildNicheSystemInstructions(params.researchParams.niche)
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let userInput = params.userInput;
  let usedFallbackSearch = false;
  if (params.researchParams) {
    const enriched = await appendWebResearchToUserMessage(
      params.userInput,
      params.researchParams
    );
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
