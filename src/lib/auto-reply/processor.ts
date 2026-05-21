import { getPostComments, replyToComment } from "@/lib/zernio-api";
import type { InboxComment } from "@/lib/zernio-api";
import {
  flattenComments,
  formatReplyMessage,
  getCommentText,
  getCommenterId,
  isTopLevelComment,
  matchesKeywords,
} from "./comments";
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

  if (comment.hasReply) {
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

async function processRule(
  apiKey: string,
  rule: PostAutoReplyRule
): Promise<AutoReplyScanResult> {
  const result: AutoReplyScanResult = {
    scanned: 0,
    replied: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const res = await getPostComments(apiKey, rule.inboxPostId, {
      accountId: rule.accountId,
      limit: 100,
    });
    const comments = flattenComments(res.comments ?? []);
    result.scanned = comments.length;

    for (const comment of comments) {
      const check = shouldReplyToComment(comment, rule);
      if (!check.ok) {
        result.skipped++;
        continue;
      }

      const message = formatReplyMessage(rule.replyMessage, comment);
      try {
        await replyToComment(apiKey, rule.inboxPostId, {
          accountId: rule.accountId,
          message,
          commentId: comment.id,
        });
        recordAutoReplySent({
          commentId: comment.id,
          inboxPostId: rule.inboxPostId,
          commenterId: getCommenterId(comment),
          sentAt: new Date().toISOString(),
        });
        result.replied++;
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
  apiKey: string
): Promise<AutoReplyScanResult> {
  const rules = getEnabledAutoReplyRules();
  const aggregate: AutoReplyScanResult = {
    scanned: 0,
    replied: 0,
    skipped: 0,
    errors: [],
  };

  for (const rule of rules) {
    const partial = await processRule(apiKey, rule);
    aggregate.scanned += partial.scanned;
    aggregate.replied += partial.replied;
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
