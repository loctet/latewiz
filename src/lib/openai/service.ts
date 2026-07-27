import type { CampaignPostDraft, DraftResult, NicheProfile, PreviousCampaignPost } from "./types";
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
  CAMPAIGN_OUTLINE_JSON_SCHEMA,
  CAMPAIGN_POST_JSON_SCHEMA,
  DRAFT_JSON_SCHEMA,
} from "./schemas";
import {
  assignFallbackSlotBrief,
  formatPriorPostsBlock,
  formatSlotBriefBlock,
  outlineBeatToSlotBrief,
  type CampaignOutlineBeat,
  type CampaignSlotBrief,
} from "./campaign-arc";
import {
  buildGoalPriorityInstructions,
  buildOutlineStrategyInstructions,
  buildSlotFormatInstructions,
  enforceBodyLength,
  isDuplicateBody,
  parseCampaignGoalConstraints,
} from "./campaign-goal-format";
import {
  appendReferenceImagesToFormData,
  loadReferenceImages,
} from "./reference-image";
import {
  buildPostPromptStructureBlock,
  buildPostPromptTaskInstructions,
  isObjectiveResearchStyle,
  resolvePostPromptStyle,
  type CustomPostPromptStyle,
} from "@/lib/post-prompt-catalog";
import { isNewsIntent } from "@/lib/web-search/build-query";
import {
  applyResearchDepthToPostStyle,
  getResearchDepth,
  parseResearchDepthId,
} from "@/lib/research-depth";

export type { PreviousCampaignPost } from "./types";
export type { CampaignSlotBrief, CampaignOutlineBeat } from "./campaign-arc";

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
  hint?: string,
  postPromptStyleId?: string,
  postPromptTemplates?: Record<string, string> | null,
  researchDepthId?: string | null,
  customPostPromptStyles?: CustomPostPromptStyle[] | null,
  userId?: string | null,
  publicOrigin?: string | null
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

  const hintText = hint?.trim() ?? "";
  const topic = niche.topic.trim() || "your niche";
  const subject = hintText || topic;
  const goal = hintText || `Timely post for ${topic}`;
  const depthId = parseResearchDepthId(researchDepthId);
  const depth = getResearchDepth(depthId);

  const postStyle = applyResearchDepthToPostStyle(
    resolvePostPromptStyle({
      styleId: postPromptStyleId,
      campaignGoal: hintText || topic,
      isListMode: false,
      listSubject: hintText || undefined,
      customStyles: customPostPromptStyles ?? undefined,
      templateOverrides: postPromptTemplates,
    }),
    depth,
    goal
  );
  const usePostTemplate = postStyle.minBodyChars > 0;
  const objectiveResearch =
    depthId === "deep" || isObjectiveResearchStyle(postStyle.id);
  // Deep mode: teaser only — skip long-form structure blocks (full report → PDF)
  const structureBlock =
    usePostTemplate && depthId !== "deep"
      ? buildPostPromptStructureBlock(
          postStyle,
          {
            subject,
            goal,
            slotNum: 1,
            totalPosts: 1,
          },
          postPromptTemplates?.[postStyle.id]
        )
      : "";

  const nicheContext = buildNicheUserContext(niche, { objectiveResearch });

  const userInput = [
    hintText
      ? `Topic / brief (primary subject — search the web for the latest on it):\n${hintText}`
      : objectiveResearch
        ? `Generate one objective research-backed post on the subject.`
        : `Generate one timely post aligned with this niche.`,
    structureBlock ? `\n${structureBlock}` : "",
    depthId === "deep"
      ? "\nDeep mode: produce a short social teaser (~1000 characters). Full analysis is delivered as a PDF."
      : "",
    `\n${nicheContext}`,
    usePostTemplate && depthId !== "deep"
      ? "\nWrite ONE post following the structure above. Use web research for timely facts."
      : depthId === "deep"
        ? "\nWrite one short teaser grounded in deep research."
        : "\nWrite one timely post grounded in current web research when available.",
  ]
    .filter(Boolean)
    .join("\n");

  const taskInstructions =
    depthId === "deep"
      ? [
          "You write short professional social teasers from deep research.",
          "Return JSON with keys title, body, hashtags.",
          "Body target ~900–1100 characters.",
          SOCIAL_POST_FORMAT_INSTRUCTIONS,
        ].join(" ")
      : usePostTemplate
        ? buildPostPromptTaskInstructions(postStyle)
        : [
            "You write concise, timely social media posts.",
            "Return JSON with keys title, body, hashtags.",
            "Prioritize recent developments from web research over generic or outdated claims.",
            SOCIAL_POST_FORMAT_INSTRUCTIONS,
          ].join(" ");

  const maxOutputTokens = usePostTemplate ? postStyle.maxOutputTokens : undefined;

  const newsIntent = isNewsIntent(hintText, goal);
  const topicForSearch = objectiveResearch
    ? (hintText || subject || "crypto market").trim()
    : (topic || hintText || "industry").trim();
  const researchSearchHint = newsIntent
    ? `${topicForSearch} news headlines today`.slice(0, 200)
    : undefined;

  try {
    const result = await generateStructuredContent<{
      title?: string;
      body?: string;
      hashtags?: string;
    }>({
      apiKey,
      taskInstructions,
      userInput,
      jsonSchema: { name: "social_post_draft", schema: DRAFT_JSON_SCHEMA },
      researchParams: {
        niche,
        hint: hintText || hint,
        searchHint: researchSearchHint,
        researchDepthId: depthId,
        ignoreNicheBias: objectiveResearch,
      },
      maxOutputTokens,
      researchDepthId: depthId,
      userId,
      titleHint: subject,
      publicOrigin,
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
      pdfUrl: result.pdfUrl ?? null,
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


/**
 * Plan distinct subtopics for each post so the campaign builds incrementally toward the goal.
 */
export async function generateCampaignOutline(
  apiKey: string | null,
  niche: NicheProfile,
  params: {
    campaignGoal: string;
    totalPosts: number;
    campaignHint?: string;
    trendSnippets?: string[];
  }
): Promise<{
  beats: CampaignSlotBrief[];
  source: string;
  detail: string | null;
}> {
  const goal = params.campaignGoal.trim() || "Grow audience engagement";
  const total = params.totalPosts;
  const constraints = parseCampaignGoalConstraints(goal);

  const fallback = () =>
    Array.from({ length: total }, (_, i) =>
      assignFallbackSlotBrief(i, total, goal, constraints)
    );

  if (!apiKey) {
    return {
      beats: fallback(),
      source: "stub",
      detail: "Add an OpenAI key for AI-planned campaign arcs.",
    };
  }

  const topic = niche.topic.trim() || "your niche";
  const nicheContext = buildNicheUserContext(niche);
  const trendLines = (params.trendSnippets ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const goalBlock = buildGoalPriorityInstructions(goal, constraints);
  const strategyBlock = buildOutlineStrategyInstructions(constraints, total);

  const userInput = `Design a ${total}-post social media content roadmap.

${goalBlock}

Niche context (background only — goal defines format):
${topic ? `Topic: ${topic}` : ""}

${nicheContext}

${params.campaignHint?.trim() ? `Extra theme notes: ${params.campaignHint.trim()}` : ""}

${trendLines.length ? `Tone references:\n- ${trendLines.join("\n- ")}` : ""}

${strategyBlock}`;

  const outlineTaskInstructions =
    constraints.format === "micro"
      ? [
          "You are an expert content strategist planning daily micro-post campaigns.",
          "Return JSON only: {\"beats\":[{\"subtopic\":\"...\",\"angle\":\"...\",\"keyPoint\":\"...\",\"searchHint\":\"...\"}]}.",
          "Each beat = one unique daily theme. Never plan educational definitions or repeated angles.",
          "searchHint: leave empty unless the beat needs a specific quote lookup.",
        ].join(" ")
      : [
          "You are an expert content strategist planning multi-post campaigns.",
          "Return JSON only: {\"beats\":[{\"subtopic\":\"...\",\"angle\":\"...\",\"keyPoint\":\"...\",\"searchHint\":\"...\"}]}.",
          "Each beat must cover DISTINCT knowledge the audience needs to reach the campaign goal.",
          "Order beats so understanding builds incrementally — never repeat or overlap topics.",
          "searchHint: short web-search phrase for fresh facts about that beat only.",
        ].join(" ");

  try {
    const result = await generateStructuredContent<{
      beats?: CampaignOutlineBeat[];
    }>({
      apiKey,
      taskInstructions: outlineTaskInstructions,
      userInput,
      jsonSchema: { name: "campaign_outline", schema: CAMPAIGN_OUTLINE_JSON_SCHEMA },
      researchParams: constraints.skipWebSearch
        ? undefined
        : {
            niche,
            campaignGoal: goal,
            campaignHint: params.campaignHint,
            totalPosts: total,
            trendSnippets: params.trendSnippets,
          },
      maxOutputTokens: 4096,
    });

    if (!result.data?.beats?.length) {
      return {
        beats: fallback(),
        source: "fallback",
        detail: result.detail ?? "Outline generation failed; using default arc.",
      };
    }

    const beats: CampaignSlotBrief[] = [];
    for (let i = 0; i < total; i++) {
      const row = result.data.beats[i];
      if (row?.subtopic?.trim()) {
        beats.push(outlineBeatToSlotBrief(i, total, row));
      } else {
        beats.push(assignFallbackSlotBrief(i, total, goal, constraints));
      }
    }

    return {
      beats,
      source: result.source,
      detail: result.detail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      beats: fallback(),
      source: "fallback",
      detail: msg.slice(0, 400),
    };
  }
}

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
    slotBrief?: CampaignSlotBrief;
    coveredSubtopics?: string[];
    postPromptStyleId?: string;
    postPromptTemplates?: Record<string, string> | null;
    customPostPromptStyles?: CustomPostPromptStyle[] | null;
    isListMode?: boolean;
    researchDepthId?: string | null;
    userId?: string | null;
    publicOrigin?: string | null;
  }
): Promise<{
  post: CampaignPostDraft;
  source: string;
  detail: string | null;
}> {
  const slotNum = params.slotIndex + 1;
  const goal = params.campaignGoal.trim() || "Grow audience engagement";
  const topic = niche.topic.trim() || "your niche";
  const constraints = parseCampaignGoalConstraints(goal);
  const depthId = parseResearchDepthId(params.researchDepthId);
  const depth = getResearchDepth(depthId);

  if (!apiKey) {
    const brief = assignFallbackSlotBrief(
      params.slotIndex,
      params.totalPosts,
      goal,
      constraints
    );
    return {
      post: {
        title: constraints.format === "micro" ? `Jour ${slotNum}` : `${goal.slice(0, 40)} — step ${slotNum}`,
        body:
          constraints.format === "micro"
            ? `Bonjour ! ${brief.subtopic} — message ${slotNum}/${params.totalPosts}.`
            : `Post ${slotNum} of ${params.totalPosts} toward: ${goal}. Edit before scheduling.`,
        hashtags: constraints.format === "micro" ? "" : "#content #growth",
      },
      source: "stub",
      detail: "Add an OpenAI key for goal-driven incremental generation.",
    };
  }

  const brief =
    params.slotBrief ??
    assignFallbackSlotBrief(params.slotIndex, params.totalPosts, goal, constraints);

  const isListItem =
    params.isListMode ?? brief.beat === "list item focus";
  const postStyle = applyResearchDepthToPostStyle(
    resolvePostPromptStyle({
      styleId: params.postPromptStyleId,
      campaignGoal: goal,
      isListMode: isListItem,
      listSubject: brief.subtopic,
      customStyles: params.customPostPromptStyles ?? undefined,
      templateOverrides: params.postPromptTemplates,
    }),
    depth,
    goal
  );
  const usePostTemplate =
    constraints.format !== "micro" && postStyle.minBodyChars > 0;
  const objectiveResearch =
    depthId === "deep" || isObjectiveResearchStyle(postStyle.id);
  const structureBlock =
    usePostTemplate && depthId !== "deep"
      ? buildPostPromptStructureBlock(
          postStyle,
          {
            subject: brief.subtopic,
            goal,
            slotNum,
            totalPosts: params.totalPosts,
          },
          params.postPromptTemplates?.[postStyle.id]
        )
      : "";

  const priorBlock = formatPriorPostsBlock(params.previousPosts);
  const briefBlock = formatSlotBriefBlock(brief);
  const goalBlock = buildGoalPriorityInstructions(goal, constraints);
  const formatBlock = buildSlotFormatInstructions(constraints);

  const trendLines = (params.trendSnippets ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const buildUserInput = (retryNote?: string) =>
    [
      goalBlock,
      "",
      `This is post ${slotNum} of ${params.totalPosts} in the series.`,
      `Scheduled for: ${params.scheduledAt}`,
      objectiveResearch
        ? "OBJECTIVE RESEARCH: Ignore workspace niche/audience. Analyze the assigned subject only."
        : topic
          ? `Niche context (background only): ${topic}`
          : "",
      depthId === "deep"
        ? "Deep mode: short social teaser (~1000 chars). Full analysis is delivered as a PDF with a link in the post."
        : "",
      "",
      briefBlock,
      formatBlock ? `\n${formatBlock}` : "",
      structureBlock ? `\n${structureBlock}` : "",
      "",
      "Posts already published in this campaign:",
      priorBlock,
      params.campaignHint?.trim() && !objectiveResearch
        ? `\nExtra theme notes: ${params.campaignHint.trim()}`
        : "",
      trendLines.length && !objectiveResearch
        ? `\nTone references:\n- ${trendLines.join("\n- ")}`
        : "",
      "",
      constraints.format === "micro"
        ? "Write ONE unique micro-message matching the goal format. Never copy or paraphrase prior posts."
        : depthId === "deep"
          ? "Write ONE short teaser for the assigned subtopic. Never reuse prior posts."
          : "Write ONE post that delivers ONLY the assigned subtopic/angle. Never reuse opening lines, statistics, or arguments from prior posts.",
      retryNote ?? "",
    ]
      .filter(Boolean)
      .join("\n");

  const slotTaskInstructions =
    constraints.format === "micro"
      ? [
          "You write short, warm daily social micro-posts.",
          "Return JSON only: {\"title\":\"...\",\"body\":\"...\",\"hashtags\":\"#a #b\"}.",
          "Follow the campaign goal format exactly — NOT educational articles or generic definitions.",
          "Each post must be emotionally distinct from all prior posts in the series.",
          "Title can be short (e.g. day number) or empty string.",
          SOCIAL_POST_FORMAT_INSTRUCTIONS,
        ].join(" ")
      : depthId === "deep"
        ? [
            "You write short professional social teasers from deep research.",
            "Return JSON only: {\"title\":\"...\",\"body\":\"...\",\"hashtags\":\"#a #b\"}.",
            "Body target ~900–1100 characters — full report is a separate PDF.",
            SOCIAL_POST_FORMAT_INSTRUCTIONS,
          ].join(" ")
      : usePostTemplate
        ? buildPostPromptTaskInstructions(postStyle)
        : [
            "You are an expert social media strategist.",
            "Return JSON only: {\"title\":\"...\",\"body\":\"...\",\"hashtags\":\"#a #b\"}.",
            "Write ONE post for a multi-part campaign — cover ONLY the assigned subtopic/angle.",
            "Each post must add distinct knowledge; never repeat hooks, stats, or phrasing from earlier posts.",
            "Do not start with the same opening pattern as prior posts in the series.",
            "Use current web research for timely angles when relevant.",
            SOCIAL_POST_FORMAT_INSTRUCTIONS,
          ].join(" ");

  const maxOutputTokens =
    constraints.format === "micro"
      ? 512
      : usePostTemplate
        ? postStyle.maxOutputTokens
        : 2048;

  const researchSearchHint =
    brief.searchHint?.trim() ||
    (usePostTemplate
      ? objectiveResearch
        ? `${brief.subtopic} market analysis`
        : `${brief.subtopic} ${goal}`
      : undefined);

  const researchParams = constraints.skipWebSearch
    ? undefined
    : {
        niche,
        campaignGoal: objectiveResearch ? undefined : goal,
        campaignHint: objectiveResearch ? undefined : params.campaignHint,
        slotIndex: params.slotIndex,
        totalPosts: params.totalPosts,
        trendSnippets: objectiveResearch ? undefined : params.trendSnippets,
        searchHint: researchSearchHint,
        coveredSubtopics: params.coveredSubtopics,
        researchDepthId: depthId,
        ignoreNicheBias: objectiveResearch,
      };

  const maxAttempts = usePostTemplate ? 3 : 2;

  try {
    let detail: string | null = null;
    let source = "openai";
    let lastBodyTooShort = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const retryNote =
        attempt > 0
          ? lastBodyTooShort && postStyle.minBodyChars > 0
            ? depthId === "deep"
              ? `\n\nRETRY: Your previous body was too short (under ${postStyle.minBodyChars} characters). Write a denser ~1000-character teaser with thesis, data points, and risk/catalyst.`
              : `\n\nRETRY: Your previous body was too short (under ${postStyle.minBodyChars} characters). Write the FULL structured analysis with all required sections and substantive paragraphs.`
            : "\n\nRETRY: Your previous attempt duplicated an earlier post or ignored the goal format. Write something completely different that matches the goal."
          : undefined;
      lastBodyTooShort = false;

      const result = await generateStructuredContent<{
        title?: string;
        body?: string;
        hashtags?: string;
      }>({
        apiKey,
        taskInstructions: slotTaskInstructions,
        userInput: buildUserInput(retryNote),
        jsonSchema: { name: "campaign_slot_post", schema: CAMPAIGN_POST_JSON_SCHEMA },
        researchParams,
        maxOutputTokens,
        researchDepthId: depthId,
        userId: params.userId,
        titleHint: brief.subtopic,
        publicOrigin: params.publicOrigin,
      });

      detail = result.detail;
      source = result.source;

      if (!result.data) continue;

      const clean = sanitizeDraftFields({
        title: result.data.title ?? (constraints.format === "micro" ? "" : `Post ${slotNum}`),
        body: result.data.body,
        hashtags: result.data.hashtags,
      });

      // Exclude PDF URL line from length check for deep teasers
      const bodyForLength =
        depthId === "deep"
          ? clean.body.replace(/\n\nFull report:\s*\S+/i, "").trim()
          : clean.body;
      const body =
        depthId === "deep"
          ? clean.body
          : enforceBodyLength(clean.body, constraints.maxBodyChars);

      if (
        postStyle.minBodyChars > 0 &&
        bodyForLength.length < postStyle.minBodyChars &&
        attempt < maxAttempts - 1
      ) {
        lastBodyTooShort = true;
        continue;
      }

      if (attempt === 0 && isDuplicateBody(body, params.previousPosts)) {
        continue;
      }

      return {
        post: {
          title: clean.title || (constraints.format === "micro" ? `Jour ${slotNum}` : `Post ${slotNum}`),
          body,
          hashtags: clean.hashtags,
          pdfUrl: result.pdfUrl ?? null,
        },
        source,
        detail,
      };
    }

    return {
      post: {
        title: `Post ${slotNum}`,
        body: "AI unavailable — edit manually.",
        hashtags: "",
      },
      source: "fallback",
      detail: detail ?? "Generation failed",
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

function parseOpenAiImageResponse(bodyRaw: string): {
  url: string | null;
  b64_json: string | null;
  detail: string | null;
} {
  const data = JSON.parse(bodyRaw) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const first = data.data?.[0];
  const urlVal = first?.url?.trim();
  const b64 = first?.b64_json?.replace(/\s+/g, "");

  if (urlVal) {
    return { url: urlVal, b64_json: null, detail: null };
  }
  if (b64) {
    return { url: null, b64_json: b64, detail: null };
  }
  return {
    url: null,
    b64_json: null,
    detail: "OpenAI Images response contained no image URL or b64_json.",
  };
}

export async function generatePostImage(
  apiKey: string | null,
  niche: NicheProfile = defaultNicheProfile(),
  explicitPrompt?: string,
  captionContext?: string,
  promptStyleId?: string,
  templateOverrides?: Record<string, string>,
  referenceImageUrls?: string[]
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

  const refs = (referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter(Boolean);
  const useReferenceEdit = refs.length > 0;

  if (useReferenceEdit && isDalle3) {
    return {
      url: null,
      b64_json: null,
      source: "fallback",
      detail:
        "Reference images require a GPT Image model (e.g. gpt-image-2). DALL·E 3 does not support image inputs.",
    };
  }

  const gptQuality =
    process.env.OPENAI_GPT_IMAGE_QUALITY?.trim() || "medium";
  const gptMod = process.env.OPENAI_GPT_IMAGE_MODERATION?.trim();

  try {
    if (useReferenceEdit) {
      if (!isGptImage && !isDalle2) {
        return {
          url: null,
          b64_json: null,
          source: "fallback",
          detail:
            "Reference images require a GPT Image model (gpt-image-2) or DALL·E 2.",
        };
      }

      const referenceFiles = await loadReferenceImages(refs);
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", brief);
      appendReferenceImagesToFormData(form, referenceFiles);

      if (isGptImage) {
        form.append("size", size);
        if (["low", "medium", "high", "auto"].includes(gptQuality)) {
          form.append("quality", gptQuality);
        }
        if (gptMod === "low") form.append("moderation", "low");
      } else if (isDalle2) {
        form.append("size", size);
      }

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      const bodyRaw = await res.text();
      if (!res.ok) {
        return {
          url: null,
          b64_json: null,
          source: "fallback",
          detail: summarizeOpenAiError(
            res.status,
            bodyRaw,
            "OpenAI Image edit"
          ),
        };
      }

      const parsed = parseOpenAiImageResponse(bodyRaw);
      if (parsed.url || parsed.b64_json) {
        return {
          url: parsed.url,
          b64_json: parsed.b64_json,
          source: "openai",
          detail: null,
        };
      }

      return {
        url: null,
        b64_json: null,
        source: "fallback",
        detail:
          parsed.detail ?? "OpenAI Image edit response contained no image.",
      };
    }

    const json: Record<string, unknown> = {
      model,
      prompt: brief,
      n: 1,
    };

    if (isGptImage) {
      json.size = size;
      if (["low", "medium", "high", "auto"].includes(gptQuality)) {
        json.quality = gptQuality;
      }
      if (gptMod === "low") json.moderation = "low";
    } else if (isDalle3) {
      json.size = size;
      json.quality = "standard";
    } else if (isDalle2) {
      json.size = size;
    }

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

    const parsed = parseOpenAiImageResponse(bodyRaw);
    if (parsed.url || parsed.b64_json) {
      return {
        url: parsed.url,
        b64_json: parsed.b64_json,
        source: "openai",
        detail: null,
      };
    }

    return {
      url: null,
      b64_json: null,
      source: "fallback",
      detail:
        parsed.detail ??
        "OpenAI Images response contained no image URL or b64_json.",
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
