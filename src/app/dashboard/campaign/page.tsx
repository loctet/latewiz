"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAccounts,
  useCreatePost,
  useCurrentProfileId,
  useGenerateDraft,
  useGenerateCampaignSlot,
  useGenerateCampaignOutline,
  useGenerateImage,
  useGenerateVideo,
  useOpenAiStatus,
  isVideoGenerationConfigured,
  useScheduledCampaigns,
  useSaveScheduledCampaign,
  useDeleteScheduledCampaign,
  useRunScheduledCampaign,
  useUploadMedia,
  urlToFile,
  useImageWatermarkSettings,
  watermarkImageIfEnabled,
} from "@/hooks";
import { buildCampaignSlotTimes } from "@/lib/openai";
import { sanitizeSocialPostText } from "@/lib/openai/sanitize-post-text";
import {
  assignListItemSlotBrief,
  parseCampaignListItems,
  slotBriefToAiInstruction,
} from "@/lib/openai/campaign-arc";
import { useAppStore, useAiStore } from "@/stores";
import { PageContainer } from "@/components/dashboard";
import {
  loadCampaignDraft,
  saveCampaignDraft,
  clearCampaignDraft,
  type CampaignDraft,
  type CampaignSlotDraft,
  type CampaignPlanningMode,
} from "@/lib/campaign-draft-storage";
import { isScheduleInFuture, minScheduleDateInput } from "@/lib/campaign-schedule-validation";
import {
  listSavedCampaigns,
  saveSavedCampaign,
  deleteSavedCampaign,
  getSavedCampaign,
  type SavedCampaign,
} from "@/lib/saved-campaigns-storage";
import { SavedCampaignsPanel } from "./_components/saved-campaigns-panel";
import { ScheduledCampaignsPanel } from "./_components/scheduled-campaigns-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformSelector } from "../compose/_components/platform-selector";
import {
  CampaignMediaModeSelect,
  ImagePromptStyleSelect,
  ImageWatermarkControls,
  PostPromptStyleSelect,
  ResearchDepthSelect,
  VideoPromptStyleSelect,
  VideoProviderSelect,
} from "@/components/ai";
import type { CampaignMediaMode } from "@/lib/campaign-media";
import { migrateCampaignMediaMode } from "@/lib/campaign-media";
import { CampaignSlotCard } from "./_components/campaign-slot-card";
import {
  CalendarClock,
  ImageIcon,
  Loader2,
  Sparkles,
  Send,
  Save,
  ChevronDown,
  FolderOpen,
  Check,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/late-api";
import type {
  CampaignGenerationMode,
  ScheduledCampaign,
  ScheduledCampaignInput,
} from "@/lib/scheduled-campaigns";

export default function CampaignPlannerPage() {
  const router = useRouter();
  const { timezone } = useAppStore();
  const profileId = useCurrentProfileId();
  const profileKey = profileId ?? null;
  const { data: accountsData } = useAccounts();
  const { data: status } = useOpenAiStatus();
  const videoProvider = useAiStore((s) => s.videoProvider);
  const imagePromptStyleId = useAiStore((s) => s.imagePromptStyleId);
  const setImagePromptStyleId = useAiStore((s) => s.setImagePromptStyleId);
  const postPromptStyleId = useAiStore((s) => s.postPromptStyleId);
  const researchDepthId = useAiStore((s) => s.researchDepthId);
  const imageWatermarkSettings = useImageWatermarkSettings();
  const videoConfigured = isVideoGenerationConfigured(videoProvider, status);
  const slotMutation = useGenerateCampaignSlot();
  const outlineMutation = useGenerateCampaignOutline();
  const draftMutation = useGenerateDraft();
  const createPostMutation = useCreatePost();
  const imageMutation = useGenerateImage();
  const videoMutation = useGenerateVideo();
  const uploadMutation = useUploadMedia();
  const { data: scheduledCampaignsData } = useScheduledCampaigns();
  const saveScheduledCampaignMutation = useSaveScheduledCampaign();
  const deleteScheduledCampaignMutation = useDeleteScheduledCampaign();
  const runScheduledCampaignMutation = useRunScheduledCampaign();

  const [postsPerDay, setPostsPerDay] = useState(3);
  const [planDays, setPlanDays] = useState(7);
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [campaignHint, setCampaignHint] = useState("");
  const [generationMode, setGenerationMode] =
    useState<CampaignGenerationMode>("immediate");
  const [campaignMode, setCampaignMode] = useState<CampaignPlanningMode>("arc");
  const [listItemsBlock, setListItemsBlock] = useState("");
  const [trendBlock, setTrendBlock] = useState("");
  const [slots, setSlots] = useState<CampaignSlotDraft[]>([]);
  const [generatingProgress, setGeneratingProgress] = useState<{
    current: number;
    total: number;
    phase?: "outline" | "posts";
  } | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [mediaMode, setMediaMode] = useState<CampaignMediaMode>("none");
  const [committing, setCommitting] = useState(false);
  const [regeneratingCopyIndex, setRegeneratingCopyIndex] = useState<
    number | null
  >(null);
  const [regeneratingImageIndices, setRegeneratingImageIndices] = useState<
    number[]
  >([]);
  const [generatingImagesProgress, setGeneratingImagesProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [regeneratingVideoIndex, setRegeneratingVideoIndex] = useState<
    number | null
  >(null);
  const [applyingWatermark, setApplyingWatermark] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [activeScheduledId, setActiveScheduledId] = useState<string | null>(null);
  const [runningCampaignId, setRunningCampaignId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [studioPhase, setStudioPhase] = useState<"plan" | "review">("plan");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minStartDate = minScheduleDateInput();
  const listItems = parseCampaignListItems(listItemsBlock);
  const scheduledCampaigns = scheduledCampaignsData?.campaigns ?? [];
  const isListMode = campaignMode === "list";
  const isDeferredMode = generationMode === "deferred";
  const effectivePlanDays = isListMode
    ? Math.max(1, Math.ceil(listItems.length / postsPerDay) || 1)
    : planDays;
  const plannedSlotCount = isListMode
    ? listItems.length
    : postsPerDay * planDays;

  const accounts = (accountsData?.accounts || []) as {
    _id: string;
    platform: string;
  }[];
  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a._id)
  );

  const applyDraft = useCallback((draft: CampaignDraft, savedId?: string | null) => {
    setGenerationMode(draft.generationMode === "deferred" ? "deferred" : "immediate");
    setPostsPerDay(draft.postsPerDay);
    setPlanDays(draft.planDays);
    setStartDate(draft.startDate);
    setWindowStart(draft.windowStart);
    setWindowEnd(draft.windowEnd);
    setCampaignGoal(draft.campaignGoal ?? "");
    setCampaignHint(draft.campaignHint);
    setCampaignMode(draft.campaignMode === "list" ? "list" : "arc");
    setListItemsBlock(draft.listItemsBlock ?? "");
    setTrendBlock(draft.trendBlock);
    setSelectedAccountIds(draft.selectedAccountIds);
    setMediaMode(migrateCampaignMediaMode(draft));
    setSlots(draft.slots);
    setDraftRestored(true);
    setStudioPhase(draft.slots.length > 0 ? "review" : "plan");
    if (savedId !== undefined) setActiveSavedId(savedId);
    setActiveScheduledId(null);
  }, []);

  const applyScheduledCampaign = useCallback((campaign: ScheduledCampaign) => {
    setGenerationMode(campaign.generationMode);
    setPostsPerDay(campaign.postsPerDay);
    setPlanDays(campaign.planDays);
    setStartDate(campaign.startDate);
    setWindowStart(campaign.windowStart);
    setWindowEnd(campaign.windowEnd);
    setCampaignGoal(campaign.campaignGoal);
    setCampaignHint(campaign.campaignHint);
    setCampaignMode(campaign.campaignMode);
    setListItemsBlock(campaign.listItemsBlock);
    setTrendBlock(campaign.trendBlock);
    setSelectedAccountIds(campaign.selectedAccountIds);
    setMediaMode(campaign.mediaMode);
    setSlots(
      campaign.slots.map((slot) => ({
        ...slot,
        generationStatus: slot.status,
      }))
    );
    setDraftRestored(true);
    setActiveScheduledId(campaign.id);
    setActiveSavedId(null);
    setSaveName(campaign.name);
    setStudioPhase(campaign.slots.length > 0 ? "review" : "plan");
  }, []);

  const refreshSavedList = useCallback(() => {
    setSavedCampaigns(listSavedCampaigns(profileKey));
  }, [profileKey]);

  useEffect(() => {
    refreshSavedList();
    const draft = loadCampaignDraft();
    if (draft) {
      applyDraft(draft, null);
    }
  }, [applyDraft, refreshSavedList]);

  const getCurrentDraft = useCallback(
    (): Omit<CampaignDraft, "savedAt"> => ({
      generationMode,
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      campaignGoal,
      campaignHint,
      campaignMode,
      listItemsBlock,
      trendBlock,
      selectedAccountIds,
      mediaMode,
      slots,
    }),
    [
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      campaignGoal,
      campaignHint,
      generationMode,
      campaignMode,
      listItemsBlock,
      trendBlock,
      selectedAccountIds,
      mediaMode,
      slots,
    ]
  );

  const getCurrentScheduledCampaignInput = useCallback(
    (): ScheduledCampaignInput => ({
      id: activeScheduledId ?? undefined,
      name: saveName.trim() || campaignGoal.trim().slice(0, 48) || "Untitled campaign",
      profileId: profileId ?? null,
      generationMode: "deferred",
      generationLeadMinutes: 60,
      timezone,
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      campaignMode,
      campaignGoal,
      campaignHint,
      trendBlock,
      listItemsBlock,
      mediaMode,
      niche: useAiStore.getState().niche,
      postPromptStyleId,
      researchDepthId,
      imagePromptStyleId,
      videoPromptStyleId: useAiStore.getState().videoPromptStyleId,
      videoProvider,
      postPromptTemplates: useAiStore.getState().postPromptTemplates,
      imagePromptTemplates: useAiStore.getState().imagePromptTemplates,
      videoPromptTemplates: useAiStore.getState().videoPromptTemplates,
      imageWatermarkSettings,
      selectedAccountIds,
      targets: selectedAccounts.map((account) => ({
        accountId: account._id,
        platform: account.platform as Platform,
      })),
      slots: slots.map((slot) => ({
        id: "id" in slot && typeof slot.id === "string" ? slot.id : undefined,
        scheduled_at: slot.scheduled_at,
        status:
          slot.generationStatus === "generated" ||
          slot.generationStatus === "failed" ||
          slot.generationStatus === "processing" ||
          slot.generationStatus === "cancelled"
            ? slot.generationStatus
            : "pending_generation",
        title: slot.title,
        body: slot.body,
        hashtags: slot.hashtags,
        content: slot.content,
        image_url: slot.image_url,
        video_url: slot.video_url,
        aiInstruction: slot.aiInstruction,
        imagePromptStyleId: slot.imagePromptStyleId ?? imagePromptStyleId,
        videoPromptStyleId:
          slot.videoPromptStyleId ?? useAiStore.getState().videoPromptStyleId,
        reference_image_url: slot.reference_image_url ?? null,
        brief: slot.brief,
        detail: slot.detail ?? null,
        generatedAt: slot.generatedAt ?? null,
        postId: slot.postId ?? null,
        lastError: slot.lastError ?? null,
      })),
    }),
    [
      activeScheduledId,
      campaignGoal,
      campaignHint,
      campaignMode,
      imagePromptStyleId,
      imageWatermarkSettings,
      listItemsBlock,
      mediaMode,
      planDays,
      postPromptStyleId,
      researchDepthId,
      postsPerDay,
      profileId,
      saveName,
      selectedAccountIds,
      selectedAccounts,
      slots,
      startDate,
      timezone,
      trendBlock,
      videoProvider,
      windowEnd,
      windowStart,
    ]
  );

  const handleSaveForLater = async () => {
    if (isDeferredMode) {
      if (!status?.scheduled_campaigns_configured) {
        toast.error(
          "Scheduled campaigns require server-managed AI and Zernio keys."
        );
        return;
      }
      if (!profileId || selectedAccounts.length === 0) {
        toast.error("Select at least one account");
        return;
      }
      if (slots.length === 0) {
        toast.error("Plan the campaign first");
        return;
      }
      try {
        const saved = await saveScheduledCampaignMutation.mutateAsync(
          getCurrentScheduledCampaignInput()
        );
        setActiveScheduledId(saved.campaign.id);
        setSaveName(saved.campaign.name);
        toast.success(
          activeScheduledId
            ? "Scheduled campaign updated"
            : "Scheduled campaign saved for cron"
        );
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save scheduled campaign"
        );
      }
      return;
    }

    const name = saveName.trim() || campaignGoal.trim().slice(0, 48) || "Untitled campaign";
    const saved = saveSavedCampaign({
      id: activeSavedId ?? undefined,
      name,
      profileId: profileKey,
      draft: getCurrentDraft(),
    });
    if (!saved) {
      toast.error("Could not save campaign (storage full)");
      return;
    }
    setActiveSavedId(saved.id);
    setSaveName(saved.name);
    refreshSavedList();
    const wasUpdate = Boolean(activeSavedId);
    toast.success(
      wasUpdate
        ? "Campaign updated"
        : "Campaign saved — open it anytime from Saved campaigns"
    );
  };

  const handleLoadSaved = (id: string) => {
    const saved = getSavedCampaign(id, profileKey);
    if (!saved) {
      toast.error("Campaign not found");
      refreshSavedList();
      return;
    }
    applyDraft(saved, saved.id);
    setSaveName(saved.name);
    saveCampaignDraft({
      postsPerDay: saved.postsPerDay,
      planDays: saved.planDays,
      startDate: saved.startDate,
      windowStart: saved.windowStart,
      windowEnd: saved.windowEnd,
      campaignMode: saved.campaignMode === "list" ? "list" : "arc",
      listItemsBlock: saved.listItemsBlock ?? "",
      campaignGoal: saved.campaignGoal ?? "",
      campaignHint: saved.campaignHint,
      generationMode: saved.generationMode ?? "immediate",
      trendBlock: saved.trendBlock,
      selectedAccountIds: saved.selectedAccountIds,
      mediaMode: migrateCampaignMediaMode(saved),
      slots: saved.slots,
    });
    toast.success(`Opened "${saved.name}"`);
  };

  const handleLoadScheduled = (id: string) => {
    const campaign = scheduledCampaigns.find((item) => item.id === id);
    if (!campaign) {
      toast.error("Scheduled campaign not found");
      return;
    }
    applyScheduledCampaign(campaign);
    toast.success(`Opened "${campaign.name}"`);
  };

  const handleDeleteSaved = async (id: string) => {
    if (scheduledCampaigns.some((campaign) => campaign.id === id)) {
      try {
        await deleteScheduledCampaignMutation.mutateAsync(id);
        if (activeScheduledId === id) setActiveScheduledId(null);
        toast.success("Scheduled campaign removed");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not delete scheduled campaign"
        );
      }
      return;
    }

    if (!deleteSavedCampaign(id, profileKey)) return;
    if (activeSavedId === id) setActiveSavedId(null);
    refreshSavedList();
    toast.success("Saved campaign removed");
  };

  const handleNewCampaign = () => {
    clearCampaignDraft();
    setActiveSavedId(null);
    setActiveScheduledId(null);
    setSaveName("");
    setSlots([]);
    setCampaignGoal("");
    setCampaignHint("");
    setGenerationMode("immediate");
    setCampaignMode("arc");
    setListItemsBlock("");
    setTrendBlock("");
    setDraftRestored(false);
    setStartDate(minScheduleDateInput());
    setStudioPhase("plan");
    toast.message("New campaign started");
  };

  const handleRunScheduled = async (id: string) => {
    setRunningCampaignId(id);
    try {
      const result = await runScheduledCampaignMutation.mutateAsync(id);
      toast.success(
        `Run complete: ${result.result.generated} generated, ${result.result.failed} failed`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run campaign");
    } finally {
      setRunningCampaignId(null);
    }
  };

  const persistDraft = useCallback(() => {
    const ok = saveCampaignDraft({
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      generationMode,
      campaignGoal,
      campaignHint,
      campaignMode,
      listItemsBlock,
      trendBlock,
      selectedAccountIds,
      mediaMode,
      slots,
    });
    if (!ok) {
      toast.error("Could not save campaign draft (storage full). Media previews are not saved in draft.");
    }
  }, [
    postsPerDay,
    planDays,
    startDate,
    windowStart,
    windowEnd,
    generationMode,
    campaignGoal,
    campaignHint,
    campaignMode,
    listItemsBlock,
    trendBlock,
    selectedAccountIds,
    mediaMode,
    slots,
  ]);

  useEffect(() => {
    if (!draftRestored && slots.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistDraft, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [persistDraft, draftRestored, slots.length]);

  const handlePlan = async () => {
    const goal = campaignGoal.trim();
    if (!goal) {
      toast.error("Enter a campaign goal first");
      return;
    }

    const listModeItems = isListMode ? parseCampaignListItems(listItemsBlock) : [];
    if (isListMode && listModeItems.length === 0) {
      toast.error("Add at least one item to your list (one per line)");
      return;
    }

    const requestedTotal = isListMode
      ? listModeItems.length
      : postsPerDay * planDays;
    const scheduleDays = isListMode ? effectivePlanDays : planDays;
    let slotTimes = buildCampaignSlotTimes(
      startDate,
      scheduleDays,
      postsPerDay,
      windowStart,
      windowEnd,
      timezone
    ).slice(0, requestedTotal);

    if (isListMode && slotTimes.length < requestedTotal) {
      let extraDays = scheduleDays;
      while (extraDays < 31 && slotTimes.length < requestedTotal) {
        extraDays++;
        slotTimes = buildCampaignSlotTimes(
          startDate,
          extraDays,
          postsPerDay,
          windowStart,
          windowEnd,
          timezone
        ).slice(0, requestedTotal);
      }
    }

    if (slotTimes.length === 0) {
      toast.error(
        "No future slots in this window. Use today or a later start date and a posting window after now."
      );
      return;
    }

    const skipped = requestedTotal - slotTimes.length;
    if (skipped > 0) {
      toast.message(
        `${skipped} past slot(s) skipped — only times after now are scheduled.`
      );
    }

    const total = slotTimes.length;

    const trendSnippets = trendBlock
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const emptySlots: CampaignSlotDraft[] = slotTimes.map((scheduled_at) => ({
      scheduled_at,
      title: "",
      body: "",
      hashtags: "",
      content: "",
      aiInstruction: "",
      generationStatus: isDeferredMode ? "pending_generation" : undefined,
    }));
    setSlots(emptySlots);
    setDraftRestored(true);
    setGeneratingProgress({
      current: 0,
      total,
      phase: isListMode ? "posts" : "outline",
    });

    const previous: { title: string; body: string; hashtags: string }[] = [];
    let hadStub = false;
    let outlineBeats: {
      slotIndex: number;
      phase: string;
      beat: string;
      subtopic: string;
      angle: string;
      keyPoint: string;
      searchHint: string;
    }[] = [];

    try {
      if (isListMode) {
        outlineBeats = listModeItems.slice(0, total).map((item, i) =>
          assignListItemSlotBrief(item, i, total, goal)
        );
      } else {
        const outline = await outlineMutation.mutateAsync({
          campaignGoal: goal,
          totalPosts: total,
          campaignHint: campaignHint.trim() || undefined,
          trendSnippets,
        });
        outlineBeats = outline.beats;
        if (outline.source === "stub") hadStub = true;
      }

      if (isDeferredMode) {
        const deferredSlots: CampaignSlotDraft[] = slotTimes.map(
          (scheduled_at, i) => {
            const brief = outlineBeats[i];
            return {
              scheduled_at,
              title: "",
              body: "",
              hashtags: "",
              content: "",
              aiInstruction: brief
                ? slotBriefToAiInstruction({
                    ...brief,
                    phase: brief.phase as
                      | "intro"
                      | "build"
                      | "deepen"
                      | "apply"
                      | "close",
                  })
                : "",
              generationStatus: "pending_generation",
              imagePromptStyleId,
              videoPromptStyleId: useAiStore.getState().videoPromptStyleId,
              brief: brief
                ? {
                    ...brief,
                    phase: brief.phase as
                      | "intro"
                      | "build"
                      | "deepen"
                      | "apply"
                      | "close",
                  }
                : undefined,
            };
          }
        );
        setSlots(deferredSlots);
        toast.success(
          isListMode
            ? `Planned ${total} deferred slot${total === 1 ? "" : "s"} from your list`
            : `Planned ${total} deferred campaign slot${total === 1 ? "" : "s"}`
        );
        setStudioPhase("review");
        return;
      }

      setGeneratingProgress({ current: 0, total, phase: "posts" });

      for (let i = 0; i < total; i++) {
        setGeneratingProgress({ current: i + 1, total, phase: "posts" });
        const brief = outlineBeats[i];
        const r = await slotMutation.mutateAsync({
          campaignGoal: goal,
          slotIndex: i,
          totalPosts: total,
          scheduledAt: slotTimes[i],
          previousPosts: previous,
          campaignHint: campaignHint.trim() || undefined,
          trendSnippets,
          slotBrief: brief,
          coveredSubtopics: outlineBeats.slice(0, i).map((b) => b.subtopic),
          postPromptStyleId,
          isListMode,
          researchDepthId,
        });

        if (r.source === "stub") hadStub = true;

        const post = r.post;
        previous.push({
          title: post.title,
          body: post.body,
          hashtags: post.hashtags,
        });

        setSlots((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  title: post.title,
                  body: post.body,
                  hashtags: post.hashtags,
                  content: post.content,
                  aiInstruction: brief
                    ? slotBriefToAiInstruction({
                        ...brief,
                        phase: brief.phase as
                          | "intro"
                          | "build"
                          | "deepen"
                          | "apply"
                          | "close",
                      })
                    : s.aiInstruction,
                }
              : s
          )
        );
      }

      if (hadStub) {
        toast.message("Using placeholder copy — add OpenAI key for full AI.");
      }
      toast.success(
        isListMode
          ? `Generated ${total} post${total === 1 ? "" : "s"} (one per list item)`
          : `Generated ${total} posts toward your campaign goal`
      );
      setStudioPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Planning failed");
    } finally {
      setGeneratingProgress(null);
    }
  };

  const updateSlot = (index: number, patch: Partial<CampaignSlotDraft>) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const regenerateSlotCopy = async (index: number) => {
    const slot = slots[index];
    if (!status?.openai_configured) {
      toast.error("Add OpenAI key in Settings first.");
      return;
    }
    setRegeneratingCopyIndex(index);
    try {
      const instruction = slot.aiInstruction?.trim();
      const prior = slots
        .filter((_, i) => i !== index)
        .map((s, i) => `Earlier slot ${i + 1}: ${s.title}`)
        .join("\n");

      const hint = [
        `Campaign goal: ${campaignGoal.trim() || "Engage audience"}`,
        `Regenerate post for slot ${index + 1} of ${slots.length}.`,
        prior ? `Other slots in this campaign:\n${prior}` : "",
        `Current title: ${slot.title}`,
        `Current body: ${slot.body}`,
        slot.hashtags ? `Current hashtags: ${slot.hashtags}` : "",
        instruction
          ? `Specific instructions (follow closely): ${instruction}`
          : "Improve clarity while advancing the campaign goal.",
      ]
        .filter(Boolean)
        .join("\n");

      const r = await draftMutation.mutateAsync(hint);
      const body = r.draft.body;
      const hashtags = r.draft.hashtags;
      updateSlot(index, {
        title: r.draft.title,
        body,
        hashtags,
        content: [body, hashtags].filter(Boolean).join("\n\n"),
      });
      if (r.source === "fallback" && r.detail) {
        toast.error(r.detail);
      } else {
        toast.success("Copy regenerated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegeneratingCopyIndex(null);
    }
  };

  const generateSlotImage = async (
    index: number,
    slot: CampaignSlotDraft
  ): Promise<{ ok: boolean; detail?: string | null }> => {
    const instruction = slot.aiInstruction?.trim();
    const r = await imageMutation.mutateAsync({
      captionContext: [slot.title, slot.body, slot.hashtags, instruction]
        .filter(Boolean)
        .join("\n\n"),
      prompt: instruction || undefined,
      promptStyleId: slot.imagePromptStyleId ?? imagePromptStyleId,
      referenceImageUrl: slot.reference_image_url ?? undefined,
    });
    if (r.image_url) {
      updateSlot(index, { image_url: r.image_url, video_url: null });
      return { ok: true };
    }
    return { ok: false, detail: r.detail };
  };

  const regenerateSlotImage = async (index: number) => {
    const slot = slots[index];
    if (!status?.openai_configured) {
      toast.error("Add OpenAI key in Settings first.");
      return;
    }
    setRegeneratingImageIndices([index]);
    try {
      const result = await generateSlotImage(index, slot);
      if (result.ok) {
        toast.success("Image regenerated");
      } else {
        toast.error(result.detail ?? "No image returned");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setRegeneratingImageIndices([]);
    }
  };

  const generateAllSlotImages = async (regenerateExisting = false) => {
    if (!status?.openai_configured) {
      toast.error("Add OpenAI key in Settings first.");
      return;
    }

    const targets = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => regenerateExisting || !slot.image_url);

    if (targets.length === 0) {
      toast.message("All slots already have images");
      return;
    }

    const targetIndices = targets.map(({ index }) => index);
    setGeneratingImagesProgress({ current: 0, total: targets.length });
    setRegeneratingImageIndices(targetIndices);

    const results = await Promise.allSettled(
      targets.map(async ({ slot, index }) => {
        try {
          return await generateSlotImage(index, slot);
        } finally {
          setGeneratingImagesProgress((prev) =>
            prev
              ? { ...prev, current: Math.min(prev.current + 1, prev.total) }
              : null
          );
        }
      })
    );

    let ok = 0;
    let fail = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) ok++;
      else fail++;
    }

    setRegeneratingImageIndices([]);
    setGeneratingImagesProgress(null);

    if (ok > 0) {
      toast.success(
        `Generated ${ok} image${ok === 1 ? "" : "s"} for scheduled posts`
      );
    }
    if (fail > 0) {
      toast.error(
        `${fail} image${fail === 1 ? "" : "s"} could not be generated`
      );
    }
  };

  const applyWatermarkToExistingImages = async () => {
    if (!imageWatermarkSettings.enabled || !imageWatermarkSettings.text.trim()) {
      toast.error("Enable signature and enter text first");
      return;
    }

    const targets = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.image_url);

    if (targets.length === 0) {
      toast.message("No images to stamp yet");
      return;
    }

    setApplyingWatermark(true);
    let ok = 0;
    let fail = 0;

    for (const { slot, index } of targets) {
      try {
        const stamped = await watermarkImageIfEnabled(
          slot.image_url!,
          imageWatermarkSettings
        );
        if (stamped !== slot.image_url) {
          updateSlot(index, { image_url: stamped });
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }

    setApplyingWatermark(false);

    if (ok > 0) {
      toast.success(
        `Signature applied to ${ok} image${ok === 1 ? "" : "s"}`
      );
    }
    if (fail > 0 && ok === 0) {
      toast.error("Could not apply signature to images");
    }
  };

  const existingImageCount = slots.filter((s) => s.image_url).length;

  const regenerateSlotVideo = async (index: number) => {
    const slot = slots[index];
    if (!videoConfigured) {
      toast.error(
        videoProvider === "fal-pika"
          ? "Add fal.ai API key in Settings first."
          : "Add OpenAI key in Settings first."
      );
      return;
    }
    toast.message("Video generation can take 1–3 minutes…");
    setRegeneratingVideoIndex(index);
    try {
      const instruction = slot.aiInstruction?.trim();
      const r = await videoMutation.mutateAsync({
        captionContext: [slot.title, slot.body, slot.hashtags, instruction]
          .filter(Boolean)
          .join("\n\n"),
        prompt: instruction || undefined,
        promptStyleId: slot.videoPromptStyleId,
      });
      if (r.video_url) {
        updateSlot(index, { video_url: r.video_url, image_url: null });
        toast.success("Video regenerated");
      } else {
        toast.error(r.detail ?? "No video returned");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video generation failed");
    } finally {
      setRegeneratingVideoIndex(null);
    }
  };

  const commitCampaign = async () => {
    if (isDeferredMode) {
      await handleSaveForLater();
      return;
    }

    if (!profileId || selectedAccountIds.length === 0) {
      toast.error("Select at least one account");
      return;
    }
    if (slots.length === 0) {
      toast.error("Plan a campaign first");
      return;
    }

    const pastSlots = slots.filter(
      (s) => !isScheduleInFuture(s.scheduled_at)
    );
    if (pastSlots.length > 0) {
      toast.error(
        `${pastSlots.length} slot${pastSlots.length === 1 ? "" : "s"} must be scheduled after the current date and time`
      );
      return;
    }

    setCommitting(true);
    let ok = 0;
    let fail = 0;

    const platforms = selectedAccounts.map((account) => ({
      platform: account.platform as Platform,
      accountId: account._id,
    }));

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      try {
        let mediaItems:
          | { type: "image" | "video"; url: string }[]
          | undefined;
        if (slot.video_url) {
          const file = await urlToFile(slot.video_url, `campaign-${i}.mp4`);
          const uploaded = await uploadMutation.mutateAsync(file);
          mediaItems = [{ type: "video", url: uploaded.url }];
        } else if (slot.image_url) {
          const file = await urlToFile(slot.image_url, `campaign-${i}.png`);
          const uploaded = await uploadMutation.mutateAsync(file);
          mediaItems = [{ type: "image", url: uploaded.url }];
        } else if (mediaMode === "video" && videoConfigured) {
          const r = await videoMutation.mutateAsync({
            captionContext: slot.content || slot.body,
            promptStyleId: slot.videoPromptStyleId,
          });
          if (r.video_url) {
            const file = await urlToFile(r.video_url, `campaign-${i}.mp4`);
            const uploaded = await uploadMutation.mutateAsync(file);
            mediaItems = [{ type: "video", url: uploaded.url }];
          }
        } else if (mediaMode === "image" && status?.openai_configured) {
          const r = await imageMutation.mutateAsync({
            captionContext: slot.content || slot.body,
            promptStyleId: slot.imagePromptStyleId ?? imagePromptStyleId,
            referenceImageUrl: slot.reference_image_url ?? undefined,
          });
          if (r.image_url) {
            const file = await urlToFile(r.image_url, `campaign-${i}.png`);
            const uploaded = await uploadMutation.mutateAsync(file);
            mediaItems = [{ type: "image", url: uploaded.url }];
          }
        }

        await createPostMutation.mutateAsync({
          content: sanitizeSocialPostText(
            slot.content ||
              [slot.body, slot.hashtags].filter(Boolean).join("\n\n")
          ),
          platforms,
          scheduledFor: slot.scheduled_at,
          timezone,
          mediaItems,
        });
        ok++;
      } catch {
        fail++;
      }
    }

    setCommitting(false);
    if (ok > 0) {
      clearCampaignDraft();
      if (activeSavedId) {
        deleteSavedCampaign(activeSavedId, profileKey);
        setActiveSavedId(null);
        refreshSavedList();
      }
      toast.success(`Scheduled ${ok} post${ok === 1 ? "" : "s"} via Zernio`);
      router.push("/dashboard/calendar");
    }
    if (fail > 0) {
      toast.error(`${fail} post${fail === 1 ? "" : "s"} failed to schedule`);
    }
  };

  return (
    <PageContainer className="max-w-6xl pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="h-4 w-4" />
            </span>
            Campaign Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan an arc, review slots, then publish to Zernio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={() => setLibraryOpen((o) => !o)}
            aria-expanded={libraryOpen}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Library
            <ChevronDown
              className={cn(
                "ml-1 h-3.5 w-3.5 transition-transform duration-200",
                libraryOpen && "rotate-180"
              )}
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={handleSaveForLater}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isDeferredMode ? "Save scheduled" : "Save"}
          </Button>
        </div>
      </div>

      {libraryOpen && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {isDeferredMode
              ? "Server cron campaigns (generate near publish)"
              : "Browser-saved drafts for this profile"}
          </p>
          {isDeferredMode ? (
            <ScheduledCampaignsPanel
              campaigns={scheduledCampaigns}
              activeId={activeScheduledId}
              saveName={saveName}
              saving={saveScheduledCampaignMutation.isPending}
              runningId={runningCampaignId}
              onSaveNameChange={setSaveName}
              onSave={() => {
                void handleSaveForLater();
              }}
              onLoad={handleLoadScheduled}
              onDelete={(id) => {
                void handleDeleteSaved(id);
              }}
              onRun={(id) => {
                void handleRunScheduled(id);
              }}
            />
          ) : (
            <SavedCampaignsPanel
              saved={savedCampaigns}
              activeSavedId={activeSavedId}
              saveName={saveName}
              onSaveNameChange={setSaveName}
              onSave={() => {
                void handleSaveForLater();
              }}
              onLoad={handleLoadSaved}
              onDelete={(id) => {
                void handleDeleteSaved(id);
              }}
              onNew={handleNewCampaign}
            />
          )}
        </div>
      )}

      {draftRestored && slots.length > 0 && !activeSavedId && !activeScheduledId && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Restored in-progress draft from this browser session.
        </p>
      )}

      {/* Step progress */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "plan" as const, label: "1 · Plan", enabled: true },
            {
              id: "review" as const,
              label: "2 · Review & publish",
              enabled: slots.length > 0,
            },
          ] as const
        ).map((step) => (
          <button
            key={step.id}
            type="button"
            disabled={!step.enabled}
            onClick={() => step.enabled && setStudioPhase(step.id)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
              studioPhase === step.id
                ? "border-primary bg-primary text-primary-foreground"
                : step.enabled
                  ? "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  : "cursor-not-allowed border-border bg-muted text-muted-foreground/50"
            )}
          >
            {studioPhase === step.id || (step.id === "review" && slots.length > 0) ? (
              <Check className="h-3 w-3" />
            ) : null}
            {step.label}
            {step.id === "review" && slots.length > 0 ? ` (${slots.length})` : ""}
          </button>
        ))}
      </div>

      {studioPhase === "plan" && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Campaign brief</h2>
              <p className="text-xs text-muted-foreground">
                {isListMode
                  ? listItems.length > 0
                    ? `${listItems.length} posts · ~${effectivePlanDays} days at ${postsPerDay}/day`
                    : "Add list items — one post per line"
                  : `${postsPerDay}/day × ${planDays} days = ${postsPerDay * planDays} slots`}
              </p>
            </div>
            <Link
              href="/dashboard/niche"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Niche settings
            </Link>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Generation timing</Label>
                <Tabs
                  value={generationMode}
                  onValueChange={(value) => {
                    const nextMode =
                      value === "deferred" ? "deferred" : "immediate";
                    setGenerationMode(nextMode);
                    if (nextMode === "deferred") {
                      setActiveSavedId(null);
                    } else {
                      setActiveScheduledId(null);
                    }
                  }}
                >
                  <TabsList className="h-8 w-full">
                    <TabsTrigger value="immediate" className="text-xs">
                      Generate now
                    </TabsTrigger>
                    <TabsTrigger value="deferred" className="text-xs">
                      Near publish
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {isDeferredMode && !status?.scheduled_campaigns_configured ? (
                  <p className="text-[11px] text-destructive">
                    Needs Zernio + OpenAI keys in Settings vault.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Structure</Label>
                <Tabs
                  value={campaignMode}
                  onValueChange={(v) =>
                    setCampaignMode(v === "list" ? "list" : "arc")
                  }
                >
                  <TabsList className="h-8 w-full">
                    <TabsTrigger value="arc" className="text-xs">
                      Content arc
                    </TabsTrigger>
                    <TabsTrigger value="list" className="text-xs">
                      List items
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {isListMode && (
              <div className="space-y-1.5">
                <Label htmlFor="campaign-list" className="text-xs">
                  List items (one per line)
                </Label>
                <Textarea
                  id="campaign-list"
                  value={listItemsBlock}
                  onChange={(e) => setListItemsBlock(e.target.value)}
                  rows={4}
                  placeholder={"Bitcoin\nEthereum\nSolana"}
                  className="resize-none text-sm"
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="posts-per-day" className="text-xs">
                  Posts / day
                </Label>
                <Input
                  id="posts-per-day"
                  type="number"
                  min={1}
                  max={12}
                  value={postsPerDay}
                  onChange={(e) => setPostsPerDay(Number(e.target.value) || 1)}
                  className="h-8"
                />
              </div>
              {!isListMode ? (
                <div className="space-y-1.5">
                  <Label htmlFor="plan-days" className="text-xs">
                    Days
                  </Label>
                  <Input
                    id="plan-days"
                    type="number"
                    min={1}
                    max={31}
                    value={planDays}
                    onChange={(e) => setPlanDays(Number(e.target.value) || 1)}
                    className="h-8"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Days (auto)</Label>
                  <Input
                    type="text"
                    readOnly
                    value={listItems.length > 0 ? String(effectivePlanDays) : "—"}
                    className="h-8 bg-muted"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-xs">
                  Start date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  min={minStartDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Window</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="time"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="h-8"
                    aria-label="Window start"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="h-8"
                    aria-label="Window end"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="campaign-goal" className="text-xs">
                Campaign goal
              </Label>
              <Textarea
                id="campaign-goal"
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                rows={2}
                placeholder={
                  isListMode
                    ? "e.g. Detailed market analysis with catalysts and outlook"
                    : "e.g. Launch our course and get 50 sign-ups"
                }
                className="resize-none text-sm"
              />
            </div>

            <PostPromptStyleSelect
              compact
              campaignGoal={campaignGoal}
              isListMode={isListMode}
            />

            <ResearchDepthSelect compact />

            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={advancedOpen}
              >
                Optional theme & trends
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    advancedOpen && "rotate-180"
                  )}
                />
              </button>
              {advancedOpen && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-hint" className="text-xs">
                      Supporting theme
                    </Label>
                    <Input
                      id="campaign-hint"
                      value={campaignHint}
                      onChange={(e) => setCampaignHint(e.target.value)}
                      placeholder="e.g. Product launch week"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="trend-hooks" className="text-xs">
                      Trend hooks (one per line)
                    </Label>
                    <Textarea
                      id="trend-hooks"
                      value={trendBlock}
                      onChange={(e) => setTrendBlock(e.target.value)}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full cursor-pointer sm:w-auto"
              onClick={handlePlan}
              disabled={
                generatingProgress !== null ||
                slotMutation.isPending ||
                outlineMutation.isPending
              }
            >
              {generatingProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {generatingProgress
                ? generatingProgress.phase === "outline"
                  ? "Planning content arc…"
                  : `Generating ${generatingProgress.current} / ${generatingProgress.total}…`
                : isListMode
                  ? isDeferredMode
                    ? `Plan ${plannedSlotCount || ""} deferred slots`
                    : `Generate ${plannedSlotCount || ""} posts from list`
                  : isDeferredMode
                    ? "Plan deferred slots"
                    : "Generate campaign"}
            </Button>
          </div>
        </div>
      )}

      {studioPhase === "review" && slots.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  Slots ({slots.length})
                </h2>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {campaignGoal.trim() || "No goal set"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 cursor-pointer"
                onClick={() => setStudioPhase("plan")}
              >
                Edit plan
              </Button>
            </div>

            <div className="mb-4 space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3">
              <CampaignMediaModeSelect
                compact
                value={mediaMode}
                onValueChange={setMediaMode}
                disabled={
                  !status?.openai_configured && !status?.fal_configured
                }
              />
              <ImageWatermarkControls
                existingImageCount={existingImageCount}
                applyingToExisting={applyingWatermark}
                onApplyToExisting={applyWatermarkToExistingImages}
              />
              {mediaMode === "image" && (
                <div className="space-y-2">
                  <ImagePromptStyleSelect
                    compact
                    onValueChange={(id) => {
                      setImagePromptStyleId(id);
                      setSlots((prev) =>
                        prev.map((s) => ({ ...s, imagePromptStyleId: id }))
                      );
                    }}
                  />
                  {!isDeferredMode ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 cursor-pointer"
                        onClick={() => generateAllSlotImages(false)}
                        disabled={
                          generatingImagesProgress !== null ||
                          regeneratingImageIndices.length > 0 ||
                          !status?.openai_configured
                        }
                      >
                        {generatingImagesProgress ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {generatingImagesProgress
                          ? `${generatingImagesProgress.current}/${generatingImagesProgress.total}`
                          : "Generate all images"}
                      </Button>
                      {slots.some((s) => s.image_url) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 cursor-pointer"
                          onClick={() => generateAllSlotImages(true)}
                          disabled={
                            generatingImagesProgress !== null ||
                            regeneratingImageIndices.length > 0 ||
                            !status?.openai_configured
                          }
                        >
                          Regenerate all
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              {mediaMode === "video" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <VideoProviderSelect compact />
                  <VideoPromptStyleSelect compact />
                </div>
              )}
            </div>

            <div className="space-y-2">
              {slots.map((slot, i) => (
                <CampaignSlotCard
                  key={`slot-${i}-${slot.scheduled_at}`}
                  slot={slot}
                  index={i}
                  onUpdate={(patch) => updateSlot(i, patch)}
                  onRemove={() => removeSlot(i)}
                  onRegenerateCopy={() => regenerateSlotCopy(i)}
                  mediaMode={mediaMode}
                  onRegenerateImage={() => regenerateSlotImage(i)}
                  onRegenerateVideo={() => regenerateSlotVideo(i)}
                  copyLoading={regeneratingCopyIndex === i}
                  imageLoading={regeneratingImageIndices.includes(i)}
                  videoLoading={regeneratingVideoIndex === i}
                  timezone={timezone}
                  deferredMode={isDeferredMode}
                  defaultExpanded={i === 0}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <h2 className="mb-2 text-sm font-semibold">Publish accounts</h2>
            <PlatformSelector
              selectedAccountIds={selectedAccountIds}
              onSelectionChange={setSelectedAccountIds}
              hasVideo={
                mediaMode === "video" || slots.some((s) => s.video_url)
              }
              hasImages={
                mediaMode === "image" || slots.some((s) => s.image_url)
              }
            />
            {selectedAccountIds.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Select at least one account before scheduling.
              </p>
            )}
          </div>
        </div>
      )}

      {studioPhase === "review" && slots.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {slots.length} slot{slots.length === 1 ? "" : "s"}
              {selectedAccountIds.length > 0
                ? ` · ${selectedAccountIds.length} account${selectedAccountIds.length === 1 ? "" : "s"}`
                : " · no accounts selected"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleSaveForLater}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={commitCampaign}
                disabled={
                  committing ||
                  createPostMutation.isPending ||
                  saveScheduledCampaignMutation.isPending
                }
              >
                {committing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isDeferredMode
                  ? activeScheduledId
                    ? "Update scheduled"
                    : "Save for cron"
                  : `Schedule ${slots.length}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
