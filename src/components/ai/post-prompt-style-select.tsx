"use client";

import { useAiStore } from "@/stores";
import {
  AUTO_POST_PROMPT_STYLE_ID,
  POST_PROMPT_STYLES,
  resolvePostPromptStyle,
} from "@/lib/post-prompt-catalog";
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

interface PostPromptStyleSelectProps {
  value?: string;
  onValueChange?: (id: string) => void;
  campaignGoal?: string;
  isListMode?: boolean;
  className?: string;
}

export function PostPromptStyleSelect({
  value: controlledValue,
  onValueChange,
  campaignGoal = "",
  isListMode = false,
  className,
}: PostPromptStyleSelectProps) {
  const storedId = useAiStore((s) => s.postPromptStyleId);
  const setStoredId = useAiStore((s) => s.setPostPromptStyleId);

  const value = controlledValue ?? storedId;

  const resolved =
    value === AUTO_POST_PROMPT_STYLE_ID
      ? resolvePostPromptStyle({
          styleId: AUTO_POST_PROMPT_STYLE_ID,
          campaignGoal,
          isListMode,
        })
      : null;

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
        <Label>Post template</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select post template" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Matching</SelectLabel>
              <SelectItem value={AUTO_POST_PROMPT_STYLE_ID}>
                Auto (from campaign goal)
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Templates</SelectLabel>
              {POST_PROMPT_STYLES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {value === AUTO_POST_PROMPT_STYLE_ID && resolved
            ? `Auto-selected: ${resolved.label} — ${resolved.description}`
            : POST_PROMPT_STYLES.find((s) => s.id === value)?.description ??
              "Choose how AI structures and lengths each post."}
        </p>
      </div>
    </div>
  );
}
