"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VIDEO_STYLES, type VideoStyle } from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

interface ExplainerStyleSelectProps {
  /** undefined = use the brand kit default */
  value: VideoStyle | undefined;
  onValueChange: (style: VideoStyle | undefined) => void;
  compact?: boolean;
  className?: string;
}

/** Explainer look for one video: whiteboard or motion graphics ("Brand default" defers to the brand kit). */
export function ExplainerStyleSelect({ value, onValueChange, compact = false, className }: ExplainerStyleSelectProps) {
  return (
    <div className={cn(compact ? "flex items-center justify-between gap-3" : "space-y-2", className)}>
      <Label className={compact ? "text-xs shrink-0" : undefined}>Explainer style</Label>
      <Select
        value={value ?? "brand"}
        onValueChange={(v) => onValueChange(v === "brand" ? undefined : (v as VideoStyle))}
      >
        <SelectTrigger className={compact ? "h-8 w-[200px] text-xs" : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="brand">Brand default</SelectItem>
          {VIDEO_STYLES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
