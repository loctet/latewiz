"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  useAccounts,
  useCampaignPlan,
  useCreatePost,
  useCurrentProfileId,
  useGenerateImage,
  useOpenAiStatus,
  useUploadMedia,
  urlToFile,
  type CampaignSlot,
} from "@/hooks";
import { useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformSelector } from "../compose/_components/platform-selector";
import {
  CalendarClock,
  Loader2,
  Sparkles,
  Trash2,
  Send,
} from "lucide-react";
import Link from "next/link";
import type { Platform } from "@/lib/late-api";

export default function CampaignPlannerPage() {
  const router = useRouter();
  const { timezone } = useAppStore();
  const profileId = useCurrentProfileId();
  const { data: accountsData } = useAccounts();
  const { data: status } = useOpenAiStatus();
  const planMutation = useCampaignPlan();
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
  const [campaignHint, setCampaignHint] = useState("");
  const [trendBlock, setTrendBlock] = useState("");
  const [slots, setSlots] = useState<CampaignSlot[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [generateImages, setGenerateImages] = useState(false);
  const [committing, setCommitting] = useState(false);

  const accounts = (accountsData?.accounts || []) as { _id: string; platform: string }[];
  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a._id)
  );

  const handlePlan = async () => {
    try {
      const r = await planMutation.mutateAsync({
        postsPerDay,
        planDays,
        startDate,
        timezone,
        windowStart,
        windowEnd,
        campaignHint: campaignHint.trim() || undefined,
        trendSnippets: trendBlock
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setSlots(r.slots);
      if (r.source === "stub") {
        toast.message("Using placeholder copy — add OpenAI key for full AI.");
      }
      if (r.detail && r.source !== "openai") {
        toast.message(r.detail);
      } else {
        toast.success(`Planned ${r.slots.length} posts`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Planning failed");
    }
  };

  const updateSlot = (index: number, patch: Partial<CampaignSlot>) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const generateSlotImage = async (index: number) => {
    const slot = slots[index];
    if (!status?.openai_configured) {
      toast.error("Add OpenAI key in Settings first.");
      return;
    }
    try {
      const r = await imageMutation.mutateAsync({
        captionContext: slot.content || slot.body,
      });
      if (r.image_url) {
        updateSlot(index, { image_url: r.image_url });
        toast.success("Image generated for slot");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image failed");
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
          });
          if (r.image_url) {
            const file = await urlToFile(r.image_url, `campaign-${i}.png`);
            const uploaded = await uploadMutation.mutateAsync(file);
            mediaItems = [{ type: "image", url: uploaded.url }];
          }
        }

        await createPostMutation.mutateAsync({
          content: slot.content || [slot.body, slot.hashtags].filter(Boolean).join("\n\n"),
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
      toast.success(`Scheduled ${ok} post${ok === 1 ? "" : "s"} via Zernio`);
      router.push("/dashboard/calendar");
    }
    if (fail > 0) {
      toast.error(`${fail} post${fail === 1 ? "" : "s"} failed to schedule`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Campaign Planner
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-generate a batch of posts and schedule them through the{" "}
          <a
            href="https://docs.zernio.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Zernio API
          </a>
          . Configure your niche in{" "}
          <Link href="/dashboard/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule window</CardTitle>
          <CardDescription>
            {postsPerDay} posts/day × {planDays} days = {postsPerDay * planDays}{" "}
            total slots
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
                onChange={(e) => setPostsPerDay(Number(e.target.value) || 1)}
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
            <Label>Campaign theme (optional)</Label>
            <Input
              value={campaignHint}
              onChange={(e) => setCampaignHint(e.target.value)}
              placeholder="e.g. Product launch week, tips series"
            />
          </div>
          <div className="space-y-2">
            <Label>Trend hooks (one per line, optional)</Label>
            <Textarea
              value={trendBlock}
              onChange={(e) => setTrendBlock(e.target.value)}
              rows={3}
              placeholder="Hooks or headlines to inspire tone"
            />
          </div>
          <Button onClick={handlePlan} disabled={planMutation.isPending}>
            {planMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate campaign with AI
          </Button>
        </CardContent>
      </Card>

      {slots.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accounts</CardTitle>
              <CardDescription>
                All scheduled posts will publish to these accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformSelector
                selectedAccountIds={selectedAccountIds}
                onSelectionChange={setSelectedAccountIds}
                hasVideo={false}
                hasImages={generateImages || slots.some((s) => s.image_url)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Planned slots ({slots.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  id="bulk-images"
                  checked={generateImages}
                  onCheckedChange={(c) => setGenerateImages(c === true)}
                  disabled={!status?.openai_configured}
                />
                <Label htmlFor="bulk-images" className="text-sm font-normal">
                  Generate AI image for each post on commit
                </Label>
              </div>
              <ScrollArea className="h-[min(400px,50vh)] pr-4">
                <div className="space-y-4">
                  {slots.map((slot, i) => (
                    <div
                      key={i}
                      className="rounded-lg border p-3 space-y-2 text-sm"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-muted-foreground">
                          {format(
                            parseISO(slot.scheduled_at),
                            "MMM d, yyyy · h:mm a"
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeSlot(i)}
                          aria-label="Remove slot"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={slot.title}
                        onChange={(e) =>
                          updateSlot(i, {
                            title: e.target.value,
                            content: [
                              slot.body,
                              slot.hashtags,
                            ]
                              .filter(Boolean)
                              .join("\n\n"),
                          })
                        }
                        className="text-xs"
                      />
                      <Textarea
                        value={slot.body}
                        onChange={(e) => {
                          const body = e.target.value;
                          updateSlot(i, {
                            body,
                            content: [body, slot.hashtags]
                              .filter(Boolean)
                              .join("\n\n"),
                          });
                        }}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSlotImage(i)}
                          disabled={imageMutation.isPending}
                        >
                          {slot.image_url ? "Regenerate image" : "Add AI image"}
                        </Button>
                        {slot.image_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={slot.image_url}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full"
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
    </div>
  );
}
