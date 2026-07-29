import {
  acquireScheduledCampaignSlot,
  computeCampaignStatus,
  getDueScheduledCampaignSlots,
  getScheduledCampaign,
  updateScheduledCampaign,
} from "@/lib/server/scheduled-campaign-store";
import type {
  ScheduledCampaign,
  ScheduledCampaignRunResult,
  ScheduledCampaignSlot,
} from "@/lib/scheduled-campaigns";
import {
  generateCampaignSlot,
  generatePostImage,
  generatePostVideo,
  sanitizeSocialPostText,
} from "@/lib/openai";
import { zernioRequest } from "@/lib/zernio-api";
import { saveGeneratedImageFile, saveGeneratedVideoFile } from "@/lib/server/generated-media-files";
import { uploadMediaFromUrl } from "@/lib/server/server-media-upload";
import { getUserSecret, allowEnvKeyFallback } from "@/lib/server/vault";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import { isPlausibleZernioKey } from "@/lib/server/resolve-user-keys";

async function resolveCampaignOpenAiKey(userId: string): Promise<string | null> {
  const fromVault = await getUserSecret(userId, "openai");
  if (fromVault && isPlausibleOpenAiApiKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env = process.env.OPENAI_API_KEY?.trim();
    if (env && isPlausibleOpenAiApiKey(env)) return env;
  }
  return null;
}

async function resolveCampaignFalKey(userId: string): Promise<string | null> {
  const fromVault = await getUserSecret(userId, "fal");
  if (fromVault && isPlausibleFalApiKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env =
      process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
    if (env && isPlausibleFalApiKey(env)) return env;
  }
  return null;
}

async function resolveCampaignZernioKey(userId: string): Promise<string | null> {
  const fromVault = await getUserSecret(userId, "zernio");
  if (fromVault && isPlausibleZernioKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env = process.env.LATE_API_KEY?.trim();
    if (env && isPlausibleZernioKey(env)) return env;
  }
  return null;
}

function buildSlotContent(
  slot: Pick<ScheduledCampaignSlot, "body" | "hashtags">
): string {
  return [slot.body, slot.hashtags].filter(Boolean).join("\n\n");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }
  if (typeof error === "string" && error.trim()) {
    return error.slice(0, 500);
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const nested =
      (typeof record.message === "string" && record.message) ||
      (typeof record.error === "string" && record.error) ||
      (record.error &&
      typeof record.error === "object" &&
      typeof (record.error as { message?: unknown }).message === "string"
        ? String((record.error as { message: string }).message)
        : null);
    if (nested) return nested.slice(0, 500);
    try {
      return JSON.stringify(error).slice(0, 500);
    } catch {
      /* ignore */
    }
  }
  return "Unknown error";
}

async function persistGeneratedImageBestEffort(
  userId: string,
  sourceUrl: string,
  captionDigest: string
): Promise<string> {
  try {
    const saved = await saveGeneratedImageFile(userId, sourceUrl, captionDigest);
    return saved.url;
  } catch (error) {
    console.warn(
      "Skipping local generated-image persist:",
      errorMessage(error)
    );
    return sourceUrl;
  }
}

async function persistGeneratedVideoBestEffort(
  userId: string,
  sourceUrl: string,
  captionDigest: string,
  durationSeconds?: string
): Promise<string> {
  try {
    const saved = await saveGeneratedVideoFile(
      userId,
      sourceUrl,
      captionDigest,
      durationSeconds
    );
    return saved.url;
  } catch (error) {
    console.warn(
      "Skipping local generated-video persist:",
      errorMessage(error)
    );
    return sourceUrl;
  }
}

async function maybeGenerateMedia(
  campaign: ScheduledCampaign,
  slot: ScheduledCampaignSlot,
  lateKey: string,
  openaiKey: string | null,
  falKey: string | null,
  userId: string
): Promise<{
  mediaItems?: Array<{ type: "image" | "video"; url: string }>;
  slotPatch: Partial<ScheduledCampaignSlot>;
  warning?: string | null;
}> {
  const captionContext = [slot.title, slot.body, slot.hashtags, slot.aiInstruction]
    .filter(Boolean)
    .join("\n\n");
  const digest = captionContext.slice(0, 120);

  if (campaign.mediaMode === "image") {
    if (!openaiKey) {
      return {
        slotPatch: {},
        warning: "Add your OpenAI key in Settings for image generation.",
      };
    }
    const imageResult = await generatePostImage(
      openaiKey,
      campaign.niche,
      slot.aiInstruction,
      captionContext,
      slot.imagePromptStyleId ?? campaign.imagePromptStyleId,
      campaign.imagePromptTemplates,
      slot.reference_image_url?.trim() ? [slot.reference_image_url.trim()] : undefined
    );
    if (!imageResult.url && !imageResult.b64_json) {
      throw new Error(
        imageResult.detail ??
          "Image generation failed for this scheduled slot (media mode requires an image)."
      );
    }

    const imageUrl = imageResult.url ?? `data:image/png;base64,${imageResult.b64_json}`;
    const previewUrl = await persistGeneratedImageBestEffort(
      userId,
      imageUrl,
      digest
    );
    const uploaded = await uploadMediaFromUrl(
      lateKey,
      imageUrl,
      "image",
      `scheduled-campaign-${slot.id}`
    );
    return {
      mediaItems: [{ type: "image", url: uploaded.url }],
      slotPatch: {
        image_url: previewUrl,
        video_url: null,
        detail: imageResult.detail,
      },
      warning:
        campaign.imageWatermarkSettings.enabled &&
        campaign.imageWatermarkSettings.text.trim()
          ? "Server-side scheduled campaigns currently skip browser-only watermark stamping."
          : null,
    };
  }

  if (campaign.mediaMode === "video") {
    const videoResult = await generatePostVideo(
      campaign.videoProvider,
      openaiKey,
      falKey,
      campaign.niche,
      slot.aiInstruction,
      captionContext,
      slot.videoPromptStyleId ?? campaign.videoPromptStyleId,
      campaign.videoPromptTemplates
    );
    if (!videoResult.url) {
      throw new Error(
        videoResult.detail ??
          "Video generation failed for this scheduled slot (media mode requires a video)."
      );
    }

    const previewUrl = await persistGeneratedVideoBestEffort(
      userId,
      videoResult.url,
      digest,
      videoResult.duration_seconds
    );
    const uploaded = await uploadMediaFromUrl(
      lateKey,
      videoResult.url,
      "video",
      `scheduled-campaign-${slot.id}`
    );
    return {
      mediaItems: [{ type: "video", url: uploaded.url }],
      slotPatch: {
        video_url: previewUrl,
        image_url: null,
        detail: videoResult.detail,
      },
    };
  }

  return { slotPatch: {} };
}

function extractPostId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const direct =
    (typeof record._id === "string" && record._id) ||
    (typeof record.id === "string" && record.id) ||
    null;
  if (direct) return direct;

  for (const key of ["post", "existingPost", "data"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const id =
        (typeof nestedRecord._id === "string" && nestedRecord._id) ||
        (typeof nestedRecord.id === "string" && nestedRecord.id) ||
        null;
      if (id) return id;
    }
  }
  return null;
}

/**
 * Create (or idempotently reuse) a Zernio post for this campaign slot.
 * Deferred slots schedule for slot.scheduled_at — Zernio publishes later.
 * Catch-up (scheduled time already past) uses publishNow once.
 */
async function createScheduledPost(
  campaign: ScheduledCampaign,
  slot: ScheduledCampaignSlot,
  lateKey: string,
  mediaItems?: Array<{ type: "image" | "video"; url: string }>
): Promise<string | null> {
  if (!campaign.targets.length) {
    throw new Error(
      "No publishing targets on this campaign. Re-save the deferred campaign with at least one account selected."
    );
  }

  const now = Date.now();
  const scheduledAtMs = new Date(slot.scheduled_at).getTime();
  // Generate ~1h early, then let Zernio hold until the scheduled time.
  // Only publish immediately when the scheduled time has already passed.
  const publishNow =
    !Number.isNaN(scheduledAtMs) && scheduledAtMs <= now;

  const requestId = `latewiz-campaign-${campaign.id}-slot-${slot.id}`;
  const body = {
    content: sanitizeSocialPostText(slot.content || buildSlotContent(slot)),
    mediaItems,
    platforms: campaign.targets.map((target) => ({
      platform: target.platform,
      accountId: target.accountId,
    })),
    scheduledFor: publishNow ? undefined : slot.scheduled_at,
    publishNow,
    timezone: campaign.timezone,
  };

  const data = await zernioRequest<unknown>(lateKey, "/posts", {
    method: "POST",
    body,
    headers: {
      // Zernio same-request idempotency — retries must not create duplicates.
      "x-request-id": requestId,
    },
  });

  const postId = extractPostId(data);
  if (!postId) {
    console.warn(
      "Zernio createPost returned no post id; response:",
      typeof data === "object" ? JSON.stringify(data).slice(0, 500) : data
    );
  }
  return postId;
}

type SlotProcessResult = {
  status: "generated" | "failed" | "skipped";
  error?: string;
};

async function processScheduledCampaignSlot(
  campaignId: string,
  slotId: string
): Promise<SlotProcessResult> {
  const acquired = await acquireScheduledCampaignSlot(campaignId, slotId);
  const acquiredSlot = acquired?.slots.find((slot) => slot.id === slotId);
  if (!acquired || !acquiredSlot || acquiredSlot.status !== "processing") {
    return { status: "skipped" };
  }
  if (acquiredSlot.postId?.trim()) {
    return { status: "skipped" };
  }

  const userId = acquired.userId;
  const lateKey = await resolveCampaignZernioKey(userId);
  const openaiKey = await resolveCampaignOpenAiKey(userId);
  const falKey = await resolveCampaignFalKey(userId);

  if (!lateKey) {
    const message =
      "Add your Zernio API key in Settings — scheduled posts use your vault, not the host key.";
    await updateScheduledCampaign(campaignId, (campaign) => ({
      ...campaign,
      slots: campaign.slots.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              status: "failed",
              lastError: message,
              processingLeaseUntil: null,
            }
          : slot
      ),
    }));
    return { status: "failed", error: message };
  }

  if (!openaiKey) {
    const message =
      "Add your OpenAI API key in Settings — AI generation uses your vault, not the host key.";
    await updateScheduledCampaign(campaignId, (campaign) => ({
      ...campaign,
      slots: campaign.slots.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              status: "failed",
              lastError: message,
              processingLeaseUntil: null,
            }
          : slot
      ),
    }));
    return { status: "failed", error: message };
  }

  try {
    const campaign = (await getScheduledCampaign(campaignId)) ?? acquired;
    const sortedSlots = [...campaign.slots].sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    const slotIndex = sortedSlots.findIndex((slot) => slot.id === slotId);
    const slot = sortedSlots[slotIndex];
    if (!slot) return { status: "skipped" };

    // If a previous attempt already scheduled/published this slot, never recreate.
    if (slot.postId?.trim()) {
      await updateScheduledCampaign(campaignId, (current) => ({
        ...current,
        slots: current.slots.map((currentSlot) =>
          currentSlot.id === slotId
            ? {
                ...currentSlot,
                status: "generated",
                processingLeaseUntil: null,
                processingOwnerToken: null,
                lastError: null,
              }
            : currentSlot
        ),
      }));
      return { status: "generated" };
    }

    const previousPosts = sortedSlots
      .slice(0, slotIndex)
      .filter((item) => item.status === "generated" && item.body.trim())
      .map((item) => ({
        title: item.title,
        body: item.body,
        hashtags: item.hashtags,
      }));

    // Reuse copy from a partial previous attempt (avoid regenerating on retry).
    let generatedSlot: ScheduledCampaignSlot;
    const canReuseCopy =
      Boolean(slot.body?.trim()) &&
      Boolean(slot.generatedAt) &&
      slot.source !== "stub" &&
      slot.source !== "fallback";

    if (canReuseCopy) {
      generatedSlot = {
        ...slot,
        content: slot.content || buildSlotContent(slot),
        lastError: null,
      };
    } else {
      const generated = await generateCampaignSlot(openaiKey, campaign.niche, {
        campaignGoal: campaign.campaignGoal,
        slotIndex,
        totalPosts: sortedSlots.length,
        scheduledAt: slot.scheduled_at,
        previousPosts,
        campaignHint: campaign.campaignHint || undefined,
        trendSnippets: campaign.trendBlock
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        slotBrief: slot.brief,
        coveredSubtopics: sortedSlots
          .slice(0, slotIndex)
          .map((item) => item.brief?.subtopic)
          .filter((value): value is string => Boolean(value)),
        postPromptStyleId: campaign.postPromptStyleId,
        postPromptTemplates: campaign.postPromptTemplates,
        customPostPromptStyles: campaign.customPostPromptStyles,
        aiInstruction: slot.aiInstruction,
        researchDepthId: campaign.researchDepthId,
        isListMode: campaign.campaignMode === "list",
        userId: campaign.userId,
      });

      if (!generated.post.body.trim()) {
        throw new Error(generated.detail ?? "Campaign slot generation returned no body.");
      }
      if (generated.source === "stub" || generated.source === "fallback") {
        throw new Error(
          generated.detail ??
            "Scheduled campaign generation needs live AI output; fallback copy is not published automatically."
        );
      }

      generatedSlot = {
        ...slot,
        title: generated.post.title,
        body: generated.post.body,
        hashtags: generated.post.hashtags,
        content: [generated.post.body, generated.post.hashtags]
          .filter(Boolean)
          .join("\n\n"),
        source: generated.source,
        detail: generated.detail,
        pdfUrl: generated.post.pdfUrl ?? null,
        generatedAt: new Date().toISOString(),
        lastError: null,
      };
    }

    // Persist copy while still processing so a crash mid-publish doesn't lose work
    await updateScheduledCampaign(campaignId, (current) => ({
      ...current,
      slots: current.slots.map((currentSlot) =>
        currentSlot.id === slotId
          ? {
              ...currentSlot,
              ...generatedSlot,
              status: "processing",
              processingLeaseUntil: new Date(
                Date.now() + 10 * 60 * 1000
              ).toISOString(),
            }
          : currentSlot
      ),
    }));

    // Reuse uploaded media URLs when present to avoid regenerating images on retry.
    let mediaItems: Array<{ type: "image" | "video"; url: string }> | undefined;
    let mediaSlotPatch: Partial<ScheduledCampaignSlot> = {};
    let mediaWarning = "";

    const existingImage = generatedSlot.image_url?.trim();
    const existingVideo = generatedSlot.video_url?.trim();
    if (campaign.mediaMode === "image" && existingImage?.startsWith("http")) {
      mediaItems = [{ type: "image", url: existingImage }];
    } else if (campaign.mediaMode === "video" && existingVideo?.startsWith("http")) {
      mediaItems = [{ type: "video", url: existingVideo }];
    } else {
      const media = await maybeGenerateMedia(
        campaign,
        generatedSlot,
        lateKey,
        openaiKey,
        falKey,
        userId
      );
      mediaItems = media.mediaItems;
      mediaSlotPatch = media.slotPatch;
      mediaWarning = media.warning?.trim() || "";
    }

    // Idempotency: if a previous attempt already created the Late post, reuse it
    const latest = (await getScheduledCampaign(campaignId)) ?? campaign;
    const latestSlot = latest.slots.find((s) => s.id === slotId);
    let postId = latestSlot?.postId?.trim() || null;

    if (!postId) {
      postId = await createScheduledPost(
        campaign,
        {
          ...generatedSlot,
          ...mediaSlotPatch,
        },
        lateKey,
        mediaItems
      );
      // Save postId immediately so a later crash won't create a duplicate
      if (postId) {
        await updateScheduledCampaign(campaignId, (current) => ({
          ...current,
          slots: current.slots.map((currentSlot) =>
            currentSlot.id === slotId
              ? {
                  ...currentSlot,
                  ...generatedSlot,
                  ...mediaSlotPatch,
                  postId,
                  status: "generated",
                  postedAt: new Date().toISOString(),
                  processingLeaseUntil: null,
                  processingOwnerToken: null,
                  lastError: null,
                  detail:
                    [generatedSlot.detail, mediaWarning]
                      .filter(Boolean)
                      .join(" | ") || null,
                }
              : currentSlot
          ),
          status: computeCampaignStatus(
            current.slots.map((currentSlot) =>
              currentSlot.id === slotId
                ? { ...currentSlot, status: "generated" }
                : currentSlot
            ),
            current.status
          ),
        }));
        return { status: "generated" };
      }
    }

    await updateScheduledCampaign(campaignId, (current) => ({
      ...current,
      slots: current.slots.map((currentSlot) =>
        currentSlot.id === slotId
          ? {
              ...currentSlot,
              ...generatedSlot,
              ...mediaSlotPatch,
              status: "generated",
              postId,
              postedAt: new Date().toISOString(),
              processingLeaseUntil: null,
              processingOwnerToken: null,
              lastError: null,
              detail:
                [generatedSlot.detail, mediaWarning]
                  .filter(Boolean)
                  .join(" | ") || null,
            }
          : currentSlot
      ),
      status: computeCampaignStatus(
        current.slots.map((currentSlot) =>
          currentSlot.id === slotId
            ? {
                ...currentSlot,
                status: "generated",
              }
            : currentSlot
        ),
        current.status
      ),
    }));

    return { status: "generated" };
  } catch (error) {
    const message = errorMessage(error);
    console.error(
      `Scheduled campaign slot failed (${campaignId}/${slotId}):`,
      message,
      error
    );

    // If Late already accepted the post, mark generated to avoid duplicate creates
    const latest = await getScheduledCampaign(campaignId);
    const latestSlot = latest?.slots.find((s) => s.id === slotId);
    if (latestSlot?.postId?.trim()) {
      await updateScheduledCampaign(campaignId, (campaign) => ({
        ...campaign,
        slots: campaign.slots.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                status: "generated",
                processingLeaseUntil: null,
                processingOwnerToken: null,
                lastError: null,
                detail: [slot.detail, `Recovered after: ${message}`]
                  .filter(Boolean)
                  .join(" | "),
              }
            : slot
        ),
      }));
      return { status: "generated" };
    }

    await updateScheduledCampaign(campaignId, (campaign) => ({
      ...campaign,
      slots: campaign.slots.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              status: "failed",
              lastError: message,
              processingLeaseUntil: null,
              processingOwnerToken: null,
            }
          : slot
      ),
      status: "failed",
    }));
    return { status: "failed", error: message };
  }
}

export async function runDueScheduledCampaigns(
  now = Date.now()
): Promise<ScheduledCampaignRunResult> {
  const due = await getDueScheduledCampaignSlots(now);
  let processed = 0;
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  const slotIds: string[] = [];
  const failures: NonNullable<ScheduledCampaignRunResult["failures"]> = [];

  for (const item of due) {
    processed++;
    slotIds.push(item.slot.id);
    const result = await processScheduledCampaignSlot(item.campaign.id, item.slot.id);
    if (result.status === "generated") generated++;
    else if (result.status === "failed") {
      failed++;
      failures.push({
        campaignId: item.campaign.id,
        slotId: item.slot.id,
        error: result.error ?? "Unknown error",
      });
    } else skipped++;
  }

  return {
    campaignId: "all",
    processed,
    generated,
    failed,
    skipped,
    slotIds,
    failures,
  };
}

export async function runScheduledCampaign(
  campaignId: string
): Promise<ScheduledCampaignRunResult> {
  const campaign = await getScheduledCampaign(campaignId);
  if (!campaign) {
    throw new Error("Scheduled campaign not found");
  }

  let processed = 0;
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  const slotIds: string[] = [];
  const failures: NonNullable<ScheduledCampaignRunResult["failures"]> = [];
  for (const slot of campaign.slots) {
    if (slot.postId?.trim()) continue;
    if (slot.status !== "pending_generation" && slot.status !== "failed") continue;
    processed++;
    slotIds.push(slot.id);
    const result = await processScheduledCampaignSlot(campaignId, slot.id);
    if (result.status === "generated") generated++;
    else if (result.status === "failed") {
      failed++;
      failures.push({
        campaignId,
        slotId: slot.id,
        error: result.error ?? "Unknown error",
      });
    } else skipped++;
  }

  return {
    campaignId,
    processed,
    generated,
    failed,
    skipped,
    slotIds,
    failures,
  };
}
