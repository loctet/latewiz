"use client";

import { useState } from "react";
import { format } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  nextPendingCampaignSlot,
  pendingCampaignSlotCount,
  type ScheduledCampaign,
  type ScheduledCampaignStatus,
} from "@/lib/scheduled-campaigns";
import { FolderOpen, Loader2, Play, Save, Trash2 } from "lucide-react";

interface ScheduledCampaignsPanelProps {
  campaigns: ScheduledCampaign[];
  activeId: string | null;
  saveName: string;
  saving: boolean;
  runningId: string | null;
  deletingId: string | null;
  loading?: boolean;
  error?: string | null;
  showSave?: boolean;
  onSaveNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onRetry?: () => void;
}

function formatSlotWhen(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function statusBadgeVariant(
  status: ScheduledCampaignStatus
): "destructive" | "secondary" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "completed" || status === "cancelled") return "outline";
  return "secondary";
}

function campaignSummary(campaign: ScheduledCampaign): string {
  const pending = pendingCampaignSlotCount(campaign);
  const generated = campaign.slots.filter((slot) => slot.status === "generated")
    .length;
  const failed = campaign.slots.filter((slot) => slot.status === "failed").length;
  const next = nextPendingCampaignSlot(campaign);
  const parts = [
    `${campaign.slots.length} slot${campaign.slots.length === 1 ? "" : "s"}`,
    `${pending} pending`,
    `${generated} generated`,
  ];
  if (failed > 0) parts.push(`${failed} failed`);
  if (next) parts.push(`next ${formatSlotWhen(next.scheduled_at)}`);
  return parts.join(" · ");
}

export function ScheduledCampaignsPanel({
  campaigns,
  activeId,
  saveName,
  saving,
  runningId,
  deletingId,
  loading = false,
  error = null,
  showSave = true,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  onRun,
  onRetry,
}: ScheduledCampaignsPanelProps) {
  const [campaignToDelete, setCampaignToDelete] =
    useState<ScheduledCampaign | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Deferred campaigns</h2>
          {campaigns.length > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {campaigns.length}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Near-publish jobs wait here until cron generates each slot. Delete a
          campaign to interrupt remaining posts.
        </p>
      </div>

      {showSave ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
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
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {activeId ? "Update" : "Save"}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading deferred campaigns…</p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2">
          <p className="text-xs text-destructive">{error}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 cursor-pointer"
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : campaigns.length > 0 ? (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border border-border">
          {campaigns.map((campaign) => {
            const pending = pendingCampaignSlotCount(campaign);
            const busy =
              runningId === campaign.id || deletingId === campaign.id;
            return (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-sm"
              >
                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-medium">
                      {campaign.name}
                      {activeId === campaign.id ? (
                        <span className="ml-1.5 text-xs text-primary">
                          (open)
                        </span>
                      ) : null}
                    </p>
                    <Badge
                      variant={statusBadgeVariant(campaign.status)}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {campaign.status}
                    </Badge>
                    {pending > 0 ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {pending} remaining
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {campaignSummary(campaign)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 cursor-pointer"
                    onClick={() => onLoad(campaign.id)}
                    disabled={busy}
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
                    disabled={busy}
                  >
                    {runningId === campaign.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    {runningId === campaign.id ? "…" : "Run"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setCampaignToDelete(campaign)}
                    disabled={busy}
                    aria-label={`Stop and delete ${campaign.name}`}
                  >
                    {deletingId === campaign.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    Stop
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No deferred campaigns yet. Choose Near publish, plan slots, then save
          — cron generates before each post.
        </p>
      )}

      <AlertDialog
        open={!!campaignToDelete}
        onOpenChange={(open) => {
          if (!open) setCampaignToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToDelete
                ? `Delete “${campaignToDelete.name}” to interrupt remaining near-publish generation. Posts already sent stay on the calendar.`
                : "Delete this campaign to interrupt remaining near-publish generation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Keep running
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!campaignToDelete) return;
                onDelete(campaignToDelete.id);
                setCampaignToDelete(null);
              }}
            >
              Stop and delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
