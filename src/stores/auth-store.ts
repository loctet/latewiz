import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UsageStats {
  planName: string;
  limits: {
    uploads: number;
    profiles: number;
  };
  usage: {
    uploads: number;
    profiles: number;
  };
}

function normalizeUsageStats(stats: unknown): UsageStats | null {
  if (!stats || typeof stats !== "object") return null;
  const s = stats as Partial<UsageStats> & {
    limits?: Partial<UsageStats["limits"]>;
    usage?: Partial<UsageStats["usage"]>;
  };
  const num = (v: unknown, fallback = 0): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    planName:
      typeof s.planName === "string" && s.planName.length > 0
        ? s.planName
        : "Free",
    limits: {
      uploads: num(s.limits?.uploads),
      profiles: num(s.limits?.profiles),
    },
    usage: {
      uploads: num(s.usage?.uploads),
      profiles: num(s.usage?.profiles),
    },
  };
}

interface AuthState {
  apiKey: string | null;
  usageStats: UsageStats | null;
  isValidating: boolean;
  error: string | null;
  hasHydrated: boolean;
  setApiKey: (key: string | null) => void;
  setUsageStats: (stats: UsageStats | null) => void;
  setIsValidating: (validating: boolean) => void;
  setError: (error: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: null,
      usageStats: null,
      isValidating: false,
      error: null,
      hasHydrated: false,
      setApiKey: (key) => set({ apiKey: key, error: null }),
      setUsageStats: (stats) => set({ usageStats: normalizeUsageStats(stats) }),
      setIsValidating: (validating) => set({ isValidating: validating }),
      setError: (error) => set({ error }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      logout: () =>
        set({
          apiKey: null,
          usageStats: null,
          error: null,
        }),
    }),
    {
      name: "latewiz-auth",
      // Secrets live in the server vault. Persist only non-secret usage cache.
      partialize: (state) => ({
        usageStats: state.usageStats,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.usageStats = normalizeUsageStats(state.usageStats);
          state.apiKey = null;
          state.setHasHydrated(true);
        }
      },
    }
  )
);
