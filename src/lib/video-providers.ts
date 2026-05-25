export type VideoProvider = "openai-sora" | "fal-pika";

export const DEFAULT_VIDEO_PROVIDER: VideoProvider = "openai-sora";

export const VIDEO_PROVIDERS: {
  id: VideoProvider;
  label: string;
  description: string;
}[] = [
  {
    id: "openai-sora",
    label: "OpenAI Sora",
    description: "OpenAI Videos API (sora-2). Uses your OpenAI API key.",
  },
  {
    id: "fal-pika",
    label: "Pika 2.2 (fal.ai)",
    description:
      "fal.ai Pika v2.2 text-to-video — up to 1080p, 5–10s clips. Uses FAL API key.",
  },
];

export function parseVideoProvider(value: unknown): VideoProvider {
  if (value === "fal-pika" || value === "fal_pika") return "fal-pika";
  if (value === "openai-sora" || value === "openai_sora" || value === "sora") {
    return "openai-sora";
  }
  const env = process.env.DEFAULT_VIDEO_PROVIDER?.trim();
  if (env === "fal-pika" || env === "fal_pika") return "fal-pika";
  return DEFAULT_VIDEO_PROVIDER;
}

export function isVideoProviderConfigured(
  provider: VideoProvider,
  openaiApiKey: string | null,
  falApiKey: string | null
): boolean {
  if (provider === "fal-pika") return Boolean(falApiKey);
  return Boolean(openaiApiKey);
}
