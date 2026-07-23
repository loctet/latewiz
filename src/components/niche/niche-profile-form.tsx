"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import { NICHE_LANGUAGE_OPTIONS } from "@/lib/openai/niche-prompt";
import { NICHE_PRESETS, type NichePresetId } from "@/lib/niche-presets";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

function patchDraft(
  draft: NicheProfile,
  partial: Partial<NicheProfile>
): NicheProfile {
  return { ...draft, ...partial };
}

export function NicheProfileForm() {
  const savedNiche = useAiStore((s) => s.niche);
  const setNiche = useAiStore((s) => s.setNiche);
  const [draft, setDraft] = useState<NicheProfile>(() => defaultNicheProfile());
  const [initialized, setInitialized] = useState(false);
  const [presetId, setPresetId] = useState<NichePresetId>("custom");

  useEffect(() => {
    if (!initialized) {
      setDraft({ ...defaultNicheProfile(), ...savedNiche });
      setInitialized(true);
    }
  }, [savedNiche, initialized]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedNiche),
    [draft, savedNiche]
  );

  const update = (partial: Partial<NicheProfile>) => {
    setDraft((prev) => patchDraft(prev, partial));
    setPresetId("custom");
  };

  const handleSave = async () => {
    setNiche(draft);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sync niche");
      }
      toast.success("Niche profile saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Saved locally; server sync failed"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Presets</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {NICHE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setPresetId(preset.id);
                setDraft({ ...preset.niche });
              }}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                presetId === preset.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              )}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Content language</Label>
        <Select
          value={draft.language || "en"}
          onValueChange={(language) => update({ language })}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {NICHE_LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          AI captions, campaigns, and infographic text use this language.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Topic / niche</Label>
        <Input
          value={draft.topic}
          onChange={(e) => update({ topic: e.target.value })}
          placeholder="e.g. molecular biology research, B2B SaaS, fitness coaching"
        />
      </div>
      <div className="space-y-2">
        <Label>Audience</Label>
        <Input
          value={draft.audience}
          onChange={(e) => update({ audience: e.target.value })}
          placeholder="Who are you writing for?"
        />
      </div>
      <div className="space-y-2">
        <Label>Geography</Label>
        <Input
          value={draft.geography}
          onChange={(e) => update({ geography: e.target.value })}
          placeholder="Optional region focus"
        />
      </div>
      <div className="space-y-2">
        <Label>Tone notes</Label>
        <Textarea
          value={draft.toneNotes}
          onChange={(e) => update({ toneNotes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Forbidden topics</Label>
        <Textarea
          value={draft.forbiddenTopics}
          onChange={(e) => update({ forbiddenTopics: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Compliance notes</Label>
        <Textarea
          value={draft.complianceNotes}
          onChange={(e) => update({ complianceNotes: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Extra instructions</Label>
        <Textarea
          value={draft.extraInstructions}
          onChange={(e) => update({ extraInstructions: e.target.value })}
          rows={3}
        />
      </div>
      <Button onClick={handleSave} disabled={!isDirty} className="gap-2">
        <Save className="h-4 w-4" />
        Save niche
      </Button>
    </div>
  );
}
