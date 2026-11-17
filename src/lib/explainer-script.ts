/**
 * Scene script for a branded explainer video. The LLM writes it, the render
 * worker adds timing (and optional background images), and the HyperFrames
 * template in video-templates/explainer turns each scene's `visual` into
 * animated icons, diagrams, charts and UI mocks. Shared by client, server
 * and worker.
 */
import { isExplainerIcon } from "@/lib/explainer-icons";

export const EXPLAINER_VISUAL_KINDS = [
  "icon-hero",
  "icon-row",
  "flow",
  "cycle",
  "compare",
  "equation",
  "analogy",
  "bar-chart",
  "line-chart",
  "stat",
  "pictogram",
  "checklist",
  "timeline",
  "chat",
  "phone",
  "code",
  "definition",
  "quote",
] as const;

export type ExplainerVisualKind = (typeof EXPLAINER_VISUAL_KINDS)[number];

export type IconLabel = { icon: string; label: string };

export type ExplainerVisual = {
  kind: ExplainerVisualKind;
  icon?: string;
  caption?: string;
  items?: IconLabel[];
  left?: { title: string; icon: string; points: string[] };
  right?: { title: string; icon: string; points: string[] };
  result?: IconLabel;
  bars?: Array<{ label: string; value: number }>;
  values?: number[];
  unit?: string;
  startLabel?: string;
  endLabel?: string;
  value?: string;
  label?: string;
  total?: number;
  highlight?: number;
  events?: Array<{ when: string; label: string }>;
  messages?: Array<{ side: "left" | "right"; text: string }>;
  lines?: string[];
  language?: string;
  term?: string;
  meaning?: string;
  text?: string;
  author?: string;
};

export type ExplainerScene = {
  /** Spoken voiceover (speakable: no links, handles, hashtags or emojis) */
  narration: string;
  /** On-screen headline, max ~6 words */
  heading: string;
  visual: ExplainerVisual;
  /** Optional background image prompt (only used when AI images are on) */
  imagePrompt?: string;
  /** Filled by the render worker */
  image?: string;
  start?: number;
  duration?: number;
  audioDuration?: number;
};

export type ExplainerScript = {
  scenes: ExplainerScene[];
  /** Requested video length in seconds */
  targetSeconds?: number;
};

export const EXPLAINER_DURATIONS = [
  { value: 30, label: "30 seconds" },
  { value: 45, label: "45 seconds" },
  { value: 60, label: "1 minute" },
  { value: 90, label: "1 min 30 s (recommended)" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
] as const;

export const DEFAULT_EXPLAINER_SECONDS = 90;
export const EXPLAINER_MIN_SECONDS = 30;
export const EXPLAINER_MAX_SECONDS = 180;
export const EXPLAINER_MAX_SCENES = 22;

export function clampExplainerSeconds(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EXPLAINER_SECONDS;
  return Math.round(Math.min(EXPLAINER_MAX_SECONDS, Math.max(EXPLAINER_MIN_SECONDS, n)));
}

/** Scene count that keeps each scene around 8–9 seconds. */
export function sceneCountFor(seconds: number): number {
  return Math.min(EXPLAINER_MAX_SCENES, Math.max(4, Math.round(seconds / 8.5)));
}

/**
 * Spoken words that fill the target length: the voice reads about 2.45
 * words/s, and each scene adds ~1.1s of lead/pause plus a 4s brand outro.
 */
export function wordBudgetFor(seconds: number): number {
  const speaking = seconds - 4 - sceneCountFor(seconds) * 1.1;
  return Math.max(40, Math.round(speaking * 2.45));
}

/**
 * Make text safe to read aloud: drop URLs, domains, @handles, hashtags,
 * emojis and markdown, and expand a few symbols TTS reads badly.
 */
export function toSpeakable(input: string): string {
  return input
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\b[\w-]+\.(com|org|net|io|ai|co|dev|app|fr|de|uk|me|ly|gg|tv|xyz)(\/\S*)?\b/gi, "")
    .replace(/(^|\s)@[\w.]+/g, "$1")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1")
    .replace(/\blink in (the )?bio\b/gi, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[*_`~>|[\]{}]/g, "")
    .replace(/\s&\s/g, " and ")
    .replace(/\be\.g\.\s?/gi, "for example ")
    .replace(/\bi\.e\.\s?/gi, "that is ")
    .replace(/\bvs\.?\s/gi, "versus ")
    .replace(/\s*->\s*/g, " to ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([,.!?]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function icon(value: unknown, fallback = "sparkles"): string {
  return isExplainerIcon(value) ? value : fallback;
}

function iconLabels(value: unknown, min: number, max: number, labelMax = 22): IconLabel[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((v) => ({ icon: icon((v as IconLabel)?.icon), label: str((v as IconLabel)?.label, labelMax) }))
    .filter((v) => v.label)
    .slice(0, max);
  return out.length >= min ? out : null;
}

function strings(value: unknown, min: number, max: number, itemMax: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map((v) => str(v, itemMax)).filter(Boolean).slice(0, max);
  return out.length >= min ? out : null;
}

function side(value: unknown): ExplainerVisual["left"] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const title = str(v.title, 22);
  if (!title) return null;
  return { title, icon: icon(v.icon), points: strings(v.points, 0, 3, 32) ?? [] };
}

/** Validate one visual; returns null when it lacks the data it needs. */
export function normalizeVisual(raw: unknown): ExplainerVisual | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const kind = EXPLAINER_VISUAL_KINDS.find((k) => k === v.kind);
  if (!kind) return null;

  switch (kind) {
    case "icon-hero":
      return { kind, icon: icon(v.icon), caption: str(v.caption, 40) || undefined };
    case "icon-row": {
      const items = iconLabels(v.items, 2, 4);
      return items ? { kind, items } : null;
    }
    case "flow": {
      const items = iconLabels(v.items, 2, 5, 20);
      return items ? { kind, items } : null;
    }
    case "cycle": {
      const items = iconLabels(v.items, 3, 5, 18);
      return items ? { kind, items } : null;
    }
    case "compare": {
      const left = side(v.left);
      const right = side(v.right);
      return left && right ? { kind, left, right } : null;
    }
    case "equation": {
      const items = iconLabels(v.items, 2, 3, 16);
      const result = v.result && typeof v.result === "object"
        ? { icon: icon((v.result as IconLabel).icon), label: str((v.result as IconLabel).label, 18) }
        : null;
      return items && result?.label ? { kind, items, result } : null;
    }
    case "analogy": {
      const items = iconLabels(v.items, 2, 2, 22);
      return items ? { kind, items } : null;
    }
    case "bar-chart": {
      const bars = Array.isArray(v.bars)
        ? v.bars
            .map((b) => ({ label: str((b as { label?: unknown })?.label, 16), value: Number((b as { value?: unknown })?.value) }))
            .filter((b) => b.label && Number.isFinite(b.value) && b.value >= 0)
            .slice(0, 5)
        : [];
      return bars.length >= 2 ? { kind, bars, unit: str(v.unit, 8) || undefined } : null;
    }
    case "line-chart": {
      const values = Array.isArray(v.values)
        ? v.values.map(Number).filter((n) => Number.isFinite(n)).slice(0, 10)
        : [];
      return values.length >= 3
        ? {
            kind,
            values,
            startLabel: str(v.startLabel, 16) || undefined,
            endLabel: str(v.endLabel, 16) || undefined,
            unit: str(v.unit, 8) || undefined,
          }
        : null;
    }
    case "stat": {
      const value = str(v.value, 8);
      return value ? { kind, value, label: str(v.label, 60), icon: icon(v.icon) } : null;
    }
    case "pictogram": {
      const total = Math.round(Number(v.total));
      const highlight = Math.round(Number(v.highlight));
      if (!(total >= 2 && total <= 20) || !(highlight >= 0 && highlight <= total)) return null;
      return { kind, icon: icon(v.icon, "user"), total, highlight, label: str(v.label, 60) };
    }
    case "checklist": {
      const lines = strings(v.lines, 2, 4, 32);
      return lines ? { kind, lines } : null;
    }
    case "timeline": {
      const events = Array.isArray(v.events)
        ? v.events
            .map((e) => ({ when: str((e as { when?: unknown })?.when, 12), label: str((e as { label?: unknown })?.label, 28) }))
            .filter((e) => e.label)
            .slice(0, 5)
        : [];
      return events.length >= 2 ? { kind, events } : null;
    }
    case "chat": {
      const messages = Array.isArray(v.messages)
        ? v.messages
            .map((m) => ({
              side: (m as { side?: unknown })?.side === "right" ? ("right" as const) : ("left" as const),
              text: str((m as { text?: unknown })?.text, 70),
            }))
            .filter((m) => m.text)
            .slice(0, 4)
        : [];
      return messages.length >= 2 ? { kind, messages } : null;
    }
    case "phone": {
      const lines = strings(v.lines, 1, 4, 60);
      return lines ? { kind, lines, label: str(v.label, 24) || undefined, icon: icon(v.icon, "smartphone") } : null;
    }
    case "code": {
      const lines = Array.isArray(v.lines)
        ? v.lines.map((l) => String(l ?? "").replace(/\t/g, "  ").slice(0, 42)).slice(0, 8)
        : [];
      return lines.some((l) => l.trim()) ? { kind, lines, language: str(v.language, 16) || undefined } : null;
    }
    case "definition": {
      const term = str(v.term, 28);
      const meaning = str(v.meaning, 120);
      return term && meaning ? { kind, term, meaning, icon: icon(v.icon, "book-open") } : null;
    }
    case "quote": {
      const text = str(v.text, 120);
      return text ? { kind, text, author: str(v.author, 40) || undefined } : null;
    }
  }
}

/** Fill-in when a scene's visual is missing or invalid. */
function fallbackVisual(heading: string, index: number): ExplainerVisual {
  const icons = ["lightbulb", "sparkles", "target", "rocket", "brain", "book-open"];
  return { kind: "icon-hero", icon: icons[index % icons.length], caption: heading.slice(0, 40) };
}

/** Drop invalid scenes and clamp text so the template layout cannot overflow. */
export function normalizeExplainerScript(raw: unknown): ExplainerScript | null {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const scenesRaw = obj && Array.isArray(obj.scenes) ? obj.scenes : Array.isArray(raw) ? raw : null;
  if (!scenesRaw) return null;

  const scenes: ExplainerScene[] = [];
  for (const item of scenesRaw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const narration = toSpeakable(str(s.narration, 400));
    if (!narration) continue;
    const heading =
      str(s.heading, 48) || narration.split(/[.!?]/)[0].split(" ").slice(0, 6).join(" ");
    const scene: ExplainerScene = {
      narration,
      heading,
      visual: normalizeVisual(s.visual) ?? fallbackVisual(heading, scenes.length),
    };
    const imagePrompt = str(s.imagePrompt, 400);
    if (imagePrompt) scene.imagePrompt = imagePrompt;
    if (typeof s.image === "string" && /^[\w.-]+$/.test(s.image)) scene.image = s.image;
    for (const key of ["start", "duration", "audioDuration"] as const) {
      const n = Number(s[key]);
      if (Number.isFinite(n) && n >= 0) scene[key] = n;
    }
    scenes.push(scene);
    if (scenes.length >= EXPLAINER_MAX_SCENES) break;
  }
  if (scenes.length === 0) return null;
  return {
    scenes,
    targetSeconds: obj?.targetSeconds != null ? clampExplainerSeconds(obj.targetSeconds) : undefined,
  };
}

/**
 * Enforce the word budget: models overshoot length rules. Each scene keeps
 * its first sentences and drops trailing ones once over its share, so the
 * video lands near the requested length without cutting mid-sentence.
 */
export function fitScriptToLength(script: ExplainerScript, seconds: number): ExplainerScript {
  const budget = wordBudgetFor(seconds) * 1.08;
  const count = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const total = script.scenes.reduce((sum, s) => sum + count(s.narration), 0);
  if (total <= budget) return script;
  // Shrink the per-scene allowance until the whole script fits (each scene
  // always keeps at least its first sentence).
  const trimTo = (cap: number) =>
    script.scenes.map((scene) => {
      const sentences = scene.narration.match(/[^.!?]+[.!?]*/g) ?? [scene.narration];
      let kept = "";
      for (const sentence of sentences) {
        const next = (kept + " " + sentence.trim()).trim();
        if (kept && count(next) > cap) break;
        kept = next;
      }
      return { ...scene, narration: kept || scene.narration };
    });
  let cap = budget / script.scenes.length;
  let scenes = trimTo(cap);
  while (scenes.reduce((sum, sc) => sum + count(sc.narration), 0) > budget && cap > 8) {
    cap *= 0.9;
    scenes = trimTo(cap);
  }
  return { ...script, scenes };
}

const HEADING_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "for",
  "by", "with", "is", "are", "your", "my", "i", "you", "that", "this",
]);

function shortHeading(sentence: string): string {
  const clause = sentence.split(/[:;,.!?—–]/)[0].trim() || sentence;
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 6);
  while (words.length > 2 && HEADING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ").replace(/[^\p{L}\p{N}%$'’\s-]+$/u, "");
}

/**
 * Fallback script when the LLM is unavailable: the post's sentences become
 * scenes with simple visuals (a stat when a sentence carries a number).
 */
export function explainerScriptFromPost(
  post: { title?: string; body?: string },
  targetSeconds = DEFAULT_EXPLAINER_SECONDS
): ExplainerScript {
  const sentences = toSpeakable((post.body ?? "").replace(/#[\w-]+/g, ""))
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length > 8);
  if (sentences.length === 0) sentences.push(toSpeakable(post.title ?? "") || "Quick explainer");

  const icons = ["lightbulb", "target", "brain", "rocket", "trending-up", "check", "sparkles", "book-open"];
  const scenes: ExplainerScene[] = [];
  for (let i = 0; i < sentences.length && scenes.length < sceneCountFor(targetSeconds); i += 2) {
    const narration = sentences.slice(i, i + 2).join(" ");
    const num = /(\$?\d[\d.,]*\s?(%|x)?)/i.exec(narration);
    const visual: ExplainerVisual = num && !scenes.some((s) => s.visual.kind === "stat")
      ? { kind: "stat", value: num[1].replace(/\s+/g, ""), label: shortHeading(narration), icon: "trending-up" }
      : { kind: "icon-hero", icon: icons[scenes.length % icons.length] };
    scenes.push({ narration, heading: shortHeading(narration), visual });
  }
  return { scenes, targetSeconds };
}
