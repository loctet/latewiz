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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformSelector } from "../compose/_components/platform-selector";
import {
  CampaignMediaModeSelect,
  ImagePromptStyleSelect,
  ImageWatermarkControls,
  PostPromptStyleSelect,
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
} from "lucide-react";
import Link from "next/link";
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
      imagePromptStyleId,
      videoPromptStyleId: useAiStore.getState().videoPromptStyleId,
      videoProvider,
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
    <PageContainer className="pb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Campaign Planner
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Plan posts now, or save a deferred cron campaign that generates fresh research, copy, and media near publish time via{" "}
            <a
              href="https://docs.zernio.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Zernio
            </a>
            . All slots must be after the current date and time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSaveForLater}>
          <Save className="mr-2 h-4 w-4" />
          {isDeferredMode ? "Save scheduled campaign" : "Save for later"}
        </Button>
      </div>

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

      {draftRestored && slots.length > 0 && !activeSavedId && !activeScheduledId && (
        <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
          Restored in-progress draft from this browser session.
        </p>
      )}

      <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Schedule window</CardTitle>
            <CardDescription>
              {isListMode
                ? listItems.length > 0
                  ? `${listItems.length} post${listItems.length === 1 ? "" : "s"} (one per list item) · ~${effectivePlanDays} day${effectivePlanDays === 1 ? "" : "s"} at ${postsPerDay}/day`
                  : "Add list items below — one post per line"
                : `${postsPerDay} posts/day × ${planDays} days = ${postsPerDay * planDays} total slots`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Generation timing</Label>
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
                <TabsList>
                  <TabsTrigger value="immediate">Generate now</TabsTrigger>
                  <TabsTrigger value="deferred">
                    Generate 1 hour before publish
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {isDeferredMode
                  ? "Use this for time-sensitive news or market analysis so AI and web research run near publish time on the server."
                  : "Use this when you want to generate copy and media immediately, then schedule finished posts yourself."}
              </p>
              {isDeferredMode && !status?.scheduled_campaigns_configured ? (
                <p className="text-xs text-destructive">
                  Server-managed scheduled campaigns need `LATE_API_KEY` plus AI credentials configured on the server.
                </p>
              ) : null}
            </div>
            <Tabs
              value={campaignMode}
              onValueChange={(v) =>
                setCampaignMode(v === "list" ? "list" : "arc")
              }
            >
              <TabsList>
                <TabsTrigger value="arc">Content arc</TabsTrigger>
                <TabsTrigger value="list">One post per list item</TabsTrigger>
              </TabsList>
              <TabsContent value="arc" className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  AI plans a multi-post series that builds toward your campaign
                  goal.
                </p>
              </TabsContent>
              <TabsContent value="list" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>List items (one per line)</Label>
                  <Textarea
                    value={listItemsBlock}
                    onChange={(e) => setListItemsBlock(e.target.value)}
                    rows={6}
                    placeholder={`Bitcoin\nEthereum\nSolana\nCardano`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Each line becomes one post. Use the campaign goal below to
                    describe what to write about every item (e.g. detailed
                    market analysis).
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Posts per day</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={postsPerDay}
                  onChange={(e) =>
                    setPostsPerDay(Number(e.target.value) || 1)
                  }
                />
              </div>
              {!isListMode ? (
                <div className="space-y-2">
                  <Label>Days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={planDays}
                    onChange={(e) => setPlanDays(Number(e.target.value) || 1)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Days (auto)</Label>
                  <Input
                    type="text"
                    readOnly
                    value={
                      listItems.length > 0
                        ? String(effectivePlanDays)
                        : "—"
                    }
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculated from list length ÷ posts per day.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  min={minStartDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Posting window</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="time"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Times vary by day (different minutes and offsets) so the
                  schedule looks natural, not like a fixed bot interval.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Campaign goal</Label>
              <Textarea
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                rows={3}
                placeholder={
                  isListMode
                    ? "e.g. Detailed market analysis with price action, catalysts, and outlook"
                    : "e.g. Launch our new course and get 50 sign-ups in 2 weeks"
                }
              />
              <p className="text-xs text-muted-foreground">
                {isListMode
                  ? "This goal applies to every list item — each post focuses on one item only."
                  : "AI generates each post one at a time, building toward this goal."}
              </p>
            </div>
            <PostPromptStyleSelect
              campaignGoal={campaignGoal}
              isListMode={isListMode}
            />
            <div className="space-y-2">
              <Label>Supporting theme (optional)</Label>
              <Input
                value={campaignHint}
                onChange={(e) => setCampaignHint(e.target.value)}
                placeholder="e.g. Product launch week"
              />
            </div>
            <div className="space-y-2">
              <Label>Trend hooks (one per line)</Label>
              <Textarea
                value={trendBlock}
                onChange={(e) => setTrendBlock(e.target.value)}
                rows={3}
              />
            </div>
            <Button
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
                    ? `Plan ${plannedSlotCount || ""} deferred slot${plannedSlotCount === 1 ? "" : "s"} from list`
                    : `Generate ${plannedSlotCount || ""} post${plannedSlotCount === 1 ? "" : "s"} from list`
                  : isDeferredMode
                    ? "Plan deferred campaign slots"
                    : "Generate campaign incrementally"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Niche & language:{" "}
              <Link href="/dashboard/niche" className="underline">
                Content Niche
              </Link>
            </p>
          </CardContent>
        </Card>

      {slots.length > 0 && (
        <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">Accounts</CardTitle>
              <CardDescription>
                All posts publish to these accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformSelector
                selectedAccountIds={selectedAccountIds}
                onSelectionChange={setSelectedAccountIds}
                hasVideo={
                  mediaMode === "video" ||
                  slots.some((s) => s.video_url)
                }
                hasImages={
                  mediaMode === "image" ||
                  slots.some((s) => s.image_url)
                }
              />
            </CardContent>
          </Card>
      )}

      {slots.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Planned slots ({slots.length})
              </CardTitle>
              <CardDescription>
                {isDeferredMode
                  ? "Each slot stays pending until cron generates its final content near publish time."
                  : "Each slot must be after now. Edit date and time, then schedule when ready."} Goal: {campaignGoal.trim() || "—"}
                {isListMode && listItems.length > 0
                  ? ` · ${listItems.length} list item${listItems.length === 1 ? "" : "s"}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
                <div className="min-w-[200px] flex-1 space-y-4">
                  <CampaignMediaModeSelect
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
                    <>
                      <ImagePromptStyleSelect
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
                            onClick={() => generateAllSlotImages(false)}
                            disabled={
                              generatingImagesProgress !== null ||
                              regeneratingImageIndices.length > 0 ||
                              !status?.openai_configured
                            }
                          >
                            {generatingImagesProgress ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ImageIcon className="mr-2 h-4 w-4" />
                            )}
                            {generatingImagesProgress
                              ? `Generating ${generatingImagesProgress.current} / ${generatingImagesProgress.total}…`
                              : "Generate images for all slots"}
                          </Button>
                          {slots.some((s) => s.image_url) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => generateAllSlotImages(true)}
                              disabled={
                                generatingImagesProgress !== null ||
                                regeneratingImageIndices.length > 0 ||
                                !status?.openai_configured
                              }
                            >
                              Regenerate all images
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                  {mediaMode === "video" && (
                    <>
                      <VideoProviderSelect />
                      <VideoPromptStyleSelect />
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground w-full">
                  {isDeferredMode
                    ? mediaMode === "image"
                      ? "Images will be generated and uploaded by cron near publish time. Browser-only watermark stamping is skipped in deferred mode."
                      : mediaMode === "video"
                        ? "Videos will be generated by cron near publish time. If media generation fails, the slot falls back to text-only posting."
                        : "Deferred mode keeps content fresh by generating text near publish time."
                    : mediaMode === "image"
                    ? "Generate images first, then use Apply signature to stamp existing images before scheduling."
                    : mediaMode === "video"
                      ? "On schedule, videos are generated for slots that do not already have media."
                      : "Choose Image as media type to generate images with your signature."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={commitCampaign}
            disabled={
              committing ||
              createPostMutation.isPending ||
              saveScheduledCampaignMutation.isPending
            }
          >
            {committing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isDeferredMode
              ? activeScheduledId
                ? "Update scheduled campaign"
                : "Save scheduled campaign for cron"
              : `Schedule ${slots.length} post${slots.length === 1 ? "" : "s"} to Zernio`}
          </Button>
        </>
      )}
    </PageContainer>
  );
}
