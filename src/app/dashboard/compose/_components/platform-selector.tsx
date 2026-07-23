"use client";

import { useAccounts, type Account } from "@/hooks";
import { AccountAvatar } from "@/components/accounts";
import { PlatformIcon } from "@/components/shared";
import {
  PLATFORMS,
  PLATFORM_NAMES,
  PLATFORM_CONSTRAINTS,
  type Platform,
} from "@/lib/late-api";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformSelectorProps {
  selectedAccountIds: string[];
  onSelectionChange: (accountIds: string[]) => void;
  hasVideo: boolean;
  hasImages: boolean;
}

export function PlatformSelector({
  selectedAccountIds,
  onSelectionChange,
  hasVideo,
  hasImages,
}: PlatformSelectorProps) {
  const { data: accountsData, isLoading } = useAccounts();
  const accounts = (accountsData?.accounts || []) as Account[];

  const accountsByPlatform = accounts.reduce(
    (acc, account) => {
      const platform = account.platform as Platform;
      if (!acc[platform]) acc[platform] = [];
      acc[platform].push(account);
      return acc;
    },
    {} as Record<Platform, Account[]>
  );

  const toggleAccount = (accountId: string) => {
    if (selectedAccountIds.includes(accountId)) {
      onSelectionChange(selectedAccountIds.filter((id) => id !== accountId));
    } else {
      onSelectionChange([...selectedAccountIds, accountId]);
    }
  };

  const getConstraintWarning = (platform: Platform): string | null => {
    const constraints = PLATFORM_CONSTRAINTS[platform];

    if (constraints.requiresVideo && !hasVideo) {
      return "Requires video";
    }
    if (constraints.requiresMedia && !hasVideo && !hasImages) {
      return "Requires media";
    }
    if (constraints.noVideo && hasVideo) {
      return "No video support";
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-32 animate-pulse rounded-full bg-muted"
          />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          No accounts connected. Connect an account to start posting.
        </p>
      </div>
    );
  }

  const platformsWithAccounts = PLATFORMS.filter(
    (platform) => accountsByPlatform[platform]?.length
  );

  return (
    <div className="space-y-2">
      {platformsWithAccounts.map((platform) => {
        const platformAccounts = accountsByPlatform[platform];
        const warning = getConstraintWarning(platform);

        return (
          <div
            key={platform}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
              <PlatformIcon platform={platform} showColor size="xs" />
              <span className="truncate text-xs font-medium text-muted-foreground">
                {PLATFORM_NAMES[platform]}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {platformAccounts.map((account) => {
                const selected = selectedAccountIds.includes(account._id);
                return (
                  <button
                    key={account._id}
                    type="button"
                    onClick={() => toggleAccount(account._id)}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    <AccountAvatar account={account} size="xs" />
                    <span className="max-w-[10rem] truncate text-xs font-medium">
                      {account.displayName || account.username}
                    </span>
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-transparent"
                      )}
                    >
                      <Check className="h-2 w-2" strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
              {warning && (
                <Badge
                  variant="outline"
                  className="h-5 gap-1 px-1.5 text-[10px] text-warning"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  {warning}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
