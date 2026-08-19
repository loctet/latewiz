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
  "Never use Markdown: no *italics*, no **bold**, no _italics_, no __bold__, no `code`, no [links](url).",
  "For scannable bullets, write a plain lead-in then a colon (e.g. Catalyseur : ...) — never wrap the lead-in in asterisks.",
  "Never use Markdown links ([label](url)); if a source matters, name it in words without a URL.",
  "Do not invent raw URLs in title, body, or hashtags — the system may append an official Full report link after generation.",
].join(" ");

/**
 * Strip paired Markdown emphasis without touching list markers or math like 2 * 3.
 * Matches *Catalyseur* and _Catalyseur_ lead-ins that read as AI-generated on social.
 */
function stripPairedMarkers(
  text: string,
  marker: "*" | "_"
): string {
  const escaped = marker === "*" ? "\\*" : "_";
  const wordSafe = marker === "*" ? "\\w*" : "\\w_";
  const pair = new RegExp(
    `(^|[^${wordSafe}])${escaped}([^${escaped}\\n]+?)${escaped}(?=[^${wordSafe}]|$)`,
    "g"
  );
  return text.replace(pair, (full, before: string, inner: string) => {
    if (!inner.trim() || inner.startsWith(" ") || inner.endsWith(" ")) {
      return full;
    }
    return `${before}${inner}`;
  });
}

/**
 * Normalize model output for platforms that do not render Markdown well.
 */
export function sanitizeSocialPostText(text: string): string {
  let s = repairModelTextCorruption(text);

  // [label](url) → label (drop URL)
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // fenced / inline code — another AI tell on social
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  // ***bold-italic***, **bold**, *italic* (order matters)
  s = s.replace(/\*{3}([^*\n]+)\*{3}/g, "$1");
  s = s.replace(/\*{2}([^*\n]+)\*{2}/g, "$1");
  s = stripPairedMarkers(s, "*");

  // ___ / __bold__ / _italic_
  s = s.replace(/_{3}([^_\n]+)_{3}/g, "$1");
  s = s.replace(/_{2}([^_\n]+)_{2}/g, "$1");
  s = stripPairedMarkers(s, "_");

  // leftover doubled markers after unpaired wraps
  s = s.replace(/\*{2,}/g, "");
  s = s.replace(/_{2,}/g, "");

  // markdown headings and "* item" lists look generated
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^(\s*)\*\s+/gm, "$1- ");

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
