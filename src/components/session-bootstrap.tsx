"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useAuthStore, useAiStore } from "@/stores";
import type { NicheProfile } from "@/lib/openai/types";

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
  const unlockedFor = useRef<string | null>(null);

  useEffect(() => {
    setHasHydrated(true);
  }, [setHasHydrated]);

  useEffect(() => {
    if (isPending) return;

    const publicPaths = ["/", "/login", "/signup"];
    const isPublic = publicPaths.includes(pathname);

    if (!session?.user) {
      unlockedFor.current = null;
      setApiKey(null);
      if (!isPublic && pathname !== "/callback") {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    if (unlockedFor.current === session.user.id) return;
    unlockedFor.current = session.user.id;

    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) return;
        const me = (await meRes.json()) as {
          needsOnboarding?: boolean;
          niche?: NicheProfile | null;
        };

        if (me.niche) setNiche(me.niche);

        if (
          me.needsOnboarding &&
          !pathname.startsWith("/onboarding") &&
          !pathname.startsWith("/login")
        ) {
          router.replace("/onboarding");
          return;
        }

        const unlockRes = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kinds: ["zernio"] }),
        });
        if (!unlockRes.ok || cancelled) return;
        const unlock = (await unlockRes.json()) as {
          secrets?: { zernio?: string | null };
        };
        const zernio = unlock.secrets?.zernio;
        if (zernio) {
          setApiKey(zernio);
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
        } else if (!pathname.startsWith("/onboarding")) {
          router.replace("/onboarding");
        }
      } catch (err) {
        console.error("Session bootstrap failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session?.user?.id,
    isPending,
    pathname,
    router,
    setApiKey,
    setUsageStats,
    setNiche,
  ]);

  return <>{children}</>;
}

export async function logoutLateWiz() {
  useAuthStore.getState().logout();
  await signOut();
}
