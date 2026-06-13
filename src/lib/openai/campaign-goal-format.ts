export type CampaignGoalFormat = "micro" | "standard";

export type CampaignGoalConstraints = {
  format: CampaignGoalFormat;
  maxBodyChars: number | null;
  wantsQuote: boolean;
  isMorningGreeting: boolean;
  isMotivational: boolean;
  /** Skip web search — avoids pulling generic educational facts that override the goal */
  skipWebSearch: boolean;
};

/** Parse format constraints embedded in the user's campaign goal text. */
export function parseCampaignGoalConstraints(goal: string): CampaignGoalConstraints {
  const trimmed = goal.trim();

  const charLimitMatch = trimmed.match(
    /(?:moins\s+de|under|max(?:imum)?|at most|≤|<\s*)\s*(\d+)\s*(?:charact\w*|caract\w*|chars?)?/i
  );
  const nearCharMatch = trimmed.match(/(\d+)\s*(?:charact\w*|caract\w*)/i);
  const maxBodyChars = charLimitMatch
    ? Math.min(500, parseInt(charLimitMatch[1], 10))
    : nearCharMatch
      ? Math.min(500, parseInt(nearCharMatch[1], 10))
      : null;

  const isMorningGreeting =
    /\b(bonjour|good\s+morning|matin(?:ée?)?|morning|commencer\s+la\s+journ|start\s+the\s+day)/i.test(
      trimmed
    );
  const isMotivational =
    /\b(motivation|motivant|espoir|hope|inspir(?:ation|ant|er)?|encourag)/i.test(trimmed);
  const wantsQuote = /\b(citation|quote|citer|proverbe)/i.test(trimmed);

  const isMicroByLength = maxBodyChars !== null && maxBodyChars <= 150;
  const format: CampaignGoalFormat =
    isMicroByLength || (isMorningGreeting && isMotivational) ? "micro" : "standard";

  const skipWebSearch =
    format === "micro" && (isMotivational || isMorningGreeting);

  return {
    format,
    maxBodyChars,
    wantsQuote,
    isMorningGreeting,
    isMotivational,
    skipWebSearch,
  };
}

export function buildGoalPriorityInstructions(
  goal: string,
  constraints: CampaignGoalConstraints
): string {
  const lines = [
    "CRITICAL: The campaign goal below defines the FORMAT, STYLE, LENGTH, and PURPOSE of every post.",
    "Follow the goal literally. The niche topic is only background context — do NOT default to educational explainers unless the goal explicitly asks for them.",
    `Campaign goal: ${goal.trim()}`,
  ];

  if (constraints.format === "micro") {
    lines.push(
      "This is a MICRO-POST campaign: each body is one short paragraph, not an article or explainer.",
      constraints.isMorningGreeting
        ? "Each post MUST open with a morning greeting (e.g. Bonjour / Good morning) and set a positive tone for the day."
        : "",
      constraints.isMotivational
        ? "Tone: warm, hopeful, motivational — never dry, technical, or definitional."
        : "",
      constraints.maxBodyChars
        ? `STRICT LENGTH: body must be at most ${constraints.maxBodyChars} characters (including spaces). Count carefully.`
        : "",
      constraints.wantsQuote
        ? "Some posts (not all) may include a short attributed quote — vary which days include one."
        : "Do NOT write textbook definitions of blockchain/crypto — write human, uplifting messages."
    );
  }

  return lines.filter(Boolean).join("\n");
}

export function buildOutlineStrategyInstructions(
  constraints: CampaignGoalConstraints,
  totalPosts: number
): string {
  if (constraints.format === "micro") {
    return [
      `Plan exactly ${totalPosts} DISTINCT daily micro-messages following the campaign goal.`,
      "Each beat = one unique motivational theme for that day (gratitude, patience, resilience, community, innovation, hope, quote-of-the-day, etc.).",
      "Do NOT plan educational arcs, definitions, or 'knowledge building' — plan emotional variety.",
      "No two beats may share the same theme, greeting angle, or quote.",
      constraints.wantsQuote
        ? "Assign ~every 3rd beat as a quote day; other beats use original motivational lines."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Return exactly ${totalPosts} beats in order. Each beat is ONE post's unique focus.`,
    "Progress from hook/foundation → deeper knowledge → practical application → conclusion/CTA.",
    "No two beats may share the same subtopic, angle, or key point.",
  ].join("\n");
}

export function buildSlotFormatInstructions(
  constraints: CampaignGoalConstraints
): string {
  if (constraints.format !== "micro") return "";

  return [
    "MICRO-POST rules (mandatory):",
    constraints.isMorningGreeting
      ? "- Start with a morning greeting appropriate to the post language."
      : "",
    constraints.isMotivational
      ? "- Write motivation and hope, not blockchain/crypto lectures or definitions."
      : "",
    constraints.maxBodyChars
      ? `- Body length: maximum ${constraints.maxBodyChars} characters total.`
      : "",
    constraints.wantsQuote
      ? "- If this beat is a quote day, include one short attributed quote; otherwise write an original line."
      : "",
    "- Hashtags: 0–3 short tags, or empty string if the goal implies none.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function enforceBodyLength(body: string, maxChars: number | null): string {
  if (!maxChars || body.length <= maxChars) return body;
  const cut = body.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

export function normalizeBodyForCompare(body: string): string {
  return body.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isDuplicateBody(
  body: string,
  previous: { body: string }[]
): boolean {
  const norm = normalizeBodyForCompare(body);
  if (!norm) return false;
  return previous.some((p) => normalizeBodyForCompare(p.body) === norm);
}
