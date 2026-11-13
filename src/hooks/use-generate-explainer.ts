"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExplainerJobStatus } from "@/lib/render-jobs";
import { generatedMediaKeys } from "./use-generated-media";

const POLL_MS = 3000;
const MAX_WAIT_MS = 20 * 60 * 1000;

export type ExplainerProgress =
  | { phase: "scripting" }
  | { phase: "queued"; ageSeconds: number; workerOnline: boolean }
  | { phase: "rendering"; ageSeconds: number };

/**
 * Queue a branded explainer render (scripts/render-worker.ts does the work)
 * and poll until the MP4 is ready. Resolves with the app media URL.
 */
export function useGenerateExplainer(options?: {
  onProgress?: (progress: ExplainerProgress) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { captionContext?: string; prompt?: string }) => {
      options?.onProgress?.({ phase: "scripting" });
      const res = await fetch("/api/ai/explainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption_context: params.captionContext,
          prompt: params.prompt,
        }),
      });
      const created = (await res.json().catch(() => ({}))) as {
        job_id?: string;
        detail?: string | null;
        error?: string;
      };
      if (!res.ok || !created.job_id) {
        throw new Error(created.error ?? "Could not queue the explainer video");
      }

      options?.onProgress?.({ phase: "queued", ageSeconds: 0, workerOnline: true });
      const started = Date.now();
      let first = true;
      while (Date.now() - started < MAX_WAIT_MS) {
        // Check right away once, so an offline worker shows up in ~1s.
        await new Promise((r) => setTimeout(r, first ? 800 : POLL_MS));
        first = false;
        const statusRes = await fetch(`/api/ai/explainer/${created.job_id}`, {
          cache: "no-store",
        });
        if (!statusRes.ok) continue;
        const status = (await statusRes.json()) as ExplainerJobStatus;
        if (status.status === "done" && status.video_url) {
          queryClient.invalidateQueries({ queryKey: generatedMediaKeys.all });
          return { video_url: status.video_url, detail: created.detail ?? null };
        }
        if (status.status === "failed") {
          throw new Error(status.error ?? "Explainer render failed");
        }
        options?.onProgress?.(
          status.status === "rendering"
            ? { phase: "rendering", ageSeconds: status.age_seconds }
            : {
                phase: "queued",
                ageSeconds: status.age_seconds,
                workerOnline: status.worker_online,
              }
        );
      }
      throw new Error(
        "The explainer is still rendering. It will appear in your media library when done."
      );
    },
  });
}

/** User-facing line for an in-flight explainer render. */
export function describeExplainerProgress(progress: ExplainerProgress | null): string {
  if (!progress) return "Generating explainer…";
  if (progress.phase === "scripting") return "Writing the scene script…";
  if (progress.phase === "rendering") {
    return `Rendering your branded video… ${progress.ageSeconds}s (usually 1–3 min)`;
  }
  if (!progress.workerOnline) {
    return "Render worker is offline: start it with `npm run render-worker`. Your video stays queued and renders as soon as it runs.";
  }
  return "Queued for rendering…";
}
