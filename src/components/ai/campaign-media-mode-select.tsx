"use client";

import type { CampaignMediaMode } from "@/lib/campaign-media";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CampaignMediaMode; label: string }[] = [
  { value: "none", label: "Text only" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
];

interface CampaignMediaModeSelectProps {
  value: CampaignMediaMode;
  onValueChange: (mode: CampaignMediaMode) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function CampaignMediaModeSelect({
  value,
  onValueChange,
  disabled,
  compact = false,
  className,
}: CampaignMediaModeSelectProps) {
  return (
    <div
      className={cn(
        compact
          ? "flex flex-wrap items-center justify-between gap-2"
          : "space-y-2",
        className
      )}
    >
      <Label className={compact ? "text-xs shrink-0" : undefined}>
        Campaign media
      </Label>
      <div className={cn("flex", compact ? "gap-1" : "flex-wrap gap-2")}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "cursor-pointer rounded-md border font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {value === "none"
            ? "Posts will be text-only unless you add media per slot."
            : value === "image"
              ? "Generate or attach images when scheduling."
              : "Generate short videos when scheduling (OpenAI Sora or Pika on fal.ai)."}
        </p>
      )}
    </div>
  );
}
