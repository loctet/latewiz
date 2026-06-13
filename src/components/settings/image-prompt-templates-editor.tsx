"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import {
  CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER,
  IMAGE_PROMPT_STYLES,
  IMAGE_PROMPT_TEMPLATE_HELP,
  createCustomImagePromptStyleId,
  getDefaultTemplate,
  getEffectiveTemplate,
  getImagePromptStyle,
  isBuiltinImagePromptStyle,
} from "@/lib/image-prompt-catalog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";

export function ImagePromptTemplatesEditor() {
  const savedTemplates = useAiStore((s) => s.imagePromptTemplates);
  const customStyles = useAiStore((s) => s.customImagePromptStyles);
  const setImagePromptTemplate = useAiStore((s) => s.setImagePromptTemplate);
  const resetImagePromptTemplate = useAiStore((s) => s.resetImagePromptTemplate);
  const resetAllImagePromptTemplates = useAiStore(
    (s) => s.resetAllImagePromptTemplates
  );
  const addCustomImagePromptStyle = useAiStore(
    (s) => s.addCustomImagePromptStyle
  );
  const updateCustomImagePromptStyle = useAiStore(
    (s) => s.updateCustomImagePromptStyle
  );
  const removeCustomImagePromptStyle = useAiStore(
    (s) => s.removeCustomImagePromptStyle
  );

  const [selectedId, setSelectedId] = useState(IMAGE_PROMPT_STYLES[0].id);
  const [draft, setDraft] = useState(() =>
    getEffectiveTemplate(IMAGE_PROMPT_STYLES[0].id, {}, [])
  );
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTemplate, setNewTemplate] = useState(
    CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER
  );

  const isCustomSelected = !isBuiltinImagePromptStyle(selectedId);
  const savedForStyle = savedTemplates[selectedId];
  const defaultTemplate = getDefaultTemplate(selectedId, customStyles);
  const selectedStyle = getImagePromptStyle(selectedId, customStyles);

  useEffect(() => {
    setDraft(getEffectiveTemplate(selectedId, savedTemplates, customStyles));
    if (isBuiltinImagePromptStyle(selectedId)) {
      setDraftLabel("");
      setDraftDescription("");
    } else {
      const meta = customStyles.find((s) => s.id === selectedId);
      setDraftLabel(meta?.label ?? "");
      setDraftDescription(meta?.description ?? "");
    }
  }, [selectedId, savedTemplates, customStyles]);

  const isTemplateDirty = useMemo(
    () => draft.trim() !== (savedForStyle ?? "").trim(),
    [draft, savedForStyle]
  );

  const isMetadataDirty = useMemo(() => {
    if (!isCustomSelected) return false;
    const meta = customStyles.find((s) => s.id === selectedId);
    return (
      draftLabel.trim() !== (meta?.label ?? "").trim() ||
      draftDescription.trim() !== (meta?.description ?? "").trim()
    );
  }, [isCustomSelected, selectedId, customStyles, draftLabel, draftDescription]);

  const isDirty = isTemplateDirty || isMetadataDirty;

  const isCustomized = Boolean(savedForStyle?.trim());
  const differsFromDefault = draft.trim() !== defaultTemplate.trim();

  const warnPlaceholders = (text: string) => {
    if (!text.includes("{{subject}}") && !text.includes("{{langNote}}")) {
      toast.message(
        "Tip: include {{subject}} and {{langNote}} so niche and caption are injected."
      );
    }
  };

  const handleSave = () => {
    if (!draft.trim()) {
      toast.error("Template cannot be empty");
      return;
    }
    warnPlaceholders(draft);

    if (isCustomSelected) {
      if (!draftLabel.trim()) {
        toast.error("Template name is required");
        return;
      }
      updateCustomImagePromptStyle(selectedId, {
        label: draftLabel.trim(),
        description: draftDescription.trim(),
      });
      setImagePromptTemplate(selectedId, draft);
      toast.success("Custom template saved");
      return;
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
    if (isCustomSelected) return;
    resetImagePromptTemplate(selectedId);
    setDraft(defaultTemplate);
    toast.success("Restored default template for this style");
  };

  const handleResetAll = () => {
    resetAllImagePromptTemplates();
    setDraft(defaultTemplate);
    toast.success("All built-in prompt templates restored to defaults");
  };

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Template name is required");
      return;
    }
    if (!newTemplate.trim()) {
      toast.error("Template cannot be empty");
      return;
    }
    warnPlaceholders(newTemplate);

    const existingIds = new Set([
      ...IMAGE_PROMPT_STYLES.map((s) => s.id),
      ...customStyles.map((s) => s.id),
    ]);
    const id = createCustomImagePromptStyleId(label, existingIds);

    addCustomImagePromptStyle(
      {
        id,
        label,
        description: newDescription.trim(),
      },
      newTemplate.trim()
    );

    setSelectedId(id);
    setIsCreating(false);
    setNewLabel("");
    setNewDescription("");
    setNewTemplate(CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER);
    toast.success("Custom template created");
  };

  const handleDeleteCustom = () => {
    if (!isCustomSelected) return;
    const label = selectedStyle.label;
    removeCustomImagePromptStyle(selectedId);
    setSelectedId(IMAGE_PROMPT_STYLES[0].id);
    toast.success(`Deleted "${label}"`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-2">
          <Label>Style to edit</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Built-in styles</SelectLabel>
                {IMAGE_PROMPT_STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                    {s.id === "notebook-educational" ? " (default)" : ""}
                    {savedTemplates[s.id] ? " · customized" : ""}
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
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsCreating((v) => !v)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {isCreating ? "Cancel" : "New template"}
        </Button>
      </div>

      {isCreating && (
        <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">Create a new image prompt template</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-template-name">Name</Label>
              <Input
                id="new-template-name"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Brand hero shot"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-template-description">Description</Label>
              <Input
                id="new-template-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short note for when picking this style"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-template-body">Prompt template</Label>
            <Textarea
              id="new-template-body"
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              rows={12}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
          <Button type="button" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create template
          </Button>
        </div>
      )}

      {selectedStyle && (
        <p className="text-xs text-muted-foreground">
          {selectedStyle.description || "Custom template"}
        </p>
      )}

      {isCustomSelected && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-template-name">Name</Label>
            <Input
              id="custom-template-name"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="custom-template-description">Description</Label>
            <Input
              id="custom-template-description"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </div>
        </div>
      )}

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
          {isCustomSelected
            ? " · custom template"
            : isCustomized
              ? " · customized"
              : " · using built-in default"}
          {!isCustomSelected && differsFromDefault && !isCustomized
            ? " · unsaved edits"
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={!isDirty}>
          <Save className="mr-2 h-4 w-4" />
          Save template
        </Button>
        {!isCustomSelected && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResetStyle}
            disabled={!isCustomized && !differsFromDefault}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset this style
          </Button>
        )}
        {isCustomSelected && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDeleteCustom}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete template
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={handleResetAll}
          disabled={
            Object.keys(savedTemplates).filter((id) =>
              isBuiltinImagePromptStyle(id)
            ).length === 0
          }
        >
          Reset all built-in styles
        </Button>
      </div>
    </div>
  );
}
