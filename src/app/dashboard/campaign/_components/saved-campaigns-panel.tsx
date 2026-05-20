"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Saved campaigns</CardTitle>
        <CardDescription>
          Save your work to finish editing later, then schedule when ready.
          Stored in this browser for your current profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="campaign-save-name">Campaign name</Label>
            <Input
              id="campaign-save-name"
              value={saveName}
              onChange={(e) => onSaveNameChange(e.target.value)}
              placeholder="e.g. Course launch week"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSave}>
              <Save className="mr-2 h-4 w-4" />
              {activeSavedId ? "Update saved" : "Save for later"}
            </Button>
            <Button type="button" variant="outline" onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" />
              New campaign
            </Button>
          </div>
        </div>

        {saved.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {saved.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {c.name}
                    {activeSavedId === c.id && (
                      <span className="ml-2 text-xs text-primary">
                        (editing)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.slots.length} slot{c.slots.length === 1 ? "" : "s"} ·
                    updated{" "}
                    {new Date(c.savedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onLoad(c.id)}
                  >
                    <FolderOpen className="mr-1 h-3 w-3" />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved campaigns yet. Generate or edit a campaign, then use Save
            for later.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
