import { create } from "zustand";
import type { AutoReplyGlobalSettings, PostAutoReplyRule } from "@/lib/auto-reply";
import {
  deleteAutoReplyRule,
  getAutoReplyRule,
  getAutoReplyRules,
  getGlobalAutoReplySettings,
  loadAutoReplyState,
  setGlobalAutoReplySettings,
  upsertAutoReplyRule,
} from "@/lib/auto-reply/storage";

interface AutoReplyState {
  rules: PostAutoReplyRule[];
  global: AutoReplyGlobalSettings;
  hydrateFromStorage: () => void;
  setRule: (rule: PostAutoReplyRule) => PostAutoReplyRule;
  removeRule: (inboxPostId: string) => void;
  setScannerEnabled: (enabled: boolean) => void;
}

export const useAutoReplyStore = create<AutoReplyState>()((set) => ({
  rules: [],
  global: { scannerEnabled: false },

  hydrateFromStorage: () => {
    const { rules, global } = loadAutoReplyState();
    set({ rules, global });
  },

  setRule: (rule) => {
    const saved = upsertAutoReplyRule(rule);
    set({ rules: getAutoReplyRules() });
    return saved;
  },

  removeRule: (inboxPostId) => {
    deleteAutoReplyRule(inboxPostId);
    set({ rules: getAutoReplyRules() });
  },

  setScannerEnabled: (enabled) => {
    const global = { ...getGlobalAutoReplySettings(), scannerEnabled: enabled };
    setGlobalAutoReplySettings(global);
    set({ global });
  },
}));

export function useAutoReplyRuleForPost(inboxPostId: string | null) {
  const rules = useAutoReplyStore((s) => s.rules);
  if (!inboxPostId) return undefined;
  return rules.find((r) => r.inboxPostId === inboxPostId) ?? getAutoReplyRule(inboxPostId);
}
