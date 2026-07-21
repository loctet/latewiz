"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScheduledCampaign } from "@/lib/scheduled-campaigns";
import { FolderOpen, Play, Trash2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScheduledCampaignsPanelProps {
  campaigns: ScheduledCampaign[];
  activeId: string | null;
  saveName: string;
  saving: boolean;
  runningId: string | null;
  onSaveNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
}

function slotSummary(campaign: ScheduledCampaign): string {
  const generated = campaign.slots.filter((slot) => slot.status === "generated").length;
  const failed = campaign.slots.filter((slot) => slot.status === "failed").length;
  const pending = campaign.slots.filter(
    (slot) => slot.status === "pending_generation" || slot.status === "processing"
  ).length;
  return `${generated} generated · ${pending} pending · ${failed} failed`;
}

export function ScheduledCampaignsPanel({
  campaigns,
  activeId,
  saveName,
  saving,
  runningId,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  onRun,
}: ScheduledCampaignsPanelProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Scheduled campaigns</CardTitle>
        <CardDescription>
          Stored on the server for cron execution. Final copy and media are generated near publish time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="scheduled-campaign-name">Campaign name</Label>
            <Input
              id="scheduled-campaign-name"
              value={saveName}
              onChange={(e) => onSaveNameChange(e.target.value)}
              placeholder="e.g. Daily crypto news"
            />
          </div>
          <Button type="button" onClick={onSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {activeId ? "Update scheduled campaign" : "Save scheduled campaign"}
          </Button>
        </div>

        {campaigns.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {campaigns.map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">
                      {campaign.name}
                      {activeId === campaign.id ? (
                        <span className="ml-2 text-xs text-primary">(editing)</span>
                      ) : null}
                    </p>
                    <Badge variant={campaign.status === "failed" ? "destructive" : "secondary"}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {campaign.slots.length} slot{campaign.slots.length === 1 ? "" : "s"} ·{" "}
                    {slotSummary(campaign)} · updated{" "}
                    {new Date(campaign.updatedAt).toLocaleString(undefined, {
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
                    onClick={() => onLoad(campaign.id)}
                  >
                    <FolderOpen className="mr-1 h-3 w-3" />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRun(campaign.id)}
                    disabled={runningId === campaign.id}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    {runningId === campaign.id ? "Running…" : "Run now"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDelete(campaign.id)}
                    aria-label={`Delete ${campaign.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No scheduled campaigns yet. Plan slots, then save the deferred campaign for cron.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
