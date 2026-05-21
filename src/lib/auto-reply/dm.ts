import {
  createInboxConversation,
  replyToComment,
  sendPrivateReplyToComment,
  ZernioApiError,
} from "@/lib/zernio-api";
import type { InboxComment } from "@/lib/zernio-api";
import type { PostAutoReplyRule } from "./types";
import { formatReplyMessage, getCommenterId } from "./comments";

const META_PLATFORMS = new Set(["instagram", "facebook"]);

export function getDmMessage(rule: PostAutoReplyRule, comment: InboxComment): string {
  const template = (rule.dmMessage?.trim() || rule.replyMessage).trim();
  return formatReplyMessage(template, comment);
}

export function getFallbackCommentMessage(
  rule: PostAutoReplyRule,
  comment: InboxComment
): string {
  const template = (
    rule.fallbackCommentMessage?.trim() ||
    "Thanks for commenting! Please DM us and we'll send the details."
  ).trim();
  return formatReplyMessage(template, comment);
}

function isDmNotAllowedError(err: unknown): boolean {
  if (!(err instanceof ZernioApiError)) return false;
  if (err.status === 403 || err.status === 422) return true;
  const body = err.body as { code?: string; error?: string; message?: string } | undefined;
  const code = body?.code ?? "";
  const msg = `${body?.error ?? ""} ${body?.message ?? ""} ${err.message}`.toLowerCase();
  return (
    code === "DM_NOT_ALLOWED" ||
    msg.includes("dm_not_allowed") ||
    msg.includes("cannot message") ||
    msg.includes("dm permission")
  );
}

export async function sendAutoReplyDm(
  apiKey: string,
  rule: PostAutoReplyRule,
  postId: string,
  comment: InboxComment,
  platform?: string
): Promise<void> {
  const message = getDmMessage(rule, comment);
  const platformKey = (platform ?? rule.platform ?? "").toLowerCase();

  if (META_PLATFORMS.has(platformKey)) {
    await sendPrivateReplyToComment(apiKey, postId, comment.id, {
      accountId: rule.accountId,
      message,
    });
    return;
  }

  const username = comment.from?.username;
  const participantId = comment.from?.id;

  if (!username && !participantId) {
    throw new ZernioApiError(
      "Comment has no author id or username for DM",
      422
    );
  }

  await createInboxConversation(apiKey, {
    accountId: rule.accountId,
    message,
    participantUsername: username,
    participantId,
  });
}

export async function sendAutoReplyWithChannel(
  apiKey: string,
  rule: PostAutoReplyRule,
  postId: string,
  comment: InboxComment,
  platform?: string
): Promise<"dm" | "comment"> {
  const platformKey = (platform ?? rule.platform ?? "").toLowerCase();

  if (rule.replyChannel === "comment") {
    await replyToComment(apiKey, postId, {
      accountId: rule.accountId,
      message: formatReplyMessage(rule.replyMessage, comment),
      commentId: comment.id,
    });
    return "comment";
  }

  try {
    await sendAutoReplyDm(apiKey, rule, postId, comment, platformKey);
    return "dm";
  } catch (err) {
    if (rule.replyChannel !== "dm_with_fallback") throw err;
    if (!isDmNotAllowedError(err)) throw err;

    const fallback = getFallbackCommentMessage(rule, comment);
    await replyToComment(apiKey, postId, {
      accountId: rule.accountId,
      message: fallback,
      commentId: comment.id,
    });
    return "comment";
  }
}
