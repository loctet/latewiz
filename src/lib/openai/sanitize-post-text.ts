/** Platform-safe copy rules injected into AI task instructions. */
export const SOCIAL_POST_FORMAT_INSTRUCTIONS = [
  "Write plain text suitable for social platforms (LinkedIn, X, Instagram, etc.).",
  "Never use Markdown bold (**text** or __text__).",
  "Never use Markdown links ([label](url)); if a source matters, name it in words without a URL.",
  "Do not include raw URLs in title, body, or hashtags unless the brief explicitly requires one.",
].join(" ");

/**
 * Normalize model output for platforms that do not render Markdown well.
 */
export function sanitizeSocialPostText(text: string): string {
  let s = text;

  // [label](url) → label (drop URL)
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // **bold** and __bold__
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");

  // stray emphasis markers
  s = s.replace(/\*\*/g, "");

  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeDraftFields(fields: {
  title?: string;
  body?: string;
  hashtags?: string;
}): { title: string; body: string; hashtags: string } {
  return {
    title: sanitizeSocialPostText(String(fields.title ?? "")),
    body: sanitizeSocialPostText(String(fields.body ?? "")),
    hashtags: sanitizeSocialPostText(String(fields.hashtags ?? "")),
  };
}
