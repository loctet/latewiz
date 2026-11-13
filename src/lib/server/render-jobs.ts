import "server-only";

import { randomUUID } from "crypto";
import { and, asc, eq, lt, or } from "drizzle-orm";
import { dbReady } from "@/db";
import { renderJobs, type RenderJobStatus } from "@/db/schema";
import {
  RENDER_JOB_LEASE_MS,
  RENDER_JOB_MAX_ATTEMPTS,
  type RenderJobPayload,
} from "@/lib/render-jobs";

export type RenderJob = typeof renderJobs.$inferSelect;

export async function getRenderJobForSlot(
  campaignId: string,
  slotId: string
): Promise<RenderJob | null> {
  const [row] = await (await dbReady())
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.campaignId, campaignId), eq(renderJobs.slotId, slotId)))
    .limit(1);
  return row ?? null;
}

/** Create a queued job for the slot, or return the existing one. */
export async function enqueueRenderJob(params: {
  userId: string;
  campaignId: string;
  slotId: string;
  payload: RenderJobPayload;
}): Promise<RenderJob> {
  const existing = await getRenderJobForSlot(params.campaignId, params.slotId);
  if (existing) return existing;
  const now = new Date();
  const row = {
    id: randomUUID(),
    userId: params.userId,
    campaignId: params.campaignId,
    slotId: params.slotId,
    status: "queued" as RenderJobStatus,
    payload: params.payload,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await (await dbReady()).insert(renderJobs).values(row);
  } catch (error) {
    // Unique (campaign_id, slot_id): another runner enqueued first.
    const raced = await getRenderJobForSlot(params.campaignId, params.slotId);
    if (raced) return raced;
    throw error;
  }
  return (await getRenderJobForSlot(params.campaignId, params.slotId))!;
}

/** Drop a slot's job so the next run re-renders (e.g. after edits). */
export async function deleteRenderJobForSlot(
  campaignId: string,
  slotId: string
): Promise<void> {
  await (await dbReady())
    .delete(renderJobs)
    .where(and(eq(renderJobs.campaignId, campaignId), eq(renderJobs.slotId, slotId)));
}

/**
 * Claim the oldest queued job, or a rendering job whose lease expired.
 * Optimistic: the UPDATE only wins if the row is still in the state we read.
 */
export async function claimNextRenderJob(workerId: string): Promise<RenderJob | null> {
  const db = await dbReady();
  const now = new Date();
  const candidates = await db
    .select()
    .from(renderJobs)
    .where(
      or(
        eq(renderJobs.status, "queued"),
        and(eq(renderJobs.status, "rendering"), lt(renderJobs.leaseUntil, now))
      )
    )
    .orderBy(asc(renderJobs.createdAt))
    .limit(5);

  for (const job of candidates) {
    const leaseUntil = new Date(now.getTime() + RENDER_JOB_LEASE_MS);
    await db
      .update(renderJobs)
      .set({
        status: "rendering",
        workerId,
        leaseUntil,
        attempts: job.attempts + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(renderJobs.id, job.id),
          eq(renderJobs.status, job.status),
          eq(renderJobs.attempts, job.attempts)
        )
      );
    const [claimed] = await db
      .select()
      .from(renderJobs)
      .where(eq(renderJobs.id, job.id))
      .limit(1);
    if (claimed?.workerId === workerId && claimed.status === "rendering") {
      return claimed;
    }
  }
  return null;
}

export async function completeRenderJob(jobId: string, mediaId: string): Promise<void> {
  await (await dbReady())
    .update(renderJobs)
    .set({
      status: "done",
      mediaId,
      error: null,
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(renderJobs.id, jobId));
}

/** Record a failed attempt. Returns true when the job gave up for good. */
export async function failRenderJob(job: RenderJob, error: string): Promise<boolean> {
  const final = job.attempts >= RENDER_JOB_MAX_ATTEMPTS;
  await (await dbReady())
    .update(renderJobs)
    .set({
      status: final ? "failed" : "queued",
      error: error.slice(0, 1000),
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(renderJobs.id, job.id));
  return final;
}
