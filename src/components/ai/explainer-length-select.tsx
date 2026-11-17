"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPLAINER_DURATIONS } from "@/lib/explainer-script";
import { cn } from "@/lib/utils";

interface ExplainerLengthSelectProps {
  /** undefined = use the brand kit default */
  value: number | undefined;
  onValueChange: (seconds: number | undefined) => void;
  compact?: boolean;
  className?: string;
}

/** Explainer video length picker; "Brand default" defers to the brand kit. */
export function ExplainerLengthSelect({
  value,
  onValueChange,
  compact = false,
  className,
}: ExplainerLengthSelectProps) {
  return (
    <div
      className={cn(
        compact ? "flex items-center justify-between gap-3" : "space-y-2",
        className
      )}
    >
      <Label className={compact ? "text-xs shrink-0" : undefined}>
        Explainer length
      </Label>
      <Select
        value={value ? String(value) : "brand"}
        onValueChange={(v) => onValueChange(v === "brand" ? undefined : Number(v))}
      >
        <SelectTrigger className={compact ? "h-8 w-[200px] text-xs" : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="brand">Brand default</SelectItem>
          {EXPLAINER_DURATIONS.map((d) => (
            <SelectItem key={d.value} value={String(d.value)}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
