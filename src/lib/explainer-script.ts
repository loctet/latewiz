/**
 * Scene script for a branded explainer video. Produced by the LLM, stored on
 * the campaign slot or render job, enriched by the render worker (images,
 * voiceover timing) and passed as JSON to video-templates/explainer.
 * Shared by client, server and the render worker.
 */

export const EXPLAINER_SCENE_TYPES = [
  "hook",
  "illustration",
  "steps",
  "bullets",
  "stat",
  "compare",
  "quote",
] as const;

export type ExplainerSceneType = (typeof EXPLAINER_SCENE_TYPES)[number];

export type ExplainerScene = {
  type: ExplainerSceneType;
  /** Spoken voiceover for this scene (1–3 short sentences) */
  narration: string;
  /** On-screen headline, max ~6 words */
  heading: string;
  /** steps / bullets: 2–4 items, max ~5 words each */
  items?: string[];
  /** stat: the number, e.g. "73%", "3x", "$2M" */
  value?: string;
  /** stat: what the number means */
  label?: string;
  /** compare: left and right labels */
  left?: string;
  right?: string;
  /** quote: author */
  author?: string;
  /** Prompt for this scene's illustration (b-roll) */
  imagePrompt: string;
  /** Filled by the render worker: image file name in the render project */
  image?: string;
  /** Filled by the render worker: timing in seconds */
  start?: number;
  duration?: number;
  /** Filled by the render worker: voiceover length for this scene */
  audioDuration?: number;
};

export type ExplainerScript = {
  scenes: ExplainerScene[];
};

export const EXPLAINER_MIN_SCENES = 4;
export const EXPLAINER_MAX_SCENES = 8;
/** Every explainer is at least this long. */
export const EXPLAINER_MIN_SECONDS = 30;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function list(value: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(value)
    ? value.map((i) => str(i, maxLen)).filter(Boolean).slice(0, maxItems)
    : [];
}

/** Map older script shapes ("title", "text") onto the current one. */
function legacyType(type: unknown): ExplainerSceneType | null {
  if (type === "title") return "hook";
  return EXPLAINER_SCENE_TYPES.find((t) => t === type) ?? null;
}

/** Drop invalid scenes and clamp text so the template layout cannot overflow. */
export function normalizeExplainerScript(raw: unknown): ExplainerScript | null {
  const scenesRaw =
    raw && typeof raw === "object" && Array.isArray((raw as ExplainerScript).scenes)
      ? (raw as ExplainerScript).scenes
      : Array.isArray(raw)
        ? (raw as unknown[])
        : null;
  if (!scenesRaw) return null;

  const scenes: ExplainerScene[] = [];
  for (const item of scenesRaw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const type = legacyType(s.type);
    if (!type) continue;

    const heading = str(s.heading, 60) || str(s.text, 60) || str(s.label, 60);
    const items = list(s.items, 4, 40);
    const value = str(s.value, 10);
    const label = str(s.label, 70);
    const left = str(s.left, 30);
    const right = str(s.right, 30);
    const narration =
      str(s.narration, 320) ||
      [heading, str(s.sub, 140), items.join(". "), label, str(s.text, 140)]
        .filter(Boolean)
        .join(". ");
    if (!narration) continue;

    if ((type === "steps" || type === "bullets") && items.length < 2) continue;
    if (type === "stat" && !value) continue;
    if (type === "compare" && (!left || !right)) continue;

    const scene: ExplainerScene = {
      type,
      narration,
      heading: heading || narration.split(/[.!?]/)[0].slice(0, 60),
      imagePrompt: str(s.imagePrompt, 400) || heading || narration.slice(0, 200),
    };
    if (items.length) scene.items = items;
    if (value) scene.value = value;
    if (label) scene.label = label;
    if (left) scene.left = left;
    if (right) scene.right = right;
    const author = str(s.author, 50);
    if (author) scene.author = author;
    // Worker-filled fields survive a round trip.
    if (typeof s.image === "string" && /^[\w.-]+$/.test(s.image)) scene.image = s.image;
    for (const key of ["start", "duration", "audioDuration"] as const) {
      const n = Number(s[key]);
      if (Number.isFinite(n) && n >= 0) scene[key] = n;
    }
    scenes.push(scene);
    if (scenes.length >= EXPLAINER_MAX_SCENES) break;
  }
  return scenes.length > 0 ? { scenes } : null;
}

const HEADING_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "for",
  "by", "with", "is", "are", "your", "my", "i", "you", "that", "this",
]);

/** Short headline from a sentence: up to 6 words, never ending on a filler word. */
function shortHeading(sentence: string): string {
  const clause = sentence.split(/[:;,.!?—–]/)[0].trim() || sentence;
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 6);
  while (words.length > 2 && HEADING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ").replace(/[^\p{L}\p{N}%$'’\s-]+$/u, "");
}

/**
 * Fallback script built from post copy when the LLM is unavailable: the post
 * is split into sentences, paired into scenes, with a stat scene when a
 * sentence carries a number. Kept short on screen; narration holds the text.
 */
export function explainerScriptFromPost(post: {
  title?: string;
  body?: string;
}): ExplainerScript {
  const sentences = (post.body ?? "")
    .replace(/#[\w-]+/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length > 8);
  const title = (post.title ?? "").trim();
  if (sentences.length === 0) sentences.push(title || "Quick explainer");

  const [first, ...rest] = sentences;
  const scenes: ExplainerScene[] = [
    { type: "hook", heading: shortHeading(first), narration: first, imagePrompt: first },
  ];

  // Two sentences per scene keeps scenes ~5–7s instead of flashing by.
  for (let i = 0; i < rest.length && scenes.length < EXPLAINER_MAX_SCENES; i += 2) {
    const pair = rest.slice(i, i + 2);
    const narration = pair.join(" ");
    const numberMatch = /(\$?\d[\d.,]*\s?(%|x|k|m|days?|hours?|weeks?|years?)?)/i.exec(narration);
    if (numberMatch && !scenes.some((s) => s.type === "stat")) {
      const sentenceWithNumber = pair.find((p) => p.includes(numberMatch[1])) ?? pair[0];
      scenes.push({
        type: "stat",
        heading: shortHeading(pair[0]),
        value: numberMatch[1].replace(/\s+/g, "").slice(0, 8),
        label: sentenceWithNumber.split(/\s+/).slice(0, 8).join(" "),
        narration,
        imagePrompt: narration,
      });
    } else {
      scenes.push({
        type: "illustration",
        heading: shortHeading(pair[0]),
        narration,
        imagePrompt: narration,
      });
    }
  }
  return normalizeExplainerScript({ scenes }) ?? { scenes };
}
