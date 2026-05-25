"use client";

import { useAiStore } from "@/stores";
import type { AiMediaKind } from "@/lib/campaign-media";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AiMediaKind; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

interface AiMediaModeSelectProps {
  value?: AiMediaKind;
  onValueChange?: (kind: AiMediaKind) => void;
  className?: string;
}

export function AiMediaModeSelect({
  value: controlledValue,
  onValueChange,
  className,
}: AiMediaModeSelectProps) {
  const stored = useAiStore((s) => s.aiMediaKind);
  const setStored = useAiStore((s) => s.setAiMediaKind);
  const value = controlledValue ?? stored;

  const handleChange = (kind: AiMediaKind) => {
    if (onValueChange) onValueChange(kind);
    else setStored(kind);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>AI media type</Label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleChange(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
