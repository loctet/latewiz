"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useAuthStore, useAiStore } from "@/stores";
import type { NicheProfile } from "@/lib/openai/types";
import type { ContentPrefs } from "@/lib/content-prefs";

/**
 * Hydrates in-memory Zernio key from the vault and redirects to onboarding when needed.
 */
export function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const setUsageStats = useAuthStore((s) => s.setUsageStats);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);
  const setNiche = useAiStore((s) => s.setNiche);
  const hydrateContentPrefs = useAiStore((s) => s.hydrateContentPrefs);
  /** Only mark unlock complete after secrets are applied (or onboarding redirect). */
  const unlockedFor = useRef<string | null>(null);
  const unlockInFlight = useRef<string | null>(null);

  useEffect(() => {
    setHasHydrated(true);
  }, [setHasHydrated]);

  useEffect(() => {
    if (isPending) return;

    const publicExact = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);
    const isPublic =
      publicExact.has(pathname) ||
      pathname === "/callback" ||
      pathname.startsWith("/callback/");

    if (!session?.user) {
      unlockedFor.current = null;
      unlockInFlight.current = null;
      setApiKey(null);
      if (!isPublic) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    const userId = session.user.id;
    if (unlockedFor.current === userId || unlockInFlight.current === userId) {
      return;
    }

    unlockInFlight.current = userId;
    let cancelled = false;

    (async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok || cancelled) {
          unlockInFlight.current = null;
          return;
        }
        const me = (await meRes.json()) as {
          needsOnboarding?: boolean;
          niche?: NicheProfile | null;
          contentPrefs?: ContentPrefs | null;
        };

        if (cancelled) {
          unlockInFlight.current = null;
          return;
        }

        if (me.niche) setNiche(me.niche);
        if (me.contentPrefs) hydrateContentPrefs(me.contentPrefs);

        if (
          me.needsOnboarding &&
          !pathname.startsWith("/onboarding") &&
          !pathname.startsWith("/login")
        ) {
          unlockedFor.current = userId;
          unlockInFlight.current = null;
          router.replace("/onboarding");
          return;
        }

        const unlockRes = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kinds: ["zernio"] }),
        });
        if (cancelled) {
          unlockInFlight.current = null;
          return;
        }
        if (!unlockRes.ok) {
          unlockInFlight.current = null;
          return;
        }

        const unlock = (await unlockRes.json()) as {
          secrets?: { zernio?: string | null };
        };
        const zernio = unlock.secrets?.zernio;
        if (zernio) {
          setApiKey(zernio);
          unlockedFor.current = userId;
          unlockInFlight.current = null;
          try {
            const validate = await fetch("/api/validate-key", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: zernio }),
            });
            if (validate.ok) {
              const data = await validate.json();
              if (data.usageStats) setUsageStats(data.usageStats);
            }
          } catch {
            /* ignore usage fetch */
          }
          return;
        }

        unlockedFor.current = userId;
        unlockInFlight.current = null;
        if (!pathname.startsWith("/onboarding")) {
          router.replace("/onboarding");
        }
      } catch (err) {
        console.error("Session bootstrap failed:", err);
        unlockInFlight.current = null;
      }
    })();

    return () => {
      cancelled = true;
      // Allow a retry on the next mount/path if unlock never finished.
      if (unlockInFlight.current === userId && unlockedFor.current !== userId) {
        unlockInFlight.current = null;
      }
    };
  }, [
    session?.user?.id,
    isPending,
    pathname,
    router,
    setApiKey,
    setUsageStats,
    setNiche,
    hydrateContentPrefs,
  ]);

  return <>{children}</>;
}

export async function logoutLateWiz() {
  useAuthStore.getState().logout();
  await signOut();
}
