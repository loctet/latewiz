import {
  AUTO_POST_PROMPT_STYLE_ID,
  getPostPromptStyle,
  resolvePostPromptStyle,
  type PostPromptStyle,
} from "@/lib/post-prompt-catalog";

export type ResearchDepthId = "standard" | "deep";

export const DEFAULT_RESEARCH_DEPTH_ID: ResearchDepthId = "standard";

/** OpenAI model used when Deep is selected (override via OPENAI_DEEP_TEXT_MODEL).
 *  o3/o4-mini deep-research aliases were shut off 2026-07-23 — use gpt-5.6-sol. */
export const DEFAULT_DEEP_RESEARCH_MODEL = "gpt-5.6-sol";

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
      "Multi-step web research with GPT-5.6 (PDF report + ~1000-char teaser). May take several minutes.",
    advancedSearch: true,
    maxSearchResults: 10,
    searchContextSize: "high",
    /** Social teaser length floor (full analysis lives in the PDF) */
    minBodyCharsFloor: 800,
    maxOutputTokensFloor: 2048,
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
    "Write a SHORT professional social TEASER (~900–1100 characters) — the full report is delivered as a separate PDF.",
    "2–3 dense paragraphs: thesis, key data, main catalyst or risk. No multi-section institutional blueprint.",
    "Do not append parenthetical source domains like (kucoin.com) in the body.",
    "Do not end with a rhetorical question to the reader.",
    "Prefer specific levels, percentages, catalysts, and risks from the report; if evidence is thin, say so.",
    "Do not invent or paste a PDF URL — the system appends the See more (full PDF report) link after generation.",
    "Stay objective — do not reshape findings for a personal niche, target audience, or brand marketing angle.",
  ].join(" ");
}

export function buildDeepResearchTeaserTaskInstructions(): string {
  return [
    "DEEP RESEARCH TEASER MODE: Write a short professional social teaser for the feed — NOT the full institutional report.",
    "Target body length: 900–1100 characters (before hashtags). Hard max ~1100 characters.",
    "Structure: a punchy title, then 2–3 dense paragraphs covering the thesis, 1–2 specific data points, and the main risk or catalyst.",
    "Do NOT include long section headings like CORE ARCHITECTURE, TOKENOMICS tables, or multi-section blueprints — those belong in the PDF.",
    "Do not invent a URL or write 'See more' / 'Full report:' — the system appends the PDF link after generation.",
    "Do not end with a rhetorical question. Stay objective and factual from the research report only.",
  ].join(" ");
}

export function appendFullReportLink(body: string, pdfUrl: string): string {
  const trimmed = body.trim();
  if (!pdfUrl) return trimmed;
  if (trimmed.includes(pdfUrl)) return trimmed;
  return `${trimmed}\n\nSee more (full PDF report): ${pdfUrl}`;
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

  // Deep mode: short social teaser; full structured analysis goes in the PDF.
  return {
    ...base,
    minBodyChars: depth.minBodyCharsFloor,
    maxOutputTokens: Math.max(2048, depth.maxOutputTokensFloor),
  };
}
