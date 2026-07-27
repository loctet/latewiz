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

/** User-created styles (metadata only; template text lives in postPromptTemplates). */
export type CustomPostPromptStyle = {
  id: string;
  label: string;
  description: string;
  expertRole?: string;
  minBodyChars?: number;
  maxOutputTokens?: number;
};

export const CUSTOM_POST_PROMPT_TEMPLATE_STARTER = `Write a post about: {{subject}}

Campaign intent: {{goal}}

Required structure (plain-text section headings on their own line):

HOOK
One compelling opening line.

BODY
Develop the idea with clear paragraphs. Use web research for timely facts when relevant.

BOTTOM LINE
2–3 sentence takeaway.

Quality bar:
- Minimum {{minBodyChars}} characters in the body (before hashtags).
- Cover ONLY {{subject}} unless the goal says otherwise.
- Write in the same language as the brief when the brief is not in English.`;

export function isBuiltinPostPromptStyle(styleId: string): boolean {
  return POST_PROMPT_STYLES.some((s) => s.id === styleId);
}

export function createCustomPostPromptStyleId(
  label: string,
  existingIds: Iterable<string>
): string {
  const taken = new Set(existingIds);
  const slug =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "template";
  let id = `custom-${slug}`;
  let n = 2;
  while (taken.has(id)) {
    id = `custom-${slug}-${n}`;
    n += 1;
  }
  return id;
}

export function getAllPostPromptStyles(
  custom: CustomPostPromptStyle[] = []
): PostPromptStyle[] {
  return [
    ...POST_PROMPT_STYLES,
    ...custom.map((style) => customPostStyleToFull(style)),
  ];
}

function customPostStyleToFull(
  style: CustomPostPromptStyle,
  templateOverride?: string | null
): PostPromptStyle {
  return {
    id: style.id,
    label: style.label,
    description: style.description,
    expertRole:
      style.expertRole?.trim() ||
      "expert content strategist who writes clear, high-value social posts",
    structureTemplate:
      templateOverride?.trim() || CUSTOM_POST_PROMPT_TEMPLATE_STARTER,
    minBodyChars: style.minBodyChars ?? 900,
    maxOutputTokens: style.maxOutputTokens ?? 3072,
    matchPatterns: [],
  };
}

export function normalizeCustomPostPromptStyles(
  raw: unknown
): CustomPostPromptStyle[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomPostPromptStyle[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!id || !label) continue;
    out.push({
      id,
      label,
      description:
        typeof r.description === "string" ? r.description.trim() : "",
      expertRole:
        typeof r.expertRole === "string" ? r.expertRole.trim() : undefined,
      minBodyChars:
        typeof r.minBodyChars === "number" && Number.isFinite(r.minBodyChars)
          ? Math.max(0, Math.floor(r.minBodyChars))
          : undefined,
      maxOutputTokens:
        typeof r.maxOutputTokens === "number" &&
        Number.isFinite(r.maxOutputTokens)
          ? Math.max(256, Math.floor(r.maxOutputTokens))
          : undefined,
    });
  }
  return out;
}

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
      "senior news editor who curates today's most important headlines for a smart audience in this niche",
    structureTemplate: `Write a timely news roundup post about: {{subject}}

Campaign intent: {{goal}}

Required structure (plain-text section headings on their own line):

HOOK
One compelling opening line on why today's news matters for this audience.

TOP STORIES
Cover 5–8 DISTINCT recent headlines pulled from the web research block. For each story:
- Start with a clear headline (paraphrase the source, do not copy verbatim)
- 1–2 sentences summarizing what happened
- One line on why it matters for people who follow this topic

Use only stories supported by web research. Skip any headline you cannot verify from the research block.

MOOD (optional, if research supports it)
Brief read on overall sentiment in this niche.

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
    label: "Market analysis (expert)",
    description:
      "In-depth analyst-style breakdown: context, catalysts, risks, and outlook. Works for any niche (markets, science, product, policy).",
    expertRole:
      "senior research analyst who writes institutional-grade notes for a sophisticated audience in this niche",
    structureTemplate: `Write a DETAILED institutional-grade analysis post for: {{subject}}

Campaign intent: {{goal}}

Required structure (use these section labels as plain-text headings on their own line):

SNAPSHOT
2–4 dense sentences: where {{subject}} stands now (level, % move over the relevant window when research supports it), what changed, and why it matters. Lead with analysis — not a press-release paraphrase.

NARRATIVE & CATALYSTS
Explain what is driving the move — flows, news, macro, regulation, product, or sentiment. Connect cause and effect. Synthesize across sources; do not invent catalysts.

STRUCTURED READ
Levels, momentum, or relative strength as observation only — no fake precision or guaranteed outcomes.

FUNDAMENTALS (if relevant)
Underlying drivers only when material to the thesis.

RISKS & WATCHPOINTS
What would invalidate the narrative; key levels or events to watch next.

BOTTOM LINE
Clear analyst takeaway in 2–4 sentences. No rhetorical question to the reader.

DISCLAIMER
One short line: not professional advice; do your own research.

Hard bans (these make the post look amateur):
- Do NOT write a thin "Faits clés" / "Key facts" numbered digest that restates one article.
- Do NOT paste parenthetical domains like (kucoin.com) or (coindesk.com) in the body.
- Do NOT open with a generic one-liner then repeat the same claim as "fact 1".
- Do NOT digress into unrelated assets unless {{goal}} explicitly asks for a cross-market view.

Quality bar:
- Minimum {{minBodyChars}} characters in the body (before hashtags).
- Write like a published research note adapted for social — substantive paragraphs.
- Use web research for timely data; if a metric is unknown, say so instead of inventing numbers.
- Cover ONLY {{subject}} unless the goal requires otherwise.`,
    minBodyChars: 1400,
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
      /expert\s+(?:market|analysis)/i,
      /institutional[- ]?grade/i,
      /24\s*h(?:eurs?)?/i,
      /derni[eè]res?\s+24/i,
      /last\s+24/i,
      /past\s+24/i,
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

export function getPostPromptStyle(
  id: string,
  custom: CustomPostPromptStyle[] = [],
  templateOverrides?: Record<string, string> | null
): PostPromptStyle {
  const builtin = POST_PROMPT_STYLES.find((s) => s.id === id);
  if (builtin) return builtin;

  const meta = custom.find((s) => s.id === id);
  if (meta) {
    return customPostStyleToFull(meta, templateOverrides?.[id]);
  }

  // Template-only fallback (e.g. deferred campaign without metadata)
  const override = templateOverrides?.[id]?.trim();
  if (override) {
    return customPostStyleToFull(
      {
        id,
        label: id,
        description: "Custom post template",
      },
      override
    );
  }

  return POST_PROMPT_STYLES.find((s) => s.id === DEFAULT_POST_PROMPT_STYLE_ID)!;
}

export type ResolvePostPromptStyleParams = {
  styleId?: string | null;
  campaignGoal: string;
  isListMode?: boolean;
  listSubject?: string;
  customStyles?: CustomPostPromptStyle[];
  templateOverrides?: Record<string, string> | null;
};

/** Pick template from explicit id or infer from campaign goal / list mode. */
export function resolvePostPromptStyle(
  params: ResolvePostPromptStyleParams
): PostPromptStyle {
  const explicit = params.styleId?.trim();
  if (explicit && explicit !== AUTO_POST_PROMPT_STYLE_ID) {
    return getPostPromptStyle(
      explicit,
      params.customStyles,
      params.templateOverrides
    );
  }

  const goal = params.campaignGoal.trim();

  for (const style of POST_PROMPT_STYLES) {
    if (style.id === DEFAULT_POST_PROMPT_STYLE_ID) continue;
    if (style.matchPatterns.some((re) => re.test(goal))) {
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
  vars: Omit<PostPromptTemplateVars, "minBodyChars">,
  templateOverride?: string | null
): string {
  const template = templateOverride?.trim() || style.structureTemplate;
  return fillPostPromptTemplate(template, {
    ...vars,
    minBodyChars: style.minBodyChars,
  });
}

export function getEffectivePostStructureTemplate(
  styleId: string,
  overrides?: Record<string, string> | null,
  custom: CustomPostPromptStyle[] = []
): string {
  const style = getPostPromptStyle(styleId, custom, overrides);
  const override = overrides?.[styleId]?.trim();
  return override || style.structureTemplate;
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
    "Use current web research when the brief requires facts, figures, or recent events.",
    "Title: clear and specific (topic + angle).",
    "Hashtags: 3–6 relevant tags, or fewer for professional analysis posts.",
    SOCIAL_POST_FORMAT_INSTRUCTIONS,
  ].join(" ");
}
