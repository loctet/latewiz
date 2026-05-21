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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveAutoReplyRule, useDeleteAutoReplyRule } from "@/hooks";
import { useAutoReplyRuleForPost } from "@/stores";
import type { CommentedPost } from "@/lib/zernio-api";
import type { AutoReplyChannel, PostAutoReplyRule } from "@/lib/auto-reply";
import { Loader2, Sparkles } from "lucide-react";

interface AutoReplyDialogProps {
  post: CommentedPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANNEL_OPTIONS: {
  value: AutoReplyChannel;
  label: string;
  description: string;
}[] = [
  {
    value: "dm",
    label: "Direct message only",
    description:
      "Send a private DM to the commenter. On Instagram/Facebook uses Meta private reply when allowed.",
  },
  {
    value: "dm_with_fallback",
    label: "DM with public fallback",
    description:
      "Try a DM first; if the platform blocks it, post a public comment asking them to message you.",
  },
  {
    value: "comment",
    label: "Public comment reply",
    description: "Reply on the comment thread (visible to everyone).",
  },
];

export function AutoReplyDialog({
  post,
  open,
  onOpenChange,
}: AutoReplyDialogProps) {
  const existing = useAutoReplyRuleForPost(post?.id ?? null);
  const saveMutation = useSaveAutoReplyRule();
  const deleteMutation = useDeleteAutoReplyRule();

  const [enabled, setEnabled] = useState(false);
  const [replyChannel, setReplyChannel] = useState<AutoReplyChannel>("dm");
  const [dmMessage, setDmMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [fallbackCommentMessage, setFallbackCommentMessage] = useState("");
  const [topLevelOnly, setTopLevelOnly] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState(60);

  useEffect(() => {
    if (!open || !post) return;
    setEnabled(existing?.enabled ?? false);
    setReplyChannel(existing?.replyChannel ?? "dm");
    setDmMessage(
      existing?.dmMessage ??
        "Thanks for commenting! Here's the link: https://example.com"
    );
    setReplyMessage(
      existing?.replyMessage ??
        "Thanks for commenting! Please DM us for details."
    );
    setFallbackCommentMessage(
      existing?.fallbackCommentMessage ??
        "Happy to help — please DM us and we'll send the details!"
    );
    setTopLevelOnly(existing?.topLevelOnly ?? true);
    setKeywords(existing?.keywords?.join(", ") ?? "");
    setCooldownMinutes(existing?.cooldownMinutes ?? 60);
  }, [open, post, existing]);

  const handleSave = async () => {
    if (!post) return;

    const dm = dmMessage.trim();
    const comment = replyMessage.trim();
    const fallback = fallbackCommentMessage.trim();

    if (enabled) {
      if (replyChannel === "comment" && !comment) {
        toast.error("Add a public reply message or disable auto-reply.");
        return;
      }
      if (replyChannel !== "comment" && !dm) {
        toast.error("Add a DM message or disable auto-reply.");
        return;
      }
      if (replyChannel === "dm_with_fallback" && !fallback) {
        toast.error("Add a fallback public message for when DMs are blocked.");
        return;
      }
    }

    const rule: PostAutoReplyRule = {
      inboxPostId: post.id,
      accountId: post.accountId,
      platform: String(post.platform),
      platformPostId: post.platformPostId,
      enabled,
      replyMessage: replyChannel === "comment" ? comment : comment || fallback,
      dmMessage: dm || undefined,
      fallbackCommentMessage: fallback || undefined,
      replyChannel,
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
  const showDmFields = replyChannel !== "comment";
  const showPublicFields =
    replyChannel === "comment" || replyChannel === "dm_with_fallback";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-reply for this post
          </DialogTitle>
          <DialogDescription>
            Respond automatically to each{" "}
            {topLevelOnly ? "top-level " : ""}
            comment. Use{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{author}}"}</code>{" "}
            for the commenter&apos;s name. Many platforms restrict cold DMs — use
            fallback mode when unsure.
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
            <Label>Response type</Label>
            <Select
              value={replyChannel}
              onValueChange={(v) => setReplyChannel(v as AutoReplyChannel)}
              disabled={!enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {
                CHANNEL_OPTIONS.find((o) => o.value === replyChannel)
                  ?.description
              }
            </p>
          </div>

          {showDmFields && (
            <div className="space-y-2">
              <Label htmlFor="dm-message">DM message</Label>
              <Textarea
                id="dm-message"
                rows={4}
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="Thanks {{author}}! Here's your link: https://example.com"
                disabled={!enabled}
              />
            </div>
          )}

          {showPublicFields && replyChannel === "dm_with_fallback" && (
            <div className="space-y-2">
              <Label htmlFor="fallback-message">Fallback public comment</Label>
              <Textarea
                id="fallback-message"
                rows={3}
                value={fallbackCommentMessage}
                onChange={(e) => setFallbackCommentMessage(e.target.value)}
                placeholder="Happy to help — DM us and we'll send the details!"
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Posted only when a DM cannot be sent (permissions, platform
                limits, etc.)
              </p>
            </div>
          )}

          {replyChannel === "comment" && (
            <div className="space-y-2">
              <Label htmlFor="reply-message">Public reply message</Label>
              <Textarea
                id="reply-message"
                rows={4}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Thanks {{author}}! Link: https://yoursite.com/page"
                disabled={!enabled}
              />
            </div>
          )}

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
          </div>

          {isIgFb && enabled && showDmFields && (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Instagram and Facebook: LateWiz uses Zernio private reply (DM in
              inbox) when possible, and can sync a server-side comment-to-DM
              automation for keyword triggers.
            </p>
          )}

          {!isIgFb && enabled && showDmFields && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              DM availability varies by platform (follower settings, connection
              requirements, etc.). Use &quot;DM with public fallback&quot; on
              LinkedIn, TikTok, X, and similar networks.
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
