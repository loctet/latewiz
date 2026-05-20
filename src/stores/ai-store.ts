import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultNicheProfile,
  type GeneratedMediaItem,
  type NicheProfile,
} from "@/lib/openai/types";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";

interface AiState {
  openaiApiKey: string | null;
  niche: NicheProfile;
  generatedMedia: GeneratedMediaItem[];

  setOpenaiApiKey: (key: string | null) => void;
  setNiche: (niche: Partial<NicheProfile>) => void;
  addGeneratedMedia: (item: Omit<GeneratedMediaItem, "id" | "createdAt">) => void;
  removeGeneratedMedia: (id: string) => void;
  clearGeneratedMedia: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      openaiApiKey: null,
      niche: defaultNicheProfile(),
      generatedMedia: [],

      setOpenaiApiKey: (key) => {
        if (key === null || key === "") {
          set({ openaiApiKey: null });
          return;
        }
        const trimmed = key.trim();
        set({
          openaiApiKey: isPlausibleOpenAiApiKey(trimmed) ? trimmed : null,
        });
      },

      setNiche: (partial) =>
        set({ niche: { ...get().niche, ...partial } }),

      addGeneratedMedia: (item) => {
        const entry: GeneratedMediaItem = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...item,
        };
        set({
          generatedMedia: [entry, ...get().generatedMedia].slice(0, 50),
        });
      },

      removeGeneratedMedia: (id) =>
        set({
          generatedMedia: get().generatedMedia.filter((m) => m.id !== id),
        }),

      clearGeneratedMedia: () => set({ generatedMedia: [] }),
    }),
    {
      name: "latewiz-ai",
      merge: (persisted, current) => {
        const p = persisted as Partial<AiState> | undefined;
        return {
          ...current,
          ...p,
          niche: { ...defaultNicheProfile(), ...p?.niche },
        };
      },
      partialize: (state) => ({
        openaiApiKey: state.openaiApiKey,
        niche: state.niche,
        generatedMedia: state.generatedMedia.slice(0, 30),
      }),
    }
  )
);
