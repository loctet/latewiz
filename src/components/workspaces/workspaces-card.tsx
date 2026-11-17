"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, Check, Copy, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  useActivateWorkspace,
  useDeleteWorkspace,
  useRenameWorkspace,
  useWorkspaces,
  type Workspace,
} from "@/hooks/use-workspaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { DuplicateWorkspaceDialog } from "./duplicate-workspace-dialog";

/** Settings card: list, switch, rename, duplicate and delete workspaces. */
export function WorkspacesCard() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const activate = useActivateWorkspace();
  const rename = useRenameWorkspace();
  const remove = useDeleteWorkspace();

  const [duplicateSource, setDuplicateSource] = useState<Workspace | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [toDelete, setToDelete] = useState<Workspace | null>(null);

  const saveName = async (id: string) => {
    try {
      await rename.mutateAsync({ id, name: draftName });
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync({ id: toDelete.id, wasActive: toDelete.isActive });
      toast.success(`Deleted “${toDelete.name}”`);
      setToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  return (
    <Card id="workspaces">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4" />
          Workspaces
        </CardTitle>
        <CardDescription>
          Each workspace has its own Zernio key (so its own connected accounts), AI
          keys, niche and campaigns. Duplicate one to start a new brand fast.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {workspaces.map((w) => (
          <div
            key={w.id}
            className="flex flex-col gap-2 rounded-lg bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              {editingId === w.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={draftName}
                    maxLength={60}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(w.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => saveName(w.id)}
                    aria-label="Save name"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel rename"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  {w.isActive && <Badge variant="secondary">Active</Badge>}
                </div>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {w.topic || "No niche yet"} ·{" "}
                {w.zernioHint ? `Zernio …${w.zernioHint}` : "no Zernio key"}
                {w.hasOpenai ? " · OpenAI" : ""}
                {w.hasFal ? " · fal" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!w.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activate.isPending}
                  onClick={() =>
                    activate.mutate(w.id, { onError: (e) => toast.error(e.message) })
                  }
                >
                  Switch
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Rename workspace"
                onClick={() => {
                  setEditingId(w.id);
                  setDraftName(w.name);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Duplicate workspace"
                onClick={() => setDuplicateSource(w)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Delete workspace"
                disabled={workspaces.length <= 1}
                onClick={() => setToDelete(w)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <DuplicateWorkspaceDialog
        source={duplicateSource}
        open={!!duplicateSource}
        onOpenChange={(open) => !open && setDuplicateSource(null)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the workspace, the API keys stored in it and its scheduled
              campaigns from LateWiz. Your Zernio account and its connected social
              accounts are not touched. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
