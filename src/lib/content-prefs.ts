import type { ImageWatermarkPosition } from "@/lib/image-watermark";
import {
  DEFAULT_IMAGE_WATERMARK_OPACITY,
  DEFAULT_IMAGE_WATERMARK_TEXT,
} from "@/lib/image-watermark";
import { DEFAULT_IMAGE_PROMPT_STYLE_ID } from "@/lib/image-prompt-catalog";
import { DEFAULT_POST_PROMPT_STYLE_ID } from "@/lib/post-prompt-catalog";
import {
  DEFAULT_RESEARCH_DEPTH_ID,
  parseResearchDepthId,
  type ResearchDepthId,
} from "@/lib/research-depth";

export type ContentPrefs = {
  postPromptStyleId: string;
  researchDepthId: ResearchDepthId;
  imagePromptStyleId: string;
  postPromptTemplates: Record<string, string>;
  imagePromptTemplates: Record<string, string>;
  imageWatermarkEnabled: boolean;
  imageWatermarkText: string;
  imageWatermarkOpacity: number;
  imageWatermarkPosition: ImageWatermarkPosition;
};

export function defaultContentPrefs(): ContentPrefs {
  return {
    postPromptStyleId: DEFAULT_POST_PROMPT_STYLE_ID,
    researchDepthId: DEFAULT_RESEARCH_DEPTH_ID,
    imagePromptStyleId: DEFAULT_IMAGE_PROMPT_STYLE_ID,
    postPromptTemplates: {},
    imagePromptTemplates: {},
    imageWatermarkEnabled: true,
    imageWatermarkText: DEFAULT_IMAGE_WATERMARK_TEXT,
    imageWatermarkOpacity: DEFAULT_IMAGE_WATERMARK_OPACITY,
    imageWatermarkPosition: "bottom-right",
  };
}

export function normalizeContentPrefs(
  partial?: Partial<ContentPrefs> | null
): ContentPrefs {
  const defaults = defaultContentPrefs();
  if (!partial || typeof partial !== "object") return defaults;
  return {
    postPromptStyleId:
      typeof partial.postPromptStyleId === "string" &&
      partial.postPromptStyleId.trim()
        ? partial.postPromptStyleId
        : defaults.postPromptStyleId,
    researchDepthId: parseResearchDepthId(partial.researchDepthId),
    imagePromptStyleId:
      typeof partial.imagePromptStyleId === "string" &&
      partial.imagePromptStyleId.trim()
        ? partial.imagePromptStyleId
        : defaults.imagePromptStyleId,
    postPromptTemplates:
      partial.postPromptTemplates &&
      typeof partial.postPromptTemplates === "object"
        ? partial.postPromptTemplates
        : {},
    imagePromptTemplates:
      partial.imagePromptTemplates &&
      typeof partial.imagePromptTemplates === "object"
        ? partial.imagePromptTemplates
        : {},
    imageWatermarkEnabled:
      typeof partial.imageWatermarkEnabled === "boolean"
        ? partial.imageWatermarkEnabled
        : defaults.imageWatermarkEnabled,
    imageWatermarkText:
      typeof partial.imageWatermarkText === "string" &&
      partial.imageWatermarkText.trim()
        ? partial.imageWatermarkText
        : defaults.imageWatermarkText,
    imageWatermarkOpacity:
      typeof partial.imageWatermarkOpacity === "number"
        ? partial.imageWatermarkOpacity
        : defaults.imageWatermarkOpacity,
    imageWatermarkPosition:
      partial.imageWatermarkPosition === "bottom-left" ||
      partial.imageWatermarkPosition === "center-diagonal" ||
      partial.imageWatermarkPosition === "bottom-right"
        ? partial.imageWatermarkPosition
        : defaults.imageWatermarkPosition,
  };
}
