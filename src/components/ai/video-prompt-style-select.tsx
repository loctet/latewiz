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
  className?: string;
}

export function VideoPromptStyleSelect({
  value: controlledValue,
  onValueChange,
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
      <div className="space-y-2">
        <Label>Video style</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="w-full">
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
        <p className="text-xs text-muted-foreground">{style.description}</p>
      </div>
    </div>
  );
}
