import { toast } from "sonner";
import type { DraftResult } from "@/lib/openai/types";

export function notifyDraftGenerationResult(r: {
  draft: DraftResult;
  source: string;
  detail?: string | null;
}): void {
  const detail = r.detail ?? r.draft.detail;

  if (r.source === "stub") {
    toast.message("Using placeholder — add OpenAI key in Settings.");
    return;
  }

  if (r.source === "fallback") {
    toast.error(detail || "Generation failed");
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
