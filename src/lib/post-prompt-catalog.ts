import { SOCIAL_POST_FORMAT_INSTRUCTIONS } from "@/lib/openai/sanitize-post-text";

export const AUTO_POST_PROMPT_STYLE_ID = "auto";
export const DEFAULT_POST_PROMPT_STYLE_ID = "standard-social";

export type PostPromptStyle = {
  id: string;
  label: string;
  description: string;
  expertRole: string;
  /** Injected into the user message — defines sections and depth */
  structureTemplate: string;
  minBodyChars: number;
  maxOutputTokens: number;
  matchPatterns: RegExp[];
};

export const POST_PROMPT_STYLES: PostPromptStyle[] = [
  {
    id: "standard-social",
    label: "Standard social post",
    description: "Concise, engaging post suited for typical social feeds.",
    expertRole: "expert social media strategist",
    structureTemplate: `Write a focused social post with a strong hook, clear value, and a natural close.
Keep it readable in one scroll — no filler.`,
    minBodyChars: 0,
    maxOutputTokens: 2048,
    matchPatterns: [],
  },
  {
    id: "news-roundup",
    label: "Recent news roundup",
    description:
      "Digest of the latest headlines from live web research — 5–10 distinct stories with context.",
    expertRole:
      "senior crypto and blockchain news editor who curates today's most important headlines for a smart general audience",
    structureTemplate: `Write a timely news roundup post about: {{subject}}

Campaign intent: {{goal}}

Required structure (plain-text section headings on their own line):

HOOK
One compelling opening line on why today's news matters for this audience.

TOP STORIES
Cover 5–8 DISTINCT recent headlines pulled from the web research block. For each story:
- Start with a clear headline (paraphrase the source, do not copy verbatim)
- 1–2 sentences summarizing what happened
- One line on why it matters for crypto/blockchain watchers

Use only stories supported by web research. Skip any headline you cannot verify from the research block.

MARKET MOOD (optional, if research supports it)
Brief read on overall sentiment — regulation, majors, DeFi, ETFs, etc.

BOTTOM LINE
2–3 sentences synthesizing the day's narrative.

Quality bar:
- Minimum {{minBodyChars}} characters in the body (before hashtags).
- Every story must trace to web research — never invent events, prices, or dates.
- Prefer the most recent sources in the research block.
- Write in the same language as the brief when the brief is not in English.`,
    minBodyChars: 900,
    maxOutputTokens: 4096,
    matchPatterns: [
      /actualit/i,
      /\bnews\b/i,
      /headlines?/i,
      /roundup/i,
      /r[eé]cent/i,
      /breaking/i,
      /derni[eè]res?\s+nouvelles/i,
      /fil d.?actualit/i,
      /aujourd.?hui/i,
      /today'?s?\s+(?:news|headlines)/i,
    ],
  },
  {
    id: "crypto-market-analysis",
    label: "Crypto market analysis (expert)",
    description:
      "In-depth analyst-style breakdown: price context, catalysts, risks, and outlook. 1,200+ characters.",
    expertRole:
      "senior crypto research analyst who writes institutional-grade market notes for sophisticated retail investors",
    structureTemplate: `Write a DETAILED market analysis post for: {{subject}}

Campaign intent: {{goal}}

Required structure (use these section labels as plain-text headings on their own line):

MARKET SNAPSHOT
Open with a compelling hook, then cover current price context, recent performance (24h/7d if research supports it), market cap tier, and volume/liquidity read. Cite specific figures when web research provides them.

NARRATIVE & CATALYSTS
Explain what is driving attention right now — upgrades, partnerships, regulation, macro, ecosystem growth, ETF flows, etc. Connect cause and effect like a researcher, not a hype account.

STRUCTURE & TECHNICAL READ
Provide a thoughtful technical or structural read (trend, key levels, dominance, correlation) without overclaiming precision. Frame as observation, not a trading signal.

FUNDAMENTALS & ON-CHAIN (if relevant)
Briefly address utility, adoption metrics, developer activity, or tokenomics only when material to the thesis.

RISKS & WATCHPOINTS
Balanced bear-case or monitoring items — what could invalidate the narrative.

BOTTOM LINE
Clear analyst takeaway in 2–4 sentences.

DISCLAIMER
One short line: not financial advice; do your own research.

Quality bar:
- Minimum {{minBodyChars}} characters in the body (before hashtags).
- Write like a published research note adapted for social — substantive paragraphs, not bullet spam.
- Use web research for timely data; if a metric is unknown, say so instead of inventing numbers.
- Cover ONLY {{subject}} — do not discuss other assets.`,
    minBodyChars: 1200,
    maxOutputTokens: 4096,
    matchPatterns: [
      /market\s*anal/i,
      /analyse?\s+(?:de\s+)?march/i,
      /price\s*action/i,
      /technical\s*anal/i,
      /crypto\s*research/i,
      /token\s*research/i,
      /detailed?\s+(?:market|crypto)/i,
      /detailled?\s+(?:market|crypto)/i,
    ],
  },
  {
    id: "expert-research-brief",
    label: "Expert research brief",
    description:
      "Long-form research-style post with thesis, evidence, risks, and conclusion.",
    expertRole:
      "principal analyst at a research firm who synthesizes complex topics into authoritative briefs",
    structureTemplate: `Write an expert research brief about: {{subject}}

Campaign intent: {{goal}}

Structure (plain-text section headings):

THESIS
State the core argument or framing in 2–3 sentences.

KEY FINDINGS
3–5 substantive paragraphs with evidence, data points, and context from research. Explain mechanisms and implications.

COUNTERPOINTS
What skeptics would say — address fairly.

IMPLICATIONS
What this means for the audience practically.

CONCLUSION
Synthesized takeaway.

Minimum {{minBodyChars}} characters in the body. Expert tone — precise, nuanced, no fluff.`,
    minBodyChars: 1000,
    maxOutputTokens: 4096,
    matchPatterns: [
      /research\s*brief/i,
      /deep\s*dive/i,
      /in[- ]depth/i,
      /expert\s*anal/i,
      /detailed?\s+analysis/i,
    ],
  },
  {
    id: "educational-explainer",
    label: "Educational explainer",
    description:
      "Structured lesson-style post that teaches one concept thoroughly.",
    expertRole: "educator and subject-matter expert who makes complex topics accessible",
    structureTemplate: `Teach the audience about: {{subject}}

Campaign intent: {{goal}}

Structure:
- Hook: why this matters now
- Core concept explained clearly
- Example or analogy
- Common misconception to correct
- Actionable takeaway

Minimum {{minBodyChars}} characters. Thorough but readable — like a mini-article.`,
    minBodyChars: 800,
    maxOutputTokens: 3072,
    matchPatterns: [
      /educat/i,
      /explain/i,
      /how\s+(?:it|to)\s+works/i,
      /guide\s+to/i,
      /tutorial/i,
      /learn\s+about/i,
    ],
  },
  {
    id: "list-item-spotlight",
    label: "List item spotlight",
    description:
      "One list item per post — applies the campaign goal with depth and focus.",
    expertRole:
      "specialist content strategist who delivers focused, high-value coverage of a single topic",
    structureTemplate: `This post covers ONE item from a list: {{subject}}

Campaign intent (apply fully to this item): {{goal}}

Requirements:
- The entire post is about {{subject}} only.
- Deliver the campaign intent at professional depth — not a shallow summary.
- Include specific details, context, and insight from research where relevant.
- Minimum {{minBodyChars}} characters in the body.
- Post {{slotNum}} of {{totalPosts}} in the series — do not mention other list items.`,
    minBodyChars: 900,
    maxOutputTokens: 3072,
    matchPatterns: [],
  },
];

export function getPostPromptStyle(id: string): PostPromptStyle {
  return (
    POST_PROMPT_STYLES.find((s) => s.id === id) ??
    POST_PROMPT_STYLES.find((s) => s.id === DEFAULT_POST_PROMPT_STYLE_ID)!
  );
}

export type ResolvePostPromptStyleParams = {
  styleId?: string | null;
  campaignGoal: string;
  isListMode?: boolean;
  listSubject?: string;
};

/** Pick template from explicit id or infer from campaign goal / list mode. */
export function resolvePostPromptStyle(
  params: ResolvePostPromptStyleParams
): PostPromptStyle {
  const explicit = params.styleId?.trim();
  if (explicit && explicit !== AUTO_POST_PROMPT_STYLE_ID) {
    return getPostPromptStyle(explicit);
  }

  const goal = params.campaignGoal.trim();
  const goalLower = goal.toLowerCase();
  const isCryptoContext =
    params.isListMode ||
    /crypto|bitcoin|ethereum|token|coin|blockchain|defi|altcoin/i.test(goalLower) ||
    (params.listSubject
      ? /^(?:\$?[A-Z]{2,10}|[A-Za-z]+(?:\s+[A-Za-z]+)?)$/.test(
          params.listSubject.trim()
        )
      : false);

  for (const style of POST_PROMPT_STYLES) {
    if (style.id === DEFAULT_POST_PROMPT_STYLE_ID) continue;
    if (style.matchPatterns.some((re) => re.test(goal))) {
      if (style.id === "crypto-market-analysis" && !isCryptoContext) continue;
      return style;
    }
  }

  if (params.isListMode) {
    return getPostPromptStyle("list-item-spotlight");
  }

  return getPostPromptStyle(DEFAULT_POST_PROMPT_STYLE_ID);
}

export type PostPromptTemplateVars = {
  subject: string;
  goal: string;
  slotNum: number;
  totalPosts: number;
  minBodyChars: number;
};

export function fillPostPromptTemplate(
  template: string,
  vars: PostPromptTemplateVars
): string {
  return template
    .replace(/\{\{subject\}\}/g, vars.subject)
    .replace(/\{\{goal\}\}/g, vars.goal)
    .replace(/\{\{slotNum\}\}/g, String(vars.slotNum))
    .replace(/\{\{totalPosts\}\}/g, String(vars.totalPosts))
    .replace(/\{\{minBodyChars\}\}/g, String(vars.minBodyChars));
}

export function buildPostPromptStructureBlock(
  style: PostPromptStyle,
  vars: Omit<PostPromptTemplateVars, "minBodyChars">
): string {
  return fillPostPromptTemplate(style.structureTemplate, {
    ...vars,
    minBodyChars: style.minBodyChars,
  });
}

export function buildPostPromptTaskInstructions(style: PostPromptStyle): string {
  const depthNote =
    style.minBodyChars > 0
      ? `The body MUST be at least ${style.minBodyChars} characters — write long-form, expert-quality prose.`
      : "Keep the post appropriately concise for social media.";

  return [
    `You are ${style.expertRole}.`,
    'Return JSON only: {"title":"...","body":"...","hashtags":"#a #b"}.',
    depthNote,
    "Use current web research when the brief requires facts, prices, or recent events.",
    "Title: clear and specific (asset/topic name + angle).",
    "Hashtags: 3–6 relevant tags, or fewer for professional analysis posts.",
    SOCIAL_POST_FORMAT_INSTRUCTIONS,
  ].join(" ");
}
