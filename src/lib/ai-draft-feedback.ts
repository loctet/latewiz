import { toast } from "sonner";
import type { DraftResult } from "@/lib/openai/types";
import { useAiStore } from "@/stores";

/** Call before starting a draft when Deep research may be selected. */
export function notifyDeepResearchStarting(): void {
  if (useAiStore.getState().researchDepthId !== "deep") return;
  toast.message("Deep research started", {
    description:
      "OpenAI Deep Research usually takes several minutes. A short teaser + PDF link are returned when it finishes. (Uses gpt-5.6-sol — older o3/o4 deep-research models are retired.)",
    duration: 12_000,
  });
}

export function notifyDraftGenerationResult(r: {
  draft: DraftResult;
  source: string;
  detail?: string | null;
}): void {
  const detail = r.detail ?? r.draft.detail;
  const deepFailed =
    typeof detail === "string" &&
    /deep research failed|falling back to standard/i.test(detail);

  if (r.source === "stub") {
    toast.message("Using placeholder — add OpenAI key in Settings.");
    return;
  }

  if (r.source === "fallback") {
    toast.error(detail || "Generation failed");
    return;
  }

  if (deepFailed) {
    toast.warning("Deep research did not complete — used standard generation", {
      description: detail?.slice(0, 280),
      duration: 14_000,
    });
    return;
  }

  if (r.source === "openai+deep-research") {
    toast.success(
      r.draft.pdfUrl
        ? "Deep research ready — teaser + See more PDF link."
        : "Deep research teaser ready (PDF link missing — check server logs)."
    );
    if (detail && /pdf/i.test(detail)) {
      toast.message(detail.slice(0, 220));
    }
    return;
  }

  if (r.source === "openai+web" || r.source === "openai+fallback-search") {
    toast.success("Caption generated with live web research.");
    return;
  }

  if (r.source === "openai") {
    toast.message(
      "Caption generated without confirmed web search — results may be generic."
    );
  }
}
