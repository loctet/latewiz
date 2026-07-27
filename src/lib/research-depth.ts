import {
  AUTO_POST_PROMPT_STYLE_ID,
  getPostPromptStyle,
  resolvePostPromptStyle,
  type PostPromptStyle,
} from "@/lib/post-prompt-catalog";

export type ResearchDepthId = "standard" | "deep";

export const DEFAULT_RESEARCH_DEPTH_ID: ResearchDepthId = "standard";

/** OpenAI Deep Research model used when Deep is selected (override via OPENAI_DEEP_TEXT_MODEL). */
export const DEFAULT_DEEP_RESEARCH_MODEL = "o4-mini-deep-research";

/** @deprecated Alias — prefer DEFAULT_DEEP_RESEARCH_MODEL */
export const DEFAULT_DEEP_TEXT_MODEL = DEFAULT_DEEP_RESEARCH_MODEL;

export type ResearchDepth = {
  id: ResearchDepthId;
  label: string;
  description: string;
  /** Prefer news/advanced search APIs and deeper Tavily depth (standard path) */
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
    description: "Default model with normal web research — fast social copy.",
    advancedSearch: false,
    maxSearchResults: 5,
    searchContextSize: "medium",
    minBodyCharsFloor: 0,
    maxOutputTokensFloor: 2048,
  },
  {
    id: "deep",
    label: "Deep research",
    description:
      "OpenAI Deep Research (o4-mini-deep-research) — multi-step web research. May take several minutes.",
    advancedSearch: true,
    maxSearchResults: 10,
    searchContextSize: "high",
    minBodyCharsFloor: 1200,
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

/**
 * Model for the *formatting* pass after deep research, or for standard generation.
 * Deep research itself uses OPENAI_DEEP_TEXT_MODEL / o4-mini-deep-research.
 */
export function resolveTextModelForDepth(depthId?: string | null): string {
  if (parseResearchDepthId(depthId) === "deep") {
    // Formatting pass uses the standard text model (deep-research models lack JSON schema).
    return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
  }
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

export function buildDeepResearchTaskInstructions(): string {
  return [
    "This post is grounded in an OpenAI Deep Research report included below.",
    "Produce institutional-grade analysis for social — not a thin news blurb.",
    "Synthesize the report into the required structure; never paraphrase a single article into numbered 'key facts'.",
    "Do not append parenthetical source domains like (kucoin.com) in the body.",
    "Do not end with a rhetorical question to the reader.",
    "Prefer specific levels, percentages, catalysts, and risks from the report; if evidence is thin, say so.",
    "Write substantive paragraphs under clear section headings — not bullet spam.",
    "Do not paste long URLs; weave findings naturally for social.",
    "Stay objective — do not reshape findings for a personal niche, target audience, or brand marketing angle.",
  ].join(" ");
}

/**
 * Deep mode upgrades shallow templates and raises length/token floors.
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
    maxOutputTokens: Math.max(base.maxOutputTokens, depth.maxOutputTokensFloor),
  };
}
