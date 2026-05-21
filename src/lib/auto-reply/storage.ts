import type { AutoReplySentRecord, PostAutoReplyRule } from "./types";

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
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
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
  const next = { ...rule, updatedAt: new Date().toISOString() };
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
  return readStore().rules.filter(
    (r) => r.enabled && r.replyMessage.trim().length > 0
  );
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
  writeSent([...readSent(), record]);
}

export function hasRecentlyReplied(
  inboxPostId: string,
  commentId: string,
  commenterId: string | undefined,
  cooldownMinutes: number
): boolean {
  const cutoff = Date.now() - cooldownMinutes * 60_000;
  return readSent().some((r) => {
    if (r.inboxPostId !== inboxPostId) return false;
    const sentAt = new Date(r.sentAt).getTime();
    if (sentAt < cutoff) return false;
    if (r.commentId === commentId) return true;
    if (commenterId && r.commenterId === commenterId) return true;
    return false;
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
