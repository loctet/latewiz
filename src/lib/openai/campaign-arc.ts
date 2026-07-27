import type { PreviousCampaignPost } from "./types";
import type { CampaignGoalConstraints } from "./campaign-goal-format";

export type CampaignSlotBrief = {
  slotIndex: number;
  phase: "intro" | "build" | "deepen" | "apply" | "close";
  beat: string;
  subtopic: string;
  angle: string;
  keyPoint: string;
  searchHint: string;
};

export type CampaignOutlineBeat = {
  subtopic: string;
  angle: string;
  keyPoint: string;
  searchHint: string;
};

const BEAT_TYPES = [
  "hook / pattern interrupt",
  "foundational concept",
  "common myth to debunk",
  "step-by-step how-to",
  "real-world example or case study",
  "data point or trend",
  "audience question / poll",
  "expert insight angle",
  "comparison or framework",
  "actionable checklist",
  "objection handling",
  "social proof",
  "recap of progress so far",
  "soft call-to-action",
] as const;

const MICRO_MOTIVATION_THEMES = [
  "gratitude — appreciate the journey",
  "hope — brighter days ahead",
  "patience — trust the process",
  "resilience — bounce back stronger",
  "community — we rise together",
  "curiosity — keep learning with joy",
  "courage — take the next small step",
  "famous quote — attributed wisdom",
  "celebrate small wins",
  "mindfulness — present moment focus",
  "innovation — build the future",
  "kindness — lift someone up",
  "perspective — zoom out, breathe",
  "energy — seize the morning",
] as const;

function phaseForSlot(slotIndex: number, totalPosts: number): CampaignSlotBrief["phase"] {
  if (totalPosts <= 1) return "intro";
  const progress = slotIndex / (totalPosts - 1);
  if (progress < 0.15) return "intro";
  if (progress < 0.4) return "build";
  if (progress < 0.7) return "deepen";
  if (progress < 0.9) return "apply";
  return "close";
}

export function assignFallbackSlotBrief(
  slotIndex: number,
  totalPosts: number,
  campaignGoal: string,
  constraints?: CampaignGoalConstraints
): CampaignSlotBrief {
  const goal = campaignGoal.trim() || "Grow audience engagement";
  const slotNum = slotIndex + 1;

  if (constraints?.format === "micro") {
    const theme = MICRO_MOTIVATION_THEMES[slotIndex % MICRO_MOTIVATION_THEMES.length];
    const isQuoteDay =
      constraints.wantsQuote && slotIndex % 3 === 2;
    return {
      slotIndex,
      phase: phaseForSlot(slotIndex, totalPosts),
      beat: isQuoteDay ? "inspirational quote" : "morning motivation",
      subtopic: theme,
      angle: isQuoteDay
        ? "Short attributed quote + brief morning greeting"
        : `Original motivational morning line — theme: ${theme}`,
      keyPoint: `Unique day-${slotNum} message: ${theme}. Must differ from all prior posts.`,
      searchHint: isQuoteDay
        ? `inspirational quote ${goal.slice(0, 60)}`.trim()
        : "",
    };
  }

  const beat = BEAT_TYPES[slotIndex % BEAT_TYPES.length];

  return {
    slotIndex,
    phase: phaseForSlot(slotIndex, totalPosts),
    beat,
    subtopic: `Knowledge area ${slotNum} toward: ${goal.slice(0, 100)}`,
    angle: beat,
    keyPoint: `Deliver one distinct insight (post ${slotNum}/${totalPosts}) that advances: ${goal.slice(0, 120)}`,
    searchHint: `${goal.slice(0, 80)} ${beat}`,
  };
}

export function outlineBeatToSlotBrief(
  slotIndex: number,
  totalPosts: number,
  beat: CampaignOutlineBeat
): CampaignSlotBrief {
  return {
    slotIndex,
    phase: phaseForSlot(slotIndex, totalPosts),
    beat: beat.angle.trim() || BEAT_TYPES[slotIndex % BEAT_TYPES.length],
    subtopic: beat.subtopic.trim(),
    angle: beat.angle.trim(),
    keyPoint: beat.keyPoint.trim(),
    searchHint: beat.searchHint.trim() || beat.subtopic.trim(),
  };
}

export function formatPriorPostsBlock(posts: PreviousCampaignPost[]): string {
  if (posts.length === 0) {
    return "No previous posts yet — this is the opening post for the campaign.";
  }

  const sections = posts.map((p, i) => {
    const body = p.body.slice(0, 800);
    const truncated = p.body.length > 800 ? `${body}…` : body;
    return [
      `--- Post ${i + 1} ---`,
      `Title: ${p.title}`,
      `Body:\n${truncated}`,
      p.hashtags ? `Hashtags: ${p.hashtags}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const openings = posts
    .map((p) => p.body.split(/[.!?]/)[0]?.trim().slice(0, 120))
    .filter(Boolean)
    .map((s) => `"${s}"`);

  return [
    sections.join("\n\n"),
    "",
    "FORBIDDEN TO REUSE (already covered in prior posts):",
    `- Opening hooks/lines: ${openings.join("; ")}`,
    "- Same statistics, examples, citations, or core arguments",
    "- Same hashtag set verbatim",
    "Add the NEXT layer of value — do not reintroduce or restate prior posts.",
  ].join("\n");
}

export function formatSlotBriefBlock(brief: CampaignSlotBrief): string {
  return [
    "Assigned focus for THIS post only (mandatory — do not cover other campaign beats):",
    `- Campaign phase: ${brief.phase}`,
    `- Subtopic: ${brief.subtopic}`,
    `- Angle / beat: ${brief.angle}`,
    `- Key point to land: ${brief.keyPoint}`,
  ].join("\n");
}

export function slotBriefToAiInstruction(brief: CampaignSlotBrief): string {
  return `Subtopic: ${brief.subtopic}. Angle: ${brief.angle}. Key point: ${brief.keyPoint}`;
}

/** Non-empty lines from a user-provided list (one item per post). */
export function parseCampaignListItems(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Slot brief when each list line maps to exactly one post. */
export function assignListItemSlotBrief(
  listItem: string,
  slotIndex: number,
  totalPosts: number,
  campaignGoal: string
): CampaignSlotBrief {
  const item = listItem.trim();
  const goal = campaignGoal.trim() || "In-depth coverage";
  const isMarketAnalysis =
    /market\s*anal|analyse?\s+(?:de\s+)?march|detail+ed?\s+market|24\s*h(?:eurs?)?|derni[eè]res?\s+24|last\s+24|past\s+24/i.test(
      goal
    );
  return {
    slotIndex,
    phase: phaseForSlot(slotIndex, totalPosts),
    beat: "list item focus",
    subtopic: item,
    angle: isMarketAnalysis
      ? `Expert 24h market analysis for ${item}`
      : `${goal} — dedicated to ${item}`,
    keyPoint: isMarketAnalysis
      ? `Institutional-quality 24h market analysis for ${item}: price context, catalysts, structured read, risks, and outlook. Cover ONLY ${item}. Synthesize multiple sources — never a thin key-facts digest.`
      : `Write ${goal.toLowerCase()} for ${item} only. Do not cover other assets or topics from the list.`,
    searchHint: isMarketAnalysis
      ? `${item} last 24 hours market analysis price catalysts news`
      : `${item} ${goal} latest developments`,
  };
}
