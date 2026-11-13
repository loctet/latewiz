/**
 * Explainer render worker.
 *
 * Polls the `render_jobs` table, renders each job with the HyperFrames CLI
 * (headless Chrome + FFmpeg, no account needed), stores the MP4 in
 * `generated_media`, and sets the campaign slot's video_url. The next cron
 * run then publishes the slot.
 *
 * Runs anywhere with Node >= 22, FFmpeg on PATH, and access to the same
 * database as the app (local SQLite, or Turso with USE_TURSO=true).
 *
 *   npm run render-worker          # loop forever
 *   npm run render-worker -- --once  # process at most one job, then exit
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { getBrandKit, getBrandLogo } from "@/lib/server/brand-kit";
import {
  claimNextRenderJob,
  completeRenderJob,
  failRenderJob,
  recordWorkerHeartbeat,
  removeWorkerHeartbeat,
  type RenderJob,
} from "@/lib/server/render-jobs";
import { saveGeneratedVideoBuffer } from "@/lib/server/generated-media-files";
import { updateScheduledCampaign } from "@/lib/server/scheduled-campaign-store";
import type { ScheduledCampaignSlot } from "@/lib/scheduled-campaigns";
import { STANDALONE_RENDER_CAMPAIGN_ID } from "@/lib/render-jobs";
import { normalizeExplainerScript } from "@/lib/explainer-script";
import { layoutExplainerTimeline } from "@/lib/explainer-timing";
import { getUserSecret, allowEnvKeyFallback } from "@/lib/server/vault";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import {
  buildNarrationTrack,
  generateSceneImages,
  generateSceneVoiceover,
} from "./explainer-assets";

const TEMPLATE_DIR = path.join(process.cwd(), "video-templates", "explainer");
const HYPERFRAMES = process.env.HYPERFRAMES_PACKAGE?.trim() || "hyperframes@0.9.41";
// In containers the CLI is installed in the image; call it directly instead of npx.
const HYPERFRAMES_BIN = process.env.HYPERFRAMES_BIN?.trim() || "";
// Parallel Chrome capture workers (~256 MB+ each). Unset = HyperFrames "auto".
const RENDER_WORKERS = process.env.RENDER_WORKERS?.trim() || "";
const QUALITY = process.env.RENDER_QUALITY?.trim() || "looks";
// 24fps reads as smooth for text-and-shape motion and renders ~20% faster than 30.
const FPS = process.env.RENDER_FPS?.trim() || "24";
const POLL_MS = Math.max(5_000, Number(process.env.RENDER_POLL_MS) || 15_000);
const RENDER_TIMEOUT_MS = 20 * 60 * 1000;
const WORKER_ID = `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

const LOGO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function log(message: string, extra?: unknown) {
  const line = `[render-worker ${new Date().toISOString()}] ${message}`;
  if (extra === undefined) console.log(line);
  else console.log(line, extra);
}

async function patchSlot(
  campaignId: string,
  slotId: string,
  patch: Partial<ScheduledCampaignSlot>
) {
  // On-demand renders (Compose / AI Studio) have no campaign slot to update.
  if (campaignId === STANDALONE_RENDER_CAMPAIGN_ID) return;
  try {
    await updateScheduledCampaign(campaignId, (campaign) => ({
      ...campaign,
      slots: campaign.slots.map((slot) =>
        slot.id === slotId ? { ...slot, ...patch } : slot
      ),
    }));
  } catch (error) {
    // Campaign deleted while rendering: the job result is simply unused.
    log(`Could not update slot ${campaignId}/${slotId}`, (error as Error).message);
  }
}

function runHyperframes(args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const [cmd, cmdArgs] = HYPERFRAMES_BIN
      ? [HYPERFRAMES_BIN, args]
      : ["npx", ["-y", HYPERFRAMES, ...args]];
    const child = spawn(cmd, cmdArgs, {
      cwd,
      // npx is a .cmd shim on Windows and needs a shell there.
      shell: process.platform === "win32",
      env: { ...process.env, HYPERFRAMES_NON_INTERACTIVE: "1", CI: "1" },
    });
    let output = "";
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-8000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => {
      output += "\nRender timed out.";
      child.kill("SIGKILL");
    }, RENDER_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}\n${error.message}` });
    });
  });
}

async function resolveOpenAiKey(userId: string): Promise<string | null> {
  const fromVault = await getUserSecret(userId, "openai");
  if (fromVault && isPlausibleOpenAiApiKey(fromVault)) return fromVault;
  if (allowEnvKeyFallback()) {
    const env = process.env.OPENAI_API_KEY?.trim();
    if (env && isPlausibleOpenAiApiKey(env)) return env;
  }
  return null;
}

/**
 * Copy the template, generate illustrations + voiceover, lay out the
 * timeline and write vars.json. Returns the video length in seconds.
 */
async function prepareProject(job: RenderJob, dir: string): Promise<number> {
  fs.cpSync(TEMPLATE_DIR, dir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}.hyperframes`),
  });

  const kit = await getBrandKit(job.userId);
  let logoFile = "";
  if (kit.hasLogo) {
    const logo = await getBrandLogo(job.userId);
    if (logo) {
      logoFile = `logo.${LOGO_EXT[logo.contentType] ?? "png"}`;
      fs.writeFileSync(path.join(dir, logoFile), logo.bytes);
    }
  }

  const script = normalizeExplainerScript(job.payload.script) ?? job.payload.script;
  let scenes = script.scenes;
  const apiKey = await resolveOpenAiKey(job.userId);
  let voiceFiles: string[] | null = null;

  if (apiKey) {
    const t0 = Date.now();
    const [withImages, voice] = await Promise.all([
      generateSceneImages({ apiKey, scenes, kit, dir, log }),
      kit.voiceoverEnabled
        ? generateSceneVoiceover({ apiKey, scenes, voice: kit.voice, dir, log })
        : Promise.resolve(null),
    ]);
    scenes = withImages.map((scene, i) => ({
      ...scene,
      audioDuration: voice?.scenes[i]?.audioDuration,
    }));
    voiceFiles = voice?.files ?? null;
    log(
      `Assets ready in ${Math.round((Date.now() - t0) / 1000)}s: ${scenes.filter((s) => s.image).length}/${scenes.length} illustrations, voiceover ${voiceFiles ? "on" : "off"}`
    );
  } else {
    log("No OpenAI key for this user: rendering without illustrations or voiceover");
  }

  const layout = layoutExplainerTimeline(scenes, { outro: kit.showOutro });

  if (voiceFiles) {
    await buildNarrationTrack({
      files: voiceFiles,
      scenes: layout.scenes,
      total: layout.total,
      output: path.join(dir, "narration.mp3"),
    });
    const html = path.join(dir, "index.html");
    const marker = "<!-- narration-audio -->";
    const source = fs.readFileSync(html, "utf8");
    if (!source.includes(marker)) throw new Error("Template is missing the narration marker");
    fs.writeFileSync(
      html,
      source.replace(
        marker,
        `<audio id="narration" src="narration.mp3" data-start="0" data-duration="${layout.total.toFixed(2)}" data-track-index="9"></audio>`
      )
    );
  }

  const variables = {
    scenes: JSON.stringify(layout.scenes),
    totalDuration: layout.total,
    outroStart: layout.outroStart,
    // Without voiceover, captions are how the video explains itself.
    captions: voiceFiles ? kit.captionsEnabled : true,
    brandName: kit.brandName,
    primaryColor: kit.primaryColor,
    secondaryColor: kit.secondaryColor,
    accentColor: kit.accentColor,
    backgroundColor: kit.backgroundColor,
    textColor: kit.textColor,
    fontFamily: kit.fontFamily,
    videoTheme: kit.videoTheme,
    logoPosition: kit.logoPosition,
    logo: logoFile,
    signature: kit.signature,
    ctaText: kit.ctaText,
    website: kit.website,
    handle: kit.handle,
    showIntro: kit.showIntro,
    showOutro: kit.showOutro,
  };
  fs.writeFileSync(path.join(dir, "vars.json"), JSON.stringify(variables, null, 2));
  return layout.total;
}

/** Remove temp project dirs from earlier renders that could not be deleted then. */
function sweepStaleTempDirs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (!name.startsWith("latewiz-render-")) continue;
    const full = path.join(os.tmpdir(), name);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    } catch {
      /* still locked; try again next job */
    }
  }
}

async function processJob(job: RenderJob) {
  sweepStaleTempDirs();
  log(`Rendering job ${job.id} (slot ${job.slotId}, attempt ${job.attempts})`);
  await patchSlot(job.campaignId, job.slotId, { renderStatus: "rendering" });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "latewiz-render-"));
  const output = path.join(dir, "out.mp4");
  const started = Date.now();
  try {
    const totalSeconds = await prepareProject(job, dir);
    const result = await runHyperframes(
      [
        "render",
        "--variables-file",
        "vars.json",
        "--quality",
        QUALITY,
        "--fps",
        FPS,
        ...(RENDER_WORKERS ? ["--workers", RENDER_WORKERS] : []),
        "--output",
        output,
      ],
      dir
    );
    if (result.code !== 0 || !fs.existsSync(output) || fs.statSync(output).size === 0) {
      throw new Error(
        `hyperframes render exited ${result.code}: ${result.output.trim().split("\n").slice(-6).join(" | ")}`
      );
    }

    const bytes = fs.readFileSync(output);
    const media = await saveGeneratedVideoBuffer(
      job.userId,
      bytes,
      job.payload.captionDigest,
      String(Math.round(totalSeconds))
    );
    await completeRenderJob(job.id, media.id);
    await patchSlot(job.campaignId, job.slotId, {
      video_url: media.url,
      renderStatus: "done",
      lastError: null,
    });
    log(
      `Done job ${job.id}: ${(bytes.length / 1024 / 1024).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)}s`
    );
  } catch (error) {
    const message = (error as Error).message;
    const final = await failRenderJob(job, message);
    log(`Job ${job.id} failed${final ? " permanently" : ", will retry"}: ${message}`);
    if (final) {
      await patchSlot(job.campaignId, job.slotId, {
        renderStatus: "failed",
        lastError: `Explainer render failed: ${message.slice(0, 300)}`,
      });
    } else {
      await patchSlot(job.campaignId, job.slotId, { renderStatus: "queued" });
    }
  } finally {
    // On Windows, Chrome can hold files briefly after the render exits.
    // Retry, and never let cleanup crash the worker loop.
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (error) {
      log(`Could not remove temp dir ${dir}`, (error as Error).message);
    }
  }
}

async function main() {
  const once = process.argv.includes("--once");
  if (!fs.existsSync(path.join(TEMPLATE_DIR, "index.html"))) {
    throw new Error(`Template not found at ${TEMPLATE_DIR}. Run from the repo root.`);
  }
  log(`Worker ${WORKER_ID} started (quality=${QUALITY}, fps=${FPS}, poll=${POLL_MS}ms)`);

  // Heartbeat on a timer so the app knows a worker is alive, even mid-render.
  const beat = () =>
    recordWorkerHeartbeat(WORKER_ID).catch((error: Error) =>
      log("Heartbeat failed", error.message)
    );
  await beat();
  const heartbeat = setInterval(beat, 20_000);

  let stopping = false;
  const stop = () => {
    stopping = true;
    log("Stopping after the current job…");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    let job: RenderJob | null = null;
    try {
      job = await claimNextRenderJob(WORKER_ID);
    } catch (error) {
      log("Failed to claim a job", (error as Error).message);
    }
    if (job) {
      await processJob(job);
    } else if (once) {
      log("No queued jobs.");
    }
    if (once) break;
    if (!job) await new Promise((r) => setTimeout(r, POLL_MS));
  }

  clearInterval(heartbeat);
  await removeWorkerHeartbeat(WORKER_ID).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
