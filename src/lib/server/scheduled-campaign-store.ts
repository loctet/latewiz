import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scheduledCampaigns } from "@/db/schema";
import {
  type ScheduledCampaign,
  type ScheduledCampaignInput,
  type ScheduledCampaignSlot,
  type ScheduledCampaignSlotStatus,
  type ScheduledCampaignStatus,
} from "@/lib/scheduled-campaigns";
import { normalizeWatermarkSettings } from "@/lib/image-watermark";
import { defaultNicheProfile } from "@/lib/openai/types";

const PROCESSING_LEASE_MS = 10 * 60 * 1000;

function normalizeSlot(
  slot: Partial<ScheduledCampaignSlot>,
  fallbackId?: string
): ScheduledCampaignSlot {
  return {
    id: slot.id ?? fallbackId ?? randomUUID(),
    scheduled_at: String(slot.scheduled_at ?? new Date().toISOString()),
    status: slot.status ?? "pending_generation",
    title: String(slot.title ?? ""),
    body: String(slot.body ?? ""),
    hashtags: String(slot.hashtags ?? ""),
    content: String(slot.content ?? ""),
    image_url: slot.image_url ?? null,
    video_url: slot.video_url ?? null,
    aiInstruction: slot.aiInstruction ?? undefined,
    imagePromptStyleId: slot.imagePromptStyleId ?? undefined,
    videoPromptStyleId: slot.videoPromptStyleId ?? undefined,
    reference_image_url: slot.reference_image_url ?? null,
    brief: slot.brief,
    source: slot.source ?? null,
    detail: slot.detail ?? null,
    generatedAt: slot.generatedAt ?? null,
    postedAt: slot.postedAt ?? null,
    postId: slot.postId ?? null,
    lastError: slot.lastError ?? null,
    processingStartedAt: slot.processingStartedAt ?? null,
    processingLeaseUntil: slot.processingLeaseUntil ?? null,
  };
}

function normalizeCampaign(
  campaign: Partial<ScheduledCampaign> & { userId?: string }
): ScheduledCampaign {
  const now = new Date().toISOString();
  const userId = String(campaign.userId ?? "");
  if (!userId) {
    throw new Error("Campaign userId is required");
  }
  return {
    id: campaign.id ?? randomUUID(),
    userId,
    name: String(campaign.name ?? "Untitled campaign"),
    profileId:
      typeof campaign.profileId === "string" || campaign.profileId === null
        ? campaign.profileId
        : null,
    status: normalizeCampaignStatus(campaign.status),
    generationMode:
      campaign.generationMode === "deferred" ? "deferred" : "immediate",
    generationLeadMinutes: Math.max(
      0,
      Number(campaign.generationLeadMinutes ?? 60) || 60
    ),
    timezone: String(campaign.timezone ?? "UTC"),
    postsPerDay: Math.max(1, Number(campaign.postsPerDay ?? 1) || 1),
    planDays: Math.max(1, Number(campaign.planDays ?? 1) || 1),
    startDate: String(campaign.startDate ?? now.slice(0, 10)),
    windowStart: String(campaign.windowStart ?? "09:00"),
    windowEnd: String(campaign.windowEnd ?? "18:00"),
    campaignMode: campaign.campaignMode === "list" ? "list" : "arc",
    campaignGoal: String(campaign.campaignGoal ?? ""),
    campaignHint: String(campaign.campaignHint ?? ""),
    trendBlock: String(campaign.trendBlock ?? ""),
    listItemsBlock: String(campaign.listItemsBlock ?? ""),
    mediaMode:
      campaign.mediaMode === "image" || campaign.mediaMode === "video"
        ? campaign.mediaMode
        : "none",
    niche: { ...defaultNicheProfile(), ...(campaign.niche ?? {}) },
    postPromptStyleId: String(campaign.postPromptStyleId ?? "auto"),
    imagePromptStyleId: String(campaign.imagePromptStyleId ?? ""),
    videoPromptStyleId: String(campaign.videoPromptStyleId ?? ""),
    videoProvider:
      campaign.videoProvider === "fal-pika" ? "fal-pika" : "openai-sora",
    imagePromptTemplates:
      campaign.imagePromptTemplates &&
      typeof campaign.imagePromptTemplates === "object"
        ? campaign.imagePromptTemplates
        : {},
    videoPromptTemplates:
      campaign.videoPromptTemplates &&
      typeof campaign.videoPromptTemplates === "object"
        ? campaign.videoPromptTemplates
        : {},
    imageWatermarkSettings: normalizeWatermarkSettings(
      campaign.imageWatermarkSettings ?? {}
    ),
    selectedAccountIds: Array.isArray(campaign.selectedAccountIds)
      ? campaign.selectedAccountIds.map(String)
      : [],
    targets: Array.isArray(campaign.targets)
      ? campaign.targets
          .map((target) => ({
            accountId: String(target.accountId ?? ""),
            platform: target.platform,
          }))
          .filter((target) => target.accountId && target.platform)
      : [],
    slots: Array.isArray(campaign.slots)
      ? campaign.slots.map((slot) => normalizeSlot(slot))
      : [],
    createdAt: String(campaign.createdAt ?? now),
    updatedAt: String(campaign.updatedAt ?? now),
  };
}

function normalizeCampaignStatus(
  status: ScheduledCampaign["status"] | undefined
): ScheduledCampaignStatus {
  switch (status) {
    case "draft":
    case "active":
    case "paused":
    case "completed":
    case "failed":
    case "cancelled":
      return status;
    default:
      return "active";
  }
}

export function computeCampaignStatus(
  slots: ScheduledCampaignSlot[],
  fallback: ScheduledCampaignStatus = "active"
): ScheduledCampaignStatus {
  if (slots.length === 0) return fallback;
  const activeSlots = slots.filter((slot) => slot.status !== "cancelled");
  if (activeSlots.length === 0) return "cancelled";
  const hasPending = activeSlots.some(
    (slot) =>
      slot.status === "pending_generation" || slot.status === "processing"
  );
  const hasFailed = activeSlots.some((slot) => slot.status === "failed");
  const allGenerated = activeSlots.every((slot) => slot.status === "generated");
  if (allGenerated) return "completed";
  if (hasPending) return "active";
  if (hasFailed) return "failed";
  return fallback;
}

async function persistCampaign(campaign: ScheduledCampaign): Promise<void> {
  const now = new Date();
  const existing = await getDb()
    .select({ id: scheduledCampaigns.id })
    .from(scheduledCampaigns)
    .where(eq(scheduledCampaigns.id, campaign.id))
    .limit(1);

  if (existing[0]) {
    await getDb()
      .update(scheduledCampaigns)
      .set({
        userId: campaign.userId,
        data: campaign,
        status: campaign.status,
        updatedAt: now,
      })
      .where(eq(scheduledCampaigns.id, campaign.id));
    return;
  }

  await getDb().insert(scheduledCampaigns).values({
    id: campaign.id,
    userId: campaign.userId,
    data: campaign,
    status: campaign.status,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listScheduledCampaigns(
  userId?: string
): Promise<ScheduledCampaign[]> {
  const rows = userId
    ? await getDb()
        .select()
        .from(scheduledCampaigns)
        .where(eq(scheduledCampaigns.userId, userId))
        .orderBy(desc(scheduledCampaigns.updatedAt))
    : await getDb()
        .select()
        .from(scheduledCampaigns)
        .orderBy(desc(scheduledCampaigns.updatedAt));

  return rows.map((row) =>
    normalizeCampaign({
      ...(row.data as ScheduledCampaign),
      id: row.id,
      userId: row.userId,
      status: (row.status as ScheduledCampaignStatus) || row.data.status,
    })
  );
}

export async function getScheduledCampaign(
  id: string,
  userId?: string
): Promise<ScheduledCampaign | null> {
  const conditions = userId
    ? and(eq(scheduledCampaigns.id, id), eq(scheduledCampaigns.userId, userId))
    : eq(scheduledCampaigns.id, id);

  const [row] = await getDb()
    .select()
    .from(scheduledCampaigns)
    .where(conditions)
    .limit(1);

  if (!row) return null;
  return normalizeCampaign({
    ...(row.data as ScheduledCampaign),
    id: row.id,
    userId: row.userId,
    status: (row.status as ScheduledCampaignStatus) || row.data.status,
  });
}

export async function saveScheduledCampaign(
  input: ScheduledCampaignInput & { userId: string }
): Promise<ScheduledCampaign> {
  const now = new Date().toISOString();
  const existing = input.id
    ? await getScheduledCampaign(input.id, input.userId)
    : null;

  if (input.id && !existing) {
    // Prevent cross-user overwrite by id alone
    const anyOwner = await getScheduledCampaign(input.id);
    if (anyOwner && anyOwner.userId !== input.userId) {
      throw new Error("Campaign not found");
    }
  }

  const slotSeeds = input.slots.map((slot, index) =>
    normalizeSlot(slot, existing?.slots[index]?.id ?? randomUUID())
  );

  const campaign = normalizeCampaign({
    ...existing,
    ...input,
    userId: input.userId,
    id: existing?.id ?? input.id ?? randomUUID(),
    status:
      input.status ??
      computeCampaignStatus(slotSeeds, existing?.status ?? "active"),
    slots: slotSeeds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await persistCampaign(campaign);
  return campaign;
}

export async function deleteScheduledCampaign(
  id: string,
  userId?: string
): Promise<boolean> {
  const existing = await getScheduledCampaign(id, userId);
  if (!existing) return false;
  await getDb()
    .delete(scheduledCampaigns)
    .where(eq(scheduledCampaigns.id, id));
  return true;
}

export async function updateScheduledCampaign(
  id: string,
  updater: (campaign: ScheduledCampaign) => ScheduledCampaign | null,
  userId?: string
): Promise<ScheduledCampaign | null> {
  const current = await getScheduledCampaign(id, userId);
  if (!current) return null;
  const next = updater(current);
  if (!next) return null;
  const normalized = normalizeCampaign({
    ...next,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });
  normalized.status = computeCampaignStatus(normalized.slots, normalized.status);
  await persistCampaign(normalized);
  return normalized;
}

export async function getDueScheduledCampaignSlots(now = Date.now()): Promise<
  Array<{ campaign: ScheduledCampaign; slot: ScheduledCampaignSlot }>
> {
  const campaigns = await listScheduledCampaigns();
  const due: Array<{ campaign: ScheduledCampaign; slot: ScheduledCampaignSlot }> =
    [];

  for (const campaign of campaigns) {
    if (campaign.generationMode !== "deferred") continue;
    if (campaign.status === "paused" || campaign.status === "cancelled") continue;
    for (const slot of campaign.slots) {
      if (slot.status !== "pending_generation" && slot.status !== "failed")
        continue;
      const dueAt =
        new Date(slot.scheduled_at).getTime() -
        campaign.generationLeadMinutes * 60_000;
      if (dueAt <= now) {
        due.push({ campaign, slot });
      }
    }
  }

  due.sort(
    (a, b) =>
      new Date(a.slot.scheduled_at).getTime() -
      new Date(b.slot.scheduled_at).getTime()
  );
  return due;
}

export async function acquireScheduledCampaignSlot(
  campaignId: string,
  slotId: string,
  now = Date.now()
): Promise<ScheduledCampaign | null> {
  return updateScheduledCampaign(campaignId, (campaign) => {
    const slots: ScheduledCampaignSlot[] = campaign.slots.map((slot) => {
      if (slot.id !== slotId) return slot;
      const leaseUntilMs = slot.processingLeaseUntil
        ? new Date(slot.processingLeaseUntil).getTime()
        : 0;
      if (
        slot.status === "generated" ||
        slot.status === "cancelled" ||
        (slot.status === "processing" && leaseUntilMs > now)
      ) {
        return slot;
      }
      return {
        ...slot,
        status: "processing" as ScheduledCampaignSlotStatus,
        processingStartedAt: new Date(now).toISOString(),
        processingLeaseUntil: new Date(now + PROCESSING_LEASE_MS).toISOString(),
        lastError: null,
      };
    });
    return {
      ...campaign,
      slots,
    };
  });
}
