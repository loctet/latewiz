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
  className?: string;
}

export function CampaignMediaModeSelect({
  value,
  onValueChange,
  disabled,
  className,
}: CampaignMediaModeSelectProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>Campaign media</Label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "none"
          ? "Posts will be text-only unless you add media per slot."
          : value === "image"
            ? "Generate or attach images when scheduling."
            : "Generate short videos when scheduling (OpenAI Sora or Pika on fal.ai)."}
      </p>
    </div>
  );
}
