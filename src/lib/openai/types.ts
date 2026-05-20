export interface NicheProfile {
  topic: string;
  audience: string;
  geography: string;
  toneNotes: string;
  forbiddenTopics: string;
  complianceNotes: string;
  extraInstructions: string;
}

export const defaultNicheProfile = (): NicheProfile => ({
  topic: "",
  audience: "",
  geography: "",
  toneNotes: "",
  forbiddenTopics: "",
  complianceNotes: "",
  extraInstructions: "",
});

export interface DraftResult {
  title: string;
  body: string;
  hashtags: string;
  source: "openai" | "stub" | "fallback";
  detail: string | null;
}

export interface CampaignPostDraft {
  title: string;
  body: string;
  hashtags: string;
}

export interface GeneratedMediaItem {
  id: string;
  url: string;
  captionDigest: string;
  createdAt: string;
}
