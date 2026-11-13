import type { ExplainerScript } from "@/lib/explainer-script";

export type RenderJobPayload = {
  template: "explainer";
  script: ExplainerScript;
  /** Short text used as the generated media caption digest */
  captionDigest: string;
};

export type SlotRenderStatus = "queued" | "rendering" | "done" | "failed";

/** Max render attempts before the job (and its slot) is marked failed. */
export const RENDER_JOB_MAX_ATTEMPTS = 3;

/** How long a worker owns a claimed job before another worker may retry it. */
export const RENDER_JOB_LEASE_MS = 20 * 60 * 1000;
