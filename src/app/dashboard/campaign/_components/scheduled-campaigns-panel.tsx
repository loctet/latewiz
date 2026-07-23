"use client";

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
  return `${generated} gen · ${pending} pending · ${failed} failed`;
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
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="scheduled-campaign-name" className="text-xs">
            Campaign name
          </Label>
          <Input
            id="scheduled-campaign-name"
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="e.g. Daily crypto news"
            className="h-8"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 cursor-pointer"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {activeId ? "Update" : "Save"}
        </Button>
      </div>

      {campaigns.length > 0 ? (
        <ul className="divide-y rounded-lg border border-border">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-medium">
                    {campaign.name}
                    {activeId === campaign.id ? (
                      <span className="ml-1.5 text-xs text-primary">(editing)</span>
                    ) : null}
                  </p>
                  <Badge
                    variant={campaign.status === "failed" ? "destructive" : "secondary"}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {campaign.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {campaign.slots.length} slots · {slotSummary(campaign)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 cursor-pointer"
                  onClick={() => onLoad(campaign.id)}
                >
                  <FolderOpen className="mr-1 h-3 w-3" />
                  Open
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer"
                  onClick={() => onRun(campaign.id)}
                  disabled={runningId === campaign.id}
                >
                  <Play className="mr-1 h-3 w-3" />
                  {runningId === campaign.id ? "…" : "Run"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => onDelete(campaign.id)}
                  aria-label={`Delete ${campaign.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No scheduled campaigns yet. Plan deferred slots, then save for cron.
        </p>
      )}
    </div>
  );
}
