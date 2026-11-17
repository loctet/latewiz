import {
  DEFAULT_EXPLAINER_SECONDS,
  clampExplainerSeconds,
} from "@/lib/explainer-script";

/**
 * Per-user brand kit used to theme generated videos (and, later, images).
 * Shared by client and server. The logo bytes live in the `brand_kits`
 * table and are served by /api/me/brand-kit/logo — they are not part of
 * this JSON shape.
 */

export const BRAND_FONT_OPTIONS = [
  { value: "Inter", label: "Inter (clean sans)" },
  { value: "Poppins", label: "Poppins (friendly geometric)" },
  { value: "Montserrat", label: "Montserrat (bold geometric)" },
  { value: "Space Grotesk", label: "Space Grotesk (techy)" },
  { value: "DM Sans", label: "DM Sans (modern neutral)" },
  { value: "Playfair Display", label: "Playfair Display (editorial serif)" },
] as const;

export type BrandFont = (typeof BRAND_FONT_OPTIONS)[number]["value"];

export const BRAND_VIDEO_THEMES = [
  { value: "minimal", label: "Minimal", description: "Light background, calm type, lots of space" },
  { value: "bold", label: "Bold", description: "Dark background, big type, strong accent color" },
  { value: "gradient", label: "Gradient", description: "Brand-color gradient backdrop, soft motion" },
  { value: "editorial", label: "Editorial", description: "Magazine layout, serif headlines, rules" },
] as const;

export type BrandVideoTheme = (typeof BRAND_VIDEO_THEMES)[number]["value"];

export const BRAND_LOGO_POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

export type BrandLogoPosition = (typeof BRAND_LOGO_POSITIONS)[number]["value"];

/** OpenAI TTS voices used for explainer voiceover. */
export const BRAND_VOICES = [
  { value: "coral", label: "Coral (warm, friendly)" },
  { value: "nova", label: "Nova (bright, upbeat)" },
  { value: "sage", label: "Sage (calm, clear)" },
  { value: "ash", label: "Ash (confident)" },
  { value: "onyx", label: "Onyx (deep, authoritative)" },
  { value: "echo", label: "Echo (neutral)" },
  { value: "shimmer", label: "Shimmer (soft)" },
  { value: "alloy", label: "Alloy (balanced)" },
] as const;

export type BrandVoice = (typeof BRAND_VOICES)[number]["value"];

/** Kokoro voices (offline, free) used when the voice engine is Kokoro. */
export const KOKORO_VOICES = [
  { value: "af_heart", label: "Heart (warm, US)" },
  { value: "af_bella", label: "Bella (bright, US)" },
  { value: "af_nicole", label: "Nicole (soft, US)" },
  { value: "am_michael", label: "Michael (calm, US)" },
  { value: "am_fenrir", label: "Fenrir (deep, US)" },
  { value: "bf_emma", label: "Emma (clear, UK)" },
  { value: "bm_george", label: "George (classic, UK)" },
  { value: "bm_fable", label: "Fable (storyteller, UK)" },
] as const;
export type KokoroVoice = (typeof KOKORO_VOICES)[number]["value"];

export const VIDEO_STYLES = [
  { value: "whiteboard", label: "Whiteboard (hand-drawn, marker)" },
  { value: "motion", label: "Motion graphics (icons and charts)" },
] as const;
export type VideoStyle = (typeof VIDEO_STYLES)[number]["value"];

export const VOICE_ENGINES = [
  { value: "kokoro", label: "Kokoro (free, runs on the worker)" },
  { value: "openai", label: "OpenAI text-to-speech (paid)" },
] as const;
export type VoiceEngine = (typeof VOICE_ENGINES)[number]["value"];

/** Look of the AI illustrations (b-roll) in explainer videos. */
export const BRAND_ILLUSTRATION_STYLES = [
  { value: "flat-vector", label: "Flat vector illustration", prompt: "modern flat vector illustration, clean shapes, subtle grain texture, soft shadows, editorial explainer style" },
  { value: "3d-render", label: "3D render", prompt: "soft 3D render, clay-like materials, studio lighting, playful isometric explainer style" },
  { value: "photo", label: "Cinematic photo", prompt: "cinematic photograph, natural light, shallow depth of field, authentic documentary b-roll" },
  { value: "hand-drawn", label: "Hand-drawn sketch", prompt: "hand-drawn ink and marker sketch on off-white paper, whiteboard explainer style, confident lines" },
] as const;

export type BrandIllustrationStyle =
  (typeof BRAND_ILLUSTRATION_STYLES)[number]["value"];

export type BrandKit = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: BrandFont;
  videoTheme: BrandVideoTheme;
  logoPosition: BrandLogoPosition;
  /** Short sign-off shown in the video outro, e.g. "— Jane, Founder" */
  signature: string;
  /** Call to action shown in the outro, e.g. "Follow for more" */
  ctaText: string;
  website: string;
  handle: string;
  showIntro: boolean;
  showOutro: boolean;
  /** Spoken voiceover (OpenAI TTS) on explainer videos */
  voiceoverEnabled: boolean;
  voice: BrandVoice;
  /** Word-by-word captions synced to the voiceover */
  captionsEnabled: boolean;
  /** Style of optional AI background images */
  illustrationStyle: BrandIllustrationStyle;
  /** Dimmed AI-generated backgrounds behind the animated visuals (off by default) */
  aiBackgroundImages: boolean;
  /** Subtle whooshes and pops on transitions and reveals */
  soundEffects: boolean;
  /** Default explainer length in seconds */
  explainerSeconds: number;
  /** Look of explainer videos */
  videoStyle: VideoStyle;
  /** Who speaks the voiceover */
  voiceEngine: VoiceEngine;
  kokoroVoice: KokoroVoice;
};

/** Brand kit as returned by the API: JSON fields plus logo metadata. */
export type BrandKitResponse = BrandKit & {
  hasLogo: boolean;
  /** ISO timestamp; use as a cache-buster on the logo URL */
  logoUpdatedAt: string | null;
};

export const BRAND_LOGO_MAX_BYTES = 512 * 1024;
export const BRAND_LOGO_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export function defaultBrandKit(): BrandKit {
  return {
    brandName: "",
    primaryColor: "#1E3A5F",
    secondaryColor: "#4A6FA5",
    accentColor: "#F2A541",
    backgroundColor: "#0F172A",
    textColor: "#F8FAFC",
    fontFamily: "Inter",
    videoTheme: "bold",
    logoPosition: "top-right",
    signature: "",
    ctaText: "Follow for more",
    website: "",
    handle: "",
    showIntro: true,
    showOutro: true,
    voiceoverEnabled: true,
    voice: "coral",
    captionsEnabled: true,
    illustrationStyle: "flat-vector",
    aiBackgroundImages: false,
    soundEffects: true,
    explainerSeconds: DEFAULT_EXPLAINER_SECONDS,
    videoStyle: "whiteboard",
    voiceEngine: "kokoro",
    kokoroVoice: "af_heart",
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function color(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (HEX_COLOR.test(trimmed)) return trimmed.toUpperCase();
  // Accept #abc shorthand
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function text(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
  fallback: T
): T {
  return options.some((o) => o.value === value) ? (value as T) : fallback;
}

export function normalizeBrandKit(partial?: Partial<BrandKit> | null): BrandKit {
  const d = defaultBrandKit();
  if (!partial || typeof partial !== "object") return d;
  return {
    brandName: text(partial.brandName, d.brandName, 60),
    primaryColor: color(partial.primaryColor, d.primaryColor),
    secondaryColor: color(partial.secondaryColor, d.secondaryColor),
    accentColor: color(partial.accentColor, d.accentColor),
    backgroundColor: color(partial.backgroundColor, d.backgroundColor),
    textColor: color(partial.textColor, d.textColor),
    fontFamily: oneOf(partial.fontFamily, BRAND_FONT_OPTIONS, d.fontFamily),
    videoTheme: oneOf(partial.videoTheme, BRAND_VIDEO_THEMES, d.videoTheme),
    logoPosition: oneOf(partial.logoPosition, BRAND_LOGO_POSITIONS, d.logoPosition),
    signature: text(partial.signature, d.signature, 80),
    ctaText: text(partial.ctaText, d.ctaText, 60),
    website: text(partial.website, d.website, 120),
    handle: text(partial.handle, d.handle, 60),
    showIntro:
      typeof partial.showIntro === "boolean" ? partial.showIntro : d.showIntro,
    showOutro:
      typeof partial.showOutro === "boolean" ? partial.showOutro : d.showOutro,
    voiceoverEnabled:
      typeof partial.voiceoverEnabled === "boolean"
        ? partial.voiceoverEnabled
        : d.voiceoverEnabled,
    voice: oneOf(partial.voice, BRAND_VOICES, d.voice),
    captionsEnabled:
      typeof partial.captionsEnabled === "boolean"
        ? partial.captionsEnabled
        : d.captionsEnabled,
    illustrationStyle: oneOf(
      partial.illustrationStyle,
      BRAND_ILLUSTRATION_STYLES,
      d.illustrationStyle
    ),
    aiBackgroundImages:
      typeof partial.aiBackgroundImages === "boolean"
        ? partial.aiBackgroundImages
        : d.aiBackgroundImages,
    soundEffects:
      typeof partial.soundEffects === "boolean" ? partial.soundEffects : d.soundEffects,
    explainerSeconds: clampExplainerSeconds(partial.explainerSeconds ?? d.explainerSeconds),
    videoStyle: oneOf(partial.videoStyle, VIDEO_STYLES, d.videoStyle),
    voiceEngine: oneOf(partial.voiceEngine, VOICE_ENGINES, d.voiceEngine),
    kokoroVoice: oneOf(partial.kokoroVoice, KOKORO_VOICES, d.kokoroVoice),
  };
}

export function isBrandLogoContentType(
  value: string
): value is (typeof BRAND_LOGO_CONTENT_TYPES)[number] {
  return (BRAND_LOGO_CONTENT_TYPES as readonly string[]).includes(value);
}
