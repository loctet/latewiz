"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AiImageReferencePicker,
  ImagePromptStyleSelect,
  VideoPromptStyleSelect,
  VideoProviderSelect,
} from "@/components/ai";
import type { CampaignMediaMode } from "@/lib/campaign-media";
import {
  isoToLocalDateInput,
  isoToLocalTimeInput,
  isoToDateInputInTimezone,
  isoToTimeInputInTimezone,
  localDateTimeToIso,
} from "@/lib/campaign-slot-datetime";
import {
  isScheduleInFuture,
  minScheduleDateInput,
  minScheduleTimeInput,
} from "@/lib/campaign-schedule-validation";
import type { CampaignSlotDraft } from "@/lib/campaign-draft-storage";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Trash2,
  Wand2,
  ImageIcon,
  Film,
  Calendar,
  AlertCircle,
  ChevronDown,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CampaignSlotCardProps {
  slot: CampaignSlotDraft;
  index: number;
  mediaMode: CampaignMediaMode;
  timezone?: string;
  deferredMode?: boolean;
  defaultExpanded?: boolean;
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
  timezone,
  deferredMode = false,
  defaultExpanded = false,
  onUpdate,
  onRemove,
  onRegenerateCopy,
  onRegenerateImage,
  onRegenerateVideo,
  copyLoading,
  imageLoading,
  videoLoading,
}: CampaignSlotCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const syncContent = (body: string, hashtags: string) =>
    [body, hashtags].filter(Boolean).join("\n\n");

  const scheduleDate = timezone
    ? isoToDateInputInTimezone(slot.scheduled_at, timezone)
    : isoToLocalDateInput(slot.scheduled_at);
  const scheduleTime = timezone
    ? isoToTimeInputInTimezone(slot.scheduled_at, timezone)
    : isoToLocalTimeInput(slot.scheduled_at);
  const minDate = minScheduleDateInput();
  const minTime = minScheduleTimeInput(scheduleDate);
  const scheduleInPast = !isScheduleInFuture(slot.scheduled_at);

  const updateSchedule = (date: string, time: string) => {
    const iso = localDateTimeToIso(date, time, timezone);
    if (!isScheduleInFuture(iso)) {
      toast.error("Pick a date and time after now");
      return;
    }
    onUpdate({ scheduled_at: iso });
  };

  const showImageMedia = mediaMode === "image" || Boolean(slot.image_url);
  const showVideoMedia = mediaMode === "video" || Boolean(slot.video_url);

  const preview =
    slot.body?.trim() ||
    slot.title?.trim() ||
    slot.aiInstruction?.trim() ||
    "(Empty slot)";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors duration-200",
        scheduleInPast && "border-destructive/40",
        expanded && "ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 cursor-pointer text-left"
          aria-expanded={expanded}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              #{index + 1}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {scheduleDate} · {scheduleTime}
            </span>
            {slot.generationStatus ? (
              <Badge
                variant={
                  slot.generationStatus === "failed"
                    ? "destructive"
                    : slot.generationStatus === "generated"
                      ? "secondary"
                      : "outline"
                }
                className="h-5 px-1.5 text-[10px]"
              >
                {slot.generationStatus.replaceAll("_", " ")}
              </Badge>
            ) : null}
            {slot.image_url ? (
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
            ) : null}
            {slot.video_url ? (
              <Film className="h-3 w-3 text-muted-foreground" />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {slot.title ? (
              <span className="font-medium text-foreground">{slot.title} — </span>
            ) : null}
            {preview}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse slot" : "Expand slot"}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={onRemove}
            aria-label="Remove slot"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                min={minDate}
                value={scheduleDate}
                onChange={(e) => updateSchedule(e.target.value, scheduleTime)}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                min={minTime}
                value={scheduleTime}
                onChange={(e) => updateSchedule(scheduleDate, e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {scheduleInPast && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Must be after now
            </p>
          )}
          {deferredMode && (
            <p className="text-xs text-muted-foreground">
              No content yet — cron generates near publish using your post prompt
              and research depth
              {slot.aiInstruction?.trim()
                ? `, with focus: ${slot.aiInstruction.trim().slice(0, 72)}${
                    slot.aiInstruction.trim().length > 72 ? "…" : ""
                  }`
                : ""}
              .
            </p>
          )}
          {slot.lastError ? (
            <p className="text-xs text-destructive">{slot.lastError}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`slot-title-${index}`}>
              Title
            </Label>
            <Input
              id={`slot-title-${index}`}
              value={slot.title}
              onChange={(e) => {
                const title = e.target.value;
                onUpdate({
                  title,
                  content: syncContent(slot.body, slot.hashtags),
                });
              }}
              className="h-8"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`slot-body-${index}`}>
              Body
            </Label>
            <Textarea
              id={`slot-body-${index}`}
              value={slot.body}
              onChange={(e) => {
                const body = e.target.value;
                onUpdate({
                  body,
                  content: syncContent(body, slot.hashtags),
                });
              }}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`slot-tags-${index}`}>
              Hashtags
            </Label>
            <Input
              id={`slot-tags-${index}`}
              value={slot.hashtags}
              onChange={(e) => {
                const hashtags = e.target.value;
                onUpdate({
                  hashtags,
                  content: syncContent(slot.body, hashtags),
                });
              }}
              placeholder="#example #tags"
              className="h-8"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`slot-ai-${index}`}>
              AI instructions
            </Label>
            <Textarea
              id={`slot-ai-${index}`}
              value={slot.aiInstruction ?? ""}
              onChange={(e) => onUpdate({ aiInstruction: e.target.value })}
              rows={2}
              placeholder="e.g. Make it shorter, add a question…"
              className="resize-none text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={onRegenerateCopy}
              disabled={copyLoading || deferredMode}
            >
              {copyLoading ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3 w-3" />
              )}
              Regenerate copy
            </Button>
            {slot.pdfUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer"
                asChild
              >
                <a href={slot.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-1.5 h-3 w-3" />
                  Full report (PDF)
                  <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                </a>
              </Button>
            ) : null}
          </div>

          {showImageMedia && (
            <div className="space-y-2 rounded-md border border-dashed p-2.5">
              <ImagePromptStyleSelect
                compact
                value={slot.imagePromptStyleId}
                onValueChange={(id) => onUpdate({ imagePromptStyleId: id })}
              />
              <AiImageReferencePicker
                compact
                value={slot.reference_image_url}
                onChange={(url) => onUpdate({ reference_image_url: url })}
                existingImageUrl={slot.image_url}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 cursor-pointer"
                  onClick={onRegenerateImage}
                  disabled={imageLoading || deferredMode}
                >
                  {imageLoading ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-1.5 h-3 w-3" />
                  )}
                  {slot.image_url ? "Regenerate image" : "Generate image"}
                </Button>
                {slot.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.image_url}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
              </div>
            </div>
          )}

          {showVideoMedia && (
            <div className="space-y-2 rounded-md border border-dashed p-2.5">
              <VideoProviderSelect compact />
              <VideoPromptStyleSelect
                compact
                value={slot.videoPromptStyleId}
                onValueChange={(id) => onUpdate({ videoPromptStyleId: id })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 cursor-pointer"
                  onClick={onRegenerateVideo}
                  disabled={videoLoading || deferredMode}
                >
                  {videoLoading ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Film className="mr-1.5 h-3 w-3" />
                  )}
                  {slot.video_url ? "Regenerate video" : "Generate video"}
                </Button>
                {slot.video_url && (
                  <video
                    src={slot.video_url}
                    className="h-12 w-12 rounded object-cover"
                    muted
                    playsInline
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
