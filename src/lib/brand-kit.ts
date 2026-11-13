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
  };
}

export function isBrandLogoContentType(
  value: string
): value is (typeof BRAND_LOGO_CONTENT_TYPES)[number] {
  return (BRAND_LOGO_CONTENT_TYPES as readonly string[]).includes(value);
}
