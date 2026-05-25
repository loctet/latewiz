"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ImagePromptStyleSelect,
  VideoPromptStyleSelect,
} from "@/components/ai";
import type { CampaignMediaMode } from "@/lib/campaign-media";
import {
  isoToLocalDateInput,
  isoToLocalTimeInput,
  localDateTimeToIso,
} from "@/lib/campaign-slot-datetime";
import {
  isScheduleInFuture,
  minScheduleDateInput,
  minScheduleTimeInput,
} from "@/lib/campaign-schedule-validation";
import type { CampaignSlotDraft } from "@/lib/campaign-draft-storage";
import {
  Loader2,
  Trash2,
  Wand2,
  ImageIcon,
  Film,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface CampaignSlotCardProps {
  slot: CampaignSlotDraft;
  index: number;
  mediaMode: CampaignMediaMode;
  onUpdate: (patch: Partial<CampaignSlotDraft>) => void;
  onRemove: () => void;
  onRegenerateCopy: () => void;
  onRegenerateImage: () => void;
  onRegenerateVideo: () => void;
  copyLoading: boolean;
  imageLoading: boolean;
  videoLoading: boolean;
}

export function CampaignSlotCard({
  slot,
  index,
  mediaMode,
  onUpdate,
  onRemove,
  onRegenerateCopy,
  onRegenerateImage,
  onRegenerateVideo,
  copyLoading,
  imageLoading,
  videoLoading,
}: CampaignSlotCardProps) {
  const syncContent = (body: string, hashtags: string) =>
    [body, hashtags].filter(Boolean).join("\n\n");

  const scheduleDate = isoToLocalDateInput(slot.scheduled_at);
  const scheduleTime = isoToLocalTimeInput(slot.scheduled_at);
  const minDate = minScheduleDateInput();
  const minTime = minScheduleTimeInput(scheduleDate);
  const scheduleInPast = !isScheduleInFuture(slot.scheduled_at);

  const updateSchedule = (date: string, time: string) => {
    const iso = localDateTimeToIso(date, time);
    if (!isScheduleInFuture(iso)) {
      toast.error("Pick a date and time after now");
      return;
    }
    onUpdate({ scheduled_at: iso });
  };

  const showImageMedia = mediaMode === "image" || Boolean(slot.image_url);
  const showVideoMedia = mediaMode === "video" || Boolean(slot.video_url);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex justify-between items-start gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Slot {index + 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Remove slot"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Date
          </Label>
          <Input
            type="date"
            min={minDate}
            value={scheduleDate}
            onChange={(e) => updateSchedule(e.target.value, scheduleTime)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Time</Label>
          <Input
            type="time"
            min={minTime}
            value={scheduleTime}
            onChange={(e) => updateSchedule(scheduleDate, e.target.value)}
          />
        </div>
      </div>
      {scheduleInPast && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Must be scheduled after the current date and time
        </p>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Title</Label>
        <Input
          value={slot.title}
          onChange={(e) => {
            const title = e.target.value;
            onUpdate({
              title,
              content: syncContent(slot.body, slot.hashtags),
            });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Body</Label>
        <Textarea
          value={slot.body}
          onChange={(e) => {
            const body = e.target.value;
            onUpdate({
              body,
              content: syncContent(body, slot.hashtags),
            });
          }}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Hashtags</Label>
        <Input
          value={slot.hashtags}
          onChange={(e) => {
            const hashtags = e.target.value;
            onUpdate({
              hashtags,
              content: syncContent(slot.body, hashtags),
            });
          }}
          placeholder="#example #tags"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">AI instructions (for regenerate)</Label>
        <Textarea
          value={slot.aiInstruction ?? ""}
          onChange={(e) => onUpdate({ aiInstruction: e.target.value })}
          rows={2}
          placeholder="e.g. Make it shorter, add a question, focus on beginners..."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRegenerateCopy}
          disabled={copyLoading}
        >
          {copyLoading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-3 w-3" />
          )}
          Regenerate copy
        </Button>
      </div>

      {showImageMedia && (
        <div className="rounded-md border border-dashed p-3 space-y-3">
          <ImagePromptStyleSelect
            value={slot.imagePromptStyleId}
            onValueChange={(id) => onUpdate({ imagePromptStyleId: id })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerateImage}
              disabled={imageLoading}
            >
              {imageLoading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-3 w-3" />
              )}
              {slot.image_url ? "Regenerate image" : "Generate image"}
            </Button>
            {slot.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={slot.image_url}
                alt=""
                className="h-16 w-16 rounded object-cover"
              />
            )}
          </div>
        </div>
      )}

      {showVideoMedia && (
        <div className="rounded-md border border-dashed p-3 space-y-3">
          <VideoPromptStyleSelect
            value={slot.videoPromptStyleId}
            onValueChange={(id) => onUpdate({ videoPromptStyleId: id })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerateVideo}
              disabled={videoLoading}
            >
              {videoLoading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Film className="mr-2 h-3 w-3" />
              )}
              {slot.video_url ? "Regenerate video" : "Generate video"}
            </Button>
            {slot.video_url && (
              <video
                src={slot.video_url}
                className="h-16 w-16 rounded object-cover"
                muted
                playsInline
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
