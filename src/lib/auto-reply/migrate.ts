import type { PostAutoReplyRule } from "./types";

/** Normalize rules saved before replyChannel existed */
export function normalizeAutoReplyRule(
  rule: Partial<PostAutoReplyRule> & Pick<PostAutoReplyRule, "inboxPostId" | "accountId">
): PostAutoReplyRule {
  return {
    inboxPostId: rule.inboxPostId,
    accountId: rule.accountId,
    platform: rule.platform,
    platformPostId: rule.platformPostId,
    enabled: rule.enabled ?? false,
    replyMessage: rule.replyMessage ?? "",
    dmMessage: rule.dmMessage,
    fallbackCommentMessage: rule.fallbackCommentMessage,
    replyChannel: rule.replyChannel ?? "comment",
    topLevelOnly: rule.topLevelOnly ?? true,
    keywords: rule.keywords ?? [],
    cooldownMinutes: rule.cooldownMinutes ?? 60,
    zernioAutomationId: rule.zernioAutomationId,
    updatedAt: rule.updatedAt ?? new Date().toISOString(),
  };
}
