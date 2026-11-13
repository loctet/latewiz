import type { CampaignSlotBrief } from "@/lib/openai/campaign-arc";

/**
 * Campaign-level media setting. "mix" lets each slot carry its own media
 * type (see SlotMediaType), chosen from the slot brief or by the user.
 */
export type CampaignMediaMode = "none" | "image" | "video" | "mix";

/**
 * Media produced for a single slot. "explainer" is a branded HyperFrames
 * video rendered by the render worker (scheduled campaigns only).
 */
export type SlotMediaType = "none" | "image" | "video" | "explainer";

export type AiMediaKind = "image" | "video";

export const SLOT_MEDIA_TYPES: { value: SlotMediaType; label: string }[] = [
  { value: "none", label: "Text only" },
  { value: "image", label: "Image" },
  { value: "video", label: "AI video" },
  { value: "explainer", label: "Explainer" },
];

export function isCampaignMediaMode(value: unknown): value is CampaignMediaMode {
  return (
    value === "none" || value === "image" || value === "video" || value === "mix"
  );
}

export function isSlotMediaType(value: unknown): value is SlotMediaType {
  return (
    value === "none" ||
    value === "image" ||
    value === "video" ||
    value === "explainer"
  );
}

export function migrateCampaignMediaMode(
  draft: { mediaMode?: CampaignMediaMode; generateImages?: boolean }
): CampaignMediaMode {
  if (isCampaignMediaMode(draft.mediaMode)) {
    return draft.mediaMode;
  }
  return draft.generateImages ? "image" : "none";
}

/** Beats that work best as motion: they open or hook the audience. */
const VIDEO_BEATS = ["hook", "pattern interrupt", "social proof", "call-to-action"];

/** Beats that teach something structured: best as a scene-by-scene explainer. */
const EXPLAINER_BEATS = [
  "how-to",
  "step-by-step",
  "framework",
  "comparison",
  "checklist",
  "foundational concept",
  "myth",
  "data point",
  "recap",
];

/** Default media type for a slot in a "mix" campaign, from its brief. */
export function suggestSlotMediaType(
  brief: CampaignSlotBrief | undefined,
  slotIndex: number
): SlotMediaType {
  const beat = brief?.beat?.toLowerCase() ?? "";
  if (VIDEO_BEATS.some((b) => beat.includes(b))) return "video";
  if (EXPLAINER_BEATS.some((b) => beat.includes(b))) return "explainer";
  if (brief?.phase === "intro" && slotIndex === 0) return "video";
  // No brief: rotate so a mix campaign still mixes.
  if (!brief) return (["explainer", "image", "video"] as const)[slotIndex % 3];
  return "image";
}

/**
 * The media type a slot actually generates. A fixed campaign mode wins;
 * in "mix" mode the slot's own choice wins, else the brief-based default.
 */
export function resolveSlotMediaType(
  campaignMode: CampaignMediaMode,
  slot: { mediaType?: SlotMediaType; brief?: CampaignSlotBrief },
  slotIndex: number
): SlotMediaType {
  if (campaignMode !== "mix") return campaignMode;
  if (isSlotMediaType(slot.mediaType)) return slot.mediaType;
  return suggestSlotMediaType(slot.brief, slotIndex);
}

/** True when any slot in the campaign may need the given media kind. */
export function campaignUsesMedia(
  campaignMode: CampaignMediaMode,
  slots: Array<{ mediaType?: SlotMediaType; brief?: CampaignSlotBrief }>,
  kind: Exclude<SlotMediaType, "none">
): boolean {
  if (campaignMode === kind) return true;
  if (campaignMode !== "mix") return false;
  return slots.some((slot, i) => resolveSlotMediaType("mix", slot, i) === kind);
}
