"use client";

import { formatDistanceToNow } from "date-fns";
import { parseISO } from "date-fns/parseISO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  flattenComments,
  getCommentText,
  isTopLevelComment,
} from "@/lib/auto-reply/comments";
import type { InboxComment } from "@/lib/zernio-api";
import { cn } from "@/lib/utils";
import { EyeOff, Loader2, MessageSquare, Reply, Trash2 } from "lucide-react";

interface CommentThreadProps {
  comments: InboxComment[];
  isLoading?: boolean;
  onReply: (comment: InboxComment) => void;
  onHide?: (comment: InboxComment) => void;
  onDelete?: (comment: InboxComment) => void;
  hidePendingId?: string | null;
  deletePendingId?: string | null;
}

function CommentRow({
  comment,
  depth,
  onReply,
  onHide,
  onDelete,
  hidePendingId,
  deletePendingId,
}: {
  comment: InboxComment;
  depth: number;
  onReply: (c: InboxComment) => void;
  onHide?: (c: InboxComment) => void;
  onDelete?: (c: InboxComment) => void;
  hidePendingId?: string | null;
  deletePendingId?: string | null;
}) {
  const text = getCommentText(comment);
  const author =
    comment.from?.name ?? comment.from?.username ?? "Unknown";
  const when = comment.createdAt ?? comment.timestamp;
  const topLevel = isTopLevelComment(comment);

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-4 border-l border-border pl-3")}>
      <div className="rounded-lg border border-border/80 bg-card/60 p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{author}</span>
              {topLevel && (
                <Badge variant="secondary" className="text-[10px]">
                  Top level
                </Badge>
              )}
              {comment.hasReply && (
                <Badge variant="outline" className="text-[10px]">
                  Replied
                </Badge>
              )}
              {comment.isHidden && (
                <Badge variant="destructive" className="text-[10px]">
                  Hidden
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>
            {when && (
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(parseISO(when), { addSuffix: true })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => onReply(comment)}
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </Button>
            {onHide && !comment.isHidden && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={hidePendingId === comment.id}
                onClick={() => onHide(comment)}
              >
                {hidePendingId === comment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                disabled={deletePendingId === comment.id}
                onClick={() => onDelete(comment)}
              >
                {deletePendingId === comment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          onReply={onReply}
          onHide={onHide}
          onDelete={onDelete}
          hidePendingId={hidePendingId}
          deletePendingId={deletePendingId}
        />
      ))}
    </div>
  );
}

export function CommentThread({
  comments,
  isLoading,
  onReply,
  onHide,
  onDelete,
  hidePendingId,
  deletePendingId,
}: CommentThreadProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading comments…</span>
      </div>
    );
  }

  const tree = comments.length ? comments : [];
  const flat = flattenComments(tree);

  if (!flat.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm">No comments on this post yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tree.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          depth={0}
          onReply={onReply}
          onHide={onHide}
          onDelete={onDelete}
          hidePendingId={hidePendingId}
          deletePendingId={deletePendingId}
        />
      ))}
    </div>
  );
}
