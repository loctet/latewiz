/** Known words where OpenAI JSON emits \\u0000 instead of ê (not é). */
const NUL_WORD_REPAIRS: [RegExp, string][] = [
  [/m\u0000me/gi, "même"],
  [/r\u0000v\u0000ler/gi, "révéler"],
  [/cr\u0000er/gi, "créer"],
  [/d\u0000j\u0000/gi, "déjà"],
];

/**
 * OpenAI structured JSON occasionally emits literal NUL (\\u0000) where Latin
 * accents belong (e.g. "m\\u0000me" instead of "même"). Repair before display
 * or image generation.
 */
export function repairModelTextCorruption(text: string): string {
  if (!text.includes("\u0000")) return text;

  let s = text;
  for (const [pattern, replacement] of NUL_WORD_REPAIRS) {
    s = s.replace(pattern, replacement);
  }
  // Trailing accent on a word: basé, créé, vidé, …
  s = s.replace(/([a-zA-Z])\u0000(?=[\s,.;:!?'"")\]]|$)/g, "$1é");
  // Accent between letters: récent, négocié, …
  s = s.replace(/([a-zA-Z])\u0000([a-zA-Z])/g, "$1é$2");
  return s.replace(/\u0000/g, "");
}

/**
 * Strip diacritics for text that will be drawn by an image model (poor UTF-8
 * rendering in infographics). Keeps captions/posts in proper Unicode elsewhere.
 */
export function foldAccentsForImagePrompt(text: string): string {
  return repairModelTextCorruption(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u0000-\u001f\u007f]/g, "");
}

/** Platform-safe copy rules injected into AI task instructions. */
export const SOCIAL_POST_FORMAT_INSTRUCTIONS = [
  "Write plain text suitable for social platforms (LinkedIn, X, Instagram, etc.).",
  "Never use Markdown bold (**text** or __text__).",
  "Never use Markdown links ([label](url)); if a source matters, name it in words without a URL.",
  "Do not invent raw URLs in title, body, or hashtags — the system may append an official Full report link after generation.",
].join(" ");

/**
 * Normalize model output for platforms that do not render Markdown well.
 */
export function sanitizeSocialPostText(text: string): string {
  let s = repairModelTextCorruption(text);

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
