"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import {
  IMAGE_PROMPT_STYLES,
  IMAGE_PROMPT_TEMPLATE_HELP,
  getDefaultTemplate,
  getEffectiveTemplate,
} from "@/lib/image-prompt-catalog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";

export function ImagePromptTemplatesEditor() {
  const savedTemplates = useAiStore((s) => s.imagePromptTemplates);
  const setImagePromptTemplate = useAiStore((s) => s.setImagePromptTemplate);
  const resetImagePromptTemplate = useAiStore((s) => s.resetImagePromptTemplate);
  const resetAllImagePromptTemplates = useAiStore(
    (s) => s.resetAllImagePromptTemplates
  );

  const [selectedId, setSelectedId] = useState(IMAGE_PROMPT_STYLES[0].id);
  const [draft, setDraft] = useState(() =>
    getEffectiveTemplate(IMAGE_PROMPT_STYLES[0].id, {})
  );

  const savedForStyle = savedTemplates[selectedId];
  const defaultTemplate = getDefaultTemplate(selectedId);

  useEffect(() => {
    setDraft(getEffectiveTemplate(selectedId, savedTemplates));
  }, [selectedId, savedTemplates]);

  const isDirty = useMemo(
    () => draft.trim() !== (savedForStyle ?? "").trim(),
    [draft, savedForStyle]
  );

  const isCustomized = Boolean(savedForStyle?.trim());
  const differsFromDefault = draft.trim() !== defaultTemplate.trim();

  const handleSave = () => {
    if (!draft.trim()) {
      toast.error("Template cannot be empty");
      return;
    }
    if (
      !draft.includes("{{subject}}") &&
      !draft.includes("{{langNote}}")
    ) {
      toast.message(
        "Tip: include {{subject}} and {{langNote}} so niche and caption are injected."
      );
    }
    if (draft.trim() === defaultTemplate.trim()) {
      resetImagePromptTemplate(selectedId);
      toast.success("Using built-in default for this style");
      return;
    }
    setImagePromptTemplate(selectedId, draft);
    toast.success("Prompt template saved");
  };

  const handleResetStyle = () => {
    resetImagePromptTemplate(selectedId);
    setDraft(defaultTemplate);
    toast.success("Restored default template for this style");
  };

  const handleResetAll = () => {
    resetAllImagePromptTemplates();
    setDraft(defaultTemplate);
    toast.success("All prompt templates restored to defaults");
  };

  const selectedStyle = IMAGE_PROMPT_STYLES.find((s) => s.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Style to edit</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_PROMPT_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
                {s.id === "notebook-educational" ? " (default)" : ""}
                {savedTemplates[s.id] ? " · customized" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedStyle && (
          <p className="text-xs text-muted-foreground">
            {selectedStyle.description}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground rounded-md bg-muted p-3">
        {IMAGE_PROMPT_TEMPLATE_HELP}
      </p>

      <div className="space-y-2">
        <Label>Prompt template</Label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          className="font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          {draft.length} characters
          {isCustomized ? " · customized" : " · using built-in default"}
          {differsFromDefault && !isCustomized ? " · unsaved edits" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={!isDirty}>
          <Save className="mr-2 h-4 w-4" />
          Save template
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleResetStyle}
          disabled={!isCustomized && !differsFromDefault}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset this style
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleResetAll}
          disabled={Object.keys(savedTemplates).length === 0}
        >
          Reset all styles
        </Button>
      </div>
    </div>
  );
}
