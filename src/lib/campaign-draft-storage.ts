import type { CampaignSlot } from "@/hooks/use-ai";

const STORAGE_KEY = "latewiz-campaign-draft";

export type CampaignSlotDraft = CampaignSlot;

export type CampaignDraft = {
  postsPerDay: number;
  planDays: number;
  startDate: string;
  windowStart: string;
  windowEnd: string;
  campaignGoal: string;
  campaignHint: string;
  trendBlock: string;
  selectedAccountIds: string[];
  generateImages: boolean;
  slots: CampaignSlotDraft[];
  savedAt: string;
};

function stripHeavyImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.length > 2000) return undefined;
  return url;
}

function serializeSlots(slots: CampaignSlotDraft[]): CampaignSlotDraft[] {
  return slots.map((s) => ({
    ...s,
    image_url: stripHeavyImageUrl(s.image_url),
  }));
}

export function loadCampaignDraft(): CampaignDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignDraft;
    if (!Array.isArray(parsed.slots)) return null;
    return parsed;
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
