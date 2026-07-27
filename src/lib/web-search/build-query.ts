import type { NicheProfile } from "@/lib/openai/types";
import type { ResearchDepthId } from "@/lib/research-depth";
import { parseResearchDepthId } from "@/lib/research-depth";

export type ContentResearchParams = {
  niche: NicheProfile;
  hint?: string;
  campaignGoal?: string;
  campaignHint?: string;
  slotIndex?: number;
  totalPosts?: number;
  trendSnippets?: string[];
  /** Slot-specific search terms from the campaign outline */
  searchHint?: string;
  /** Subtopics already covered — steers search toward fresh angles */
  coveredSubtopics?: string[];
  /** Standard vs deep — deep forces advanced/news-style search */
  researchDepthId?: ResearchDepthId | string | null;
  /**
   * Skip niche topic/audience/geography in the search query so research
   * stays objective (market analysis, news roundup, deep research).
   */
  ignoreNicheBias?: boolean;
};

const NEWS_INTENT_RE =
  /actualit|news|headlines?|roundup|r[eé]cent|breaking|derni[eè]res?\s+nouvelles|fil d.?actualit|aujourd.?hui|today'?s?\s+(?:news|headlines)/i;

const MARKET_INTENT_RE =
  /market\s*anal|analyse?\s+(?:de\s+)?march|price\s*action|technical\s*anal|crypto\s*(?:market|research)|token\s*research|24\s*h(?:eurs?)?|derni[eè]res?\s+24|last\s+24|past\s+24|institutional[- ]?grade/i;

/** Brief asks for a timely news digest rather than evergreen commentary. */
export function isNewsIntent(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => t?.trim() && NEWS_INTENT_RE.test(t));
}

/** Brief asks for market / 24h price analysis — needs fresh market sources. */
export function isMarketIntent(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => t?.trim() && MARKET_INTENT_RE.test(t));
}

/** News, market, or deep research → use advanced/news search depth. */
export function prefersAdvancedSearch(
  params: Pick<
    ContentResearchParams,
    | "searchHint"
    | "hint"
    | "campaignGoal"
    | "campaignHint"
    | "researchDepthId"
  >
): boolean {
  if (parseResearchDepthId(params.researchDepthId) === "deep") return true;
  const texts = [
    params.searchHint,
    params.hint,
    params.campaignGoal,
    params.campaignHint,
  ];
  return isNewsIntent(...texts) || isMarketIntent(...texts);
}

/** Build a search query aimed at recent, niche-relevant information. */
export function buildContentResearchQuery(params: ContentResearchParams): string {
  const parts: string[] = [];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  const slotSearch = params.searchHint?.trim();
  if (slotSearch) parts.push(slotSearch.slice(0, 200));

  const hint = params.hint?.trim() || params.campaignHint?.trim();
  if (hint) parts.push(hint.slice(0, 200));

  const ignoreNiche = Boolean(params.ignoreNicheBias);
  if (!ignoreNiche) {
    const topic = params.niche.topic.trim();
    if (topic) parts.push(topic);

    const geo = params.niche.geography.trim();
    if (geo) parts.push(geo);

    const audience = params.niche.audience.trim();
    if (audience) parts.push(`for ${audience}`);
  }

  const goal = params.campaignGoal?.trim();
  // For objective research, avoid injecting a marketing-style campaign goal into search
  if (goal && !ignoreNiche) parts.push(goal.slice(0, 120));
  if (goal && ignoreNiche && (isNewsIntent(goal) || isMarketIntent(goal))) {
    // Keep only market/news signal words, not brand framing — use searchHint/subject instead
  }

  const newsIntent = isNewsIntent(
    params.searchHint,
    params.hint,
    params.campaignGoal,
    params.campaignHint
  );
  const marketIntent = isMarketIntent(
    params.searchHint,
    params.hint,
    params.campaignGoal,
    params.campaignHint
  );
  if (marketIntent) {
    parts.push(`24 hour market analysis price catalysts ${year}`);
  } else if (newsIntent) {
    parts.push(`breaking news headlines today ${year}`);
  } else if (parseResearchDepthId(params.researchDepthId) === "deep") {
    parts.push(`in-depth analysis latest developments ${year} ${month}`);
  } else {
    parts.push(`latest news trends ${year} ${month}`);
  }

  if (
    params.slotIndex != null &&
    params.totalPosts != null &&
    params.totalPosts > 0
  ) {
    parts.push(`campaign post ${params.slotIndex + 1} of ${params.totalPosts}`);
  }

  const trends = (params.trendSnippets ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (trends.length) parts.push(trends.join(" "));

  const covered = (params.coveredSubtopics ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(-4);
  if (covered.length) {
    parts.push(`different angle from ${covered.join(", ")}`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}
