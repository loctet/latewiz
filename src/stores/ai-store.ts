import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  defaultNicheProfile,
  type GeneratedMediaItem,
  type NicheProfile,
} from "@/lib/openai/types";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import {
  DEFAULT_IMAGE_PROMPT_STYLE_ID,
  isBuiltinImagePromptStyle,
  type CustomImagePromptStyle,
} from "@/lib/image-prompt-catalog";
import { DEFAULT_VIDEO_PROMPT_STYLE_ID } from "@/lib/video-prompt-catalog";
import {
  AUTO_POST_PROMPT_STYLE_ID,
} from "@/lib/post-prompt-catalog";
import type { AiMediaKind } from "@/lib/campaign-media";
import {
  DEFAULT_VIDEO_PROVIDER,
  type VideoProvider,
} from "@/lib/video-providers";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import {
  DEFAULT_IMAGE_WATERMARK_OPACITY,
  type ImageWatermarkPosition,
} from "@/lib/image-watermark";
import { safeLocalStorage } from "@/lib/safe-storage";

interface AiState {
  openaiApiKey: string | null;
  falApiKey: string | null;
  niche: NicheProfile;
  imagePromptStyleId: string;
  postPromptStyleId: string;
  videoPromptStyleId: string;
  videoProvider: VideoProvider;
  aiMediaKind: AiMediaKind;
  /** Custom template overrides per style id (use {{subject}} and {{langNote}}) */
  imagePromptTemplates: Record<string, string>;
  /** User-created image prompt styles (template text in imagePromptTemplates) */
  customImagePromptStyles: CustomImagePromptStyle[];
  videoPromptTemplates: Record<string, string>;
  imageWatermarkEnabled: boolean;
  imageWatermarkText: string;
  imageWatermarkOpacity: number;
  imageWatermarkPosition: ImageWatermarkPosition;
  generatedMedia: GeneratedMediaItem[];

  setOpenaiApiKey: (key: string | null) => void;
  setFalApiKey: (key: string | null) => void;
  setVideoProvider: (provider: VideoProvider) => void;
  setNiche: (niche: Partial<NicheProfile>) => void;
  setImagePromptStyleId: (id: string) => void;
  setPostPromptStyleId: (id: string) => void;
  setVideoPromptStyleId: (id: string) => void;
  setAiMediaKind: (kind: AiMediaKind) => void;
  setImagePromptTemplate: (styleId: string, template: string) => void;
  resetImagePromptTemplate: (styleId: string) => void;
  resetAllImagePromptTemplates: () => void;
  addCustomImagePromptStyle: (
    style: CustomImagePromptStyle,
    template: string
  ) => void;
  updateCustomImagePromptStyle: (
    id: string,
    patch: Partial<Pick<CustomImagePromptStyle, "label" | "description">>
  ) => void;
  removeCustomImagePromptStyle: (id: string) => void;
  setVideoPromptTemplate: (styleId: string, template: string) => void;
  resetVideoPromptTemplate: (styleId: string) => void;
  resetAllVideoPromptTemplates: () => void;
  setImageWatermarkEnabled: (enabled: boolean) => void;
  setImageWatermarkText: (text: string) => void;
  setImageWatermarkOpacity: (opacity: number) => void;
  setImageWatermarkPosition: (position: ImageWatermarkPosition) => void;
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
      postPromptStyleId: AUTO_POST_PROMPT_STYLE_ID,
      videoPromptStyleId: DEFAULT_VIDEO_PROMPT_STYLE_ID,
      videoProvider: DEFAULT_VIDEO_PROVIDER,
      aiMediaKind: "image",
      imagePromptTemplates: {},
      customImagePromptStyles: [],
      videoPromptTemplates: {},
      imageWatermarkEnabled: false,
      imageWatermarkText: "",
      imageWatermarkOpacity: DEFAULT_IMAGE_WATERMARK_OPACITY,
      imageWatermarkPosition: "bottom-right",
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

      setPostPromptStyleId: (id) => set({ postPromptStyleId: id }),

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

      resetAllImagePromptTemplates: () => {
        const kept: Record<string, string> = {};
        for (const [id, template] of Object.entries(get().imagePromptTemplates)) {
          if (!isBuiltinImagePromptStyle(id)) kept[id] = template;
        }
        set({ imagePromptTemplates: kept });
      },

      addCustomImagePromptStyle: (style, template) =>
        set({
          customImagePromptStyles: [...get().customImagePromptStyles, style],
          imagePromptTemplates: {
            ...get().imagePromptTemplates,
            [style.id]: template,
          },
        }),

      updateCustomImagePromptStyle: (id, patch) =>
        set({
          customImagePromptStyles: get().customImagePromptStyles.map((s) =>
            s.id === id ? { ...s, ...patch } : s
          ),
        }),

      removeCustomImagePromptStyle: (id) => {
        const templates = { ...get().imagePromptTemplates };
        delete templates[id];
        const next: Partial<AiState> = {
          customImagePromptStyles: get().customImagePromptStyles.filter(
            (s) => s.id !== id
          ),
          imagePromptTemplates: templates,
        };
        if (get().imagePromptStyleId === id) {
          next.imagePromptStyleId = DEFAULT_IMAGE_PROMPT_STYLE_ID;
        }
        set(next);
      },

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

      setImageWatermarkEnabled: (enabled) =>
        set({ imageWatermarkEnabled: enabled }),
      setImageWatermarkText: (text) => set({ imageWatermarkText: text }),
      setImageWatermarkOpacity: (opacity) =>
        set({
          imageWatermarkOpacity: Math.min(0.6, Math.max(0.1, opacity)),
        }),
      setImageWatermarkPosition: (position) =>
        set({ imageWatermarkPosition: position }),

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
          postPromptStyleId:
            p?.postPromptStyleId ?? AUTO_POST_PROMPT_STYLE_ID,
          videoPromptStyleId:
            p?.videoPromptStyleId ?? DEFAULT_VIDEO_PROMPT_STYLE_ID,
          videoProvider:
            p?.videoProvider === "fal-pika" ? "fal-pika" : DEFAULT_VIDEO_PROVIDER,
          falApiKey: p?.falApiKey ?? null,
          aiMediaKind: p?.aiMediaKind === "video" ? "video" : "image",
          imagePromptTemplates: p?.imagePromptTemplates ?? {},
          customImagePromptStyles: p?.customImagePromptStyles ?? [],
          videoPromptTemplates: p?.videoPromptTemplates ?? {},
          imageWatermarkEnabled: p?.imageWatermarkEnabled ?? false,
          imageWatermarkText: p?.imageWatermarkText ?? "",
          imageWatermarkOpacity:
            p?.imageWatermarkOpacity ?? DEFAULT_IMAGE_WATERMARK_OPACITY,
          imageWatermarkPosition:
            p?.imageWatermarkPosition === "bottom-left" ||
            p?.imageWatermarkPosition === "center-diagonal"
              ? p.imageWatermarkPosition
              : "bottom-right",
          generatedMedia: [],
        };
      },
      partialize: (state) => ({
        openaiApiKey: state.openaiApiKey,
        falApiKey: state.falApiKey,
        niche: state.niche,
        imagePromptStyleId: state.imagePromptStyleId,
        postPromptStyleId: state.postPromptStyleId,
        videoPromptStyleId: state.videoPromptStyleId,
        videoProvider: state.videoProvider,
        aiMediaKind: state.aiMediaKind,
        imagePromptTemplates: state.imagePromptTemplates,
        customImagePromptStyles: state.customImagePromptStyles,
        videoPromptTemplates: state.videoPromptTemplates,
        imageWatermarkEnabled: state.imageWatermarkEnabled,
        imageWatermarkText: state.imageWatermarkText,
        imageWatermarkOpacity: state.imageWatermarkOpacity,
        imageWatermarkPosition: state.imageWatermarkPosition,
        // Never persist generatedMedia (base64 images blow localStorage quota)
      }),
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);
