"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";
import { Loader2, ChevronLeft, ChevronRight, Trash2, Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePosts, postKeys } from "@/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PlatformIcons, PostStatusBadge } from "@/components/posts";
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

const PAGE_SIZE = 25;

type PostRow = {
  _id: string;
  content?: string;
  status?: string;
  scheduledFor?: string;
  createdAt?: string;
  platforms?: Array<{ platform?: string; status?: string }>;
  mediaItems?: Array<{ type: "image" | "video"; url: string }>;
};

function parsePageParam(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export default function PostsAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);

  const page = parsePageParam(searchParams.get("page"));
  const { data, isLoading } = usePosts({ page, limit: PAGE_SIZE });
  const posts = useMemo(() => ((data?.posts ?? []) as PostRow[]), [data?.posts]);
  const pagination = data?.pagination as
    | { page?: number; limit?: number; total?: number; hasMore?: boolean }
    | undefined;

  const allSelectedOnPage = posts.length > 0 && posts.every((post) => selectedIds.has(post._id));
  const selectedCount = selectedIds.size;
  const totalCount = pagination?.total ?? posts.length;
  const canGoNext = Boolean(pagination?.hasMore ?? (posts.length === PAGE_SIZE));
  const canGoPrev = page > 1;

  const bulkDeleteMutation = useMutation({
    mutationFn: async (postIds: string[]) => {
      const payload = {
        posts: posts
          .filter((post) => postIds.includes(post._id))
          .map((post) => ({
            postId: post._id,
            status: post.status,
            platforms: post.platforms ?? [],
          })),
      };

      const response = await fetch("/api/posts/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to delete selected posts");
      }
      return json as {
        success: boolean;
        successCount: number;
        failureCount: number;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      setSelectedIds(new Set());
      setConfirmDeleteOpen(false);

      if (result.failureCount > 0) {
        toast.warning(
          `${result.successCount} deleted/unpublished, ${result.failureCount} failed`
        );
        return;
      }
      toast.success(`Deleted ${result.successCount} post${result.successCount === 1 ? "" : "s"}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete selected posts";
      toast.error(message);
    },
  });

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`/dashboard/posts-all?${params.toString()}`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedIds);
      for (const post of posts) next.add(post._id);
      setSelectedIds(next);
      return;
    }

    const next = new Set(selectedIds);
    for (const post of posts) next.delete(post._id);
    setSelectedIds(next);
  };

  const toggleSelectOne = (postId: string, checked: boolean, shiftKey = false) => {
    const postIdsOnPage = posts.map((post) => post._id);
    const next = new Set(selectedIds);

    if (shiftKey && lastToggledId && lastToggledId !== postId) {
      const start = postIdsOnPage.indexOf(lastToggledId);
      const end = postIdsOnPage.indexOf(postId);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        const idsInRange = postIdsOnPage.slice(from, to + 1);
        for (const id of idsInRange) {
          if (checked) next.add(id);
          else next.delete(id);
        }
      } else if (checked) {
        next.add(postId);
      } else {
        next.delete(postId);
      }
    } else if (checked) {
      next.add(postId);
    } else {
      next.delete(postId);
    }

    setLastToggledId(postId);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">All Posts</h1>
          <p className="text-muted-foreground">
            Review every post, select multiple, and remove from Zernio and posted platforms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={selectedCount === 0 || bulkDeleteMutation.isPending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Delete ({selectedCount})
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/compose">
              <Plus className="mr-1.5 h-4 w-4" />
              New Post
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">All posts</Badge>
            <Badge variant="outline">All platforms</Badge>
            <Badge variant="outline">Page {page}</Badge>
            <Badge variant="outline">{totalCount} total</Badge>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allSelectedOnPage}
                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
              />
              Select page
            </label>
            {selectedCount > 0 && <Badge variant="secondary">{selectedCount} selected</Badge>}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts</CardTitle>
            <CardDescription>No posts found on this page.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {posts.map((post) => {
            const scheduledText = post.scheduledFor
              ? format(parseISO(post.scheduledFor), "MMM d, yyyy, h:mm a")
              : post.createdAt
                ? format(parseISO(post.createdAt), "MMM d, yyyy, h:mm a")
                : "No date";
            const firstMedia = post.mediaItems?.[0];
            const checked = selectedIds.has(post._id);

            return (
              <div
                key={post._id}
                className={`overflow-hidden rounded-xl border bg-card transition-colors ${
                  checked ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
              >
                <div className="relative h-32 bg-muted">
                  {firstMedia ? (
                    firstMedia.type === "video" ? (
                      <video src={firstMedia.url} className="h-full w-full object-cover" />
                    ) : (
                      <img src={firstMedia.url} alt="" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No media
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded bg-background/90 p-1 shadow-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleSelectOne(post._id, Boolean(value))}
                      onClick={(event) => {
                        const checkedValue = !checked;
                        toggleSelectOne(post._id, checkedValue, event.shiftKey);
                        event.preventDefault();
                      }}
                      aria-label="Select post"
                    />
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {post.content || "(No content)"}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <PlatformIcons platforms={(post.platforms as any) || []} size="xs" />
                    <PostStatusBadge status={post.status || "unknown"} />
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span className="truncate">{scheduledText}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => setPage(page + 1)}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected posts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unpublish published posts from supported social platforms, then delete them from Zernio where possible. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              {bulkDeleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete {selectedCount} post{selectedCount === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 animate-pulse">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border">
          <div className="h-32 bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
