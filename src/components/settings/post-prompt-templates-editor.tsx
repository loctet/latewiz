"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import {
  DEFAULT_POST_PROMPT_STYLE_ID,
  POST_PROMPT_STYLES,
  getEffectivePostStructureTemplate,
  getPostPromptStyle,
} from "@/lib/post-prompt-catalog";
import { persistContentPrefsToProfile } from "@/lib/persist-content-prefs";
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

export function PostPromptTemplatesEditor() {
  const savedTemplates = useAiStore((s) => s.postPromptTemplates);
  const setPostPromptTemplate = useAiStore((s) => s.setPostPromptTemplate);
  const resetPostPromptTemplate = useAiStore((s) => s.resetPostPromptTemplate);
  const resetAllPostPromptTemplates = useAiStore(
    (s) => s.resetAllPostPromptTemplates
  );

  const [selectedId, setSelectedId] = useState(DEFAULT_POST_PROMPT_STYLE_ID);
  const [draft, setDraft] = useState(() =>
    getEffectivePostStructureTemplate(DEFAULT_POST_PROMPT_STYLE_ID, {})
  );
  const [saving, setSaving] = useState(false);

  const savedForStyle = savedTemplates[selectedId];
  const defaultTemplate = getPostPromptStyle(selectedId).structureTemplate;
  const selectedStyle = getPostPromptStyle(selectedId);

  useEffect(() => {
    setDraft(getEffectivePostStructureTemplate(selectedId, savedTemplates));
  }, [selectedId, savedTemplates]);

  const isDirty = useMemo(
    () => draft.trim() !== (savedForStyle ?? defaultTemplate).trim(),
    [draft, savedForStyle, defaultTemplate]
  );

  const isCustomized = Boolean(savedForStyle?.trim());
  const differsFromDefault = draft.trim() !== defaultTemplate.trim();

  const syncProfile = async () => {
    try {
      await persistContentPrefsToProfile();
    } catch (err) {
      toast.message(
        err instanceof Error
          ? `Saved locally — ${err.message}`
          : "Saved locally; server sync failed"
      );
    }
  };

  const handleSave = async () => {
    if (!draft.trim()) {
      toast.error("Template cannot be empty");
      return;
    }
    if (
      !draft.includes("{{subject}}") &&
      !draft.includes("{{goal}}") &&
      selectedStyle.minBodyChars > 0
    ) {
      toast.message(
        "Tip: include {{subject}} or {{goal}} so campaign context is injected."
      );
    }

    setSaving(true);
    try {
      if (draft.trim() === defaultTemplate.trim()) {
        resetPostPromptTemplate(selectedId);
        toast.success("Using built-in default for this style");
      } else {
        setPostPromptTemplate(selectedId, draft);
        toast.success("Post prompt template saved");
      }
      await syncProfile();
    } finally {
      setSaving(false);
    }
  };

  const handleResetStyle = async () => {
    resetPostPromptTemplate(selectedId);
    setDraft(defaultTemplate);
    toast.success("Restored default template for this style");
    await syncProfile();
  };

  const handleResetAll = async () => {
    resetAllPostPromptTemplates();
    setDraft(defaultTemplate);
    toast.success("All post prompt templates restored to defaults");
    await syncProfile();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Style to edit</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POST_PROMPT_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
                {s.id === DEFAULT_POST_PROMPT_STYLE_ID ? " (default)" : ""}
                {savedTemplates[s.id] ? " · customized" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedStyle.description}
        </p>
      </div>

      <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
        Placeholders: <code>{"{{subject}}"}</code>, <code>{"{{goal}}"}</code>,{" "}
        <code>{"{{minBodyChars}}"}</code>, <code>{"{{slotNum}}"}</code>,{" "}
        <code>{"{{totalPosts}}"}</code>
      </p>

      <div className="space-y-2">
        <Label>Post prompt template</Label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
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
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
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
