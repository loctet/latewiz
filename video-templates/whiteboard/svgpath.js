// SVG path / shape → polylines (no DOM), so icons can be drawn as marker strokes in Node and in the page.
// Supports M L H V C S Q T A Z (absolute and relative). Output: arrays of [x,y,x,y,...] in icon units.

function arcToPoints(x1, y1, rx, ry, phi, fa, fs, x2, y2, out) {
  // endpoint → centre parameterisation (SVG spec F.6.5)
  if (rx === 0 || ry === 0) { out.push(x2, y2); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / (den || 1))); if (fa === fs) co = -co;
  const cxp = co * (rx * y1p) / ry, cyp = co * -(ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= Math.PI * 2; else if (fs && dt < 0) dt += Math.PI * 2;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
  for (let i = 1; i <= n; i++) {
    const t = t1 + dt * i / n, ct = Math.cos(t), st = Math.sin(t);
    out.push(cx + rx * ct * cp - ry * st * sp, cy + rx * ct * sp + ry * st * cp);
  }
}

export function pathToPolylines(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) || [];
  const polys = []; let cur = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const start = (nx, ny) => { cur = [nx, ny]; polys.push(cur); };
  const cubic = (x1, y1, x2, y2, ex, ey) => { const n = 10; for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; cur.push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey); } };
  const quad = (x1, y1, ex, ey) => { const n = 8; for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; cur.push(u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey); } };
  while (i < toks.length) {
    if (/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'Z') { if (cur) cur.push(sx, sy); x = sx; y = sy; prev = C; if (!isNum()) continue; }
    if (C === 'M') { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } x = sx = nx; y = sy = ny; start(x, y); cmd = rel ? 'l' : 'L'; prev = 'M'; continue; }
    if (!cur) start(x, y);
    if (C === 'L') { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } x = nx; y = ny; cur.push(x, y); }
    else if (C === 'H') { let nx = num(); if (rel) nx += x; x = nx; cur.push(x, y); }
    else if (C === 'V') { let ny = num(); if (rel) ny += y; y = ny; cur.push(x, y); }
    else if (C === 'C') { let a = [num(), num(), num(), num(), num(), num()]; if (rel) a = a.map((v, k) => v + (k % 2 ? y : x)); cubic(...a); lcx = a[2]; lcy = a[3]; x = a[4]; y = a[5]; }
    else if (C === 'S') { let a = [num(), num(), num(), num()]; if (rel) a = a.map((v, k) => v + (k % 2 ? y : x)); const r1x = prev === 'C' || prev === 'S' ? 2 * x - lcx : x, r1y = prev === 'C' || prev === 'S' ? 2 * y - lcy : y; cubic(r1x, r1y, ...a); lcx = a[0]; lcy = a[1]; x = a[2]; y = a[3]; }
    else if (C === 'Q') { let a = [num(), num(), num(), num()]; if (rel) a = a.map((v, k) => v + (k % 2 ? y : x)); quad(...a); lqx = a[0]; lqy = a[1]; x = a[2]; y = a[3]; }
    else if (C === 'T') { let a = [num(), num()]; if (rel) a = [a[0] + x, a[1] + y]; const qx = prev === 'Q' || prev === 'T' ? 2 * x - lqx : x, qy = prev === 'Q' || prev === 'T' ? 2 * y - lqy : y; quad(qx, qy, a[0], a[1]); lqx = qx; lqy = qy; x = a[0]; y = a[1]; }
    else if (C === 'A') { const rx = num(), ry = num(), rot = num(), fa = num(), fs = num(); let ex = num(), ey = num(); if (rel) { ex += x; ey += y; } arcToPoints(x, y, rx, ry, rot * Math.PI / 180, fa, fs, ex, ey, cur); x = ex; y = ey; }
    else { i++; continue; }
    prev = C;
  }
  return polys.filter(p => p.length >= 4);
}

/** Lucide icon node list ([[tag, attrs], ...]) → polylines in the 24×24 icon box. */
export function iconPolylines(nodes) {
  const out = [];
  for (const [tag, a] of nodes || []) {
    if (tag === 'path') out.push(...pathToPolylines(a.d));
    else if (tag === 'circle' || tag === 'ellipse') {
      const cx = +a.cx, cy = +a.cy, rx = +(a.r ?? a.rx), ry = +(a.r ?? a.ry), p = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2 - 2.2; p.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry); }
      out.push(p);
    } else if (tag === 'rect') {
      const x = +a.x || 0, y = +a.y || 0, w = +a.width, h = +a.height, r = Math.min(+(a.rx || 0), w / 2, h / 2);
      if (r > 0) out.push(...pathToPolylines(`M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`));
      else out.push([x, y, x + w, y, x + w, y + h, x, y + h, x, y]);
    } else if (tag === 'line') out.push([+a.x1, +a.y1, +a.x2, +a.y2]);
    else if (tag === 'polyline' || tag === 'polygon') {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      if (tag === 'polygon') pts.push(pts[0], pts[1]);
      out.push(pts);
    }
  }
  return out;
}
