import type { StateStorage } from "zustand/middleware";

/** localStorage wrapper that avoids quota crashes from oversized persisted state */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn(`[storage] Failed to persist "${name}"`, e);
      if (name === "latewiz-ai" && value.length > 500_000) {
        try {
          const parsed = JSON.parse(value) as {
            state?: { imagePromptTemplates?: Record<string, string> };
          };
          const state = parsed.state ?? parsed;
          const slim = {
            ...parsed,
            state: {
              ...(typeof state === "object" ? state : {}),
              imagePromptTemplates: {},
            },
          };
          localStorage.setItem(name, JSON.stringify(slim));
        } catch {
          /* give up */
        }
      }
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};
