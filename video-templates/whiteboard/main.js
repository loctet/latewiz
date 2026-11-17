// Whiteboard explainer composition (HyperFrames). The planner turns the script into strokes; this page draws
// the board for any time t. A paused GSAP timeline drives render(t), so every frame is seekable.
import * as W from './wb.js';
import { plan } from './planner.js';
import icons from './icons.js';
import { clamp, mulberry, TAU } from './lib.js';

const v = window.__hyperframes.getVariables();
const text = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);

// ── script (worker passes timed scenes; Studio preview falls back to a demo)
const DEMO = [
  { heading: 'Why posts stall at 200 views', narration: 'Ever wonder why your posts stop at two hundred views? It is almost never the algorithm.', visual: { kind: 'icon-hero', icon: 'trending-down', caption: 'Stuck at 200' } },
  { heading: 'What is a hook?', narration: 'A hook is the first line people see. Think of it like a shop window.', visual: { kind: 'definition', term: 'Hook', meaning: 'The first line that makes people stop scrolling.', icon: 'eye' } },
  { heading: 'How a good hook works', narration: 'First you stop the scroll, then you make a promise, then you deliver it.', visual: { kind: 'flow', items: [{ icon: 'hand', label: 'Stop the scroll' }, { icon: 'handshake', label: 'Make a promise' }, { icon: 'gift', label: 'Deliver fast' }] } },
  { heading: 'Same post, new first line', narration: 'Same post twice. Only the first line changed, and the saves doubled.', visual: { kind: 'bar-chart', unit: '', bars: [{ label: 'Before', value: 100 }, { label: 'After', value: 200 }] } },
];
let scenes = [];
try { const p = JSON.parse(v.scenes || '[]'); if (Array.isArray(p) && p.length) scenes = p; } catch { scenes = []; }
if (!scenes.length) scenes = DEMO;
const OVERLAP = .5, LEAD = .35, OUTRO = v.showOutro === false ? 0 : 5.5;
if (!scenes.every(s => isFinite(+s.start) && +s.duration > 0)) {
  let t = 0;
  for (const s of scenes) { const words = text(s.narration, 400).split(' ').filter(Boolean).length, a = +s.audioDuration > 0 ? +s.audioDuration : words / 2.4; s.start = t; s.duration = Math.max(4, LEAD + a + .9 + OVERLAP); s.audioDuration = a; t += s.duration - OVERLAP; }
}
scenes.forEach(s => { s.start = +s.start; s.duration = +s.duration; });
const last = scenes[scenes.length - 1];
const outroStart = +v.outroStart > 0 ? +v.outroStart : last.start + last.duration - OVERLAP;
const total = +v.totalDuration > 0 ? +v.totalDuration : outroStart + (OUTRO || OVERLAP);

// ── plan the board
const glyphs = (await (await fetch('fonts/EMSTech.json')).json()).glyphs;
plan.icons = icons;
const brand = { primaryColor: v.primaryColor, accentColor: v.accentColor, ctaText: text(v.ctaText, 60), handle: text(v.handle, 40), signature: text(v.signature, 60), brandName: text(v.brandName, 40), logo: text(v.logo, 200) };
const P = plan({ scenes, total, outroStart, brand, glyphs });

// ghosts of old lessons
const ghosts = [], gR = mulberry(77);
for (let i = 0; i < Math.round(P.board.W * P.board.H / 900000); i++) {
  const x = gR() * (P.board.W - 400) + 200, y = gR() * (P.board.H - 400) + 200, k = gR();
  const o = { w: 12, alpha: .04 + gR() * .05, color: gR() < .2 ? '#8aa0c8' : '#9aa0a8' };
  if (k < .3) ghosts.push(...W.text(['x = 4', 'f(x)', 'q.2', 'TUE', 'n + 1', 'ok!', '→ ?'][i % 7], x, y, { h: 50 + gR() * 40, ...o }));
  else if (k < .55) ghosts.push(W.circle(x, y, 40 + gR() * 110, o));
  else if (k < .8) ghosts.push(...W.arrow(x, y, x + (gR() - .5) * 500, y + (gR() - .5) * 300, o));
  else ghosts.push(W.line(x, y, x + 200 + gR() * 500, y + (gR() - .5) * 80, o));
}
const board = new W.Board(P.tl, { W: P.board.W, H: P.board.H, ghosts });

// logo as a printed card stuck on the board in the outro
let logoImg = null;
if (brand.logo) { logoImg = new Image(); logoImg.src = brand.logo; await logoImg.decode().catch(() => { logoImg = null; }); }
if (logoImg) board.objs.push({
  draw: (ctx, t, c) => {
    const b = P.outro.logoBox; if (t < b.t - .3) return;
    const u = clamp((t - b.t + .3) / .3), lift = 1 - u * u;
    const k = Math.min(b.w / logoImg.width, b.h / logoImg.height), w = logoImg.width * k, h = logoImg.height * k;
    const [sx, sy] = W.toScreen(c, b.x + b.w / 2, b.y + b.h / 2), s = c.z * (1 + lift * .1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.filter = `blur(${(8 + lift * 16) * c.z}px)`; ctx.fillStyle = `rgba(40,40,50,${.25 - lift * .1})`;
    ctx.fillRect(sx - w * s / 2 + 10 * c.z + lift * 20, sy - h * s / 2 + 14 * c.z + lift * 30, w * s + 40 * c.z, h * s + 40 * c.z); ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - w * s / 2 - 20 * c.z, sy - h * s / 2 - 20 * c.z - lift * 30, w * s + 40 * c.z, h * s + 40 * c.z);
    ctx.drawImage(logoImg, sx - w * s / 2, sy - h * s / 2 - lift * 30, w * s, h * s);
  },
});
board.objs.push({ draw: (ctx, t, c) => { for (const e of P.tl.erasers) W.drawEraser(ctx, e, t, c); } });
board.objs.push({ draw: (ctx, t, c) => { for (const p of P.pens) W.drawMarker(ctx, p, W.penPose(p, t, P.cam), c, t); } });

// ── captions: clause chunks timed across each scene's narration, whiteboard label style
const caps = [];
if (v.captions !== false) for (const s of scenes) {
  const words = text(s.narration, 400).split(' ').filter(Boolean); if (!words.length) continue;
  const audio = +s.audioDuration > 0 ? +s.audioDuration : words.length / 2.4, t0 = s.start + LEAD;
  const wts = words.map(w => 1 + w.replace(/[^\w]/g, '').length * .18), sum = wts.reduce((a, b) => a + b, 0);
  let t = t0, chunk = [], cs = t0;
  words.forEach((w, i) => {
    chunk.push(w); t += wts[i] / sum * audio;
    const txt = chunk.join(' ');
    if (txt.length > 34 || /[.!?,:;]$/.test(w) && txt.length > 14 || i === words.length - 1) { caps.push({ t0: cs - .05, t1: t + .25, text: txt }); chunk = []; cs = t; }
  });
}
for (let i = 0; i < caps.length - 1; i++) caps[i].t1 = Math.min(Math.max(caps[i].t1, caps[i].t0 + 1.2), caps[i + 1].t0 - .03);
board.overlays.push({
  draw: (ctx, t) => {
    const s = caps.find(c => t >= c.t0 && t < c.t1); if (!s) return;
    const a = Math.min(1, (t - s.t0) / .1, (s.t1 - t) / .1);
    ctx.font = '54px AD'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let rows = [s.text];
    if (ctx.measureText(s.text).width > 900) { const ws = s.text.split(' '), m = Math.ceil(ws.length / 2); rows = [ws.slice(0, m).join(' '), ws.slice(m).join(' ')]; }
    const w = Math.min(1000, Math.max(...rows.map(r => ctx.measureText(r).width)) + 70), h = 84 + (rows.length - 1) * 64, y0 = W.VP.h - 150 - h;
    ctx.globalAlpha = a * .92; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.2)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.roundRect(W.VP.w / 2 - w / 2, y0, w, h, 18); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
    ctx.fillStyle = P.ink.accent; ctx.fillRect(W.VP.w / 2 - w / 2 + 24, y0 + h - 14, 44, 5);
    ctx.fillStyle = '#23262c'; rows.forEach((r, i) => ctx.fillText(r, W.VP.w / 2, y0 + 44 + i * 64));
  },
});

// ── frame render, with camera motion blur on fast rides
const cv = document.getElementById('board'), ctx = cv.getContext('2d');
const off = new OffscreenCanvas(W.VP.w, W.VP.h), oc = off.getContext('2d');
function render(t) {
  const dt = 1 / 24, a = P.cam.at(t), b = P.cam.at(Math.max(0, t - dt));
  const sp = Math.hypot((a.x - b.x) * a.z, (a.y - b.y) * a.z) + Math.abs(Math.log(a.z / b.z)) * 900;
  const N = sp > 16 ? Math.min(6, Math.ceil(sp * .5 / 6)) : 1;
  if (N === 1) { board.render(ctx, t, P.cam); return; }
  const ov = board.overlays; board.overlays = [];
  for (let i = 0; i < N; i++) { board.render(oc, t - dt * .5 * i / (N - 1), P.cam); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(off, 0, 0); }
  ctx.globalAlpha = 1; board.overlays = ov;
  for (const o of ov) { ctx.save(); o.draw(ctx, t); ctx.restore(); }
}
await document.fonts.load('54px AD');
render(0);
const proxy = { t: 0 };
const tl = gsap.timeline({ paused: true });
tl.fromTo(proxy, { t: 0 }, { t: total, duration: total, ease: 'none', onUpdate: () => render(proxy.t) }, 0);
window.__timelines['whiteboard'] = tl;
// Built after async setup (fonts, icons, logo): tell the runtime to pick the finished timeline up.
document.getElementById('root').setAttribute('data-duration', String(+total.toFixed(2)));
if (typeof window.__hfForceTimelineRebind === 'function') window.__hfForceTimelineRebind();
void TAU;
