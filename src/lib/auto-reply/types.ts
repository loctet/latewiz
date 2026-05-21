/** How to respond when auto-reply triggers */
export type AutoReplyChannel =
  | "comment"
  | "dm"
  | "dm_with_fallback";

export interface PostAutoReplyRule {
  /** Inbox post id from Zernio (GET /inbox/comments row id) */
  inboxPostId: string;
  accountId: string;
  platform?: string;
  platformPostId?: string;
  enabled: boolean;
  /** Public comment reply text */
  replyMessage: string;
  /** DM text; defaults to replyMessage when empty */
  dmMessage?: string;
  /** Public comment when DM is not allowed (dm_with_fallback only) */
  fallbackCommentMessage?: string;
  replyChannel: AutoReplyChannel;
  topLevelOnly: boolean;
  keywords: string[];
  cooldownMinutes: number;
  zernioAutomationId?: string;
  updatedAt: string;
}

export interface AutoReplySentRecord {
  commentId: string;
  inboxPostId: string;
  commenterId?: string;
  channel: "comment" | "dm";
  sentAt: string;
}

export interface AutoReplyScanResult {
  scanned: number;
  replied: number;
  dmSent: number;
  commentReplied: number;
  skipped: number;
  errors: string[];
}
