import "server-only";

import {
  EXPLAINER_MAX_SCENES,
  EXPLAINER_MIN_SCENES,
  explainerScriptFromPost,
  normalizeExplainerScript,
  type ExplainerScript,
} from "@/lib/explainer-script";
import {
  extractOutputTextFromResponse,
  parseJsonFromModelOutput,
  resolveTextModel,
} from "./responses";

// Strict structured output: every property must be required, so unused
// fields come back as "" / [] and normalizeExplainerScript drops them.
const EXPLAINER_SCRIPT_JSON_SCHEMA = {
  name: "explainer_script",
  schema: {
    type: "object",
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["hook", "illustration", "steps", "bullets", "stat", "compare", "quote"],
            },
            narration: { type: "string" },
            heading: { type: "string" },
            items: { type: "array", items: { type: "string" } },
            value: { type: "string" },
            label: { type: "string" },
            left: { type: "string" },
            right: { type: "string" },
            author: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: [
            "type",
            "narration",
            "heading",
            "items",
            "value",
            "label",
            "left",
            "right",
            "author",
            "imagePrompt",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["scenes"],
    additionalProperties: false,
  },
} as const;

const INSTRUCTIONS = `You are a short-form video producer. Turn a social media post into a narrated vertical explainer video (9:16) that genuinely TEACHES the idea, like a good YouTube Shorts / TikTok explainer.

LENGTH: ${EXPLAINER_MIN_SCENES}-${EXPLAINER_MAX_SCENES} scenes. Total narration 95-130 words (35-50 seconds spoken). Never shorter.

STORY ARC:
1. "hook" scene first: a surprising claim, question or tension that makes people stay. Narration 1 sentence.
2. Middle scenes EXPLAIN: what it is, why it matters, how it works, a concrete example. Each scene adds one new idea; build on the previous one. Use concrete details from the post (names, numbers, steps).
3. Last scene: the takeaway or one action to try today. Do not ask to follow or subscribe (the brand outro is added automatically).

NARRATION: spoken, conversational, second person ("you"). Short sentences. 1-3 sentences per scene. No hashtags, emojis, URLs, or "in this video".

ON-SCREEN TEXT IS MINIMAL (narration carries the explanation, captions show it):
- heading: max 6 words, punchy, never a full sentence copy of the narration.
- steps / bullets: 2-4 items, max 4 words each. Use "steps" for an ordered process, "bullets" for parallel points.
- stat: value (max 6 chars, e.g. "73%", "3x", "$2M") + label (max 8 words). ONLY use numbers that appear in the post; never invent statistics.
- compare: left and right (max 3 words each), e.g. "Before" / "After", "Myth" / "Fact", "Old way" / "New way".
- quote: heading = the quote (max 12 words) + author. Only quote what the post supports.
- illustration: heading only; the image does the work.
Leave unused fields as "" or [].

VISUAL VARIETY: never use the same type twice in a row. Use at least 3 different types.

imagePrompt (every scene): describe ONE clear illustration that shows the scene's idea visually, like b-roll: a concrete subject, action and setting (e.g. "a person at a laptop watching a sales chart climb, warm morning light"). No text, letters, numbers, logos or UI labels in the image. Vertical composition with the subject in the upper two thirds.

Write narration, headings and items in the same language as the post. Write imagePrompt in English.`;

export async function generateExplainerScript(params: {
  apiKey: string | null;
  title: string;
  body: string;
  aiInstruction?: string;
}): Promise<{ script: ExplainerScript; detail: string | null }> {
  const fallback = () => explainerScriptFromPost(params);
  if (!params.apiKey) {
    return {
      script: fallback(),
      detail: "No OpenAI key: explainer built from the post text, without illustrations or voiceover.",
    };
  }

  const input = [
    `Post title: ${params.title}`,
    `Post body:\n${params.body}`,
    params.aiInstruction?.trim()
      ? `Extra direction from the user: ${params.aiInstruction.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveTextModel(),
        instructions: INSTRUCTIONS,
        input,
        max_output_tokens: 3000,
        text: {
          format: {
            type: "json_schema",
            name: EXPLAINER_SCRIPT_JSON_SCHEMA.name,
            strict: true,
            schema: EXPLAINER_SCRIPT_JSON_SCHEMA.schema,
          },
        },
      }),
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return {
        script: fallback(),
        detail: `Explainer script fell back to post text (OpenAI HTTP ${res.status}: ${raw.slice(0, 160)})`,
      };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const parsed = parseJsonFromModelOutput<unknown>(
      extractOutputTextFromResponse(data)
    );
    const script = normalizeExplainerScript(parsed);
    if (!script || script.scenes.length < 3) {
      return {
        script: fallback(),
        detail: "Explainer script fell back to post text (model returned too few usable scenes).",
      };
    }
    return { script, detail: null };
  } catch (error) {
    return {
      script: fallback(),
      detail: `Explainer script fell back to post text (${(error as Error).message})`,
    };
  }
}
