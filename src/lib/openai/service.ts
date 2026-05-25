import type { CampaignPostDraft, DraftResult, NicheProfile } from "./types";
import { defaultNicheProfile } from "./types";
import { buildImagePromptFromStyle } from "@/lib/image-prompt-catalog";
import { buildNicheUserContext, nicheToRecord } from "./niche-prompt";
import { generateStructuredContent } from "./text-generation";
import {
  sanitizeDraftFields,
  SOCIAL_POST_FORMAT_INSTRUCTIONS,
} from "./sanitize-post-text";
import {
  CAMPAIGN_BATCH_JSON_SCHEMA,
  CAMPAIGN_POST_JSON_SCHEMA,
  DRAFT_JSON_SCHEMA,
} from "./schemas";

function summarizeOpenAiError(status: number, bodyRaw: string, label: string): string {
  try {
    const data = JSON.parse(bodyRaw) as { error?: { message?: string; code?: string | number } };
    const message = data?.error?.message?.trim();
    if (message) {
      const code = data.error?.code != null ? ` (code ${data.error.code})` : "";
      return `${label} HTTP ${status}: ${message}${code}`;
    }
  } catch {
    /* ignore */
  }
  const snippet = bodyRaw.trim().slice(0, 240);
  return snippet
    ? `${label} HTTP ${status}: ${snippet}`
    : `${label} returned HTTP ${status}.`;
}

export function isOpenAiConfigured(apiKey: string | null): boolean {
  return apiKey !== null && apiKey !== "";
}

export async function generateDraft(
  apiKey: string | null,
  niche: NicheProfile,
  hint?: string
): Promise<DraftResult> {
  if (!apiKey) {
    const topic = niche.topic || "your niche";
    const title = hint || `Ideas for ${topic}`;
    return {
      title,
      body: `Here's a draft caption for ${topic}. Edit tone and details before scheduling.\n\n#growth #content #draft`,
      hashtags: "#latewiz #draft",
      source: "stub",
      detail: "Add an OpenAI API key in Settings or set OPENAI_API_KEY on the server.",
    };
  }

  const nicheContext = buildNicheUserContext(niche);
  const hintText = hint?.trim() ?? "";
  const userInput = hintText
    ? `Topic / brief (use this as the primary subject; search the web for the latest on it):\n${hintText}\n\n${nicheContext}\n\nWrite one timely post grounded in current web research when available.`
    : `Generate one timely post aligned with this niche.\n\n${nicheContext}\n\nSearch the web for recent trends and facts relevant to this audience.`;

  try {
    const result = await generateStructuredContent<{
      title?: string;
      body?: string;
      hashtags?: string;
    }>({
      apiKey,
      taskInstructions: [
        "You write concise, timely social media posts.",
        "Return JSON with keys title, body, hashtags.",
        "Prioritize recent developments from web research over generic or outdated claims.",
        SOCIAL_POST_FORMAT_INSTRUCTIONS,
      ].join(" "),
      userInput,
      jsonSchema: { name: "social_post_draft", schema: DRAFT_JSON_SCHEMA },
      researchParams: { niche, hint: hintText || hint },
    });

    if (!result.data) {
      return {
        title: "Draft (fallback)",
        body: "AI temporarily unavailable. Edit and schedule manually.",
        hashtags: "",
        source: "fallback",
        detail: result.detail ?? "Generation failed",
      };
    }

    const clean = sanitizeDraftFields({
      title: result.data.title,
      body: result.data.body,
      hashtags: result.data.hashtags,
    });
    return {
      title: clean.title || "Post",
      body: clean.body,
      hashtags: clean.hashtags,
      source: result.source,
      detail: result.detail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      title: "Draft (fallback)",
      body: "AI temporarily unavailable. Edit and schedule manually.",
      hashtags: "",
      source: "fallback",
      detail: msg.slice(0, 400),
    };
  }
}

export async function generateCampaignBatch(
  apiKey: string | null,
  niche: NicheProfile,
  totalPosts: number,
  campaignHint?: string,
  trendSnippets: string[] = []
): Promise<{
  posts: CampaignPostDraft[];
  source: string;
  detail: string | null;
}> {
  if (totalPosts <= 0) {
    return { posts: [], source: "stub", detail: null };
  }
  if (!apiKey) {
    return stubCampaignBatch(niche, totalPosts, campaignHint);
  }

  const topic = niche.topic.trim() || "the workspace niche";
  const nicheJson = JSON.stringify(nicheToRecord(niche));
  const hint = campaignHint?.trim() ?? "";
  const trendLines = trendSnippets
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.slice(0, 240));

  const all: CampaignPostDraft[] = [];
  const chunkSize = 14;
  let offset = 0;
  let detail: string | null = null;

  while (offset < totalPosts) {
    const n = Math.min(chunkSize, totalPosts - offset);
    const chunk = await openAiCampaignChunk(
      apiKey,
      niche,
      nicheJson,
      topic,
      trendLines,
      hint,
      n,
      offset
    );

    if (chunk.posts.length === 0) {
      const rest = stubCampaignBatch(niche, totalPosts - all.length, campaignHint);
      return {
        posts: [...all, ...rest.posts].slice(0, totalPosts),
        source: "fallback",
        detail: chunk.detail ?? "AI campaign chunk failed; filled with placeholders.",
      };
    }

    let got = chunk.posts;
    if (got.length < n) {
      detail = chunk.detail;
      const pad = stubCampaignBatch(niche, n - got.length, campaignHint);
      got = [...got, ...pad.posts];
    }
    all.push(...got.slice(0, n));
    offset += n;
  }

  return {
    posts: all.slice(0, totalPosts),
    source: detail ? "mixed" : "openai",
    detail,
  };
}

export type PreviousCampaignPost = {
  title: string;
  body: string;
  hashtags: string;
};

/**
 * Generate one campaign post at a time, using prior posts + goal so content builds incrementally.
 */
export async function generateCampaignSlot(
  apiKey: string | null,
  niche: NicheProfile,
  params: {
    campaignGoal: string;
    slotIndex: number;
    totalPosts: number;
    scheduledAt: string;
    previousPosts: PreviousCampaignPost[];
    campaignHint?: string;
    trendSnippets?: string[];
  }
): Promise<{
  post: CampaignPostDraft;
  source: string;
  detail: string | null;
}> {
  const slotNum = params.slotIndex + 1;
  const goal = params.campaignGoal.trim() || "Grow audience engagement";
  const topic = niche.topic.trim() || "your niche";

  if (!apiKey) {
    return {
      post: {
        title: `${goal.slice(0, 40)} — step ${slotNum}`,
        body: `Post ${slotNum} of ${params.totalPosts} toward: ${goal}. Edit before scheduling.`,
        hashtags: "#content #growth",
      },
      source: "stub",
      detail: "Add an OpenAI key for goal-driven incremental generation.",
    };
  }

  const priorBlock =
    params.previousPosts.length > 0
      ? params.previousPosts
          .map(
            (p, i) =>
              `Post ${i + 1}: title="${p.title}" | body excerpt="${p.body.slice(0, 200)}..."`
          )
          .join("\n")
      : "No previous posts yet — this is the opening post for the campaign.";

  const trendLines = (params.trendSnippets ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const userInput = `Campaign goal (every post must move toward this):
${goal}

This is post ${slotNum} of ${params.totalPosts} in the series.
Scheduled for: ${params.scheduledAt}

Audience topic: ${topic}

Posts already planned (build on these — do not duplicate):
${priorBlock}

${params.campaignHint?.trim() ? `Extra theme notes: ${params.campaignHint.trim()}` : ""}

${trendLines.length ? `Tone references:\n- ${trendLines.join("\n- ")}` : ""}

Choose the beat that best fits slot ${slotNum} of ${params.totalPosts} (e.g. hook, educate, story, question, proof, soft CTA) so the full series achieves the campaign goal.`;

  try {
    const result = await generateStructuredContent<{
      title?: string;
      body?: string;
      hashtags?: string;
    }>({
      apiKey,
      taskInstructions: [
        "You are an expert social media strategist.",
        "Return JSON only: {\"title\":\"...\",\"body\":\"...\",\"hashtags\":\"#a #b\"}.",
        "Write ONE post that advances a multi-part campaign toward a defined goal.",
        "Each new post must add distinct value — never repeat hooks or angles from earlier posts.",
        "Use current web research for timely angles when relevant.",
        SOCIAL_POST_FORMAT_INSTRUCTIONS,
      ].join(" "),
      userInput,
      jsonSchema: { name: "campaign_slot_post", schema: CAMPAIGN_POST_JSON_SCHEMA },
      researchParams: {
        niche,
        campaignGoal: goal,
        campaignHint: params.campaignHint,
        slotIndex: params.slotIndex,
        totalPosts: params.totalPosts,
        trendSnippets: params.trendSnippets,
      },
      maxOutputTokens: 2048,
    });

    if (!result.data) {
      return {
        post: {
          title: `Post ${slotNum}`,
          body: "AI unavailable — edit manually.",
          hashtags: "",
        },
        source: "fallback",
        detail: result.detail ?? "Generation failed",
      };
    }

    const clean = sanitizeDraftFields({
      title: result.data.title ?? `Post ${slotNum}`,
      body: result.data.body,
      hashtags: result.data.hashtags,
    });
    return {
      post: {
        title: clean.title || `Post ${slotNum}`,
        body: clean.body,
        hashtags: clean.hashtags,
      },
      source: result.source,
      detail: result.detail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      post: {
        title: `Post ${slotNum}`,
        body: "",
        hashtags: "",
      },
      source: "fallback",
      detail: msg.slice(0, 400),
    };
  }
}

function stubCampaignBatch(
  niche: NicheProfile,
  totalPosts: number,
  campaignHint?: string
): { posts: CampaignPostDraft[]; source: string; detail: string | null } {
  const topic = niche.topic.trim() || "your niche";
  const hint =
    campaignHint?.trim() !== "" ? campaignHint!.trim() : "Series";
  const posts: CampaignPostDraft[] = [];
  for (let i = 0; i < totalPosts; i++) {
    const k = i + 1;
    posts.push({
      title: `${hint} — idea ${k}`,
      body: `Draft ${k} for ${topic}. Refine the hook and CTA before you commit the calendar.\n\nTip: lead with a specific problem your audience recognizes, then offer one clear takeaway.`,
      hashtags: "#content #growth",
    });
  }
  return {
    posts,
    source: "stub",
    detail:
      "Add an OpenAI key in Settings (or OPENAI_API_KEY on the server) for full campaign copy.",
  };
}

async function openAiCampaignChunk(
  apiKey: string,
  niche: NicheProfile,
  nicheJson: string,
  topicLabel: string,
  trendLines: string[],
  campaignHint: string,
  count: number,
  offset: number
): Promise<{ posts: CampaignPostDraft[]; detail: string | null }> {
  const trendBlock =
    trendLines.length > 0
      ? `Recent/trend-style hooks to mirror in tone (not copy verbatim):\n- ${trendLines.join("\n- ")}`
      : "No manual trend hooks provided; search the web for timely angles for this niche.";

  const start = offset + 1;
  const end = offset + count;
  const userInput = `Build exactly ${count} social posts for slots ${start} through ${end} of a longer editorial calendar.

Primary audience topic: ${topicLabel}

Niche profile JSON:
${nicheJson}

${trendBlock}

Campaign theme / CTA focus (optional): ${campaignHint}

Posts must feel like a cohesive month of content: mix educational, story-driven, question, listicle, and soft-promo beats.
Vary opening lines; no two posts may start with the same first three words.

Return JSON: {"posts":[{"title":"...","body":"...","hashtags":"#a #b"}]}
The posts array length must be exactly ${count}.`;

  try {
    const result = await generateStructuredContent<{
      posts?: { title?: string; body?: string; hashtags?: string }[];
    }>({
      apiKey,
      taskInstructions: [
        "You are an expert social media strategist and SEO copywriter.",
        "Return compact JSON only, matching the requested schema.",
        "Each post must be unique: different angle, hook, and structure.",
        'Use platform-agnostic phrasing (no "link in bio").',
        "Bodies: under 2200 characters, punchy, scannable lines, optional emoji sparingly.",
        "Hashtags: one string with 3–8 relevant tags, space-separated with #.",
        "Ground timely claims in web research; avoid outdated generic filler.",
        SOCIAL_POST_FORMAT_INSTRUCTIONS,
      ].join(" "),
      userInput,
      jsonSchema: { name: "campaign_batch", schema: CAMPAIGN_BATCH_JSON_SCHEMA },
      researchParams: { niche, campaignHint, trendSnippets: trendLines },
      maxOutputTokens: 8192,
    });

    if (!result.data?.posts || !Array.isArray(result.data.posts)) {
      return {
        posts: [],
        detail: result.detail ?? "OpenAI JSON missing posts[]",
      };
    }

    const out: CampaignPostDraft[] = [];
    for (const row of result.data.posts) {
      if (!row || typeof row !== "object") continue;
      const clean = sanitizeDraftFields({
        title: row.title,
        body: row.body,
        hashtags: row.hashtags,
      });
      out.push({
        title: clean.title || "Post",
        body: clean.body,
        hashtags: clean.hashtags,
      });
    }
    return { posts: out, detail: result.detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { posts: [], detail: msg.slice(0, 400) };
  }
}

export function resolvePostTextForBoard(
  captionContext: string | undefined,
  explicitPrompt: string | undefined,
  niche: NicheProfile
): string {
  let core = captionContext?.trim() ?? "";
  if (!core) {
    const topic = niche.topic.trim();
    core = topic
      ? `Educational overview for audiences interested in: ${topic}. (Write your full post in the composer and generate again for a board tailored to that exact text.)`
      : "Professional growth and clarity — general themes. Add your post caption and regenerate for a tailored whiteboard.";
  }
  if (explicitPrompt?.trim()) {
    core += `\n\nAdditional creative direction from author: ${explicitPrompt.trim()}`;
  }
  return core;
}

export async function generatePostImage(
  apiKey: string | null,
  niche: NicheProfile = defaultNicheProfile(),
  explicitPrompt?: string,
  captionContext?: string,
  promptStyleId?: string,
  templateOverrides?: Record<string, string>
): Promise<{
  url: string | null;
  b64_json: string | null;
  source: string;
  detail: string | null;
}> {
  if (!apiKey) {
    return {
      url: null,
      b64_json: null,
      source: "unconfigured",
      detail:
        "Add an OpenAI API key in Settings or set OPENAI_API_KEY on the server.",
    };
  }

  const model =
    process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  const lower = model.toLowerCase();
  const isDalle3 = lower.includes("dall-e-3");
  const isDalle2 = lower.includes("dall-e-2");
  const isGptImage =
    lower.includes("gpt-image") ||
    lower.includes("gpt_image") ||
    lower.includes("chatgpt-image");

  let defaultSize = "1024x1792";
  if (isGptImage) defaultSize = "1024x1536";
  else if (isDalle2) defaultSize = "1024x1024";

  let size = process.env.OPENAI_IMAGE_SIZE?.trim() || defaultSize;
  if (isDalle3) {
    const allowed = ["1024x1024", "1792x1024", "1024x1792"];
    if (!allowed.includes(size)) size = "1024x1792";
  } else if (isDalle2) {
    const allowed = ["256x256", "512x512", "1024x1024"];
    if (!allowed.includes(size)) size = "1024x1024";
  } else if (isGptImage && !/^[1-9]\d*x[1-9]\d*$/.test(size)) {
    size = "1024x1536";
  }

  const postText = resolvePostTextForBoard(captionContext, explicitPrompt, niche);
  const nicheLines: string[] = [];
  if (niche.topic.trim()) nicheLines.push(`Niche topic: ${niche.topic.trim()}`);
  if (niche.audience.trim()) nicheLines.push(`Audience: ${niche.audience.trim()}`);
  if (niche.geography.trim()) nicheLines.push(`Market: ${niche.geography.trim()}`);
  const boardText =
    nicheLines.length > 0
      ? `${postText}\n\n${nicheLines.join("\n")}`
      : postText;
  const brief = buildImagePromptFromStyle(
    promptStyleId,
    boardText,
    niche,
    templateOverrides
  );

  const json: Record<string, unknown> = {
    model,
    prompt: brief,
    n: 1,
  };

  if (isGptImage) {
    json.size = size;
    const gptQuality =
      process.env.OPENAI_GPT_IMAGE_QUALITY?.trim() || "medium";
    if (["low", "medium", "high", "auto"].includes(gptQuality)) {
      json.quality = gptQuality;
    }
    const gptMod = process.env.OPENAI_GPT_IMAGE_MODERATION?.trim();
    if (gptMod === "low") json.moderation = "low";
  } else if (isDalle3) {
    json.size = size;
    json.quality = "standard";
  } else if (isDalle2) {
    json.size = size;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    });

    const bodyRaw = await res.text();
    if (!res.ok) {
      return {
        url: null,
        b64_json: null,
        source: "fallback",
        detail: summarizeOpenAiError(res.status, bodyRaw, "OpenAI Images"),
      };
    }

    const data = JSON.parse(bodyRaw) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const first = data.data?.[0];
    const urlVal = first?.url?.trim();
    const b64 = first?.b64_json?.replace(/\s+/g, "");

    if (urlVal) {
      return { url: urlVal, b64_json: null, source: "openai", detail: null };
    }
    if (b64) {
      return { url: null, b64_json: b64, source: "openai", detail: null };
    }

    return {
      url: null,
      b64_json: null,
      source: "fallback",
      detail: "OpenAI Images response contained no image URL or b64_json.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      url: null,
      b64_json: null,
      source: "fallback",
      detail: msg.slice(0, 400),
    };
  }
}
