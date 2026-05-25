import {
  buildVideoPromptFromStyle,
  getVideoPromptStyle,
} from "@/lib/video-prompt-catalog";
import type { NicheProfile } from "@/lib/openai/types";
import { defaultNicheProfile } from "@/lib/openai/types";
import { resolvePostTextForBoard } from "@/lib/openai/service";

/** @see https://fal.ai/models/fal-ai/pika/v2.2/text-to-video/api */
const PIKA_MODEL_ID = "fal-ai/pika/v2.2/text-to-video";
const FAL_QUEUE_BASE = "https://queue.fal.run";

const POLL_MS = 3000;
const MAX_POLL_MS = Number(process.env.FAL_VIDEO_POLL_MAX_MS ?? "300000");

const NEGATIVE_PROMPT =
  "ugly, bad, terrible, blurry, watermark, logo, readable text, subtitles, low quality";

type FalQueueStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
  logs?: { message: string }[];
};

type FalPikaResult = {
  video?: { url?: string };
};

function summarizeFalError(status: number, bodyRaw: string, label: string): string {
  try {
    const data = JSON.parse(bodyRaw) as {
      detail?: string;
      message?: string;
      error?: string;
    };
    const message = data.detail ?? data.message ?? data.error;
    if (typeof message === "string" && message.trim()) {
      return `${label} HTTP ${status}: ${message.trim()}`;
    }
  } catch {
    /* ignore */
  }
  const snippet = bodyRaw.trim().slice(0, 240);
  return snippet
    ? `${label} HTTP ${status}: ${snippet}`
    : `${label} returned HTTP ${status}.`;
}

function mapStyleToPikaInput(styleId: string | undefined): {
  aspect_ratio: "9:16" | "16:9" | "1:1";
  resolution: "720p" | "1080p";
  duration: 5 | 10;
} {
  const style = getVideoPromptStyle(styleId);
  const landscape =
    style.size === "1280x720" || style.size === "1792x1024";
  const aspect_ratio = landscape ? "16:9" : "9:16";
  const resolution =
    style.id === "landscape-youtube" || style.size === "1792x1024"
      ? "1080p"
      : "720p";
  const duration: 5 | 10 =
    style.durationSeconds === "8" || style.durationSeconds === "12" ? 10 : 5;
  return { aspect_ratio, resolution, duration };
}

async function falFetch(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${FAL_QUEUE_BASE}/${PIKA_MODEL_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function pollFalRequest(apiKey: string, requestId: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    const res = await falFetch(apiKey, `/requests/${requestId}/status`);
    const bodyRaw = await res.text();
    if (!res.ok) {
      throw new Error(summarizeFalError(res.status, bodyRaw, "fal.ai queue"));
    }
    const status = JSON.parse(bodyRaw) as FalQueueStatus;
    if (status.status === "COMPLETED") return;
    if (status.status === "FAILED") {
      throw new Error(status.error?.trim() || "Pika video generation failed");
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    `Pika generation timed out after ${Math.round(MAX_POLL_MS / 1000)}s (request ${requestId}).`
  );
}

export async function generatePikaVideo(
  apiKey: string | null,
  niche: NicheProfile = defaultNicheProfile(),
  explicitPrompt?: string,
  captionContext?: string,
  promptStyleId?: string,
  templateOverrides?: Record<string, string>
): Promise<{
  url: string | null;
  video_id: string | null;
  source: string;
  detail: string | null;
  duration_seconds?: string;
}> {
  if (!apiKey) {
    return {
      url: null,
      video_id: null,
      source: "unconfigured",
      detail:
        "Add a fal.ai API key in Settings or set FAL_KEY on the server. Get one at fal.ai/dashboard/keys.",
    };
  }

  const postText = resolvePostTextForBoard(captionContext, explicitPrompt, niche);
  const nicheLines: string[] = [];
  if (niche.topic.trim()) nicheLines.push(`Niche topic: ${niche.topic.trim()}`);
  if (niche.audience.trim()) nicheLines.push(`Audience: ${niche.audience.trim()}`);
  if (niche.geography.trim()) nicheLines.push(`Market: ${niche.geography.trim()}`);
  const subject =
    nicheLines.length > 0 ? `${postText}\n\n${nicheLines.join("\n")}` : postText;

  const { prompt } = buildVideoPromptFromStyle(
    promptStyleId,
    subject,
    niche,
    templateOverrides
  );
  const pikaOpts = mapStyleToPikaInput(promptStyleId);

  try {
    const submitRes = await falFetch(apiKey, "", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        aspect_ratio: pikaOpts.aspect_ratio,
        resolution: pikaOpts.resolution,
        duration: pikaOpts.duration,
      }),
    });
    const submitRaw = await submitRes.text();
    if (!submitRes.ok) {
      return {
        url: null,
        video_id: null,
        source: "fallback",
        detail: summarizeFalError(submitRes.status, submitRaw, "fal.ai Pika"),
      };
    }

    const submitted = JSON.parse(submitRaw) as { request_id?: string };
    const requestId = submitted.request_id?.trim();
    if (!requestId) {
      return {
        url: null,
        video_id: null,
        source: "fallback",
        detail: "fal.ai response missing request_id.",
      };
    }

    await pollFalRequest(apiKey, requestId);

    const resultRes = await falFetch(apiKey, `/requests/${requestId}`);
    const resultRaw = await resultRes.text();
    if (!resultRes.ok) {
      return {
        url: null,
        video_id: requestId,
        source: "fallback",
        detail: summarizeFalError(resultRes.status, resultRaw, "fal.ai result"),
      };
    }

    const parsed = JSON.parse(resultRaw) as FalPikaResult & {
      response?: FalPikaResult;
    };
    const result = parsed.response ?? parsed;
    const videoUrl = result.video?.url?.trim();
    if (!videoUrl) {
      return {
        url: null,
        video_id: requestId,
        source: "fallback",
        detail: "fal.ai Pika completed but returned no video URL.",
      };
    }

    return {
      url: videoUrl,
      video_id: requestId,
      source: "fal-pika",
      detail: null,
      duration_seconds: String(pikaOpts.duration),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      url: null,
      video_id: null,
      source: "fallback",
      detail: msg.slice(0, 400),
    };
  }
}
