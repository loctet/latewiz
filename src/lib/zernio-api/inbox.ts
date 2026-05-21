import { zernioRequest } from "./client";
import type {
  CommentAutomation,
  CreateCommentAutomationInput,
  GetPostCommentsResponse,
  ListCommentedPostsResponse,
  ReplyToCommentInput,
} from "./types";

export async function listCommentedPosts(
  apiKey: string,
  query: {
    profileId?: string;
    accountId?: string;
    platform?: string;
    page?: number;
    limit?: number;
  }
) {
  return zernioRequest<ListCommentedPostsResponse>(apiKey, "/inbox/comments", {
    query,
  });
}

export async function getPostComments(
  apiKey: string,
  postId: string,
  query: {
    accountId: string;
    limit?: number;
    cursor?: string;
  }
) {
  return zernioRequest<GetPostCommentsResponse>(
    apiKey,
    `/inbox/comments/${encodeURIComponent(postId)}`,
    { query }
  );
}

export async function replyToComment(
  apiKey: string,
  postId: string,
  body: ReplyToCommentInput
) {
  return zernioRequest<{ success?: boolean; data?: unknown }>(
    apiKey,
    `/inbox/comments/${encodeURIComponent(postId)}`,
    { method: "POST", body }
  );
}

export async function hideComment(
  apiKey: string,
  postId: string,
  commentId: string,
  accountId: string
) {
  return zernioRequest(
    apiKey,
    `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/hide`,
    { method: "POST", body: { accountId } }
  );
}

export async function deleteComment(
  apiKey: string,
  postId: string,
  query: { accountId: string; commentId: string }
) {
  return zernioRequest(
    apiKey,
    `/inbox/comments/${encodeURIComponent(postId)}`,
    { method: "DELETE", query }
  );
}

export async function listCommentAutomations(
  apiKey: string,
  query: { profileId: string }
) {
  return zernioRequest<{ automations?: CommentAutomation[] }>(
    apiKey,
    "/comment-automations",
    { query }
  );
}

export async function createCommentAutomation(
  apiKey: string,
  body: CreateCommentAutomationInput
) {
  return zernioRequest<{ automation?: CommentAutomation }>(
    apiKey,
    "/comment-automations",
    { method: "POST", body }
  );
}

export async function updateCommentAutomation(
  apiKey: string,
  automationId: string,
  body: Partial<CreateCommentAutomationInput> & { isActive?: boolean }
) {
  return zernioRequest<{ automation?: CommentAutomation }>(
    apiKey,
    `/comment-automations/${encodeURIComponent(automationId)}`,
    { method: "PATCH", body }
  );
}

export async function deleteCommentAutomation(
  apiKey: string,
  automationId: string
) {
  return zernioRequest(
    apiKey,
    `/comment-automations/${encodeURIComponent(automationId)}`,
    { method: "DELETE" }
  );
}
