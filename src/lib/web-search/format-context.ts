import type { WebSearchContext } from "./types";

export function formatWebContextForPrompt(ctx: WebSearchContext | null): string {
  if (!ctx || ctx.results.length === 0) {
    if (ctx?.error) {
      return `## Web research\nLive search was attempted but unavailable: ${ctx.error}\nUse only evergreen claims; avoid specific recent statistics or news you cannot verify.`;
    }
    return "";
  }

  const lines: string[] = [
    "## Current web research (live search)",
    `Retrieved at: ${ctx.searchedAt} UTC`,
    `Search query: ${ctx.query}`,
    `Provider: ${ctx.provider}`,
    "",
    "Treat this block as the primary source for timely facts, trends, product updates, and news.",
    "Do not invent statistics or recent events not supported below.",
    "Prefer paraphrasing insights; do not copy source text verbatim.",
  ];

  if (ctx.answer?.trim()) {
    lines.push("", "### Research summary", ctx.answer.trim());
  }

  lines.push("", "### Sources");
  ctx.results.forEach((r, i) => {
    lines.push(
      `${i + 1}. ${r.title} — ${r.url}`,
      `   ${r.snippet}`
    );
  });

  return lines.join("\n");
}
