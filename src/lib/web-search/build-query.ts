import type { NicheProfile } from "@/lib/openai/types";

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
};

const NEWS_INTENT_RE =
  /actualit|news|headlines?|roundup|r[eé]cent|breaking|derni[eè]res?\s+nouvelles|fil d.?actualit|aujourd.?hui|today'?s?\s+(?:news|headlines)/i;

/** Brief asks for a timely news digest rather than evergreen commentary. */
export function isNewsIntent(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => t?.trim() && NEWS_INTENT_RE.test(t));
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

  const topic = params.niche.topic.trim();
  if (topic) parts.push(topic);

  const geo = params.niche.geography.trim();
  if (geo) parts.push(geo);

  const audience = params.niche.audience.trim();
  if (audience) parts.push(`for ${audience}`);

  const goal = params.campaignGoal?.trim();
  if (goal) parts.push(goal.slice(0, 120));

  const newsIntent = isNewsIntent(
    params.searchHint,
    params.hint,
    params.campaignGoal,
    params.campaignHint
  );
  if (newsIntent) {
    parts.push(`breaking news headlines today ${year}`);
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
