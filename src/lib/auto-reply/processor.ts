import { getPostComments } from "@/lib/zernio-api";
import type { InboxComment } from "@/lib/zernio-api";
import {
  flattenComments,
  getCommenterId,
  getCommentText,
  isTopLevelComment,
  matchesKeywords,
} from "./comments";
import { sendAutoReplyWithChannel } from "./dm";
import {
  getEnabledAutoReplyRules,
  hasRecentlyReplied,
  recordAutoReplySent,
  setGlobalAutoReplySettings,
  getGlobalAutoReplySettings,
} from "./storage";
import type { AutoReplyScanResult, PostAutoReplyRule } from "./types";

function shouldReplyToComment(
  comment: InboxComment,
  rule: PostAutoReplyRule
): { ok: boolean; reason?: string } {
  const text = getCommentText(comment);
  if (!text) return { ok: false, reason: "empty" };

  if (rule.topLevelOnly && !isTopLevelComment(comment)) {
    return { ok: false, reason: "not-top-level" };
  }

  if (comment.hasReply && rule.replyChannel === "comment") {
    return { ok: false, reason: "already-replied" };
  }

  if (!matchesKeywords(text, rule.keywords)) {
    return { ok: false, reason: "keyword-mismatch" };
  }

  const commenterId = getCommenterId(comment);
  if (
    hasRecentlyReplied(
      rule.inboxPostId,
      comment.id,
      commenterId,
      rule.cooldownMinutes
    )
  ) {
    return { ok: false, reason: "cooldown" };
  }

  return { ok: true };
}

function emptyResult(): AutoReplyScanResult {
  return {
    scanned: 0,
    replied: 0,
    dmSent: 0,
    commentReplied: 0,
    skipped: 0,
    errors: [],
  };
}

async function processRule(
  apiKey: string,
  rule: PostAutoReplyRule,
  platform?: string
): Promise<AutoReplyScanResult> {
  const result = emptyResult();

  try {
    const res = await getPostComments(apiKey, rule.inboxPostId, {
      accountId: rule.accountId,
      limit: 100,
    });
    const comments = flattenComments(res.comments ?? []);
    const resolvedPlatform =
      platform ?? rule.platform ?? res.meta?.platform ?? "";
    result.scanned = comments.length;

    for (const comment of comments) {
      const check = shouldReplyToComment(comment, rule);
      if (!check.ok) {
        result.skipped++;
        continue;
      }

      try {
        const channel = await sendAutoReplyWithChannel(
          apiKey,
          rule,
          rule.inboxPostId,
          comment,
          resolvedPlatform
        );
        recordAutoReplySent({
          commentId: comment.id,
          inboxPostId: rule.inboxPostId,
          commenterId: getCommenterId(comment),
          channel,
          sentAt: new Date().toISOString(),
        });
        result.replied++;
        if (channel === "dm") result.dmSent++;
        else result.commentReplied++;
      } catch (err) {
        result.errors.push(
          `${comment.id}: ${err instanceof Error ? err.message : "reply failed"}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : "Failed to load comments"
    );
  }

  return result;
}

export async function runAutoReplyScan(
  apiKey: string,
  platformByPostId?: Record<string, string>
): Promise<AutoReplyScanResult> {
  const rules = getEnabledAutoReplyRules();
  const aggregate = emptyResult();

  for (const rule of rules) {
    const platform = platformByPostId?.[rule.inboxPostId] ?? rule.platform;
    const partial = await processRule(apiKey, rule, platform);
    aggregate.scanned += partial.scanned;
    aggregate.replied += partial.replied;
    aggregate.dmSent += partial.dmSent;
    aggregate.commentReplied += partial.commentReplied;
    aggregate.skipped += partial.skipped;
    aggregate.errors.push(...partial.errors);
  }

  const global = getGlobalAutoReplySettings();
  setGlobalAutoReplySettings({
    ...global,
    lastScanAt: new Date().toISOString(),
  });

  return aggregate;
}
