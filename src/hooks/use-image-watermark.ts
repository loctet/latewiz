import { useAiStore } from "@/stores";
import {
  maybeApplyImageWatermark,
  normalizeWatermarkSettings,
  type ImageWatermarkSettings,
} from "@/lib/image-watermark";

export function useImageWatermarkSettings(): ImageWatermarkSettings {
  const enabled = useAiStore((s) => s.imageWatermarkEnabled);
  const text = useAiStore((s) => s.imageWatermarkText);
  const opacity = useAiStore((s) => s.imageWatermarkOpacity);
  const position = useAiStore((s) => s.imageWatermarkPosition);

  return normalizeWatermarkSettings({
    enabled,
    text,
    opacity,
    position,
  });
}

export async function watermarkImageIfEnabled(
  imageUrl: string,
  settings: ImageWatermarkSettings
): Promise<string> {
  return maybeApplyImageWatermark(imageUrl, settings);
}
