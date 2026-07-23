"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedCampaign } from "@/lib/saved-campaigns-storage";
import { FolderOpen, Plus, Trash2, Save } from "lucide-react";

interface SavedCampaignsPanelProps {
  saved: SavedCampaign[];
  activeSavedId: string | null;
  saveName: string;
  onSaveNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function SavedCampaignsPanel({
  saved,
  activeSavedId,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  onNew,
}: SavedCampaignsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="campaign-save-name" className="text-xs">
            Campaign name
          </Label>
          <Input
            id="campaign-save-name"
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="e.g. Course launch week"
            className="h-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" className="h-8 cursor-pointer" onClick={onSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {activeSavedId ? "Update" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={onNew}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      {saved.length > 0 ? (
        <ul className="divide-y rounded-lg border border-border">
          {saved.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {c.name}
                  {activeSavedId === c.id && (
                    <span className="ml-1.5 text-xs text-primary">(editing)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {c.slots.length} slot{c.slots.length === 1 ? "" : "s"} ·{" "}
                  {new Date(c.savedAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 cursor-pointer"
                  onClick={() => onLoad(c.id)}
                >
                  <FolderOpen className="mr-1 h-3 w-3" />
                  Open
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => onDelete(c.id)}
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No saved campaigns yet. Generate slots, then save here.
        </p>
      )}
    </div>
  );
}
