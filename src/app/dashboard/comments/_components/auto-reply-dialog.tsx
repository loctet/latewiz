"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSaveAutoReplyRule, useDeleteAutoReplyRule } from "@/hooks";
import { useAutoReplyRuleForPost } from "@/stores";
import type { CommentedPost } from "@/lib/zernio-api";
import type { PostAutoReplyRule } from "@/lib/auto-reply";
import { Loader2, Sparkles } from "lucide-react";

interface AutoReplyDialogProps {
  post: CommentedPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoReplyDialog({
  post,
  open,
  onOpenChange,
}: AutoReplyDialogProps) {
  const existing = useAutoReplyRuleForPost(post?.id ?? null);
  const saveMutation = useSaveAutoReplyRule();
  const deleteMutation = useDeleteAutoReplyRule();

  const [enabled, setEnabled] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [topLevelOnly, setTopLevelOnly] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState(60);

  useEffect(() => {
    if (!open || !post) return;
    setEnabled(existing?.enabled ?? false);
    setReplyMessage(
      existing?.replyMessage ??
        "Thanks for commenting! Here's the link: https://example.com"
    );
    setTopLevelOnly(existing?.topLevelOnly ?? true);
    setKeywords(existing?.keywords?.join(", ") ?? "");
    setCooldownMinutes(existing?.cooldownMinutes ?? 60);
  }, [open, post, existing]);

  const handleSave = async () => {
    if (!post) return;
    if (enabled && !replyMessage.trim()) {
      toast.error("Add a reply message or disable auto-reply.");
      return;
    }

    const rule: PostAutoReplyRule = {
      inboxPostId: post.id,
      accountId: post.accountId,
      platformPostId: post.platformPostId,
      enabled,
      replyMessage: replyMessage.trim(),
      topLevelOnly,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      cooldownMinutes: Math.max(0, cooldownMinutes),
      zernioAutomationId: existing?.zernioAutomationId,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveMutation.mutateAsync({
        rule,
        platform: String(post.platform),
        syncZernioAutomation: ["instagram", "facebook"].includes(
          String(post.platform)
        ),
      });
      toast.success(
        enabled ? "Auto-reply saved" : "Auto-reply disabled for this post"
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save auto-reply"
      );
    }
  };

  const handleDelete = async () => {
    if (!existing) {
      onOpenChange(false);
      return;
    }
    try {
      await deleteMutation.mutateAsync(existing);
      toast.success("Auto-reply rule removed");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove auto-reply"
      );
    }
  };

  if (!post) return null;

  const isIgFb = ["instagram", "facebook"].includes(String(post.platform));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-reply for this post
          </DialogTitle>
          <DialogDescription>
            Send an automatic public reply to each{" "}
            {topLevelOnly ? "top-level " : ""}
            comment on this post. Use{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{author}}"}</code>{" "}
            to insert the commenter&apos;s name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
            <Label htmlFor="auto-reply-enabled" className="cursor-pointer">
              Enable auto-reply
            </Label>
            <Switch
              id="auto-reply-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-message">Reply message</Label>
            <Textarea
              id="reply-message"
              rows={4}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Thanks {{author}}! Link: https://yoursite.com/page"
              disabled={!enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="top-level-only">Top-level comments only</Label>
              <p className="text-xs text-muted-foreground">
                Skip replies in comment threads
              </p>
            </div>
            <Switch
              id="top-level-only"
              checked={topLevelOnly}
              onCheckedChange={setTopLevelOnly}
              disabled={!enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (optional)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="link, price, info"
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to reply to all matching comments
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cooldown">Cooldown (minutes)</Label>
            <Input
              id="cooldown"
              type="number"
              min={0}
              value={cooldownMinutes}
              onChange={(e) =>
                setCooldownMinutes(parseInt(e.target.value, 10) || 0)
              }
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              Avoid replying twice to the same person within this window
            </p>
          </div>

          {isIgFb && enabled && (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              On Instagram and Facebook, LateWiz also syncs a Zernio comment
              automation so replies can run server-side when keywords match.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {existing && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Remove rule
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
