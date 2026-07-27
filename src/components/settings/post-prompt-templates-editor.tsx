"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import {
  CUSTOM_POST_PROMPT_TEMPLATE_STARTER,
  DEFAULT_POST_PROMPT_STYLE_ID,
  POST_PROMPT_STYLES,
  createCustomPostPromptStyleId,
  getEffectivePostStructureTemplate,
  getPostPromptStyle,
  isBuiltinPostPromptStyle,
} from "@/lib/post-prompt-catalog";
import { persistContentPrefsToProfile } from "@/lib/persist-content-prefs";
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

export function PostPromptTemplatesEditor() {
  const savedTemplates = useAiStore((s) => s.postPromptTemplates);
  const customStyles = useAiStore((s) => s.customPostPromptStyles);
  const setPostPromptTemplate = useAiStore((s) => s.setPostPromptTemplate);
  const resetPostPromptTemplate = useAiStore((s) => s.resetPostPromptTemplate);
  const resetAllPostPromptTemplates = useAiStore(
    (s) => s.resetAllPostPromptTemplates
  );
  const addCustomPostPromptStyle = useAiStore((s) => s.addCustomPostPromptStyle);
  const updateCustomPostPromptStyle = useAiStore(
    (s) => s.updateCustomPostPromptStyle
  );
  const removeCustomPostPromptStyle = useAiStore(
    (s) => s.removeCustomPostPromptStyle
  );

  const [selectedId, setSelectedId] = useState(DEFAULT_POST_PROMPT_STYLE_ID);
  const [draft, setDraft] = useState(() =>
    getEffectivePostStructureTemplate(DEFAULT_POST_PROMPT_STYLE_ID, {}, [])
  );
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTemplate, setNewTemplate] = useState(
    CUSTOM_POST_PROMPT_TEMPLATE_STARTER
  );
  const [saving, setSaving] = useState(false);

  const isCustomSelected = !isBuiltinPostPromptStyle(selectedId);
  const savedForStyle = savedTemplates[selectedId];
  const selectedStyle = getPostPromptStyle(
    selectedId,
    customStyles,
    savedTemplates
  );
  const defaultTemplate = selectedStyle.structureTemplate;

  useEffect(() => {
    setDraft(
      getEffectivePostStructureTemplate(selectedId, savedTemplates, customStyles)
    );
    if (isBuiltinPostPromptStyle(selectedId)) {
      setDraftLabel("");
      setDraftDescription("");
    } else {
      const meta = customStyles.find((s) => s.id === selectedId);
      setDraftLabel(meta?.label ?? "");
      setDraftDescription(meta?.description ?? "");
    }
  }, [selectedId, savedTemplates, customStyles]);

  const isTemplateDirty = useMemo(() => {
    if (isCustomSelected) {
      return draft.trim() !== (savedForStyle ?? "").trim();
    }
    return draft.trim() !== (savedForStyle ?? defaultTemplate).trim();
  }, [draft, savedForStyle, defaultTemplate, isCustomSelected]);

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
  const differsFromDefault =
    !isCustomSelected && draft.trim() !== defaultTemplate.trim();

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
      !draft.includes("{{goal}}")
    ) {
      toast.message(
        "Tip: include {{subject}} or {{goal}} so campaign context is injected."
      );
    }

    setSaving(true);
    try {
      if (isCustomSelected) {
        if (!draftLabel.trim()) {
          toast.error("Style name is required");
          return;
        }
        updateCustomPostPromptStyle(selectedId, {
          label: draftLabel.trim(),
          description: draftDescription.trim(),
        });
        setPostPromptTemplate(selectedId, draft);
        toast.success("Custom style saved");
        await syncProfile();
        return;
      }

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
    if (isCustomSelected) return;
    resetPostPromptTemplate(selectedId);
    setDraft(defaultTemplate);
    toast.success("Restored default template for this style");
    await syncProfile();
  };

  const handleResetAll = async () => {
    resetAllPostPromptTemplates();
    setDraft(
      getEffectivePostStructureTemplate(selectedId, {}, customStyles)
    );
    toast.success("All built-in post prompt templates restored to defaults");
    await syncProfile();
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Style name is required");
      return;
    }
    if (!newTemplate.trim()) {
      toast.error("Template cannot be empty");
      return;
    }

    const existingIds = new Set([
      ...POST_PROMPT_STYLES.map((s) => s.id),
      ...customStyles.map((s) => s.id),
    ]);
    const id = createCustomPostPromptStyleId(label, existingIds);

    addCustomPostPromptStyle(
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
    setNewTemplate(CUSTOM_POST_PROMPT_TEMPLATE_STARTER);
    toast.success("Custom style created");
    await syncProfile();
  };

  const handleDeleteCustom = async () => {
    if (!isCustomSelected) return;
    const label = selectedStyle.label;
    removeCustomPostPromptStyle(selectedId);
    setSelectedId(DEFAULT_POST_PROMPT_STYLE_ID);
    toast.success(`Deleted "${label}"`);
    await syncProfile();
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
                {POST_PROMPT_STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                    {s.id === DEFAULT_POST_PROMPT_STYLE_ID ? " (default)" : ""}
                    {savedTemplates[s.id] ? " · customized" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
              {customStyles.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Your styles</SelectLabel>
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
          {isCreating ? "Cancel" : "New style"}
        </Button>
      </div>

      {isCreating && (
        <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">Create a new post style</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-post-style-name">Name</Label>
              <Input
                id="new-post-style-name"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Weekly market brief"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-post-style-description">Description</Label>
              <Input
                id="new-post-style-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short note for when picking this style"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-post-style-body">Structure template</Label>
            <Textarea
              id="new-post-style-body"
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              rows={8}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
          <Button type="button" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create style
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedStyle.description || "Custom post style"}
      </p>

      {isCustomSelected && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-post-style-name">Name</Label>
            <Input
              id="custom-post-style-name"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="custom-post-style-description">Description</Label>
            <Input
              id="custom-post-style-description"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </div>
        </div>
      )}

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
          {isCustomSelected
            ? " · custom style"
            : isCustomized
              ? " · customized"
              : " · using built-in default"}
          {!isCustomSelected && differsFromDefault && !isCustomized
            ? " · unsaved edits"
            : ""}
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
            Delete style
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={handleResetAll}
          disabled={
            Object.keys(savedTemplates).filter((id) =>
              isBuiltinPostPromptStyle(id)
            ).length === 0
          }
        >
          Reset all built-in styles
        </Button>
      </div>
    </div>
  );
}
