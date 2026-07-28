import {
  AUTO_POST_PROMPT_STYLE_ID,
  getPostPromptStyle,
  resolvePostPromptStyle,
  type PostPromptStyle,
} from "@/lib/post-prompt-catalog";

export type ResearchDepthId = "standard" | "deep";

export const DEFAULT_RESEARCH_DEPTH_ID: ResearchDepthId = "standard";

export type ResearchDepth = {
  id: ResearchDepthId;
  label: string;
  description: string;
  /** Prefer news/advanced search APIs and deeper Tavily depth */
  advancedSearch: boolean;
  maxSearchResults: number;
  searchContextSize: "low" | "medium" | "high";
  /** Floor applied to post body length in deep mode */
  minBodyCharsFloor: number;
  maxOutputTokensFloor: number;
};

export const RESEARCH_DEPTHS: ResearchDepth[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Normal model with web search — fast social copy.",
    advancedSearch: false,
    maxSearchResults: 5,
    searchContextSize: "medium",
    minBodyCharsFloor: 0,
    maxOutputTokensFloor: 2048,
  },
  {
    id: "deep",
    label: "Thorough",
    description:
      "Same model with higher web-search context and more sources — richer research, still a normal caption.",
    advancedSearch: true,
    maxSearchResults: 10,
    searchContextSize: "high",
    minBodyCharsFloor: 0,
    maxOutputTokensFloor: 4096,
  },
];

export function parseResearchDepthId(raw?: string | null): ResearchDepthId {
  return raw?.trim().toLowerCase() === "deep" ? "deep" : "standard";
}

export function getResearchDepth(id?: string | null): ResearchDepth {
  const parsed = parseResearchDepthId(id);
  return RESEARCH_DEPTHS.find((d) => d.id === parsed)!;
}

/** Always the normal text model — depth only changes web-search strength. */
export function resolveTextModelForDepth(_depthId?: string | null): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * Deep/thorough mode upgrades shallow templates and can raise token floors.
 * When the user left "Standard social" selected, re-match from the goal (or expert brief).
 */
export function applyResearchDepthToPostStyle(
  style: PostPromptStyle,
  depth: ResearchDepth,
  campaignGoal = ""
): PostPromptStyle {
  if (depth.id !== "deep") return style;

  let base = style;
  if (style.minBodyChars <= 0) {
    const fromGoal = resolvePostPromptStyle({
      styleId: AUTO_POST_PROMPT_STYLE_ID,
      campaignGoal: campaignGoal.trim() || "expert research brief deep dive",
    });
    base =
      fromGoal.minBodyChars > 0
        ? fromGoal
        : getPostPromptStyle("expert-research-brief");
  }

  return {
    ...base,
    minBodyChars: Math.max(base.minBodyChars, depth.minBodyCharsFloor),
    maxOutputTokens: Math.max(
      base.maxOutputTokens,
      depth.maxOutputTokensFloor
    ),
  };
}
