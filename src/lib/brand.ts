/**
 * Product brand — change `name` here to rebrand display copy.
 * Repo / domains can stay latewiz until you cut over infrastructure.
 */
export const BRAND = {
  /** Display name (proposed rebrand from LateWiz) */
  name: "Postline",
  /** Short product line */
  tagline: "AI social scheduling, made clear",
  /** Longer meta description */
  description:
    "Generate captions, images, and videos with AI, then schedule across 13 platforms. Open source and powered by Zernio.",
  /** Public site URL (update when domain changes) */
  url: "https://latewiz.com",
  /** GitHub */
  github: "https://github.com/zernio-dev/latewiz",
  /** Pantone 2755 C analogous (see globals.css) */
  colors: {
    teal: "#0E4B62",
    navy: "#0E2162",
    indigo: "#250E62",
    purple: "#4F0E62",
    plum: "#620E4B",
  },
} as const;

export type Brand = typeof BRAND;
