/**
 * Whiteboard explainer audio, all in Node (no Python): Kokoro voice (offline, free), procedural marker foley
 * placed on every stroke the board planner scheduled, and a kalimba + plucked-bass score ducked under the voice.
 * Writes one 48 kHz stereo WAV that the render worker attaches to the composition.
 */
import fs from "fs";
import path from "path";

const SR = 48000;

// ───────── Kokoro (kokoro-js, ONNX on CPU). The model (~300 MB) downloads once to the Hugging Face cache.
type Kokoro = { generate(text: string, o: { voice: string; speed?: number }): Promise<{ audio: Float32Array; sampling_rate: number }> };
let kokoro: Promise<Kokoro> | null = null;
function loadKokoro(): Promise<Kokoro> {
  if (!kokoro) {
    kokoro = import("kokoro-js").then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" }) as unknown as Promise<Kokoro>
    );
  }
  return kokoro;
}


/** One mono 48 kHz clip per scene narration. Returns clips and their lengths in seconds. */
export async function kokoroVoiceover(texts: string[], voice: string): Promise<{ clips: Float32Array[]; durations: number[] }> {
  const tts = await loadKokoro();
  const clips: Float32Array[] = [];
  for (const text of texts) {
    const out = await tts.generate(text, { voice, speed: 0.95 });
    clips.push(trimSilence(resample(out.audio, out.sampling_rate, SR)));
  }
  return { clips, durations: clips.map((c) => c.length / SR) };
}

function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.round(x.length * to / from), y = new Float32Array(n), k = from / to;
  for (let i = 0; i < n; i++) { const p = i * k, j = Math.floor(p), f = p - j; y[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? 0) * f; }
  return y;
}
function trimSilence(x: Float32Array, thr = 0.008): Float32Array {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  return x.slice(Math.max(0, a - 480), Math.min(x.length, b + 2400));
}

// ───────── tiny DSP
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(11);
const gauss = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function noise(n: number) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = gauss(); return x; }
function biquad(x: Float32Array, type: "bp" | "lp" | "hp", f: number, q = 0.707): Float32Array {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2; const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === "bp") { b0 = al; b1 = 0; b2 = -al; } else if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
const band = (x: Float32Array, lo: number, hi: number) => { const f = Math.sqrt(lo * hi), q = f / (hi - lo); return biquad(biquad(x, "bp", f, q), "bp", f, q); };
const BANDS = new Map<string, Float32Array>();
function bandNoise(n: number, lo: number, hi: number) {
  const k = `${lo | 0}-${hi | 0}`;
  if (!BANDS.has(k)) { const b = band(noise(SR * 6), lo, hi); let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); BANDS.set(k, b.map((v) => v / (m || 1) * 2.2)); }
  const b = BANDS.get(k)!, i = Math.floor(R() * (b.length - n - 1)); return b.subarray(i, i + n);
}

// ───────── foley
function marker(dur: number, len: number, kind: string, pen: string, z: number): Float32Array {
  const d = Math.max(.03, dur), n = Math.floor(d * SR), br = pen === "accent" ? 1.12 : pen === "blue" ? .92 : 1;
  const hiss = bandNoise(n, 2200 * br, 7500 * br), body = bandNoise(n, 500 * br, 1500 * br), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / n, v = kind === "dash" ? 1.2 : 1 - .8 * Math.cos(2 * Math.PI * u);
    const a = Math.pow(v / 1.8, .8) * Math.min(1, u * d / .006) * Math.min(1, (1 - u) * d / .012);
    const grain = R() < .004 * (1 + v) ? gauss() * .6 : 0;
    x[i] = (hiss[i] * (.55 + .45 * v / 1.8) + body[i] * .45 + grain) * a;
  }
  if (kind !== "dash" && len > 140 && R() < .25) {                       // the dry-erase squeak
    const s0 = (.15 + R() * .4) * d, sd = Math.min(d - s0, .06 + R() * .1);
    if (sd > .03) { const m = Math.floor(sd * SR), f0 = (1500 + R() * 1100) * br, vib = 7 + R() * 6; let ph = 0; const i0 = Math.floor(s0 * SR);
      for (let k = 0; k < m && i0 + k < n; k++) { const t = k / SR; ph += 2 * Math.PI * f0 * (1 + .03 * Math.sin(2 * Math.PI * vib * t)) / SR; x[i0 + k] += (Math.sin(ph) + .3 * Math.sin(2 * ph)) * Math.pow(Math.sin(Math.PI * t / sd), 1.5) * .35; } }
  }
  const tick = Math.floor(.004 * SR), tn = bandNoise(tick, 2500, 6500);
  for (let i = 0; i < tick; i++) x[i] += tn[i] * (1 - i / tick) * 1.4;
  const g = .32 * Math.min(1.3, Math.sqrt(z));
  for (let i = 0; i < n; i++) x[i] *= g;
  return x;
}
function whoosh(d: number, v = 1) { const n = Math.floor(d * SR), b = bandNoise(n, 300, 2400), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = b[i] * Math.sin(Math.PI * i / n) ** 2 * .3 * v; return x; }
function ringTone(fs: number[], taus: number[], amps: number[], d: number) { const n = Math.floor(d * SR), x = new Float32Array(n); fs.forEach((f, k) => { for (let i = 0; i < n; i++) x[i] += Math.sin(2 * Math.PI * f * i / SR) * Math.exp(-i / SR / taus[k]) * amps[k]; }); return x; }
function capPop() { const x = ringTone([1750, 3400], [.03, .012], [.8, .3], .25), k = Math.floor(.07 * SR), b = bandNoise(k, 1200, 5000); const y = new Float32Array(x.length + k); for (let i = 0; i < k; i++) y[i] = b[i] * (.2 + .8 * i / k) * .35; y.set(x.map((v) => v * .6), k); return y; }
function capOn() { const y = new Float32Array(Math.floor(.2 * SR)); [0, .045].forEach((o, j) => { const r = ringTone([2600], [.015], [.4], .06), i0 = Math.floor(o * SR), b = bandNoise(Math.floor(.006 * SR), 2500, 9000); for (let i = 0; i < b.length; i++) y[i0 + i] += b[i] * (1 - i / b.length) * (1 - .4 * j); for (let i = 0; i < r.length; i++) y[i0 + i] += r[i]; }); return y.map((v) => v * .7); }

// ───────── score: kalimba, plucked bass, bells
const mf = (m: number) => 440 * 2 ** ((m - 69) / 12);
function kalimba(m: number, v = 1, d = 1.6) {
  const n = Math.floor(d * SR), f = mf(m), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / .55) + .5 * Math.sin(2 * Math.PI * f * 1.004 * t) * Math.exp(-t / .4) + .32 * Math.sin(2 * Math.PI * f * 5.95 * t) * Math.exp(-t / .045) + .12 * Math.sin(2 * Math.PI * f * 2.98 * t) * Math.exp(-t / .12)) * .3 * v * Math.min(1, i / 144); }
  return x;
}
function pluck(m: number, v = 1, d = 1.4) {
  const f = mf(m), N = Math.floor(SR / f), n = Math.floor(d * SR), y = new Float32Array(n + N), init = biquad(noise(N), "lp", 2500);
  y.set(init.map((s) => s * .5), 0);
  for (let i = N; i < n + N; i++) y[i] = .996 * .5 * (y[i - N] + y[i - N + 1]);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = (y[i + N] * Math.exp(-t / .9) + .3 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t / .25)) * .42 * v; }
  return out;
}
function bell(m: number, v = 1, d = 1.8) { const n = Math.floor(d * SR), f = mf(m), x = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; x[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / .7) + .4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / .25)) * .16 * v; } return x; }

// ───────── mix buses
class Bus {
  L: Float32Array; Rr: Float32Array;
  constructor(public n: number) { this.L = new Float32Array(n); this.Rr = new Float32Array(n); }
  add(x: Float32Array, t: number, g = 1, pan = 0) {
    const i0 = Math.floor(t * SR); if (i0 >= this.n || t < 0) return;
    const l = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2 * g, r = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2 * g;
    for (let i = 0; i < x.length && i0 + i < this.n; i++) { this.L[i0 + i] += x[i] * l; this.Rr[i0 + i] += x[i] * r; }
  }
  rms() { let s = 0, c = 0; for (let i = 0; i < this.n; i++) { const v = Math.max(Math.abs(this.L[i]), Math.abs(this.Rr[i])); if (v > 1e-4) { s += this.L[i] ** 2 + this.Rr[i] ** 2; c += 2; } } return c ? Math.sqrt(s / c) : 1; }
}

export type BoardEvent = { t: number; type: string; dur?: number; len?: number; pen?: string; pan?: number; z?: number; on?: number };

/**
 * Build the full soundtrack. `voice` = per-scene clips placed at scene start + lead.
 * Score follows the scenes: motif every bar, bass from scene 2, a bell on each new scene, resolve at the outro.
 */
export function buildWhiteboardSoundtrack(p: {
  total: number;
  events: BoardEvent[];
  scenes: Array<{ start: number }>;
  voice: Float32Array[] | null;
  lead: number;
  outroStart: number;
  output: string;
}) {
  const n = Math.ceil((p.total + .5) * SR);
  const fol = new Bus(n), mus = new Bus(n), vo = new Bus(n), amb = new Bus(n);
  const db = (x: number) => 10 ** (x / 20);

  for (const e of p.events) {
    const off = e.on === 0 ? db(-9) : 1, pan = e.pan ?? 0, z = e.z ?? 1;
    if (e.type === "stroke" || e.type === "write" || e.type === "dash") fol.add(marker(e.dur ?? .2, e.len ?? 50, e.type, e.pen ?? "black", z), e.t, off * (e.type === "write" ? .8 : 1), pan);
    else if (e.type === "tap") { const k = Math.floor(.03 * SR), b = bandNoise(k, 1800, 6000); fol.add(b.map((v, i) => v * Math.exp(-i / SR / .004) * .3), e.t, off, pan); }
    else if (e.type === "whoosh") fol.add(whoosh(e.dur ?? .9, .5), e.t, 1, 0);
    else if (e.type === "cap") fol.add(capPop(), e.t, 1, .35);
    else if (e.type === "capOn") fol.add(capOn(), e.t, 1, .4);
  }

  // score
  const BEAT = 60 / 96, MOTIF = [74, 69, 71, 78];
  const sceneAt = (t: number) => { let k = 0; p.scenes.forEach((s, i) => { if (s.start <= t) k = i; }); return k; };
  for (let t = .15; t < p.outroStart - .3; t += 4 * BEAT) {
    const k = sceneAt(t), shift = k >= Math.ceil(p.scenes.length / 2) ? 2 : 0;          // a step up for the second half
    MOTIF.forEach((m, j) => mus.add(kalimba(m + shift, j ? .75 : .9), t + j * BEAT, 1, -.15 + .1 * j));
    if (k >= 1) { mus.add(pluck(38 + shift, .85), t); mus.add(pluck(45 + shift, .65), t + 2 * BEAT); }
  }
  p.scenes.forEach((s, i) => { if (i) mus.add(bell(86 - (i % 3) * 2, .7), s.start + .2, 1, .3); });
  [74, 69, 71, 74].forEach((m, j) => mus.add(kalimba(m, .95, j === 3 ? 3.2 : 1.6), p.outroStart + .4 + j * BEAT * 1.25));
  mus.add(pluck(38, .7, 3), p.outroStart + .4);

  // voice + ducking envelope
  const env = new Float32Array(n);
  if (p.voice) p.voice.forEach((clip, i) => {
    const t = p.scenes[i].start + p.lead; vo.add(clip, t, 1, 0);
    const i0 = Math.floor(t * SR); for (let k = 0; k < clip.length && i0 + k < n; k++) env[i0 + k] = Math.max(env[i0 + k], Math.abs(clip[k]));
  });
  const duck = new Float32Array(n); let g = 0; const win = 2400;
  for (let i = 0; i < n; i += 240) { let m = 0; for (let k = i; k < Math.min(n, i + win); k++) m = Math.max(m, env[k]); const tgt = m > .02 ? 1 : 0; g += (tgt - g) * (tgt > g ? 240 / (.06 * SR) : 240 / (.35 * SR)); duck.fill(g, i, Math.min(n, i + 240)); }
  for (let i = 0; i < n; i++) { const k = 1 - (1 - db(-9)) * duck[i]; mus.L[i] *= k; mus.Rr[i] *= k; }

  // room tone
  const rt = biquad(noise(n), "lp", 900); for (let i = 0; i < n; i++) { amb.L[i] = rt[i] * .006; amb.Rr[i] = rt[(i + 311) % n] * .006; }

  // balance by RMS: voice on top, score ~10 dB under, foley ~11 dB under
  const vr = p.voice ? vo.rms() : db(-20), mr = mus.rms(), fr = fol.rms();
  const gm = vr / mr * db(-10), gf = vr / fr * db(-11);
  const L = new Float32Array(n), Rch = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = vo.L[i] + mus.L[i] * gm + fol.L[i] * gf + amb.L[i]; Rch[i] = vo.Rr[i] + mus.Rr[i] * gm + fol.Rr[i] * gf + amb.Rr[i]; }
  // gain to about -16 LUFS-ish (voice RMS -20 dBFS), then a soft limiter
  const target = db(-20) / vr;
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * target * 1.1) / 1.1; Rch[i] = Math.tanh(Rch[i] * target * 1.1) / 1.1; }
  writeWav(p.output, L, Rch, Math.floor(p.total * SR));
}

/** Mono 48 kHz clip → 16-bit WAV (used for Kokoro clips in the motion-graphics style). */
export function writeMonoWav(file: string, x: Float32Array) { writeWav(file, x, x, x.length); }

function writeWav(file: string, L: Float32Array, Rch: Float32Array, frames: number) {
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Rch[i])) * 32767), 46 + i * 4); }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}
