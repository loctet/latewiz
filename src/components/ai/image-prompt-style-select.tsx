"use client";

import { useAiStore } from "@/stores";
import {
  IMAGE_PROMPT_STYLES,
  getImagePromptStyle,
} from "@/lib/image-prompt-catalog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImagePromptStyleSelectProps {
  /** Override store value (controlled) */
  value?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

export function ImagePromptStyleSelect({
  value: controlledValue,
  onValueChange,
  className,
}: ImagePromptStyleSelectProps) {
  const storedId = useAiStore((s) => s.imagePromptStyleId);
  const setStoredId = useAiStore((s) => s.setImagePromptStyleId);
  const customStyles = useAiStore((s) => s.customImagePromptStyles);

  const value = controlledValue ?? storedId;
  const style = getImagePromptStyle(value, customStyles);

  const handleChange = (id: string) => {
    if (onValueChange) {
      onValueChange(id);
    } else {
      setStoredId(id);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label>Image style</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select image style" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Built-in styles</SelectLabel>
              {IMAGE_PROMPT_STYLES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                  {s.id === "notebook-educational" ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
            {customStyles.length > 0 && (
              <SelectGroup>
                <SelectLabel>Your templates</SelectLabel>
                {customStyles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{style.description}</p>
      </div>
    </div>
  );
}
