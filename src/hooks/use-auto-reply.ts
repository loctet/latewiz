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

function buildAutomationPayload(
  rule: PostAutoReplyRule,
  profileId: string
) {
  const dmText = (rule.dmMessage?.trim() || rule.replyMessage).trim();
  const base = {
    profileId,
    accountId: rule.accountId,
    name: `LateWiz: ${rule.inboxPostId.slice(-8)}`,
    platformPostId: rule.platformPostId,
    keywords: rule.keywords.length ? rule.keywords : undefined,
    isActive: true,
  };

  if (rule.replyChannel === "comment") {
    return {
      ...base,
      commentReply: rule.replyMessage,
      dmMessage: dmText,
    };
  }

  if (rule.replyChannel === "dm") {
    return {
      ...base,
      dmMessage: dmText,
    };
  }

  return {
    ...base,
    dmMessage: dmText,
    commentReply: (
      rule.fallbackCommentMessage?.trim() ||
      "Thanks for commenting! Please DM us and we'll send the details."
    ).trim(),
  };
}

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

      const wantsDm = rule.replyChannel !== "comment";

      if (
        syncZernioAutomation &&
        apiKey &&
        profileId &&
        IG_FB_PLATFORMS.has(platform) &&
        rule.platformPostId &&
        rule.enabled &&
        (rule.replyMessage.trim() || rule.dmMessage?.trim()) &&
        wantsDm
      ) {
        const body = buildAutomationPayload(rule, profileId);

        if (zernioAutomationId) {
          await updateCommentAutomation(apiKey, zernioAutomationId, body);
        } else {
          const created = await createCommentAutomation(apiKey, body);
          zernioAutomationId = created.automation?._id;
        }
      } else if (zernioAutomationId && apiKey) {
        if (!rule.enabled || rule.replyChannel === "comment") {
          await updateCommentAutomation(apiKey, zernioAutomationId, {
            isActive: false,
          });
        } else if (rule.enabled && wantsDm && profileId) {
          await updateCommentAutomation(
            apiKey,
            zernioAutomationId,
            buildAutomationPayload(rule, profileId)
          );
        }
      }

      const saved = setRule({ ...rule, platform, zernioAutomationId });
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
    mutationFn: async (platformByPostId?: Record<string, string>) => {
      if (!apiKey) throw new Error("Not authenticated");
      return runAutoReplyScan(apiKey, platformByPostId);
    },
  });
}

export function useAutoReplyScanner(
  intervalMs = 90_000,
  platformByPostId?: Record<string, string>
) {
  const apiKey = useAuthStore((s) => s.apiKey);
  const scannerEnabled = useAutoReplyStore((s) => s.global.scannerEnabled);
  const scanMutation = useRunAutoReplyScan();
  const running = useRef(false);

  const tick = useCallback(async () => {
    if (!apiKey || !scannerEnabled || running.current) return;
    running.current = true;
    try {
      await scanMutation.mutateAsync(platformByPostId);
    } catch {
      // surfaced on manual scan
    } finally {
      running.current = false;
    }
  }, [apiKey, scannerEnabled, scanMutation, platformByPostId]);

  useEffect(() => {
    if (!scannerEnabled) return;
    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => clearInterval(id);
  }, [scannerEnabled, intervalMs, tick]);
}
