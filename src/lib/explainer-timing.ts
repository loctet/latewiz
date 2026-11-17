import {
  DEFAULT_EXPLAINER_SECONDS,
  EXPLAINER_MIN_SECONDS,
  clampExplainerSeconds,
  type ExplainerScene,
} from "@/lib/explainer-script";

/** Seconds two scenes overlap during a transition. */
export const SCENE_OVERLAP = 0.5;
/** Voiceover starts this long after its scene starts. */
export const NARRATION_LEAD = 0.35;
/** Brand outro length (no voiceover from the script). */
export const OUTRO_SECONDS = 4;

const MIN_SCENE_SECONDS = 4;
/** Spoken pace used when there is no voiceover to measure. */
const WORDS_PER_SECOND = 2.4;

export function estimateNarrationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / WORDS_PER_SECOND;
}

export type TimedScene = ExplainerScene & {
  start: number;
  duration: number;
  audioDuration: number;
};

/**
 * Lay scenes out on the timeline. Each scene lasts its voiceover plus a lead,
 * a breathing pause and the transition overlap. Scenes are stretched evenly
 * so the video reaches at least 90% of the target length (and never less
 * than EXPLAINER_MIN_SECONDS).
 */
export function layoutExplainerTimeline(
  scenes: ExplainerScene[],
  options: { outro: boolean; targetSeconds?: number; outroSeconds?: number }
): { scenes: TimedScene[]; total: number; outroStart: number } {
  const target = clampExplainerSeconds(options.targetSeconds ?? DEFAULT_EXPLAINER_SECONDS);
  const base = scenes.map((scene) => {
    const audio =
      scene.audioDuration && scene.audioDuration > 0
        ? scene.audioDuration
        : estimateNarrationSeconds(scene.narration);
    return {
      audio,
      duration: Math.max(MIN_SCENE_SECONDS, NARRATION_LEAD + audio + 0.7 + SCENE_OVERLAP),
    };
  });

  const outroLength = options.outro ? options.outroSeconds ?? OUTRO_SECONDS : 0;
  const naturalTotal =
    base.reduce((sum, s) => sum + s.duration - SCENE_OVERLAP, 0) + SCENE_OVERLAP + outroLength;
  // Hold visuals a little longer when the narration came out short, so the
  // video stays close to the length the user picked.
  const floor = Math.max(EXPLAINER_MIN_SECONDS, target * 0.97);
  const shortfall = Math.max(0, floor - naturalTotal);
  const stretch = base.length > 0 ? shortfall / base.length : 0;

  let t = 0;
  const timed: TimedScene[] = scenes.map((scene, i) => {
    const duration = Math.round((base[i].duration + stretch) * 100) / 100;
    const out: TimedScene = {
      ...scene,
      start: Math.round(t * 100) / 100,
      duration,
      audioDuration: Math.round(base[i].audio * 100) / 100,
    };
    t += duration - SCENE_OVERLAP;
    return out;
  });

  const outroStart = Math.round(t * 100) / 100;
  const total = Math.round((t + (options.outro ? outroLength : SCENE_OVERLAP)) * 100) / 100;
  return { scenes: timed, total, outroStart };
}
