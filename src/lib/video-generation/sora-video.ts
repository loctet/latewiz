import type { NicheProfile } from "@/lib/openai/types";
import { defaultNicheProfile } from "@/lib/openai/types";
import { buildVideoPromptFromStyle } from "@/lib/video-prompt-catalog";
import { resolvePostTextForBoard } from "@/lib/openai/service";

function summarizeOpenAiError(status: number, bodyRaw: string, label: string): string {
  try {
    const data = JSON.parse(bodyRaw) as { error?: { message?: string; code?: string | number } };
    const message = data?.error?.message?.trim();
    if (message) {
      const code = data.error?.code != null ? ` (code ${data.error.code})` : "";
      return `${label} HTTP ${status}: ${message}${code}`;
    }
  } catch {
    /* ignore */
  }
  const snippet = bodyRaw.trim().slice(0, 240);
  return snippet
    ? `${label} HTTP ${status}: ${snippet}`
    : `${label} returned HTTP ${status}.`;
}

type VideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  error?: { message?: string };
};

const POLL_MS = 3000;
const MAX_POLL_MS = Number(process.env.OPENAI_VIDEO_POLL_MAX_MS ?? "300000");

async function openAiFetch(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function pollVideoJob(apiKey: string, videoId: string): Promise<VideoJob> {
  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    const res = await openAiFetch(apiKey, `/videos/${videoId}`);
    const bodyRaw = await res.text();
    if (!res.ok) {
      throw new Error(summarizeOpenAiError(res.status, bodyRaw, "OpenAI Videos"));
    }
    const job = JSON.parse(bodyRaw) as VideoJob;
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      throw new Error(job.error?.message?.trim() || "Video generation failed");
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    `Video generation timed out after ${Math.round(MAX_POLL_MS / 1000)}s. Try again or check job ${videoId}.`
  );
}

async function downloadVideoBuffer(apiKey: string, videoId: string): Promise<Buffer> {
  const res = await openAiFetch(apiKey, `/videos/${videoId}/content`);
  if (!res.ok) {
    const bodyRaw = await res.text();
    throw new Error(summarizeOpenAiError(res.status, bodyRaw, "OpenAI Video content"));
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function generateSoraVideo(
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
        "Add an OpenAI API key in Settings or set OPENAI_API_KEY on the server.",
    };
  }

  const model = process.env.OPENAI_VIDEO_MODEL?.trim() || "sora-2";
  const postText = resolvePostTextForBoard(captionContext, explicitPrompt, niche);
  const nicheLines: string[] = [];
  if (niche.topic.trim()) nicheLines.push(`Niche topic: ${niche.topic.trim()}`);
  if (niche.audience.trim()) nicheLines.push(`Audience: ${niche.audience.trim()}`);
  if (niche.geography.trim()) nicheLines.push(`Market: ${niche.geography.trim()}`);
  const subject =
    nicheLines.length > 0 ? `${postText}\n\n${nicheLines.join("\n")}` : postText;

  const { prompt, seconds, size } = buildVideoPromptFromStyle(
    promptStyleId,
    subject,
    niche,
    templateOverrides
  );

  try {
    const createRes = await openAiFetch(apiKey, "/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, seconds, size }),
    });
    const createRaw = await createRes.text();
    if (!createRes.ok) {
      return {
        url: null,
        video_id: null,
        source: "fallback",
        detail: summarizeOpenAiError(createRes.status, createRaw, "OpenAI Videos"),
      };
    }

    const created = JSON.parse(createRaw) as VideoJob;
    const videoId = created.id?.trim();
    if (!videoId) {
      return {
        url: null,
        video_id: null,
        source: "fallback",
        detail: "OpenAI Videos response missing job id.",
      };
    }

    await pollVideoJob(apiKey, videoId);
    const buffer = await downloadVideoBuffer(apiKey, videoId);
    const dataUrl = `data:video/mp4;base64,${buffer.toString("base64")}`;

    return {
      url: dataUrl,
      video_id: videoId,
      source: "openai-sora",
      detail: null,
      duration_seconds: seconds,
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
