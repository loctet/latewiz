import type {
  CampaignDraft,
  CampaignSlotDraft,
} from "@/lib/campaign-draft-storage";
import { saveCampaignDraft } from "@/lib/campaign-draft-storage";

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

const STORAGE_KEY = "latewiz-saved-campaigns";

export type SavedCampaign = CampaignDraft & {
  id: string;
  name: string;
  profileId: string | null;
};

type SavedCampaignStore = {
  campaigns: SavedCampaign[];
};

function readStore(): SavedCampaignStore {
  if (typeof window === "undefined") return { campaigns: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { campaigns: [] };
    const parsed = JSON.parse(raw) as SavedCampaignStore;
    if (!Array.isArray(parsed.campaigns)) return { campaigns: [] };
    return parsed;
  } catch {
    return { campaigns: [] };
  }
}

function writeStore(store: SavedCampaignStore): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function listSavedCampaigns(
  profileId: string | null
): SavedCampaign[] {
  const store = readStore();
  return store.campaigns
    .filter((c) => c.profileId === profileId)
    .sort(
      (a, b) =>
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
}

export function getSavedCampaign(
  id: string,
  profileId: string | null
): SavedCampaign | null {
  return (
    listSavedCampaigns(profileId).find((c) => c.id === id) ?? null
  );
}

export function saveSavedCampaign(
  params: {
    id?: string;
    name: string;
    profileId: string | null;
    draft: Omit<CampaignDraft, "savedAt">;
  }
): SavedCampaign | null {
  const store = readStore();
  const now = new Date().toISOString();
  const id = params.id ?? crypto.randomUUID();
  const entry: SavedCampaign = {
    ...params.draft,
    slots: serializeSlots(params.draft.slots),
    id,
    name: params.name.trim() || "Untitled campaign",
    profileId: params.profileId,
    savedAt: now,
  };

  const idx = store.campaigns.findIndex((c) => c.id === id);
  if (idx >= 0) {
    store.campaigns[idx] = entry;
  } else {
    store.campaigns.push(entry);
  }

  if (!writeStore(store)) return null;

  saveCampaignDraft(params.draft);
  return entry;
}

export function deleteSavedCampaign(
  id: string,
  profileId: string | null
): boolean {
  const store = readStore();
  const next = store.campaigns.filter(
    (c) => !(c.id === id && c.profileId === profileId)
  );
  if (next.length === store.campaigns.length) return false;
  return writeStore({ campaigns: next });
}
