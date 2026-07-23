export type ImageWatermarkPosition =
  | "bottom-right"
  | "bottom-left"
  | "center-diagonal";

export type ImageWatermarkSettings = {
  enabled: boolean;
  text: string;
  /** 0.1–0.6 — lower = more subtle */
  opacity: number;
  position: ImageWatermarkPosition;
};

export const DEFAULT_IMAGE_WATERMARK_OPACITY = 0.28;
export const DEFAULT_IMAGE_WATERMARK_TEXT = "LateWiz";

export function defaultImageWatermarkSettings(): ImageWatermarkSettings {
  return {
    enabled: true,
    text: DEFAULT_IMAGE_WATERMARK_TEXT,
    opacity: DEFAULT_IMAGE_WATERMARK_OPACITY,
    position: "bottom-right",
  };
}

export const IMAGE_WATERMARK_POSITIONS: {
  value: ImageWatermarkPosition;
  label: string;
}[] = [
  { value: "bottom-right", label: "Bottom right (signature)" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "center-diagonal", label: "Center diagonal (filigrane)" },
];

function clampOpacity(value: number): number {
  return Math.min(0.6, Math.max(0.1, value));
}

export function normalizeWatermarkSettings(
  partial: Partial<ImageWatermarkSettings>
): ImageWatermarkSettings {
  const defaults = defaultImageWatermarkSettings();
  return {
    enabled: partial.enabled ?? defaults.enabled,
    text:
      typeof partial.text === "string" && partial.text.trim()
        ? partial.text
        : defaults.text,
    opacity: clampOpacity(
      partial.opacity ?? DEFAULT_IMAGE_WATERMARK_OPACITY
    ),
    position: partial.position ?? defaults.position,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load image for watermark"));
    img.src = url;
  });
}

function drawCornerSignature(
  ctx: CanvasRenderingContext2D,
  text: string,
  opacity: number,
  align: "left" | "right",
  width: number,
  height: number
): void {
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.032));
  const padding = fontSize * 0.9;

  ctx.save();
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = align;

  const x = align === "right" ? width - padding : padding;
  const y = height - padding;

  // Soft shadow — readable on light and dark areas without a solid box
  ctx.globalAlpha = opacity * 0.45;
  ctx.fillStyle = "#000000";
  const shadowOffset = Math.max(1, Math.round(fontSize * 0.06));
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);

  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDiagonalFiligrane(
  ctx: CanvasRenderingContext2D,
  text: string,
  opacity: number,
  width: number,
  height: number
): void {
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.09));

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  ctx.font = `400 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = opacity * 0.55;
  ctx.fillStyle = "#000000";
  ctx.fillText(text, 2, 2);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Draw a semi-transparent signature / filigrane on an image (client-side, no AI).
 * Returns a PNG data URL.
 */
export async function applyImageWatermark(
  imageUrl: string,
  settings: ImageWatermarkSettings
): Promise<string> {
  const normalized = normalizeWatermarkSettings(settings);
  const text = normalized.text.trim();
  if (!normalized.enabled || !text) return imageUrl;

  const img = await loadImage(imageUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) return imageUrl;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageUrl;

  ctx.drawImage(img, 0, 0, width, height);

  const opacity = normalized.opacity;

  if (normalized.position === "center-diagonal") {
    drawDiagonalFiligrane(ctx, text, opacity, width, height);
  } else {
    drawCornerSignature(
      ctx,
      text,
      opacity,
      normalized.position === "bottom-left" ? "left" : "right",
      width,
      height
    );
  }

  return canvas.toDataURL("image/png");
}

export async function maybeApplyImageWatermark(
  imageUrl: string,
  settings: ImageWatermarkSettings
): Promise<string> {
  if (!settings.enabled || !settings.text.trim()) return imageUrl;
  try {
    return await applyImageWatermark(imageUrl, settings);
  } catch {
    return imageUrl;
  }
}
