import type { CampaignMediaMode } from "@/lib/campaign-media";
import type { ImageWatermarkSettings } from "@/lib/image-watermark";
import type { Platform } from "@/lib/late-api";
import type { CampaignPlanningMode } from "@/lib/campaign-draft-storage";
import type { CampaignSlotBrief } from "@/lib/openai";
import type { NicheProfile } from "@/lib/openai/types";
import type { CustomPostPromptStyle } from "@/lib/post-prompt-catalog";
import type { VideoProvider } from "@/lib/video-providers";

export type CampaignGenerationMode = "immediate" | "deferred";

export type ScheduledCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ScheduledCampaignSlotStatus =
  | "pending_generation"
  | "processing"
  | "generated"
  | "failed"
  | "cancelled";

export type ScheduledCampaignTarget = {
  accountId: string;
  platform: Platform;
};

export type ScheduledCampaignSlot = {
  id: string;
  scheduled_at: string;
  status: ScheduledCampaignSlotStatus;
  title: string;
  body: string;
  hashtags: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  aiInstruction?: string;
  imagePromptStyleId?: string;
  videoPromptStyleId?: string;
  reference_image_url?: string | null;
  brief?: CampaignSlotBrief;
  source?: string | null;
  detail?: string | null;
  generatedAt?: string | null;
  postedAt?: string | null;
  postId?: string | null;
  lastError?: string | null;
  processingStartedAt?: string | null;
  processingLeaseUntil?: string | null;
  /** Random token set on acquire — used to detect lost lease races */
  processingOwnerToken?: string | null;
};

export type ScheduledCampaignSlotInput = Omit<ScheduledCampaignSlot, "id"> & {
  id?: string;
};

export type ScheduledCampaign = {
  id: string;
  /** Owning LateWiz user — required for multi-user vault/cron isolation */
  userId: string;
  name: string;
  profileId: string | null;
  status: ScheduledCampaignStatus;
  generationMode: CampaignGenerationMode;
  generationLeadMinutes: number;
  timezone: string;
  postsPerDay: number;
  planDays: number;
  startDate: string;
  windowStart: string;
  windowEnd: string;
  campaignMode: CampaignPlanningMode;
  campaignGoal: string;
  campaignHint: string;
  trendBlock: string;
  listItemsBlock: string;
  mediaMode: CampaignMediaMode;
  niche: NicheProfile;
  postPromptStyleId: string;
  researchDepthId: string;
  imagePromptStyleId: string;
  videoPromptStyleId: string;
  videoProvider: VideoProvider;
  /** Custom post structure overrides keyed by style id */
  postPromptTemplates: Record<string, string>;
  /** User-created post styles (metadata); template text in postPromptTemplates */
  customPostPromptStyles: CustomPostPromptStyle[];
  imagePromptTemplates: Record<string, string>;
  videoPromptTemplates: Record<string, string>;
  imageWatermarkSettings: ImageWatermarkSettings;
  selectedAccountIds: string[];
  targets: ScheduledCampaignTarget[];
  slots: ScheduledCampaignSlot[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduledCampaignInput = Omit<
  ScheduledCampaign,
  "id" | "createdAt" | "updatedAt" | "status" | "slots" | "userId"
> & {
  id?: string;
  userId?: string;
  status?: ScheduledCampaignStatus;
  slots: ScheduledCampaignSlotInput[];
};

export type ScheduledCampaignRunResult = {
  campaignId: string;
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
  slotIds: string[];
  failures?: Array<{
    campaignId: string;
    slotId: string;
    error: string;
  }>;
};

export function isDeferredCampaign(
  campaign: Pick<ScheduledCampaign, "generationMode">
): boolean {
  return campaign.generationMode === "deferred";
}
