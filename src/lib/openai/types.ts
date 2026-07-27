export interface NicheProfile {
  /** ISO 639-1 code — controls language of AI-generated copy and infographic text */
  language: string;
  topic: string;
  audience: string;
  geography: string;
  toneNotes: string;
  forbiddenTopics: string;
  complianceNotes: string;
  extraInstructions: string;
}

export const defaultNicheProfile = (): NicheProfile => ({
  language: "en",
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
  source: "openai" | "openai+web" | "openai+fallback-search" | "openai+deep-research" | "stub" | "fallback";
  detail: string | null;
  /** Public URL to the full deep-research PDF when Deep mode succeeds */
  pdfUrl?: string | null;
}

export interface CampaignPostDraft {
  title: string;
  body: string;
  hashtags: string;
  pdfUrl?: string | null;
}

export type PreviousCampaignPost = {
  title: string;
  body: string;
  hashtags: string;
};

export type GeneratedMediaType = "image" | "video";

export interface GeneratedMediaItem {
  id: string;
  url: string;
  type: GeneratedMediaType;
  captionDigest: string;
  createdAt: string;
  filename?: string;
  durationSeconds?: string;
}
