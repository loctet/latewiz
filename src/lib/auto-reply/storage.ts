import type { AutoReplySentRecord, PostAutoReplyRule } from "./types";
import { normalizeAutoReplyRule } from "./migrate";

const STORE_KEY = "latewiz-auto-reply";
const SENT_KEY = "latewiz-auto-reply-sent";

export interface AutoReplyGlobalSettings {
  scannerEnabled: boolean;
  lastScanAt?: string;
}

interface AutoReplyStoreData {
  rules: PostAutoReplyRule[];
  global: AutoReplyGlobalSettings;
}

function readStore(): AutoReplyStoreData {
  if (typeof window === "undefined") {
    return { rules: [], global: { scannerEnabled: false } };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { rules: [], global: { scannerEnabled: false } };
    const parsed = JSON.parse(raw) as Partial<AutoReplyStoreData>;
    return {
      rules: Array.isArray(parsed.rules)
        ? parsed.rules.map((r) =>
            normalizeAutoReplyRule(r as PostAutoReplyRule)
          )
        : [],
      global: parsed.global ?? { scannerEnabled: false },
    };
  } catch {
    return { rules: [], global: { scannerEnabled: false } };
  }
}

function writeStore(data: AutoReplyStoreData) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

export function getAutoReplyRules(): PostAutoReplyRule[] {
  return readStore().rules;
}

export function getAutoReplyRule(inboxPostId: string): PostAutoReplyRule | undefined {
  return readStore().rules.find((r) => r.inboxPostId === inboxPostId);
}

export function upsertAutoReplyRule(rule: PostAutoReplyRule): PostAutoReplyRule {
  const store = readStore();
  const idx = store.rules.findIndex((r) => r.inboxPostId === rule.inboxPostId);
  const next = normalizeAutoReplyRule({
    ...rule,
    updatedAt: new Date().toISOString(),
  });
  if (idx >= 0) {
    store.rules[idx] = next;
  } else {
    store.rules.push(next);
  }
  writeStore(store);
  return next;
}

export function deleteAutoReplyRule(inboxPostId: string) {
  const store = readStore();
  store.rules = store.rules.filter((r) => r.inboxPostId !== inboxPostId);
  writeStore(store);
}

export function getEnabledAutoReplyRules(): PostAutoReplyRule[] {
  return readStore().rules.filter((r) => {
    if (!r.enabled) return false;
    const hasComment = r.replyMessage.trim().length > 0;
    const hasDm = (r.dmMessage?.trim() || r.replyMessage.trim()).length > 0;
    return r.replyChannel === "comment" ? hasComment : hasDm;
  });
}

function readSent(): AutoReplySentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AutoReplySentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSent(records: AutoReplySentRecord[]) {
  localStorage.setItem(SENT_KEY, JSON.stringify(records.slice(-5000)));
}

export function recordAutoReplySent(record: AutoReplySentRecord) {
  const existing = readSent();
  const dup = existing.some(
    (r) =>
      r.inboxPostId === record.inboxPostId &&
      r.commentId === record.commentId &&
      (r.channel === record.channel ||
        (!r.channel && !record.channel))
  );
  if (dup) return;
  writeSent([...existing, record]);
}

/** Permanent: this comment was already auto-replied on the thread (public). */
export function hasAutoReplyCommentSent(
  inboxPostId: string,
  commentId: string
): boolean {
  return readSent().some(
    (r) =>
      r.inboxPostId === inboxPostId &&
      r.commentId === commentId &&
      (r.channel === "comment" || r.channel === undefined)
  );
}

/** Permanent: this comment already received an auto-reply DM. */
export function hasAutoReplyDmSent(
  inboxPostId: string,
  commentId: string
): boolean {
  return readSent().some(
    (r) =>
      r.inboxPostId === inboxPostId &&
      r.commentId === commentId &&
      (r.channel === "dm" || r.channel === undefined)
  );
}

/** Permanent: any auto-reply was sent for this comment (DM and/or public). */
export function hasAnyAutoReplyForComment(
  inboxPostId: string,
  commentId: string
): boolean {
  return readSent().some(
    (r) => r.inboxPostId === inboxPostId && r.commentId === commentId
  );
}

/** Cooldown applies to other comments from the same person on the same post. */
export function hasRecentAutoReplyToCommenter(
  inboxPostId: string,
  commentId: string,
  commenterId: string | undefined,
  cooldownMinutes: number
): boolean {
  if (!commenterId || cooldownMinutes <= 0) return false;
  const cutoff = Date.now() - cooldownMinutes * 60_000;
  return readSent().some((r) => {
    if (r.inboxPostId !== inboxPostId) return false;
    if (r.commentId === commentId) return false;
    if (r.commenterId !== commenterId) return false;
    return new Date(r.sentAt).getTime() >= cutoff;
  });
}

export function getGlobalAutoReplySettings(): AutoReplyGlobalSettings {
  return readStore().global;
}

export function setGlobalAutoReplySettings(settings: AutoReplyGlobalSettings) {
  const store = readStore();
  store.global = settings;
  writeStore(store);
}

export function loadAutoReplyState(): AutoReplyStoreData {
  return readStore();
}
