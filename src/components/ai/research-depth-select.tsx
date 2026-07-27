"use client";

import { useAiStore } from "@/stores";
import {
  RESEARCH_DEPTHS,
  type ResearchDepthId,
} from "@/lib/research-depth";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ResearchDepthSelectProps {
  value?: ResearchDepthId;
  onValueChange?: (id: ResearchDepthId) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function ResearchDepthSelect({
  value: controlledValue,
  onValueChange,
  disabled,
  compact = false,
  className,
}: ResearchDepthSelectProps) {
  const storedId = useAiStore((s) => s.researchDepthId);
  const setStoredId = useAiStore((s) => s.setResearchDepthId);

  const value = controlledValue ?? storedId;
  const active = RESEARCH_DEPTHS.find((d) => d.id === value) ?? RESEARCH_DEPTHS[0];

  const handleChange = (id: ResearchDepthId) => {
    if (onValueChange) {
      onValueChange(id);
    } else {
      setStoredId(id);
    }
  };

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
        Research depth
      </Label>
      <div className={cn("flex", compact ? "gap-1" : "flex-wrap gap-2")}>
        {RESEARCH_DEPTHS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => handleChange(opt.id)}
            className={cn(
              "cursor-pointer rounded-md border font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              value === opt.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">{active.description}</p>
      )}
      {compact && value === "deep" && (
        <p className="basis-full text-[11px] text-muted-foreground">
          Uses OpenAI Deep Research — may take several minutes per post.
        </p>
      )}
    </div>
  );
}
