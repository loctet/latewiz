/**
 * Scene script for a branded explainer video. Produced by the LLM, stored on
 * the campaign slot, and passed (as JSON) to the HyperFrames template in
 * video-templates/explainer. Shared by client, server and the render worker.
 */

export const EXPLAINER_SCENE_TYPES = [
  "title",
  "bullets",
  "steps",
  "stat",
  "quote",
] as const;

export type ExplainerSceneType = (typeof EXPLAINER_SCENE_TYPES)[number];

export type ExplainerScene = {
  type: ExplainerSceneType;
  heading?: string;
  sub?: string;
  items?: string[];
  value?: string;
  label?: string;
  text?: string;
  author?: string;
  /** Seconds on screen, 2.5–10 */
  duration: number;
};

export type ExplainerScript = {
  scenes: ExplainerScene[];
};

export const EXPLAINER_MAX_SCENES = 6;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampDuration(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(2.5, Math.round(n * 10) / 10));
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
    const type = EXPLAINER_SCENE_TYPES.find((t) => t === s.type);
    if (!type) continue;

    if (type === "stat") {
      const value = str(s.value, 12);
      const label = str(s.label, 90);
      if (!value || !label) continue;
      scenes.push({ type, value, label, duration: clampDuration(s.duration, 4) });
    } else if (type === "quote") {
      const text = str(s.text, 140);
      if (!text) continue;
      scenes.push({
        type,
        text,
        author: str(s.author, 60) || undefined,
        duration: clampDuration(s.duration, 4.5),
      });
    } else if (type === "bullets" || type === "steps") {
      const heading = str(s.heading, 70);
      const items = Array.isArray(s.items)
        ? s.items.map((i) => str(i, 80)).filter(Boolean).slice(0, 4)
        : [];
      if (!heading || items.length === 0) continue;
      scenes.push({ type, heading, items, duration: clampDuration(s.duration, 6) });
    } else {
      const heading = str(s.heading, 80);
      if (!heading) continue;
      scenes.push({
        type,
        heading,
        sub: str(s.sub, 140) || undefined,
        duration: clampDuration(s.duration, 4),
      });
    }
    if (scenes.length >= EXPLAINER_MAX_SCENES) break;
  }
  return scenes.length > 0 ? { scenes } : null;
}

/** Fallback script built from post copy when the LLM is unavailable. */
export function explainerScriptFromPost(post: {
  title?: string;
  body?: string;
}): ExplainerScript {
  const title = (post.title ?? "").trim() || "Quick explainer";
  const sentences = (post.body ?? "")
    .replace(/#[\w-]+/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length > 8);
  const scenes: ExplainerScene[] = [{ type: "title", heading: title, duration: 4 }];
  if (sentences.length > 0) {
    scenes.push({
      type: "bullets",
      heading: "Key points",
      items: sentences.slice(0, 3),
      duration: 6,
    });
  }
  return normalizeExplainerScript({ scenes }) ?? { scenes };
}
