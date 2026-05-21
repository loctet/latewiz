export interface PostAutoReplyRule {
  /** Inbox post id from Zernio (GET /inbox/comments row id) */
  inboxPostId: string;
  accountId: string;
  platformPostId?: string;
  enabled: boolean;
  /** Reply text sent to each matching top-level comment */
  replyMessage: string;
  /** Only reply to top-level comments (no thread replies) */
  topLevelOnly: boolean;
  /** Optional comma-separated keywords; empty = all comments */
  keywords: string[];
  /** Minutes before replying to the same commenter again on this post */
  cooldownMinutes: number;
  /** Zernio comment-automation id when synced for Instagram/Facebook */
  zernioAutomationId?: string;
  updatedAt: string;
}

export interface AutoReplySentRecord {
  commentId: string;
  inboxPostId: string;
  commenterId?: string;
  sentAt: string;
}

export interface AutoReplyScanResult {
  scanned: number;
  replied: number;
  skipped: number;
  errors: string[];
}
