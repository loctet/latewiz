import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores";
import { useAutoReplyStore } from "@/stores/auto-reply-store";
import {
  createCommentAutomation,
  deleteCommentAutomation,
  updateCommentAutomation,
} from "@/lib/zernio-api";
import type { PostAutoReplyRule } from "@/lib/auto-reply";
import { runAutoReplyScan } from "@/lib/auto-reply/processor";
import { useCurrentProfileId } from "./use-profiles";

const IG_FB_PLATFORMS = new Set(["instagram", "facebook"]);

export function useSaveAutoReplyRule() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const profileId = useCurrentProfileId();
  const setRule = useAutoReplyStore((s) => s.setRule);

  return useMutation({
    mutationFn: async (input: {
      rule: PostAutoReplyRule;
      platform: string;
      syncZernioAutomation?: boolean;
    }) => {
      const { rule, platform, syncZernioAutomation = true } = input;
      let zernioAutomationId = rule.zernioAutomationId;

      if (
        syncZernioAutomation &&
        apiKey &&
        profileId &&
        IG_FB_PLATFORMS.has(platform) &&
        rule.platformPostId &&
        rule.enabled &&
        rule.replyMessage.trim()
      ) {
        const body = {
          profileId,
          accountId: rule.accountId,
          name: `LateWiz: ${rule.inboxPostId.slice(-8)}`,
          platformPostId: rule.platformPostId,
          commentReply: rule.replyMessage,
          dmMessage: rule.replyMessage,
          keywords: rule.keywords.length ? rule.keywords : undefined,
          isActive: true,
        };

        if (zernioAutomationId) {
          await updateCommentAutomation(apiKey, zernioAutomationId, body);
        } else {
          const created = await createCommentAutomation(apiKey, body);
          zernioAutomationId = created.automation?._id;
        }
      } else if (zernioAutomationId && apiKey && !rule.enabled) {
        await updateCommentAutomation(apiKey, zernioAutomationId, {
          isActive: false,
        });
      }

      const saved = setRule({ ...rule, zernioAutomationId });
      return saved;
    },
  });
}

export function useDeleteAutoReplyRule() {
  const apiKey = useAuthStore((s) => s.apiKey);
  const removeRule = useAutoReplyStore((s) => s.removeRule);

  return useMutation({
    mutationFn: async (rule: PostAutoReplyRule) => {
      if (rule.zernioAutomationId && apiKey) {
        await deleteCommentAutomation(apiKey, rule.zernioAutomationId);
      }
      removeRule(rule.inboxPostId);
    },
  });
}

export function useRunAutoReplyScan() {
  const apiKey = useAuthStore((s) => s.apiKey);

  return useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error("Not authenticated");
      return runAutoReplyScan(apiKey);
    },
  });
}

/** Polls for auto-replies when scanner is enabled (e.g. on Comments page). */
export function useAutoReplyScanner(intervalMs = 90_000) {
  const apiKey = useAuthStore((s) => s.apiKey);
  const scannerEnabled = useAutoReplyStore((s) => s.global.scannerEnabled);
  const scanMutation = useRunAutoReplyScan();
  const running = useRef(false);

  const tick = useCallback(async () => {
    if (!apiKey || !scannerEnabled || running.current) return;
    running.current = true;
    try {
      await scanMutation.mutateAsync();
    } catch {
      // Errors surfaced via mutation state when user runs manual scan
    } finally {
      running.current = false;
    }
  }, [apiKey, scannerEnabled, scanMutation]);

  useEffect(() => {
    if (!scannerEnabled) return;
    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => clearInterval(id);
  }, [scannerEnabled, intervalMs, tick]);
}
