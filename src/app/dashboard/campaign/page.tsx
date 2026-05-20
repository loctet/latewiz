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
  useGenerateImage,
  useOpenAiStatus,
  useUploadMedia,
  urlToFile,
} from "@/hooks";
import { buildCampaignSlotTimes } from "@/lib/openai";
import { useAppStore } from "@/stores";
import { PageContainer } from "@/components/dashboard";
import {
  loadCampaignDraft,
  saveCampaignDraft,
  clearCampaignDraft,
  type CampaignDraft,
  type CampaignSlotDraft,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PlatformSelector } from "../compose/_components/platform-selector";
import { ImagePromptStyleSelect } from "@/components/ai";
import { CampaignSlotCard } from "./_components/campaign-slot-card";
import {
  CalendarClock,
  Loader2,
  Sparkles,
  Send,
  Save,
} from "lucide-react";
import Link from "next/link";
import type { Platform } from "@/lib/late-api";

export default function CampaignPlannerPage() {
  const router = useRouter();
  const { timezone } = useAppStore();
  const profileId = useCurrentProfileId();
  const profileKey = profileId ?? null;
  const { data: accountsData } = useAccounts();
  const { data: status } = useOpenAiStatus();
  const slotMutation = useGenerateCampaignSlot();
  const draftMutation = useGenerateDraft();
  const createPostMutation = useCreatePost();
  const imageMutation = useGenerateImage();
  const uploadMutation = useUploadMedia();

  const [postsPerDay, setPostsPerDay] = useState(3);
  const [planDays, setPlanDays] = useState(7);
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [campaignHint, setCampaignHint] = useState("");
  const [trendBlock, setTrendBlock] = useState("");
  const [slots, setSlots] = useState<CampaignSlotDraft[]>([]);
  const [generatingProgress, setGeneratingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [generateImages, setGenerateImages] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [regeneratingCopyIndex, setRegeneratingCopyIndex] = useState<
    number | null
  >(null);
  const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<
    number | null
  >(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minStartDate = minScheduleDateInput();

  const accounts = (accountsData?.accounts || []) as {
    _id: string;
    platform: string;
  }[];
  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a._id)
  );

  const applyDraft = useCallback((draft: CampaignDraft, savedId?: string | null) => {
    setPostsPerDay(draft.postsPerDay);
    setPlanDays(draft.planDays);
    setStartDate(draft.startDate);
    setWindowStart(draft.windowStart);
    setWindowEnd(draft.windowEnd);
    setCampaignGoal(draft.campaignGoal ?? "");
    setCampaignHint(draft.campaignHint);
    setTrendBlock(draft.trendBlock);
    setSelectedAccountIds(draft.selectedAccountIds);
    setGenerateImages(draft.generateImages);
    setSlots(draft.slots);
    setDraftRestored(true);
    if (savedId !== undefined) setActiveSavedId(savedId);
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
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      campaignGoal,
      campaignHint,
      trendBlock,
      selectedAccountIds,
      generateImages,
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
      trendBlock,
      selectedAccountIds,
      generateImages,
      slots,
    ]
  );

  const handleSaveForLater = () => {
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
      campaignGoal: saved.campaignGoal ?? "",
      campaignHint: saved.campaignHint,
      trendBlock: saved.trendBlock,
      selectedAccountIds: saved.selectedAccountIds,
      generateImages: saved.generateImages,
      slots: saved.slots,
    });
    toast.success(`Opened "${saved.name}"`);
  };

  const handleDeleteSaved = (id: string) => {
    if (!deleteSavedCampaign(id, profileKey)) return;
    if (activeSavedId === id) setActiveSavedId(null);
    refreshSavedList();
    toast.success("Saved campaign removed");
  };

  const handleNewCampaign = () => {
    clearCampaignDraft();
    setActiveSavedId(null);
    setSaveName("");
    setSlots([]);
    setCampaignGoal("");
    setCampaignHint("");
    setTrendBlock("");
    setDraftRestored(false);
    setStartDate(minScheduleDateInput());
    toast.message("New campaign started");
  };

  const persistDraft = useCallback(() => {
    const ok = saveCampaignDraft({
      postsPerDay,
      planDays,
      startDate,
      windowStart,
      windowEnd,
      campaignGoal,
      campaignHint,
      trendBlock,
      selectedAccountIds,
      generateImages,
      slots,
    });
    if (!ok) {
      toast.error("Could not save campaign draft (storage full). Images are not saved in draft.");
    }
  }, [
    postsPerDay,
    planDays,
    startDate,
    windowStart,
    windowEnd,
    campaignGoal,
    campaignHint,
    trendBlock,
    selectedAccountIds,
    generateImages,
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

    const requestedTotal = postsPerDay * planDays;
    const slotTimes = buildCampaignSlotTimes(
      startDate,
      planDays,
      postsPerDay,
      windowStart,
      windowEnd,
      timezone
    );

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
    }));
    setSlots(emptySlots);
    setDraftRestored(true);
    setGeneratingProgress({ current: 0, total });

    const previous: { title: string; body: string; hashtags: string }[] = [];
    let hadStub = false;

    try {
      for (let i = 0; i < total; i++) {
        setGeneratingProgress({ current: i + 1, total });
        const r = await slotMutation.mutateAsync({
          campaignGoal: goal,
          slotIndex: i,
          totalPosts: total,
          scheduledAt: slotTimes[i],
          previousPosts: previous,
          campaignHint: campaignHint.trim() || undefined,
          trendSnippets,
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
                }
              : s
          )
        );
      }

      if (hadStub) {
        toast.message("Using placeholder copy — add OpenAI key for full AI.");
      }
      toast.success(`Generated ${total} posts toward your campaign goal`);
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

  const regenerateSlotImage = async (index: number) => {
    const slot = slots[index];
    if (!status?.openai_configured) {
      toast.error("Add OpenAI key in Settings first.");
      return;
    }
    setRegeneratingImageIndex(index);
    try {
      const instruction = slot.aiInstruction?.trim();
      const r = await imageMutation.mutateAsync({
        captionContext: [slot.title, slot.body, slot.hashtags, instruction]
          .filter(Boolean)
          .join("\n\n"),
        prompt: instruction || undefined,
        promptStyleId: slot.imagePromptStyleId,
      });
      if (r.image_url) {
        updateSlot(index, { image_url: r.image_url });
        toast.success("Image regenerated");
      } else {
        toast.error(r.detail ?? "No image returned");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setRegeneratingImageIndex(null);
    }
  };

  const commitCampaign = async () => {
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
        let mediaItems: { type: "image"; url: string }[] | undefined;
        if (slot.image_url) {
          const file = await urlToFile(slot.image_url, `campaign-${i}.png`);
          const uploaded = await uploadMutation.mutateAsync(file);
          mediaItems = [{ type: "image", url: uploaded.url }];
        } else if (generateImages && status?.openai_configured) {
          const r = await imageMutation.mutateAsync({
            captionContext: slot.content || slot.body,
            promptStyleId: slot.imagePromptStyleId,
          });
          if (r.image_url) {
            const file = await urlToFile(r.image_url, `campaign-${i}.png`);
            const uploaded = await uploadMutation.mutateAsync(file);
            mediaItems = [{ type: "image", url: uploaded.url }];
          }
        }

        await createPostMutation.mutateAsync({
          content:
            slot.content ||
            [slot.body, slot.hashtags].filter(Boolean).join("\n\n"),
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
            Plan posts locally, save campaigns to finish later, then schedule via{" "}
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
          Save for later
        </Button>
      </div>

      <SavedCampaignsPanel
        saved={savedCampaigns}
        activeSavedId={activeSavedId}
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onSave={handleSaveForLater}
        onLoad={handleLoadSaved}
        onDelete={handleDeleteSaved}
        onNew={handleNewCampaign}
      />

      {draftRestored && slots.length > 0 && !activeSavedId && (
        <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
          Restored in-progress draft from this browser session.
        </p>
      )}

      <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Schedule window</CardTitle>
            <CardDescription>
              {postsPerDay} posts/day × {planDays} days ={" "}
              {postsPerDay * planDays} total slots
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              </div>
            </div>
            <div className="space-y-2">
              <Label>Campaign goal</Label>
              <Textarea
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                rows={3}
                placeholder="e.g. Launch our new course and get 50 sign-ups in 2 weeks"
              />
              <p className="text-xs text-muted-foreground">
                AI generates each post one at a time, building toward this goal.
              </p>
            </div>
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
              disabled={generatingProgress !== null || slotMutation.isPending}
            >
              {generatingProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {generatingProgress
                ? `Generating ${generatingProgress.current} / ${generatingProgress.total}…`
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
                hasVideo={false}
                hasImages={
                  generateImages || slots.some((s) => s.image_url)
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
                Each slot must be after now. Edit date and time, then schedule
                when ready. Goal: {campaignGoal.trim() || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
                <div className="min-w-[200px] flex-1">
                  <ImagePromptStyleSelect />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-images"
                    checked={generateImages}
                    onCheckedChange={(c) => setGenerateImages(c === true)}
                    disabled={!status?.openai_configured}
                  />
                  <Label htmlFor="bulk-images" className="text-sm font-normal">
                    Generate image on commit if missing
                  </Label>
                </div>
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
                    onRegenerateImage={() => regenerateSlotImage(i)}
                    copyLoading={regeneratingCopyIndex === i}
                    imageLoading={regeneratingImageIndex === i}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={commitCampaign}
            disabled={committing || createPostMutation.isPending}
          >
            {committing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Schedule {slots.length} posts to Zernio
          </Button>
        </>
      )}
    </PageContainer>
  );
}
