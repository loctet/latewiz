"use client";

import { useAiStore } from "@/stores";
import {
  VIDEO_PROMPT_STYLES,
  getVideoPromptStyle,
} from "@/lib/video-prompt-catalog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoPromptStyleSelectProps {
  value?: string;
  onValueChange?: (id: string) => void;
  /** Hide description under the select */
  compact?: boolean;
  className?: string;
}

export function VideoPromptStyleSelect({
  value: controlledValue,
  onValueChange,
  compact = false,
  className,
}: VideoPromptStyleSelectProps) {
  const storedId = useAiStore((s) => s.videoPromptStyleId);
  const setStoredId = useAiStore((s) => s.setVideoPromptStyleId);

  const value = controlledValue ?? storedId;
  const style = getVideoPromptStyle(value);

  const handleChange = (id: string) => {
    if (onValueChange) onValueChange(id);
    else setStoredId(id);
  };

  return (
    <div className={className}>
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <Label className={compact ? "text-xs" : undefined}>Video style</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="w-full" size={compact ? "sm" : undefined}>
            <SelectValue placeholder="Select video style" />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_PROMPT_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
                {s.durationSeconds ? ` (${s.durationSeconds}s)` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!compact && (
          <p className="text-xs text-muted-foreground">{style.description}</p>
        )}
      </div>
    </div>
  );
}
