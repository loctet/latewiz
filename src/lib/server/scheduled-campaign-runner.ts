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
import { createLateClient } from "@/lib/late-api";
import { saveGeneratedImageFile, saveGeneratedVideoFile } from "@/lib/server/generated-media-files";
import { uploadMediaFromUrl } from "@/lib/server/server-media-upload";

function serverOpenAiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function serverFalKey(): string | null {
  return process.env.FAL_KEY?.trim() || null;
}

function serverLateKey(): string | null {
  return process.env.LATE_API_KEY?.trim() || null;
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
  sourceUrl: string,
  captionDigest: string
): Promise<string> {
  // Vercel filesystem is ephemeral/read-only for most paths — never fail the post for this.
  try {
    const saved = await saveGeneratedImageFile(sourceUrl, captionDigest);
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
  sourceUrl: string,
  captionDigest: string,
  durationSeconds?: string
): Promise<string> {
  try {
    const saved = await saveGeneratedVideoFile(
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
  lateKey: string
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
    const imageResult = await generatePostImage(
      serverOpenAiKey(),
      campaign.niche,
      slot.aiInstruction,
      captionContext,
      slot.imagePromptStyleId ?? campaign.imagePromptStyleId,
      campaign.imagePromptTemplates,
      slot.reference_image_url?.trim() ? [slot.reference_image_url.trim()] : undefined
    );
    if (!imageResult.url && !imageResult.b64_json) {
      return {
        slotPatch: {
          detail: imageResult.detail,
        },
        warning: imageResult.detail ?? "Image generation failed; posting text-only.",
      };
    }

    const imageUrl = imageResult.url ?? `data:image/png;base64,${imageResult.b64_json}`;
    const previewUrl = await persistGeneratedImageBestEffort(imageUrl, digest);
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
      serverOpenAiKey(),
      serverFalKey(),
      campaign.niche,
      slot.aiInstruction,
      captionContext,
      slot.videoPromptStyleId ?? campaign.videoPromptStyleId,
      campaign.videoPromptTemplates
    );
    if (!videoResult.url) {
      return {
        slotPatch: {
          detail: videoResult.detail,
        },
        warning: videoResult.detail ?? "Video generation failed; posting text-only.",
      };
    }

    const previewUrl = await persistGeneratedVideoBestEffort(
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

async function createScheduledPost(
  campaign: ScheduledCampaign,
  slot: ScheduledCampaignSlot,
  mediaItems?: Array<{ type: "image" | "video"; url: string }>
): Promise<string | null> {
  const lateKey = serverLateKey();
  if (!lateKey) {
    throw new Error("LATE_API_KEY is required for scheduled campaigns.");
  }
  if (!campaign.targets.length) {
    throw new Error(
      "No publishing targets on this campaign. Re-save the deferred campaign with at least one account selected."
    );
  }

  const late = createLateClient(lateKey);
  const now = Date.now();
  const scheduledAtMs = new Date(slot.scheduled_at).getTime();
  const publishNow = !Number.isNaN(scheduledAtMs) && scheduledAtMs <= now + 60_000;
  const { data, error } = await late.posts.createPost({
    body: {
      content: sanitizeSocialPostText(slot.content || buildSlotContent(slot)),
      mediaItems,
      platforms: campaign.targets.map((target) => ({
        platform: target.platform,
        accountId: target.accountId,
      })),
      scheduledFor: publishNow ? undefined : slot.scheduled_at,
      publishNow,
      timezone: campaign.timezone,
    },
  });
  if (error) {
    throw error;
  }
  return (data as { _id?: string; id?: string } | null)?._id ?? data?.id ?? null;
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

  const lateKey = serverLateKey();
  if (!lateKey) {
    const message = "LATE_API_KEY is missing on the server.";
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

    const previousPosts = sortedSlots
      .slice(0, slotIndex)
      .filter((item) => item.status === "generated" && item.body.trim())
      .map((item) => ({
        title: item.title,
        body: item.body,
        hashtags: item.hashtags,
      }));

    const generated = await generateCampaignSlot(serverOpenAiKey(), campaign.niche, {
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
      isListMode: campaign.campaignMode === "list",
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

    const generatedSlot: ScheduledCampaignSlot = {
      ...slot,
      title: generated.post.title,
      body: generated.post.body,
      hashtags: generated.post.hashtags,
      content: [generated.post.body, generated.post.hashtags]
        .filter(Boolean)
        .join("\n\n"),
      source: generated.source,
      detail: generated.detail,
      generatedAt: new Date().toISOString(),
      lastError: null,
    };

    const media = await maybeGenerateMedia(campaign, generatedSlot, lateKey);
    const mediaWarning = media.warning?.trim() || "";
    const postId = await createScheduledPost(
      campaign,
      {
        ...generatedSlot,
        ...media.slotPatch,
      },
      media.mediaItems
    );

    await updateScheduledCampaign(campaignId, (current) => ({
      ...current,
      slots: current.slots.map((currentSlot) =>
        currentSlot.id === slotId
          ? {
              ...currentSlot,
              ...generatedSlot,
              ...media.slotPatch,
              status: "generated",
              postId,
              postedAt: new Date().toISOString(),
              processingLeaseUntil: null,
              lastError: null,
              detail: [generated.detail, mediaWarning].filter(Boolean).join(" | ") || null,
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
