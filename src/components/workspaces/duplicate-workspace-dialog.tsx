"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  reloadIntoWorkspace,
  useCreateWorkspace,
  type Workspace,
} from "@/hooks/use-workspaces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Duplicate a workspace: copies its niche, content prefs and keys, lets the
 * user paste a different Zernio key, then switches to it and opens the niche
 * page so the niche can be changed too.
 */
export function DuplicateWorkspaceDialog({
  source,
  open,
  onOpenChange,
}: {
  source: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateWorkspace();
  const [name, setName] = useState("");
  const [zernioKey, setZernioKey] = useState("");

  useEffect(() => {
    if (open) {
      setName(source ? `${source.name} copy` : "");
      setZernioKey("");
    }
  }, [open, source]);

  const keyLooksValid = !zernioKey.trim() || zernioKey.trim().startsWith("sk_");

  const submit = async () => {
    try {
      await create.mutateAsync({
        name,
        sourceId: source?.id ?? null,
        zernioKey: zernioKey.trim() || undefined,
        activate: true,
      });
      toast.success(`Switched to “${name.trim()}”. Now adjust its niche.`);
      reloadIntoWorkspace("/dashboard/niche");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create workspace");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate workspace</DialogTitle>
          <DialogDescription>
            {source
              ? `Copies the niche and API keys of “${source.name}”. Paste a different Zernio key to post to another set of accounts.`
              : "Create a new workspace with its own keys and niche."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fitness brand"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-zernio">Zernio API key</Label>
            <PasswordInput
              id="ws-zernio"
              value={zernioKey}
              onChange={(e) => setZernioKey(e.target.value)}
              placeholder={
                source?.zernioHint ? `Leave empty to keep …${source.zernioHint}` : "sk_…"
              }
              autoComplete="off"
            />
            {!keyLooksValid && (
              <p className="text-xs text-destructive">Zernio keys start with sk_</p>
            )}
            <p className="text-xs text-muted-foreground">
              OpenAI and fal keys are copied. Change them later in Settings.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !keyLooksValid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create and switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
