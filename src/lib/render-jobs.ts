import type { ExplainerScript } from "@/lib/explainer-script";

export type RenderJobPayload = {
  template: "explainer";
  script: ExplainerScript;
  /** Short text used as the generated media caption digest */
  captionDigest: string;
};

export type SlotRenderStatus = "queued" | "rendering" | "done" | "failed";

/**
 * campaign_id used for on-demand renders (Compose, AI Studio) that are not
 * tied to a scheduled campaign slot. The worker skips slot updates for these.
 */
export const STANDALONE_RENDER_CAMPAIGN_ID = "standalone";

/** Status payload returned by GET /api/ai/explainer/[id]. */
export type ExplainerJobStatus = {
  id: string;
  status: SlotRenderStatus;
  video_url: string | null;
  error: string | null;
  /** Seconds since the job was queued */
  age_seconds: number;
  /** False when no render worker has checked in recently */
  worker_online: boolean;
};

/** Max render attempts before the job (and its slot) is marked failed. */
export const RENDER_JOB_MAX_ATTEMPTS = 3;

/** How long a worker owns a claimed job before another worker may retry it. */
export const RENDER_JOB_LEASE_MS = 20 * 60 * 1000;
