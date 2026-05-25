import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  defaultNicheProfile,
  type GeneratedMediaItem,
  type NicheProfile,
} from "@/lib/openai/types";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import { DEFAULT_IMAGE_PROMPT_STYLE_ID } from "@/lib/image-prompt-catalog";
import { DEFAULT_VIDEO_PROMPT_STYLE_ID } from "@/lib/video-prompt-catalog";
import type { AiMediaKind } from "@/lib/campaign-media";
import {
  DEFAULT_VIDEO_PROVIDER,
  type VideoProvider,
} from "@/lib/video-providers";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import { safeLocalStorage } from "@/lib/safe-storage";

interface AiState {
  openaiApiKey: string | null;
  falApiKey: string | null;
  niche: NicheProfile;
  imagePromptStyleId: string;
  videoPromptStyleId: string;
  videoProvider: VideoProvider;
  aiMediaKind: AiMediaKind;
  /** Custom template overrides per style id (use {{subject}} and {{langNote}}) */
  imagePromptTemplates: Record<string, string>;
  videoPromptTemplates: Record<string, string>;
  generatedMedia: GeneratedMediaItem[];

  setOpenaiApiKey: (key: string | null) => void;
  setFalApiKey: (key: string | null) => void;
  setVideoProvider: (provider: VideoProvider) => void;
  setNiche: (niche: Partial<NicheProfile>) => void;
  setImagePromptStyleId: (id: string) => void;
  setVideoPromptStyleId: (id: string) => void;
  setAiMediaKind: (kind: AiMediaKind) => void;
  setImagePromptTemplate: (styleId: string, template: string) => void;
  resetImagePromptTemplate: (styleId: string) => void;
  resetAllImagePromptTemplates: () => void;
  setVideoPromptTemplate: (styleId: string, template: string) => void;
  resetVideoPromptTemplate: (styleId: string) => void;
  resetAllVideoPromptTemplates: () => void;
  addGeneratedMedia: (item: Omit<GeneratedMediaItem, "id" | "createdAt">) => void;
  removeGeneratedMedia: (id: string) => void;
  clearGeneratedMedia: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      openaiApiKey: null,
      falApiKey: null,
      niche: defaultNicheProfile(),
      imagePromptStyleId: DEFAULT_IMAGE_PROMPT_STYLE_ID,
      videoPromptStyleId: DEFAULT_VIDEO_PROMPT_STYLE_ID,
      videoProvider: DEFAULT_VIDEO_PROVIDER,
      aiMediaKind: "image",
      imagePromptTemplates: {},
      videoPromptTemplates: {},
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

      setFalApiKey: (key) => {
        if (key === null || key === "") {
          set({ falApiKey: null });
          return;
        }
        const trimmed = key.trim();
        set({
          falApiKey: isPlausibleFalApiKey(trimmed) ? trimmed : null,
        });
      },

      setVideoProvider: (provider) => set({ videoProvider: provider }),

      setNiche: (partial) =>
        set({ niche: { ...get().niche, ...partial } }),

      setImagePromptStyleId: (id) => set({ imagePromptStyleId: id }),

      setVideoPromptStyleId: (id) => set({ videoPromptStyleId: id }),

      setAiMediaKind: (kind) => set({ aiMediaKind: kind }),

      setImagePromptTemplate: (styleId, template) =>
        set({
          imagePromptTemplates: {
            ...get().imagePromptTemplates,
            [styleId]: template,
          },
        }),

      resetImagePromptTemplate: (styleId) => {
        const next = { ...get().imagePromptTemplates };
        delete next[styleId];
        set({ imagePromptTemplates: next });
      },

      resetAllImagePromptTemplates: () => set({ imagePromptTemplates: {} }),

      setVideoPromptTemplate: (styleId, template) =>
        set({
          videoPromptTemplates: {
            ...get().videoPromptTemplates,
            [styleId]: template,
          },
        }),

      resetVideoPromptTemplate: (styleId) => {
        const next = { ...get().videoPromptTemplates };
        delete next[styleId];
        set({ videoPromptTemplates: next });
      },

      resetAllVideoPromptTemplates: () => set({ videoPromptTemplates: {} }),

      addGeneratedMedia: (item) => {
        const entry: GeneratedMediaItem = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          type: item.type ?? "image",
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
          imagePromptStyleId:
            p?.imagePromptStyleId ?? DEFAULT_IMAGE_PROMPT_STYLE_ID,
          videoPromptStyleId:
            p?.videoPromptStyleId ?? DEFAULT_VIDEO_PROMPT_STYLE_ID,
          videoProvider:
            p?.videoProvider === "fal-pika" ? "fal-pika" : DEFAULT_VIDEO_PROVIDER,
          falApiKey: p?.falApiKey ?? null,
          aiMediaKind: p?.aiMediaKind === "video" ? "video" : "image",
          imagePromptTemplates: p?.imagePromptTemplates ?? {},
          videoPromptTemplates: p?.videoPromptTemplates ?? {},
          generatedMedia: [],
        };
      },
      partialize: (state) => ({
        openaiApiKey: state.openaiApiKey,
        falApiKey: state.falApiKey,
        niche: state.niche,
        imagePromptStyleId: state.imagePromptStyleId,
        videoPromptStyleId: state.videoPromptStyleId,
        videoProvider: state.videoProvider,
        aiMediaKind: state.aiMediaKind,
        imagePromptTemplates: state.imagePromptTemplates,
        videoPromptTemplates: state.videoPromptTemplates,
        // Never persist generatedMedia (base64 images blow localStorage quota)
      }),
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);
