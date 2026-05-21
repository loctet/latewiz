"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { parseISO } from "date-fns/parseISO";
import { toast } from "sonner";
import {
  useCommentedPosts,
  usePostComments,
  useReplyToComment,
  useHideComment,
  useDeleteInboxComment,
  useRunAutoReplyScan,
  useAutoReplyScanner,
} from "@/hooks";
import { useAutoReplyStore, useAutoReplyRuleForPost } from "@/stores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { PLATFORM_NAMES, type Platform } from "@/lib/late-api";
import type { CommentedPost, InboxComment } from "@/lib/zernio-api";
import { cn } from "@/lib/utils";
import { CommentThread } from "./_components/comment-thread";
import { AutoReplyDialog } from "./_components/auto-reply-dialog";
import {
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Send,
  Bot,
} from "lucide-react";

export default function CommentsPage() {
  const [selectedPost, setSelectedPost] = useState<CommentedPost | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [replyText, setReplyText] = useState("");
  const [replyToComment, setReplyToComment] = useState<InboxComment | null>(null);
  const [autoReplyOpen, setAutoReplyOpen] = useState(false);
  const [hidePendingId, setHidePendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const global = useAutoReplyStore((s) => s.global);
  const setScannerEnabled = useAutoReplyStore((s) => s.setScannerEnabled);
  const hydrateFromStorage = useAutoReplyStore((s) => s.hydrateFromStorage);

  const { data: postsData, isLoading: postsLoading, refetch } = useCommentedPosts({
    platform: platformFilter === "all" ? undefined : platformFilter,
  });

  const { data: commentsData, isLoading: commentsLoading } = usePostComments(
    selectedPost?.id ?? null,
    selectedPost?.accountId ?? null
  );

  const replyMutation = useReplyToComment();
  const hideMutation = useHideComment();
  const deleteMutation = useDeleteInboxComment();
  const scanMutation = useRunAutoReplyScan();

  const posts = postsData?.posts ?? [];

  const platformByPostId = useMemo(
    () =>
      Object.fromEntries(posts.map((p) => [p.id, String(p.platform)])),
    [posts]
  );

  useAutoReplyScanner(90_000, platformByPostId);
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);
  const rules = useAutoReplyStore((s) => s.rules);
  const rule = useAutoReplyRuleForPost(selectedPost?.id ?? null);
  const rulesByPostId = useMemo(
    () => new Map(rules.map((r) => [r.inboxPostId, r])),
    [rules]
  );

  const filteredPosts = useMemo(() => {
    if (platformFilter === "all") return posts;
    return posts.filter((p) => p.platform === platformFilter);
  }, [posts, platformFilter]);

  const handleSelectPost = (post: CommentedPost) => {
    setSelectedPost(post);
    setReplyToComment(null);
    setReplyText("");
  };

  const handleSendReply = async () => {
    if (!selectedPost || !replyText.trim()) return;
    try {
      await replyMutation.mutateAsync({
        postId: selectedPost.id,
        accountId: selectedPost.accountId,
        message: replyText.trim(),
        commentId: replyToComment?.id,
      });
      toast.success("Reply sent");
      setReplyText("");
      setReplyToComment(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    }
  };

  const handleHide = async (comment: InboxComment) => {
    if (!selectedPost) return;
    setHidePendingId(comment.id);
    try {
      await hideMutation.mutateAsync({
        postId: selectedPost.id,
        commentId: comment.id,
        accountId: selectedPost.accountId,
      });
      toast.success("Comment hidden");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to hide comment");
    } finally {
      setHidePendingId(null);
    }
  };

  const handleDelete = async (comment: InboxComment) => {
    if (!selectedPost) return;
    setDeletePendingId(comment.id);
    try {
      await deleteMutation.mutateAsync({
        postId: selectedPost.id,
        commentId: comment.id,
        accountId: selectedPost.accountId,
      });
      toast.success("Comment deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setDeletePendingId(null);
    }
  };

  const handleManualScan = async () => {
    try {
      const result = await scanMutation.mutateAsync(platformByPostId);
      if (result.replied > 0) {
        const parts: string[] = [];
        if (result.dmSent > 0) parts.push(`${result.dmSent} DM(s)`);
        if (result.commentReplied > 0) {
          parts.push(`${result.commentReplied} public reply(s)`);
        }
        toast.success(`Sent ${parts.join(" and ")}`);
        void refetch();
      } else if (result.errors.length) {
        toast.error(result.errors[0]);
      } else {
        toast.message("No new comments to auto-reply");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const postPreview =
    selectedPost?.content ??
    selectedPost?.caption ??
    selectedPost?.message ??
    "";

  const commentCount =
    selectedPost?.commentCount ??
    selectedPost?.commentsCount ??
    0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comments</h1>
          <p className="text-sm text-muted-foreground">
            Read, reply, and auto-respond to post comments via Zernio Inbox
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Bot className="h-4 w-4 text-primary" />
            <Label htmlFor="scanner" className="text-xs cursor-pointer">
              Background scanner
            </Label>
            <Switch
              id="scanner"
              checked={global.scannerEnabled}
              onCheckedChange={setScannerEnabled}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualScan}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Run auto-reply
          </Button>
        </div>
      </div>

      {global.lastScanAt && (
        <p className="text-xs text-muted-foreground">
          Last scan{" "}
          {formatDistanceToNow(parseISO(global.lastScanAt), { addSuffix: true })}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base">Posts with comments</CardTitle>
            <CardDescription>
              Select a post to view its thread
            </CardDescription>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="mt-2 h-9">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {(["instagram", "facebook", "youtube", "linkedin", "tiktok", "twitter"] as Platform[]).map(
                  (p) => (
                    <SelectItem key={p} value={p}>
                      {PLATFORM_NAMES[p]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[min(70vh,560px)]">
              {postsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredPosts.length ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No commented posts found. Published posts with engagement will
                  appear here.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {filteredPosts.map((post) => {
                    const active = selectedPost?.id === post.id;
                    const postRule = rulesByPostId.get(post.id);
                    const count =
                      post.commentCount ?? post.commentsCount ?? 0;
                    return (
                      <li key={post.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectPost(post)}
                          className={cn(
                            "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            active && "bg-primary/5 border-l-2 border-l-primary"
                          )}
                        >
                          <PlatformIcon
                            platform={post.platform as Platform}
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm">
                              {post.content ??
                                post.caption ??
                                post.message ??
                                "Post"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {count} comments
                              </Badge>
                              {postRule?.enabled && (
                                <Badge className="text-[10px] gap-0.5">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  {postRule.replyChannel === "comment"
                                    ? "Auto"
                                    : "Auto DM"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex min-h-[min(70vh,560px)] flex-col border-border/80 shadow-sm">
          {!selectedPost ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a post to manage comments</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border/60 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PlatformIcon
                      platform={selectedPost.platform as Platform}
                      className="h-5 w-5"
                    />
                    <div>
                      <CardTitle className="text-base line-clamp-2">
                        {postPreview || "Post thread"}
                      </CardTitle>
                      <CardDescription>
                        {commentCount} comments ·{" "}
                        {PLATFORM_NAMES[selectedPost.platform as Platform] ??
                          selectedPost.platform}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant={rule?.enabled ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAutoReplyOpen(true)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {rule?.enabled && rule.replyChannel !== "comment"
                      ? "Auto DM"
                      : "Auto-reply"}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
                <ScrollArea className="flex-1 pr-3">
                  <CommentThread
                    comments={commentsData?.comments ?? []}
                    isLoading={commentsLoading}
                    onReply={(c) => {
                      setReplyToComment(c);
                      setReplyText(
                        (prev) =>
                          prev ||
                          `@${c.from?.username ?? c.from?.name ?? ""} `
                      );
                    }}
                    onHide={handleHide}
                    onDelete={handleDelete}
                    hidePendingId={hidePendingId}
                    deletePendingId={deletePendingId}
                  />
                </ScrollArea>

                <div className="shrink-0 space-y-2 border-t border-border pt-4">
                  {replyToComment && (
                    <p className="text-xs text-muted-foreground">
                      Replying to{" "}
                      <span className="font-medium text-foreground">
                        {replyToComment.from?.name ??
                          replyToComment.from?.username}
                      </span>
                      <Button
                        variant="link"
                        className="h-auto p-0 ml-1 text-xs"
                        onClick={() => setReplyToComment(null)}
                      >
                        Clear
                      </Button>
                    </p>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Write a reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!replyText.trim() || replyMutation.isPending}
                    onClick={handleSendReply}
                  >
                    {replyMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send reply
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <AutoReplyDialog
        post={selectedPost}
        open={autoReplyOpen}
        onOpenChange={setAutoReplyOpen}
      />
    </div>
  );
}
