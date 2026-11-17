import "server-only";

import { EXPLAINER_ICON_NAMES } from "@/lib/explainer-icons";
import {
  clampExplainerSeconds,
  fitScriptToLength,
  explainerScriptFromPost,
  normalizeExplainerScript,
  sceneCountFor,
  wordBudgetFor,
  type ExplainerScript,
} from "@/lib/explainer-script";
import {
  extractOutputTextFromResponse,
  parseJsonFromModelOutput,
} from "./responses";

const ICON = { $ref: "#/$defs/icon" };
const ICON_LABEL = {
  type: "object",
  properties: { icon: ICON, label: { type: "string" } },
  required: ["icon", "label"],
  additionalProperties: false,
};
const SIDE = {
  type: "object",
  properties: {
    title: { type: "string" },
    icon: ICON,
    points: { type: "array", items: { type: "string" } },
  },
  required: ["title", "icon", "points"],
  additionalProperties: false,
};

// Strict structured output: every property is required, so unused fields
// come back empty and normalizeVisual() keeps only what the kind needs.
const VISUAL = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: [
        "icon-hero", "icon-row", "flow", "cycle", "compare", "equation", "analogy",
        "bar-chart", "line-chart", "stat", "pictogram", "checklist", "timeline",
        "chat", "phone", "code", "definition", "quote",
      ],
    },
    icon: ICON,
    caption: { type: "string" },
    items: { type: "array", items: ICON_LABEL },
    left: SIDE,
    right: SIDE,
    result: ICON_LABEL,
    bars: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "number" } },
        required: ["label", "value"],
        additionalProperties: false,
      },
    },
    values: { type: "array", items: { type: "number" } },
    unit: { type: "string" },
    startLabel: { type: "string" },
    endLabel: { type: "string" },
    value: { type: "string" },
    label: { type: "string" },
    total: { type: "number" },
    highlight: { type: "number" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: { when: { type: "string" }, label: { type: "string" } },
        required: ["when", "label"],
        additionalProperties: false,
      },
    },
    messages: {
      type: "array",
      items: {
        type: "object",
        properties: { side: { type: "string", enum: ["left", "right"] }, text: { type: "string" } },
        required: ["side", "text"],
        additionalProperties: false,
      },
    },
    lines: { type: "array", items: { type: "string" } },
    language: { type: "string" },
    term: { type: "string" },
    meaning: { type: "string" },
    text: { type: "string" },
    author: { type: "string" },
  },
  required: [
    "kind", "icon", "caption", "items", "left", "right", "result", "bars", "values",
    "unit", "startLabel", "endLabel", "value", "label", "total", "highlight", "events",
    "messages", "lines", "language", "term", "meaning", "text", "author",
  ],
  additionalProperties: false,
};

const EXPLAINER_SCRIPT_JSON_SCHEMA = {
  name: "explainer_script",
  schema: {
    type: "object",
    $defs: { icon: { type: "string", enum: [...EXPLAINER_ICON_NAMES] } },
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            narration: { type: "string" },
            heading: { type: "string" },
            visual: VISUAL,
            imagePrompt: { type: "string" },
          },
          required: ["narration", "heading", "visual", "imagePrompt"],
          additionalProperties: false,
        },
      },
    },
    required: ["scenes"],
    additionalProperties: false,
  },
} as const;

function instructions(seconds: number): string {
  const scenes = sceneCountFor(seconds);
  const words = wordBudgetFor(seconds);
  return `You are a patient teacher making a narrated vertical explainer video (9:16) for complete BEGINNERS, like the best educational YouTube Shorts / Kurzgesagt-style explainers. Animated icons, diagrams and charts carry the visuals; your narration carries the explanation.

LENGTH: about ${seconds} seconds of narration. Write exactly ${scenes} scenes and ${words} spoken words in total: each scene narration is 2-3 sentences, about ${Math.round(words / scenes)} words. Count your words. A script under ${Math.round(words * 0.85)} words is too short and will be rejected.

TEACHING ARC (adapt to the topic):
1. Hook: a relatable question or surprising fact that makes a beginner curious.
2. Why it matters to the viewer, using an everyday situation.
3. The simple idea in one sentence, with an everyday ANALOGY ("think of it like…").
4. How it works, step by step (one step per scene when needed). Define every technical word the first time it appears, in plain words.
5. A concrete, worked EXAMPLE with simple made-up but realistic details (a person, a number, a before/after). Show it visually.
6. A common mistake or myth, and the fix.
7. Quick recap of the key points.
8. One small thing the viewer can try today.
Do not add a "follow / subscribe" scene (a brand outro is added automatically).

NARRATION (it is read aloud by a voice):
- The narration must SAY what the visual shows: if the visual lists steps, parts or points, speak each one; if it shows numbers, say them and what they mean. Never write "here is how it works:" without then explaining it in the same scene.
- Short sentences, everyday words, second person ("you"). No jargon without an explanation.
- NEVER include URLs, website names, @handles, hashtags, emojis, "link in bio", markdown, or abbreviations a voice would stumble on. Write numbers the way you would say them.
- Use only facts from the post or general knowledge; never invent statistics. Example numbers must be clearly framed as an example ("say you have 100 followers").

ON-SCREEN:
- heading: max 6 words, never a copy of the narration.
- Each scene has ONE visual that SHOWS the narration (not decoration). Pick the kind that teaches best:
  icon-hero {icon, caption}: one key concept. caption max 4 words.
  icon-row {items:2-4 {icon,label}}: parts / ingredients / options.
  flow {items:2-5 {icon,label}}: a process, left to right with arrows.
  cycle {items:3-5 {icon,label}}: a loop that repeats.
  compare {left, right: {title, icon, points:0-3}}: LEFT is always the wrong / old / myth / worse side (shown with red crosses), RIGHT is always the right / new / fact / better side (shown with green checks). Points describe each side.
  equation {items:2-3 {icon,label}, result {icon,label}}: A + B = result.
  analogy {items: exactly 2 {icon,label}}: "X is like Y".
  bar-chart {bars:2-5 {label,value}, unit}: compare amounts.
  line-chart {values:3-8 numbers, startLabel, endLabel, unit}: growth or decline over time.
  stat {value (max 6 chars), label, icon}: one striking number.
  pictogram {icon, total 4-20, highlight, label}: "7 out of 10 people".
  checklist {lines:2-4}: recap or to-do.
  timeline {events:2-5 {when,label}}: order in time.
  chat {messages:2-4 {side,text}}: an example conversation.
  phone {label, icon, lines:1-4}: an example post, notification or app screen.
  code {language, lines:2-8}: only for programming topics.
  definition {term, meaning, icon}: a beginner's dictionary card for a key term.
  quote {text, author}: only quotes the post supports.
- Labels max 3 words. Use at least 6 different kinds; never the same kind twice in a row.
- Icons: pick the closest name from the allowed icon list.
- Leave unused fields empty ("" , [], 0, and for unused objects fill title/label with "").
- imagePrompt: a short description of a simple background scene for this idea (no text in it). It is optional decoration.

Write narration, headings and labels in the same language as the post.`;
}

/** Script model: needs to follow length rules well; the cheap default text model does not. */
function explainerModel(): string {
  return process.env.OPENAI_EXPLAINER_MODEL?.trim() || "gpt-4.1";
}

function wordCount(script: ExplainerScript): number {
  return script.scenes.reduce((sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length, 0);
}

async function callScriptModel(apiKey: string, instructionsText: string, input: string): Promise<{ ok: true; parsed: Record<string, unknown> | null } | { ok: false; status: number; raw: string }> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: explainerModel(),
      instructions: instructionsText,
      input,
      max_output_tokens: 12000,
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
  if (!res.ok) return { ok: false, status: res.status, raw: await res.text().catch(() => "") };
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: true, parsed: parseJsonFromModelOutput<Record<string, unknown>>(extractOutputTextFromResponse(data)) };
}

export async function generateExplainerScript(params: {
  apiKey: string | null;
  title: string;
  body: string;
  aiInstruction?: string;
  targetSeconds?: number;
}): Promise<{ script: ExplainerScript; detail: string | null }> {
  const seconds = clampExplainerSeconds(params.targetSeconds);
  const fallback = () => explainerScriptFromPost(params, seconds);
  if (!params.apiKey) {
    return {
      script: fallback(),
      detail: "No OpenAI key: explainer built from the post text, without an AI script or voiceover.",
    };
  }

  const input = [
    `Post title: ${params.title}`,
    `Post body:\n${params.body}`,
    params.aiInstruction?.trim() ? `Extra direction from the user: ${params.aiInstruction.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const first = await callScriptModel(params.apiKey, instructions(seconds), input);
    if (!first.ok) {
      return {
        script: fallback(),
        detail: `Explainer script fell back to post text (OpenAI HTTP ${first.status}: ${first.raw.slice(0, 160)})`,
      };
    }
    let script = normalizeExplainerScript(first.parsed ? { ...first.parsed, targetSeconds: seconds } : null);
    if (!script || script.scenes.length < 3) {
      return {
        script: fallback(),
        detail: "Explainer script fell back to post text (model returned too few usable scenes).",
      };
    }

    // Models rarely hit the length on the first try. One correction pass
    // when the draft is more than 20% off, keeping whichever is closer.
    const target = wordBudgetFor(seconds);
    const words = wordCount(script);
    if (words < target * 0.8 || words > target * 1.2) {
      const tooShort = words < target;
      const perScene = Math.round(target / sceneCountFor(seconds));
      const fix = await callScriptModel(
        params.apiKey,
        instructions(seconds),
        `${input}

Your previous draft (below) has ${words} spoken words; the video needs about ${target} words (${seconds} seconds). Rewrite it with ${sceneCountFor(seconds)} scenes and narrations of about ${perScene} words each. ${tooShort ? "Explain each step and example more fully for a beginner." : "Cut repetition and filler; keep one clear idea per scene."} Keep the good ideas and visuals.

Previous draft:
${JSON.stringify(script)}`
      );
      const fixed = fix.ok
        ? normalizeExplainerScript(fix.parsed ? { ...fix.parsed, targetSeconds: seconds } : null)
        : null;
      if (fixed && fixed.scenes.length >= 3 && Math.abs(wordCount(fixed) - target) < Math.abs(words - target)) {
        script = fixed;
      }
    }
    return { script: fitScriptToLength(script, seconds), detail: null };
  } catch (error) {
    return {
      script: fallback(),
      detail: `Explainer script fell back to post text (${(error as Error).message})`,
    };
  }
}
