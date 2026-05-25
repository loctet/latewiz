"use client";

import { useAiStore } from "@/stores";
import {
  VIDEO_PROVIDERS,
  type VideoProvider,
} from "@/lib/video-providers";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoProviderSelectProps {
  value?: VideoProvider;
  onValueChange?: (id: VideoProvider) => void;
  className?: string;
}

export function VideoProviderSelect({
  value: controlledValue,
  onValueChange,
  className,
}: VideoProviderSelectProps) {
  const stored = useAiStore((s) => s.videoProvider);
  const setStored = useAiStore((s) => s.setVideoProvider);

  const value = controlledValue ?? stored;
  const provider = VIDEO_PROVIDERS.find((p) => p.id === value) ?? VIDEO_PROVIDERS[0];

  const handleChange = (id: string) => {
    const next = id as VideoProvider;
    if (onValueChange) onValueChange(next);
    else setStored(next);
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label>Video generator</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{provider.description}</p>
      </div>
    </div>
  );
}
