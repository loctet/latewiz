// Whiteboard board planner — turns an explainer script into marker strokes, pens and a camera.
// Pure JS (no DOM): the render worker runs it in Node to get exact stroke timings for the foley,
// and the page runs the same code to draw. Same input → same strokes, same times.
//
//   plan({ scenes, total, outroStart, brand, glyphs, icons }) → { tl, cam, pens, board, regions, outro, ev }
//
// Board: one region per scene on a serpentine grid (3 columns), an outro region after the last scene.
// Colours: black = structure and text, blue = signals and data, accent = the thing that matters.
import * as W from './wb.js';
import { iconPolylines } from './svgpath.js';
import { clamp } from './lib.js';

export const CELL = { w: 1200, h: 2100, gx: 260, gy: 300, cols: 3, margin: 320 };
export const LEAD = 0.35;

/** Marker colours from the brand, kept dark enough to read on a white board. */
export function markerColours(brand = {}) {
  const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1; const v = parseInt(m[1], 16); const c = [v >> 16, (v >> 8) & 255, v & 255].map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const darken = (hex, k) => { const v = parseInt(hex.slice(1), 16); const c = [v >> 16, (v >> 8) & 255, v & 255].map(x => Math.round(x * k)); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); };
  const usable = (hex, fallback, maxLum) => { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return fallback; let h = hex, k = 1; while (lum(h) > maxLum && k > .3) { k -= .1; h = darken(hex, k); } return h; };
  return {
    black: W.INK.black,
    blue: usable(brand.primaryColor, W.INK.blue, .12),
    accent: usable(brand.accentColor, W.INK.orange, .3),
  };
}

export function regionOf(i) {
  const row = Math.floor(i / CELL.cols), k = i % CELL.cols, col = row % 2 === 0 ? k : CELL.cols - 1 - k;
  const x = CELL.margin + col * (CELL.w + CELL.gx), y = CELL.margin + row * (CELL.h + CELL.gy);
  return { i, row, col, x, y, w: CELL.w, h: CELL.h, cx: x + CELL.w / 2, cy: y + CELL.h / 2 };
}

export function plan({ scenes, total, outroStart, brand = {}, glyphs }) {
  if (glyphs) W.setFont('tech', glyphs);
  const icons = plan.icons || {};
  const ink = markerColours(brand);
  const tl = new W.Timeline();
  const K = new W.Pen('black', ink.black, { park: [W.VP.w + 260, W.VP.h * .62] });
  const B = new W.Pen('blue', ink.blue, { park: [W.VP.w + 220, W.VP.h * .74] });
  const A = new W.Pen('accent', ink.accent, { park: [W.VP.w + 300, W.VP.h * .52] });
  const PENS = [K, B, A];
  const T = W.text;
  const D = (pen, shapes, a, b, o = {}) => { if (b < a + .12) b = a + .12; return tl.draw(pen, shapes, a, { by: b, ...o }); };

  // ── helpers
  const wrap = (str, maxW, h) => {
    const words = String(str || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for (const w of words) { const next = cur ? cur + ' ' + w : w; if (cur && W.textWidth(next, { h }) > maxW) { lines.push(cur); cur = w; } else cur = next; }
    if (cur) lines.push(cur); return lines;
  };
  const fit = (str, maxW, h, minH = 34) => { while (h > minH && W.textWidth(str, { h }) > maxW) h -= 4; return h; };
  const lines = (str, x, y, maxW, h, o = {}) => {             // wrapped text → strokes, centred by default
    const ls = wrap(str, maxW, h), lh = h * 1.45, out = [];
    ls.forEach((l, k) => out.push(...T(l, x, y + k * lh, { h, align: o.align ?? 'center', ...o })));
    out.height = ls.length * lh; return out;
  };
  const icon = (name, cx, cy, size, o = {}) => {
    const polys = iconPolylines(icons[name] || icons.sparkles || []), s = size / 24, w = clamp(size * .05, 6, 13);
    return polys.map(p => { const q = []; for (let i = 0; i < p.length; i += 2) q.push(cx + (p[i] - 12) * s, cy + (p[i + 1] - 12) * s); return W.poly(q, { w, jitter: .5, ...o }); });
  };
  const ringAround = (cx, cy, r, o = {}) => W.circle(cx, cy, r, { w: 9, lap: .3, ...o });

  // ── one visual per scene; steps are placed on the narration as fractions (f) with a duration (d)
  function visual(v, box) {
    const { x: bx, y: by, w: bw, h: bh } = box, cx = bx + bw / 2, cy = by + bh / 2, steps = [];
    const S = (pen, shapes, f, d) => steps.push({ pen, shapes, f, d });
    switch (v?.kind) {
      case 'icon-row': {
        const it = v.items || [], n = it.length;
        const pos = n === 2 ? [[cx - 260, cy - 60], [cx + 260, cy - 60]] : n === 3 ? [[cx - 330, cy - 60], [cx, cy - 60], [cx + 330, cy - 60]] : [[cx - 250, cy - 230], [cx + 250, cy - 230], [cx - 250, cy + 250], [cx + 250, cy + 250]];
        const sz = n === 3 ? 220 : 250;
        it.forEach((x, k) => { S(K, icon(x.icon, pos[k][0], pos[k][1], sz), k / n * .85, .8); S(K, T(x.label, pos[k][0], pos[k][1] + sz * .78, { h: fit(x.label, n === 3 ? 300 : 440, 52), align: 'center' }), k / n * .85 + .06, .5); });
        if (n) S(A, W.line(pos[n - 1][0] - 110, pos[n - 1][1] + sz * .9, pos[n - 1][0] + 110, pos[n - 1][1] + sz * .9, { w: 9 }), .92, .3);
        break;
      }
      case 'flow': {
        const it = v.items || [], n = it.length, rh = Math.min(200, (bh - 40) / n - 60);
        it.forEach((x, k) => {
          const y = by + 40 + k * (rh + 70), f = k / n * .88;
          S(B, ringAround(bx + 110, y + rh / 2, rh * .42), f, .35);
          S(K, icon(x.icon, bx + 110, y + rh / 2, rh * .5), f + .03, .5);
          S(K, W.roundRect(bx + 230, y + 10, bw - 250, rh - 20, 24, { w: 8 }), f + .02, .45);
          S(K, T(x.label, bx + 230 + (bw - 250) / 2, y + rh / 2 + 22, { h: fit(x.label, bw - 300, 58), align: 'center' }), f + .06, .55);
          if (k < n - 1) S(A, W.arrow(bx + 110, y + rh / 2 + rh * .45, bx + 110, y + rh + 62, { w: 8, head: 22 }), f + .1, .3);
        });
        break;
      }
      case 'cycle': {
        const it = v.items || [], n = it.length, R = 340, ccy = cy + 20;
        S(B, icon('repeat', cx, ccy, 170), 0, .6);
        it.forEach((x, k) => {
          const a = -Math.PI / 2 + k / n * Math.PI * 2, nx = cx + Math.cos(a) * R, ny = ccy + Math.sin(a) * R, f = k / n * .85;
          S(K, ringAround(nx, ny, 100), f, .35);
          S(K, icon(x.icon, nx, ny, 110), f + .03, .45);
          S(K, T(x.label, nx, ny + 160, { h: fit(x.label, 360, 44), align: 'center' }), f + .06, .45);
          const a0 = a + .42, a1 = a + Math.PI * 2 / n - .42;
          S(A, W.arc(cx, ccy, R, a0, a1, { w: 8 }), f + .09, .4);
          const hx = cx + Math.cos(a1) * R, hy = ccy + Math.sin(a1) * R, ta = a1 + Math.PI / 2;
          S(A, [W.line(hx - Math.cos(ta - .5) * 34, hy - Math.sin(ta - .5) * 34, hx, hy, { w: 8, bow: 0 }), W.line(hx - Math.cos(ta + .5) * 34, hy - Math.sin(ta + .5) * 34, hx, hy, { w: 8, bow: 0 })], f + .14, .15);
        });
        break;
      }
      case 'compare': {
        const colW = bw / 2 - 40, L = v.left || {}, R = v.right || {};
        S(K, W.line(cx, by + 30, cx, by + bh - 40, { w: 7 }), 0, .4);
        [[L, bx + colW / 2, K, '×', 0], [R, cx + 40 + colW / 2, A, '✓', .5]].forEach(([s, x, pen, mark, f0]) => {
          S(K, T(s.title || '', x, by + 110, { h: fit(s.title || '', colW - 20, 72), align: 'center' }), f0, .5);
          S(pen, icon(s.icon, x, by + 340, 230), f0 + .05, .6);
          (s.points || []).forEach((p, k) => {
            const yy = by + 590 + k * 150;
            S(pen, T(mark, x - colW / 2 + 40, yy, { h: 60 }), f0 + .12 + k * .1, .2);
            S(K, lines(p, x + 30, yy, colW - 90, 50), f0 + .14 + k * .1, .45);
          });
        });
        S(A, ringAround(cx + 40 + colW / 2, by + 340, 170), .92, .4);
        break;
      }
      case 'equation': {
        const it = v.items || [], n = it.length, xs = n === 2 ? [cx - 280, cx + 280] : [cx - 380, cx, cx + 380], sz = n === 2 ? 230 : 190, y0 = cy - 220;
        it.forEach((x, k) => {
          const f = k / (n + 1) * .9;
          S(K, icon(x.icon, xs[k], y0, sz), f, .6);
          S(K, T(x.label, xs[k], y0 + sz * .8, { h: fit(x.label, 300, 46), align: 'center' }), f + .05, .4);
          if (k < n - 1) S(A, T('+', (xs[k] + xs[k + 1]) / 2, y0 + 30, { h: 110, align: 'center', w: 13 }), f + .08, .2);
        });
        const r = v.result || {}, fy = cy + 330;
        S(A, T('=', cx, cy + 110, { h: 120, align: 'center', w: 13 }), n / (n + 1) * .9 - .05, .2);
        S(K, icon(r.icon, cx, fy, 270), n / (n + 1) * .9, .6);
        S(A, ringAround(cx, fy, 200), n / (n + 1) * .9 + .05, .35);
        S(A, T(r.label || '', cx, fy + 290, { h: fit(r.label || '', 700, 64), align: 'center' }), n / (n + 1) * .9 + .08, .4);
        break;
      }
      case 'analogy': {
        const [a, b] = v.items || [];
        const isz = Math.min(280, bh * .24);
        if (a) { S(K, icon(a.icon, cx, by + isz * .6, isz), 0, .7); S(K, T(a.label, cx, by + isz * 1.35, { h: fit(a.label, 800, 58), align: 'center' }), .1, .4); }
        S(A, T('≈  is like', cx, cy + 30, { h: 66, align: 'center' }), .35, .5);
        if (b) { S(A, icon(b.icon, cx, by + bh - isz * 1.25, isz), .55, .7); S(K, T(b.label, cx, by + bh - isz * .35, { h: fit(b.label, 800, 62), align: 'center' }), .68, .45); }
        break;
      }
      case 'bar-chart': {
        const bars = v.bars || [], n = bars.length, max = Math.max(...bars.map(b => b.value), 1), base = by + bh - 160, top = by + 120;
        const slot = (bw - 120) / n, bwid = Math.min(220, slot * .62);
        S(K, [W.line(bx + 60, base, bx + bw - 40, base, { w: 9 }), W.line(bx + 60, base + 10, bx + 60, top - 30, { w: 9 })], 0, .45);
        bars.forEach((b, k) => {
          const x0 = bx + 60 + slot * k + (slot - bwid) / 2, hh = Math.max(20, (b.value / max) * (base - top)), f = .1 + k / n * .78, top_ = b.value === max;
          const pen = top_ ? A : B;
          S(pen, W.rect(x0, base - hh, bwid, hh, { w: 8, over: 4 }), f, .4);
          S(pen, W.hatch([[x0, base - hh], [x0 + bwid, base - hh], [x0 + bwid, base], [x0, base]], { spacing: 30, w: 6 }), f + .05, .35);
          S(K, T(fmtNum(b.value, v.unit), x0 + bwid / 2, base - hh - 30, { h: 50, align: 'center' }), f + .09, .3);
          S(K, T(b.label, x0 + bwid / 2, base + 80, { h: fit(b.label, slot - 10, 42), align: 'center' }), f + .02, .3);
        });
        break;
      }
      case 'line-chart': {
        const vals = v.values || [], n = vals.length, min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
        const x0 = bx + 90, x1 = bx + bw - 60, y0 = by + bh - 220, y1 = by + 160;
        const pts = vals.map((val, k) => [x0 + k / (n - 1) * (x1 - x0), y0 - (val - min) / span * (y0 - y1)]);
        S(K, [W.line(x0 - 20, y0 + 30, x1 + 20, y0 + 30, { w: 9 }), W.line(x0 - 20, y0 + 30, x0 - 20, y1 - 60, { w: 9 })], 0, .45);
        S(B, W.curve(pts, { w: 11 }), .12, .55);
        pts.forEach((p, k) => S(A, W.circle(p[0], p[1], 14, { w: 9, lap: .4 }), .12 + k / (n - 1) * .55, .12));
        const last = pts[n - 1];
        S(A, T(fmtNum(vals[n - 1], v.unit), last[0] - 40, last[1] - 70, { h: 64, align: 'center' }), .72, .35);
        if (v.startLabel) S(K, T(v.startLabel, x0, y0 + 120, { h: 44, align: 'left' }), .05, .35);
        if (v.endLabel) S(K, T(v.endLabel, x1, y0 + 120, { h: 44, align: 'right' }), .7, .35);
        break;
      }
      case 'stat': {
        const val = String(v.value || ''), h = fit(val, 820, 300, 120);
        S(K, icon(v.icon, cx, by + 120, 160), 0, .45);
        S(A, T(val, cx, cy + 60, { h, align: 'center', w: Math.max(14, h * .12) }), .08, .7);
        S(A, W.circle(cx, cy - h * .3, Math.max(300, W.textWidth(val, { h }) * .62), { w: 10, ry: h * .9, lap: .35 }), .4, .45);
        if (v.label) S(K, lines(v.label, cx, cy + 340, 860, 56), .5, .6);
        break;
      }
      case 'pictogram': {
        const n = v.total || 10, cols = n <= 10 ? 5 : Math.min(5, Math.ceil(n / 4)), rows = Math.ceil(n / cols), sz = n <= 10 ? 160 : 120;
        const gx = bx + bw / 2 - (cols - 1) * sz * .62, gy = by + 140;
        for (let k = 0; k < n; k++) {
          const x = gx + (k % cols) * sz * 1.24, y = gy + Math.floor(k / cols) * sz * 1.3, hi = k < (v.highlight || 0);
          S(hi ? A : K, icon(v.icon || 'user', x, y, sz, { w: 7 }), hi ? .35 + k / n * .3 : k / n * .3, .25);
        }
        const yc = gy + rows * sz * 1.3 + 120;
        S(A, T(`${v.highlight} / ${n}`, cx, yc, { h: 120, align: 'center', w: 14 }), .72, .35);
        if (v.label) S(K, lines(v.label, cx, yc + 120, 900, 50), .8, .45);
        break;
      }
      case 'checklist': {
        const ls = v.lines || [], n = ls.length;
        ls.forEach((l, k) => {
          const y = by + 120 + k * 220, f = k / n * .85;
          S(K, W.rect(bx + 60, y - 60, 90, 90, { w: 8, over: 4 }), f, .25);
          S(K, lines(l, bx + 200, y, bw - 240, 56, { align: 'left' }), f + .03, .5);
          S(A, W.poly([[bx + 70, y - 20], [bx + 102, y + 18], [bx + 168, y - 90]], { w: 12, jitter: .4 }), f + .12, .2);
        });
        break;
      }
      case 'timeline': {
        const ev = v.events || [], n = ev.length, x = bx + 160;
        S(B, W.line(x, by + 40, x, by + bh - 60, { w: 9 }), 0, .5);
        ev.forEach((e, k) => {
          const y = by + 120 + k * ((bh - 200) / Math.max(1, n - 1 || 1)), f = .1 + k / n * .8;
          S(A, W.circle(x, y, 26, { w: 10, lap: .4 }), f, .15);
          S(B, T(e.when, x + 80, y - 30, { h: 44, align: 'left' }), f + .02, .3);
          S(K, lines(e.label, x + 80, y + 50, bw - 280, 52, { align: 'left' }), f + .05, .45);
        });
        break;
      }
      case 'chat': {
        const ms = v.messages || [];
        let y = by + 60;
        ms.forEach((m, k) => {
          const right = m.side === 'right', ls = wrap(m.text, 640, 46), bh2 = ls.length * 66 + 50, w = Math.min(760, Math.max(...ls.map(l => W.textWidth(l, { h: 46 }))) + 80);
          const x0 = right ? bx + bw - 40 - w : bx + 40, f = k / ms.length * .85;
          S(right ? A : K, W.roundRect(x0, y, w, bh2, 34, { w: 8 }), f, .35);
          S(K, lines(m.text, x0 + 40, y + 78, 640, 46, { align: 'left' }), f + .04, .5);
          y += bh2 + 60;
        });
        break;
      }
      case 'phone': {
        const pw = 580, ph = Math.min(bh - 40, 960), px = cx - pw / 2, py = by + 20;
        S(K, W.roundRect(px, py, pw, ph, 70, { w: 10 }), 0, .55);
        S(K, W.line(cx - 60, py + 50, cx + 60, py + 50, { w: 8 }), .05, .15);
        if (v.label) S(B, T(v.label, cx, py + 150, { h: 52, align: 'center' }), .08, .35);
        (v.lines || []).forEach((l, k) => {
          const y = py + 220 + k * 190, f = .15 + k / (v.lines.length) * .7;
          S(K, W.roundRect(px + 40, y, pw - 80, 150, 24, { w: 7 }), f, .3);
          S(K, lines(l, px + 70, y + 65, pw - 200, 36, { align: 'left' }), f + .03, .4);
          S(A, icon('heart', px + pw - 90, y + 75, 56, { w: 6 }), f + .08, .2);
        });
        break;
      }
      case 'code': {
        const ls = v.lines || [], h = 42;
        S(K, W.roundRect(bx + 20, by + 40, bw - 40, Math.min(bh - 80, 160 + ls.length * 90), 28, { w: 9 }), 0, .45);
        S(K, [W.circle(bx + 80, by + 100, 12, { w: 8 }), W.circle(bx + 125, by + 100, 12, { w: 8 }), W.circle(bx + 170, by + 100, 12, { w: 8 })], .03, .2);
        ls.forEach((l, k) => { if (l.trim()) S(B, T(l, bx + 80, by + 220 + k * 90, { h, align: 'left' }), .08 + k / ls.length * .8, .5); });
        break;
      }
      case 'definition': {
        const term = v.term || '', th = fit(term, 820, 120, 60);
        S(K, icon(v.icon, cx, by + 170, 220), 0, .55);
        S(B, T('definition', cx, by + 380, { h: 42, align: 'center' }), .05, .3);
        S(K, T(term, cx, by + 560, { h: th, align: 'center', w: Math.max(9, th * .11) }), .1, .5);
        S(A, W.curve([[cx - W.textWidth(term, { h: th }) / 2, by + 600], [cx, by + 615], [cx + W.textWidth(term, { h: th }) / 2, by + 595]], { w: 10, over: 18 }), .3, .3);
        S(K, lines(v.meaning, cx, by + 760, 900, 54), .38, .55);
        break;
      }
      case 'quote': {
        S(A, [W.curve([[bx + 140, by + 160], [bx + 90, by + 210], [bx + 110, by + 260]], { w: 14 }), W.curve([[bx + 230, by + 160], [bx + 180, by + 210], [bx + 200, by + 260]], { w: 14 })], 0, .3);
        S(K, lines(v.text, cx, by + 420, 920, 64), .08, .75);
        if (v.author) S(B, T('— ' + v.author, bx + bw - 60, by + bh - 120, { h: 50, align: 'right' }), .85, .3);
        break;
      }
      default: {                                              // icon-hero (and anything unknown)
        S(K, icon(v?.icon || 'lightbulb', cx, cy - 100, 520), 0, 1.0);
        S(A, ringAround(cx, cy - 100, 380), .4, .5);
        if (v?.caption) S(K, T(v.caption, cx, cy + 360, { h: fit(v.caption, 900, 80), align: 'center' }), .55, .6);
      }
    }
    return steps;
  }

  // ── scenes
  const regions = [];
  scenes.forEach((s, i) => {
    const r = regionOf(i); regions.push(r);
    const start = s.start, dur = s.duration, nS = start + LEAD, nE = nS + Math.max(1.4, (s.audioDuration || dur - 1.2));
    // pen leads the camera: a blue line from the previous region to this heading
    if (i > 0) {
      // routed through the gap between regions, so it never crosses the content
      const p = regions[i - 1]; let pts;
      if (p.row === r.row) { const dir = r.col > p.col ? 1 : -1, x0 = dir > 0 ? p.x + p.w - 30 : p.x + 30, x1 = dir > 0 ? r.x + 30 : r.x + r.w - 30; pts = [[x0, p.y + 200], [(x0 + x1) / 2, p.y + 120], [x1, r.y + 200]]; }
      else pts = [[p.cx, p.y + p.h - 30], [p.cx + 120, p.y + p.h + CELL.gy / 2], [r.cx, r.y + 30]];
      D(B, W.curve(pts, { w: 9 }), start - .45, start + .3, { tag: 'link' });
    }
    // heading
    let hh = 100; while (hh > 60 && wrap(s.heading || '', CELL.w - 220, hh).length > 2) hh -= 6;
    const head = lines(s.heading || '', r.cx, r.y + 250, CELL.w - 220, hh);
    D(K, head, start + .25, start + .25 + clamp(.45 + (s.heading || '').length * .045, .8, 2.0), { minGap: .02, maxGap: .06, tag: 'heading' });
    const ulY = r.y + 250 + head.height - hh * .4;
    D(A, W.curve([[r.cx - 160, ulY], [r.cx, ulY + 10], [r.cx + 160, ulY - 6]], { w: 10, over: 14 }), start + .9, start + 1.25);
    // the visual, hung on the narration
    const box = { x: r.x + 100, y: r.y + 250 + head.height + 70, w: CELL.w - 200, h: 0 };
    box.h = r.y + 1680 - box.y;
    const span = Math.max(1.2, nE - nS - .4);
    for (const st of visual(s.visual, box)) {
      const a = nS + .3 + st.f * span;
      D(st.pen, st.shapes, a, a + Math.max(.18, st.d * Math.min(1.4, span / 6)), { minGap: .02, maxGap: .08 });
    }
  });

  // ── outro region: brand CTA written by hand
  const ro = regionOf(scenes.length);
  const outro = { region: ro, start: outroStart };
  const os = outroStart, wT = os + 2.3;
  const cta = brand.ctaText || 'Follow for more';
  const ctaS = lines(cta, ro.cx, ro.cy - 40, CELL.w - 200, fit(cta, CELL.w - 200, 110, 70));
  D(K, ctaS, wT, wT + 1.0, { minGap: .02, maxGap: .05 });
  if (brand.handle) D(A, T(brand.handle, ro.cx, ro.cy + ctaS.height + 40, { h: fit(brand.handle, CELL.w - 260, 84), align: 'center' }), wT + 1.05, wT + 1.7);
  if (brand.signature) D(B, T(brand.signature, ro.cx, ro.cy + ctaS.height + 200, { h: fit(brand.signature, CELL.w - 260, 54), align: 'center' }), wT + 1.75, wT + 2.3);
  if (!brand.logo && brand.brandName) D(K, T(brand.brandName, ro.cx, ro.cy - 360, { h: fit(brand.brandName, CELL.w - 260, 110), align: 'center', w: 12 }), os + 1.6, wT - .05);
  outro.logoBox = { x: ro.cx - 260, y: ro.cy - 640, w: 520, h: 360, t: os + 1.8 };
  tl.cue(Math.max(0, os - .2), 'whoosh', { dur: 1.2 });
  tl.cue(os + 1.4, 'whoosh', { dur: 1.0 });
  tl.cue(.05, 'cap');
  tl.cue(Math.min(total - .3, wT + 2.5), 'capOn');
  tl.end();

  // ── board size and camera
  const rowsN = Math.floor(scenes.length / CELL.cols) + 1;
  const board = { W: CELL.margin * 2 + CELL.cols * CELL.w + (CELL.cols - 1) * CELL.gx, H: CELL.margin * 2 + rowsN * CELL.h + (rowsN - 1) * CELL.gy };
  const Z = W.VP.w / (CELL.w - 110), zFull = Math.min(W.VP.w / board.W, W.VP.h / board.H) * .94;
  const keys = [[0, regions[0].cx, regions[0].cy, Z * 1.06], [.6, regions[0].cx, regions[0].cy, Z * 1.05, 0, 's']];
  scenes.forEach((s, i) => {
    const r = regions[i];
    if (i > 0) { const p = regions[i - 1]; keys.push([s.start - .5, p.cx, p.cy + 10, Z * 1.03, 0, 'l'], [s.start + .4, r.cx, r.cy, Z, 0, 'io']); tl.cue(s.start - .45, 'whoosh', { dur: .9 }); }
    keys.push([s.start + s.duration - .55, r.cx, r.cy + 12, Z * 1.03, 0, 'l']);
  });
  keys.push([os + 1.3, board.W / 2, board.H / 2, zFull, 0, 'io'], [os + 1.6, board.W / 2, board.H / 2, zFull * 1.01, 0, 'l'], [os + 2.4, ro.cx, ro.cy, Z, 0, 'io'], [total, ro.cx, ro.cy + 8, Z * 1.02, 0, 'l']);
  keys.sort((a, b) => a[0] - b[0]);
  const cam = new W.Camera(keys);
  tl.ev.sort((a, b) => a.t - b.t);

  // events with screen pan/zoom for the mixer
  const ev = tl.ev.map(e => {
    if (e.x == null) return e;
    const c = cam.at(Math.max(0, e.t)), [px, py] = W.toScreen(c, e.x, e.y);
    return { ...e, pan: +clamp((px - W.VP.w / 2) / (W.VP.w * .75), -.7, .7).toFixed(2), z: +c.z.toFixed(2), on: px > -100 && px < W.VP.w + 100 && py > -100 && py < W.VP.h + 100 ? 1 : 0 };
  });
  return { tl, cam, pens: PENS, board, regions, outro, ev, ink };
}

function fmtNum(n, unit) {
  let u = String(unit || '').trim(); const a = Math.abs(n);
  if (u.length > 4 && !/^(dollars?|usd)$/i.test(u)) u = '';   // long units belong in the narration, not on the bar
  let s = a >= 1e6 ? (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : a >= 1e4 ? (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K' : (Math.round(n * 10) / 10).toString();
  if (/^[$€£]$/.test(u) || /^(dollars?|usd)$/i.test(u)) return (/^[€£]$/.test(u) ? u : '$') + s;
  if (/^(%|x)$/i.test(u)) return s + u;
  return u ? `${s} ${u}` : s;
}
