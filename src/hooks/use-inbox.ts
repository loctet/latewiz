import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores";
import { useCurrentProfileId } from "./use-profiles";
import {
  deleteComment,
  getPostComments,
  hideComment,
  listCommentedPosts,
  replyToComment,
} from "@/lib/zernio-api";
import type { ReplyToCommentInput } from "@/lib/zernio-api";

export const inboxKeys = {
  all: ["inbox"] as const,
  posts: () => ["inbox", "posts"] as const,
  postList: (filters: InboxPostFilters) => ["inbox", "posts", filters] as const,
  comments: (postId: string, accountId: string) =>
    ["inbox", "comments", postId, accountId] as const,
};

export interface InboxPostFilters {
  profileId?: string;
  accountId?: string;
  platform?: string;
  page?: number;
  limit?: number;
}

export function useCommentedPosts(filters: InboxPostFilters = {}) {
  const apiKey = useAuthStore((s) => s.apiKey);
  const currentProfileId = useCurrentProfileId();
  const profileId = filters.profileId ?? currentProfileId ?? undefined;

  return useQuery({
    queryKey: inboxKeys.postList({ ...filters, profileId }),
    queryFn: async () => {
      if (!apiKey) throw new Error("Not authenticated");
      const res = await listCommentedPosts(apiKey, {
        profileId,
        accountId: filters.accountId,
        platform: filters.platform,
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
      });
      const posts = res.data ?? res.posts ?? [];
      return { posts, pagination: res.pagination };
    },
    enabled: !!apiKey && !!profileId,
  });
}

export function usePostComments(
  postId: string | null,
  accountId: string | null
) {
  const apiKey = useAuthStore((s) => s.apiKey);

  return useQuery({
    queryKey: inboxKeys.comments(postId ?? "", accountId ?? ""),
    queryFn: async () => {
      if (!apiKey || !postId || !accountId) throw new Error("Missing params");
      return getPostComments(apiKey, postId, { accountId, limit: 100 });
    },
    enabled: !!apiKey && !!postId && !!accountId,
    refetchInterval: 30_000,
  });
}

export function useReplyToComment() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      ...body
    }: ReplyToCommentInput & { postId: string }) => {
      if (!apiKey) throw new Error("Not authenticated");
      return replyToComment(apiKey, postId, body);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: inboxKeys.comments(vars.postId, vars.accountId),
      });
      queryClient.invalidateQueries({ queryKey: inboxKeys.posts() });
    },
  });
}

export function useHideComment() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      commentId,
      accountId,
    }: {
      postId: string;
      commentId: string;
      accountId: string;
    }) => {
      if (!apiKey) throw new Error("Not authenticated");
      return hideComment(apiKey, postId, commentId, accountId);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: inboxKeys.comments(vars.postId, vars.accountId),
      });
    },
  });
}

export function useDeleteInboxComment() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      commentId,
      accountId,
    }: {
      postId: string;
      commentId: string;
      accountId: string;
    }) => {
      if (!apiKey) throw new Error("Not authenticated");
      return deleteComment(apiKey, postId, { accountId, commentId });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: inboxKeys.comments(vars.postId, vars.accountId),
      });
      queryClient.invalidateQueries({ queryKey: inboxKeys.posts() });
    },
  });
}
