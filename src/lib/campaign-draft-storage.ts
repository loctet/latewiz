import type { CampaignSlot } from "@/hooks/use-ai";
import {
  type CampaignMediaMode,
  migrateCampaignMediaMode,
} from "@/lib/campaign-media";
import type { CampaignGenerationMode } from "@/lib/scheduled-campaigns";

const STORAGE_KEY = "latewiz-campaign-draft";

export type CampaignSlotDraft = CampaignSlot;

export type CampaignPlanningMode = "arc" | "list";

export type CampaignDraft = {
  generationMode?: CampaignGenerationMode;
  postsPerDay: number;
  planDays: number;
  startDate: string;
  windowStart: string;
  windowEnd: string;
  /** "arc" = AI-planned series; "list" = one post per line in listItemsBlock */
  campaignMode?: CampaignPlanningMode;
  listItemsBlock?: string;
  campaignGoal: string;
  campaignHint: string;
  trendBlock: string;
  selectedAccountIds: string[];
  mediaMode: CampaignMediaMode;
  /** @deprecated migrated to mediaMode on load */
  generateImages?: boolean;
  slots: CampaignSlotDraft[];
  savedAt: string;
};

function stripHeavyMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.length > 2000) return undefined;
  return url;
}

function serializeSlots(slots: CampaignSlotDraft[]): CampaignSlotDraft[] {
  return slots.map((s) => ({
    ...s,
    image_url: stripHeavyMediaUrl(s.image_url),
    video_url: stripHeavyMediaUrl(s.video_url),
    reference_image_url: stripHeavyMediaUrl(s.reference_image_url),
  }));
}

function normalizeDraft(parsed: CampaignDraft): CampaignDraft {
  return {
    ...parsed,
    generationMode: parsed.generationMode === "deferred" ? "deferred" : "immediate",
    campaignMode: parsed.campaignMode === "list" ? "list" : "arc",
    listItemsBlock: parsed.listItemsBlock ?? "",
    mediaMode: migrateCampaignMediaMode(parsed),
  };
}

export function loadCampaignDraft(): CampaignDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignDraft;
    if (!Array.isArray(parsed.slots)) return null;
    return normalizeDraft(parsed);
  } catch {
    return null;
  }
}

export function saveCampaignDraft(draft: Omit<CampaignDraft, "savedAt">): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: CampaignDraft = {
      ...draft,
      slots: serializeSlots(draft.slots),
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearCampaignDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
