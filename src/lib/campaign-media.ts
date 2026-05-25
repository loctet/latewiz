export type CampaignMediaMode = "none" | "image" | "video";

export type AiMediaKind = "image" | "video";

export function migrateCampaignMediaMode(
  draft: { mediaMode?: CampaignMediaMode; generateImages?: boolean }
): CampaignMediaMode {
  if (draft.mediaMode === "none" || draft.mediaMode === "image" || draft.mediaMode === "video") {
    return draft.mediaMode;
  }
  return draft.generateImages ? "image" : "none";
}
