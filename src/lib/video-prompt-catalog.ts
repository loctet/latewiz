import type { NicheProfile } from "@/lib/openai/types";
import { buildNicheImageLanguageNote } from "@/lib/openai/niche-prompt";

export const DEFAULT_VIDEO_PROMPT_STYLE_ID = "talking-head-broll";

export const VIDEO_PROMPT_TEMPLATE_HELP =
  "Use {{langNote}}, {{subject}}, {{motion}}, and {{duration}} placeholders.";

export type VideoPromptStyle = {
  id: string;
  label: string;
  description: string;
  template: string;
  durationSeconds: "4" | "8" | "12";
  size: "720x1280" | "1280x720" | "1024x1792" | "1792x1024";
  motion: string;
};

export const VIDEO_PROMPT_STYLES: VideoPromptStyle[] = [
  {
    id: DEFAULT_VIDEO_PROMPT_STYLE_ID,
    label: "Talking-head b-roll",
    description: "Soft studio light, subtle push-in — tips and explainers.",
    durationSeconds: "4",
    size: "720x1280",
    motion: "subtle slow push-in, natural head movement",
    template: `Create a short vertical social video clip, {{duration}}, 9:16 portrait.

{{langNote}} Spoken language only if voiceover; no on-screen text or subtitles.

Topic to visualize:
{{subject}}

Visual: single continuous shot, professional but approachable, soft key light, shallow depth of field, clean neutral background, no logos, no watermarks, no readable text in frame.

Motion: {{motion}}.

End on a calm frame suitable for a social thumbnail.`,
  },
  {
    id: "product-showcase",
    label: "Product showcase",
    description: "Slow orbit or push-in on a product or UI on a desk.",
    durationSeconds: "4",
    size: "720x1280",
    motion: "slow orbit then gentle push-in",
    template: `Create a short vertical product showcase video, {{duration}}, 9:16.

{{langNote}}

Subject:
{{subject}}

Visual: minimal modern desk setup, soft daylight, product or screen as hero, premium tech aesthetic, no readable UI text, no logos.

Motion: {{motion}}, smooth and deliberate.`,
  },
  {
    id: "cinematic-broll",
    label: "Cinematic b-roll",
    description: "Moody golden-hour motion without faces required.",
    durationSeconds: "8",
    size: "720x1280",
    motion: "slow dolly forward through scene",
    template: `Create cinematic vertical b-roll, {{duration}}, 9:16.

{{langNote}}

Mood and subject:
{{subject}}

Visual: golden hour or blue hour, rich color grade, atmospheric depth, no text, no watermarks, film-like grain optional.

Motion: {{motion}}, unhurried and immersive.`,
  },
  {
    id: "kinetic-abstract",
    label: "Kinetic abstract",
    description: "Abstract shapes and motion — no legible text in frame.",
    durationSeconds: "4",
    size: "720x1280",
    motion: "gentle floating shapes and soft parallax",
    template: `Create an abstract kinetic motion graphic video, {{duration}}, 9:16.

{{langNote}}

Theme:
{{subject}}

Visual: bold simple shapes, gradient backgrounds, educational energy, absolutely no readable words or letters in frame.

Motion: {{motion}}, looping-friendly ending.`,
  },
  {
    id: "ugc-handheld",
    label: "UGC handheld",
    description: "Authentic phone-style Reels/TikTok aesthetic.",
    durationSeconds: "4",
    size: "720x1280",
    motion: "slight handheld sway, natural micro-movements",
    template: `Create authentic handheld vertical social video, {{duration}}, 9:16.

{{langNote}}

Content:
{{subject}}

Visual: natural indoor or outdoor light, phone-camera realism, relatable creator vibe, no on-screen text, no brand logos.

Motion: {{motion}}, energetic but not shaky.`,
  },
  {
    id: "landscape-youtube",
    label: "Landscape (16:9)",
    description: "Horizontal clip for YouTube or LinkedIn video posts.",
    durationSeconds: "8",
    size: "1280x720",
    motion: "slow pan across scene",
    template: `Create a short horizontal social video, {{duration}}, 16:9 landscape.

{{langNote}}

Topic:
{{subject}}

Visual: clear subject in frame, balanced composition, professional lighting, no subtitles burned in, no watermarks.

Motion: {{motion}}.`,
  },
];

export function getVideoPromptStyle(id?: string | null): VideoPromptStyle {
  const found = VIDEO_PROMPT_STYLES.find((s) => s.id === id);
  return found ?? VIDEO_PROMPT_STYLES[0];
}

export function getDefaultVideoTemplate(styleId: string): string {
  return getVideoPromptStyle(styleId).template;
}

export function getEffectiveVideoTemplate(
  styleId: string,
  overrides?: Record<string, string>
): string {
  const custom = overrides?.[styleId]?.trim();
  if (custom) return custom;
  return getDefaultVideoTemplate(styleId);
}

export function applyVideoPromptTemplate(
  template: string,
  subject: string,
  langNote: string,
  motion: string,
  duration: string
): string {
  return template
    .replaceAll("{{langNote}}", langNote)
    .replaceAll("{{subject}}", subject.trim())
    .replaceAll("{{motion}}", motion)
    .replaceAll("{{duration}}", duration)
    .slice(0, 4000);
}

export function buildVideoPromptFromStyle(
  styleId: string | undefined,
  subject: string,
  niche: NicheProfile,
  templateOverrides?: Record<string, string>
): { prompt: string; seconds: "4" | "8" | "12"; size: VideoPromptStyle["size"] } {
  const style = getVideoPromptStyle(styleId || DEFAULT_VIDEO_PROMPT_STYLE_ID);
  const template = getEffectiveVideoTemplate(style.id, templateOverrides);
  const langNote = buildNicheImageLanguageNote(niche);
  const duration = `${style.durationSeconds} seconds`;
  const prompt = applyVideoPromptTemplate(
    template,
    subject,
    langNote,
    style.motion,
    duration
  );
  return { prompt, seconds: style.durationSeconds, size: style.size };
}
