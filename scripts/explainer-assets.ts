/**
 * Asset generation for explainer renders: one AI illustration per scene
 * (b-roll) and a voiceover track, both with the user's OpenAI key.
 * Used by scripts/render-worker.ts.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import {
  BRAND_ILLUSTRATION_STYLES,
  type BrandKit,
} from "@/lib/brand-kit";
import type { ExplainerScene } from "@/lib/explainer-script";
import { NARRATION_LEAD, type TimedScene } from "@/lib/explainer-timing";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const IMAGE_QUALITY = process.env.EXPLAINER_IMAGE_QUALITY?.trim() || "medium";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
const IMAGE_CONCURRENCY = 4;

type Log = (message: string, extra?: unknown) => void;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function runFfmpeg(args: string[], bin = process.env.HYPERFRAMES_FFMPEG_PATH || "ffmpeg") {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr = (stderr + c.toString()).slice(-4000)));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (e) => resolve({ code: 1, stdout, stderr: e.message }));
  });
}

export async function probeDurationSeconds(file: string): Promise<number> {
  const bin = process.env.HYPERFRAMES_FFPROBE_PATH || "ffprobe";
  const r = await runFfmpeg(
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    bin
  );
  const n = Number(r.stdout.trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function imagePromptFor(scene: ExplainerScene, kit: BrandKit): string {
  const style =
    BRAND_ILLUSTRATION_STYLES.find((s) => s.value === kit.illustrationStyle)?.prompt ??
    BRAND_ILLUSTRATION_STYLES[0].prompt;
  return [
    scene.imagePrompt,
    `Style: ${style}.`,
    `Color palette built around ${kit.primaryColor}, ${kit.secondaryColor} and accent ${kit.accentColor}.`,
    "Vertical 2:3 composition, main subject in the upper two thirds, calm lower third for captions.",
    "Absolutely no text, letters, numbers, words, logos or watermarks anywhere in the image.",
  ].join(" ");
}

async function generateImage(apiKey: string, prompt: string, file: string): Promise<boolean> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1536",
      quality: IMAGE_QUALITY,
    }),
  });
  if (!res.ok) {
    throw new Error(`image HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (item?.b64_json) {
    fs.writeFileSync(file, Buffer.from(item.b64_json, "base64"));
    return true;
  }
  if (item?.url) {
    const img = await fetch(item.url);
    if (!img.ok) return false;
    fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    return true;
  }
  return false;
}

/** Generate scene illustrations. Scenes whose image fails simply have none. */
export async function generateSceneImages(params: {
  apiKey: string;
  scenes: ExplainerScene[];
  kit: BrandKit;
  dir: string;
  log: Log;
}): Promise<ExplainerScene[]> {
  return mapLimit(params.scenes, IMAGE_CONCURRENCY, async (scene, i) => {
    if (!scene.imagePrompt) return scene;
    const name = `scene-${i}.png`;
    try {
      const ok = await generateImage(
        params.apiKey,
        imagePromptFor(scene, params.kit),
        path.join(params.dir, name)
      );
      return ok ? { ...scene, image: name } : scene;
    } catch (error) {
      params.log(`Illustration ${i} failed`, (error as Error).message);
      return scene;
    }
  });
}

async function generateSpeech(apiKey: string, text: string, voice: string, file: string) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      response_format: "mp3",
      instructions:
        "You are narrating a short social media explainer. Warm, clear and energetic, like a friendly expert. Natural pace, slight emphasis on key words, no long pauses.",
    }),
  });
  if (!res.ok) {
    throw new Error(`speech HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/**
 * Voiceover per scene. Returns scenes with audioDuration set, or null when
 * TTS fails (the video then renders without voiceover).
 */
export async function generateSceneVoiceover(params: {
  apiKey: string;
  scenes: ExplainerScene[];
  voice: string;
  dir: string;
  log: Log;
}): Promise<{ scenes: ExplainerScene[]; files: string[] } | null> {
  try {
    const files = await mapLimit(params.scenes, 4, async (scene, i) => {
      const file = path.join(params.dir, `vo-${i}.mp3`);
      await generateSpeech(params.apiKey, scene.narration, params.voice, file);
      return file;
    });
    const durations = await Promise.all(files.map(probeDurationSeconds));
    if (durations.some((d) => d <= 0)) throw new Error("could not measure voiceover length");
    return {
      scenes: params.scenes.map((s, i) => ({ ...s, audioDuration: durations[i] })),
      files,
    };
  } catch (error) {
    params.log("Voiceover failed, rendering without it", (error as Error).message);
    return null;
  }
}

export type AudioCue = { file: string; at: number; volume?: number };

/**
 * Synthesize the sound effects used on transitions and reveals with ffmpeg
 * (no audio assets to license): a soft whoosh, a pop and an outro chime.
 */
export async function synthesizeSfx(dir: string): Promise<{ whoosh: string; pop: string; chime: string }> {
  const out = {
    whoosh: path.join(dir, "sfx-whoosh.wav"),
    pop: path.join(dir, "sfx-pop.wav"),
    chime: path.join(dir, "sfx-chime.wav"),
  };
  const jobs: Array<[string, string[]]> = [
    [out.whoosh, ["-f", "lavfi", "-i", "anoisesrc=color=pink:duration=0.55:amplitude=0.5:seed=7",
      "-af", "highpass=f=400,lowpass=f=5000,afade=t=in:d=0.22,afade=t=out:st=0.25:d=0.3"]],
    [out.pop, ["-f", "lavfi", "-i", "sine=frequency=740:duration=0.14",
      "-af", "afade=t=in:d=0.005,afade=t=out:st=0.02:d=0.12"]],
    [out.chime, ["-f", "lavfi", "-i", "sine=frequency=659:duration=0.9", "-f", "lavfi", "-i", "sine=frequency=988:duration=0.9",
      "-filter_complex", "[0][1]amix=inputs=2,afade=t=in:d=0.01,afade=t=out:st=0.1:d=0.8[a]", "-map", "[a]"]],
  ];
  for (const [file, args] of jobs) {
    const r = await runFfmpeg(["-y", "-v", "error", ...args, "-ar", "44100", "-ac", "2", file]);
    if (r.code !== 0) throw new Error(`ffmpeg sfx failed: ${r.stderr.slice(-200)}`);
  }
  return out;
}

/** Narration cues: each scene's voiceover at its scene start + lead. */
export function narrationCues(files: string[], scenes: TimedScene[]): AudioCue[] {
  return files.map((file, i) => ({ file, at: scenes[i].start + NARRATION_LEAD, volume: 1 }));
}

/** Mix cues into one soundtrack of exactly `total` seconds. */
export async function buildAudioTrack(params: {
  cues: AudioCue[];
  total: number;
  output: string;
}): Promise<void> {
  const cues = params.cues.filter((c) => c.at < params.total);
  if (cues.length === 0) throw new Error("No audio cues");
  const inputs = cues.flatMap((c) => ["-i", c.file]);
  const delayed = cues.map((c, i) => {
    const ms = Math.max(0, Math.round(c.at * 1000));
    return `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${(c.volume ?? 1).toFixed(2)},adelay=${ms}|${ms}[a${i}]`;
  });
  const mix =
    cues.map((_, i) => `[a${i}]`).join("") +
    `amix=inputs=${cues.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95,apad[out]`;
  const r = await runFfmpeg([
    "-y", "-v", "error",
    ...inputs,
    "-filter_complex", [...delayed, mix].join(";"),
    "-map", "[out]",
    "-t", params.total.toFixed(2),
    "-ac", "2",
    "-b:a", "160k",
    params.output,
  ]);
  if (r.code !== 0) throw new Error(`ffmpeg audio mix failed: ${r.stderr.slice(-300)}`);
}
