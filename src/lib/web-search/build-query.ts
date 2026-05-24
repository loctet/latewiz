import type { NicheProfile } from "@/lib/openai/types";

export type ContentResearchParams = {
  niche: NicheProfile;
  hint?: string;
  campaignGoal?: string;
  campaignHint?: string;
  slotIndex?: number;
  totalPosts?: number;
  trendSnippets?: string[];
};

/** Build a search query aimed at recent, niche-relevant information. */
export function buildContentResearchQuery(params: ContentResearchParams): string {
  const parts: string[] = [];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  parts.push(`latest news trends ${year} ${month}`);

  const topic = params.niche.topic.trim();
  if (topic) parts.push(topic);

  const geo = params.niche.geography.trim();
  if (geo) parts.push(geo);

  const audience = params.niche.audience.trim();
  if (audience) parts.push(`for ${audience}`);

  const goal = params.campaignGoal?.trim();
  if (goal) parts.push(goal.slice(0, 120));

  const hint = params.hint?.trim() || params.campaignHint?.trim();
  if (hint) parts.push(hint.slice(0, 160));

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

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}
