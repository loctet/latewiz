import type { NicheProfile } from "@/lib/openai/types";
import {
  buildContentResearchQuery,
  type ContentResearchParams,
} from "./build-query";
import { formatWebContextForPrompt } from "./format-context";
import { isWebSearchEnabled, searchWeb } from "./service";

export type ContentWebResearch = {
  block: string;
  usedWebSearch: boolean;
  query: string | null;
};

export async function fetchContentWebResearch(
  params: ContentResearchParams
): Promise<ContentWebResearch> {
  if (!isWebSearchEnabled()) {
    return { block: "", usedWebSearch: false, query: null };
  }

  const query = buildContentResearchQuery(params);
  if (!query) {
    return { block: "", usedWebSearch: false, query: null };
  }

  const ctx = await searchWeb(query);
  const block = formatWebContextForPrompt(ctx);
  return {
    block,
    usedWebSearch: Boolean(ctx && ctx.results.length > 0),
    query,
  };
}

export function buildTimelinessSystemInstructions(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Today's date (UTC): ${today}.`,
    "Write timely, accurate social content. When web research is included in the user message, treat it as authoritative for current events, trends, statistics, and product updates.",
    "Do not state specific recent facts, numbers, or news from memory alone — use the web research block or keep claims evergreen.",
    "If web research is missing or thin, avoid pretending to know breaking news; focus on durable insights and clearly timeless advice.",
  ].join("\n");
}

export async function appendWebResearchToUserMessage(
  baseUserMessage: string,
  params: ContentResearchParams
): Promise<{ message: string; usedWebSearch: boolean }> {
  const research = await fetchContentWebResearch(params);
  if (!research.block) {
    return { message: baseUserMessage, usedWebSearch: false };
  }
  return {
    message: `${baseUserMessage}\n\n${research.block}`,
    usedWebSearch: research.usedWebSearch,
  };
}
