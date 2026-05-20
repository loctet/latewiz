"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiStore } from "@/stores";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import { NICHE_LANGUAGE_OPTIONS } from "@/lib/openai/niche-prompt";
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

function patchDraft(
  draft: NicheProfile,
  partial: Partial<NicheProfile>
): NicheProfile {
  return { ...draft, ...partial };
}

export function NicheProfileForm() {
  const savedNiche = useAiStore((s) => s.niche);
  const setNiche = useAiStore((s) => s.setNiche);
  const [draft, setDraft] = useState<NicheProfile>(defaultNicheProfile);
  const [initialized, setInitialized] = useState(false);

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
  };

  const handleSave = () => {
    setNiche(draft);
    toast.success("Niche profile saved");
  };

  return (
    <div className="space-y-4">
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
          placeholder="e.g. SaaS marketing, fitness coaching"
        />
      </div>
      <div className="space-y-2">
        <Label>Target audience</Label>
        <Input
          value={draft.audience}
          onChange={(e) => update({ audience: e.target.value })}
          placeholder="Who are you speaking to?"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Geography</Label>
          <Input
            value={draft.geography}
            onChange={(e) => update({ geography: e.target.value })}
            placeholder="e.g. US, EU, global"
          />
        </div>
        <div className="space-y-2">
          <Label>Tone notes</Label>
          <Input
            value={draft.toneNotes}
            onChange={(e) => update({ toneNotes: e.target.value })}
            placeholder="e.g. friendly, expert, no slang"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Forbidden topics</Label>
        <Textarea
          value={draft.forbiddenTopics}
          onChange={(e) => update({ forbiddenTopics: e.target.value })}
          rows={2}
          placeholder="Topics or brands to never mention"
        />
      </div>
      <div className="space-y-2">
        <Label>Compliance notes</Label>
        <Textarea
          value={draft.complianceNotes}
          onChange={(e) => update({ complianceNotes: e.target.value })}
          rows={2}
          placeholder="Disclaimers, regulated claims, legal constraints"
        />
      </div>
      <div className="space-y-2">
        <Label>Extra instructions</Label>
        <Textarea
          value={draft.extraInstructions}
          onChange={(e) => update({ extraInstructions: e.target.value })}
          rows={3}
          placeholder="CTA style, hashtag rules, brand voice details..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="button" onClick={handleSave} disabled={!isDirty}>
          <Save className="mr-2 h-4 w-4" />
          Save niche profile
        </Button>
        {isDirty && (
          <p className="text-xs text-muted-foreground">Unsaved changes</p>
        )}
      </div>
    </div>
  );
}
