"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Briefcase, Check, ChevronDown, Copy, Loader2, Settings2 } from "lucide-react";
import { useActivateWorkspace, useWorkspaces } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DuplicateWorkspaceDialog } from "./duplicate-workspace-dialog";

/** Header control: switch between LateWiz workspaces or duplicate the current one. */
export function WorkspaceSwitcher() {
  const { data: workspaces = [] } = useWorkspaces();
  const activate = useActivateWorkspace();
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const active = workspaces.find((w) => w.isActive) ?? workspaces[0];
  if (!active) return null;

  const switchTo = (id: string) => {
    if (id === active.id || activate.isPending) return;
    activate.mutate(id, {
      onError: (error) => toast.error(error.message || "Failed to switch workspace"),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {activate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Briefcase className="h-4 w-4" />
            )}
            <span className="max-w-28 truncate">{active.name}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => switchTo(w.id)} className="gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{w.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {w.topic || "No niche yet"}
                  {w.zernioHint ? ` · key …${w.zernioHint}` : " · no Zernio key"}
                </p>
              </div>
              {w.isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDuplicateOpen(true)} className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicate current…
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/dashboard/settings#workspaces">
              <Settings2 className="h-4 w-4" />
              Manage workspaces
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DuplicateWorkspaceDialog
        source={active}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />
    </>
  );
}
