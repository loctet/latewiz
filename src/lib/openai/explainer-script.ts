import "server-only";

import {
  EXPLAINER_MAX_SCENES,
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
              enum: ["title", "bullets", "steps", "stat", "quote"],
            },
            heading: { type: "string" },
            sub: { type: "string" },
            items: { type: "array", items: { type: "string" } },
            value: { type: "string" },
            label: { type: "string" },
            text: { type: "string" },
            author: { type: "string" },
            duration: { type: "number" },
          },
          required: [
            "type",
            "heading",
            "sub",
            "items",
            "value",
            "label",
            "text",
            "author",
            "duration",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["scenes"],
    additionalProperties: false,
  },
} as const;

const INSTRUCTIONS = `You turn a social media post into a short vertical explainer video script.
Return ${3}-${EXPLAINER_MAX_SCENES} scenes. Total length 20-40 seconds.

Scene types and the fields they use (leave unused fields as "" or []):
- title: heading (max 60 chars), optional sub (max 120 chars). Use first, as the hook.
- bullets: heading (max 50 chars) + 2-4 items (max 60 chars each).
- steps: heading (max 50 chars) + 2-4 ordered items (max 60 chars each).
- stat: value (max 8 chars, e.g. "73%", "3x", "$2M") + label (max 80 chars). Only use numbers that appear in the post; never invent statistics.
- quote: text (max 120 chars) + author. Only quote what the post supports.

Rules:
- Short, punchy, scannable phrases. No hashtags, no emojis, no URLs.
- One idea per scene. Do not repeat the same point.
- The last scene should land the takeaway; the brand outro is added automatically, so do not write a "follow us" scene.
- duration: seconds the scene stays on screen, 3-8. Lists need about 1.5s per item plus 2s.
- Write in the same language as the post.`;

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
      detail: "No OpenAI key: explainer built from the post text.",
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
        max_output_tokens: 1500,
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
    if (!script) {
      return {
        script: fallback(),
        detail: "Explainer script fell back to post text (model returned no usable scenes).",
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
