/*
 * Explainer visual library: turns a scene's `visual` spec into animated
 * icons, diagrams, charts and UI mocks. Each builder appends DOM to the
 * stage and returns animate(ctx), which adds tweens to the paused GSAP
 * timeline. Deterministic: no clocks, no Math.random.
 *
 * ctx = { tl, start, dur, narrStart, narrEnd, beat(k, n) }
 */
(function () {
  var SVGNS = "http://www.w3.org/2000/svg";
  var ICONS = window.EXPLAINER_ICONS || {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function clip(s, max) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
  }

  /** Lucide icon as inline SVG. Shapes get pathLength=1 so they can "draw". */
  function icon(name, size, strokeWidth) {
    var nodes = ICONS[name] || ICONS.sparkles || [];
    var s = svgEl("svg", {
      viewBox: "0 0 24 24", width: size, height: size, fill: "none",
      stroke: "currentColor", "stroke-width": strokeWidth || 1.8,
      "stroke-linecap": "round", "stroke-linejoin": "round", class: "ico",
    });
    nodes.forEach(function (n) {
      var attrs = {};
      for (var k in n[1]) attrs[k] = n[1][k];
      attrs.pathLength = 1;
      s.appendChild(svgEl(n[0], attrs));
    });
    return s;
  }

  /** Round badge holding an icon. */
  function badge(name, size, variant) {
    var b = el("div", "badge" + (variant ? " " + variant : ""));
    b.style.width = size + "px";
    b.style.height = size + "px";
    b.appendChild(icon(name, Math.round(size * 0.52)));
    return b;
  }

  function drawIcon(tl, root, at, dur) {
    var shapes = root.querySelectorAll(".ico > *");
    if (!shapes.length) return;
    tl.fromTo(shapes,
      { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } },
      { attr: { "stroke-dashoffset": 0 }, duration: dur || 0.8, ease: "power2.inOut", stagger: 0.06 },
      at);
  }

  function popIn(tl, node, at, opts) {
    opts = opts || {};
    tl.fromTo(node,
      { scale: opts.from != null ? opts.from : 0.3, opacity: 0, rotation: opts.rotation || 0 },
      { scale: 1, opacity: 1, rotation: 0, duration: opts.duration || 0.55, ease: opts.ease || "back.out(1.9)" },
      at);
  }

  function slideIn(tl, node, at, dx, dy) {
    tl.fromTo(node, { opacity: 0, x: dx || 0, y: dy == null ? 40 : dy },
      { opacity: 1, x: 0, y: 0, duration: 0.55, ease: "power3.out" }, at);
  }

  /** Gentle idle float so nothing sits perfectly still. */
  function bob(tl, node, at, until, amount) {
    var len = Math.max(0.5, until - at);
    var cycles = Math.max(1, Math.floor(len / 1.6));
    tl.fromTo(node, { y: 0 }, {
      y: -(amount || 12), duration: len / (cycles * 2), ease: "sine.inOut",
      yoyo: true, repeat: cycles * 2 - 1,
    }, at);
  }

  function labelEl(text, cls) {
    return el("div", "lbl" + (cls ? " " + cls : ""), clip(text, 28));
  }

  // Straight connector (SVG line) that draws itself, with an arrow head.
  function connector(w, h, vertical) {
    var s = svgEl("svg", { width: w, height: h, class: "conn", viewBox: "0 0 " + w + " " + h });
    var x1 = vertical ? w / 2 : 6, y1 = vertical ? 6 : h / 2;
    var x2 = vertical ? w / 2 : w - 18, y2 = vertical ? h - 18 : h / 2;
    s.appendChild(svgEl("line", { x1: x1, y1: y1, x2: x2, y2: y2, pathLength: 1, class: "conn-line" }));
    var head = vertical
      ? "M" + (w / 2 - 14) + " " + (h - 26) + " L" + w / 2 + " " + (h - 8) + " L" + (w / 2 + 14) + " " + (h - 26)
      : "M" + (w - 26) + " " + (h / 2 - 14) + " L" + (w - 8) + " " + h / 2 + " L" + (w - 26) + " " + (h / 2 + 14);
    s.appendChild(svgEl("path", { d: head, pathLength: 1, class: "conn-head" }));
    return s;
  }
  function drawConnector(tl, conn, at, dur) {
    tl.fromTo(conn.querySelectorAll("line, path"),
      { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } },
      { attr: { "stroke-dashoffset": 0 }, duration: dur || 0.45, ease: "power2.out", stagger: 0.25 }, at);
  }

  // ---------------------------------------------------------------- builders
  var B = {};

  B["icon-hero"] = function (v, stage) {
    var wrap = el("div", "v-hero");
    var ring = svgEl("svg", { width: 560, height: 560, viewBox: "0 0 560 560", class: "hero-ring" });
    ring.appendChild(svgEl("circle", { cx: 280, cy: 280, r: 262, pathLength: 1, class: "ring-dash" }));
    var b = badge(v.icon, 380, "big");
    var orbits = [];
    for (var i = 0; i < 6; i++) {
      var o = el("div", "orbit-dot");
      var a = (i / 6) * Math.PI * 2;
      o.style.left = Math.round(280 + Math.cos(a) * 300 - 14) + "px";
      o.style.top = Math.round(280 + Math.sin(a) * 300 - 14) + "px";
      wrap.appendChild(o);
      orbits.push(o);
    }
    wrap.appendChild(ring);
    wrap.appendChild(b);
    var cap = v.caption ? labelEl(v.caption, "hero-cap") : null;
    stage.appendChild(wrap);
    if (cap) stage.appendChild(cap);
    return function (c) {
      var tl = c.tl;
      tl.fromTo(ring.querySelector("circle"), { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.2, ease: "power2.inOut" }, c.start + 0.2);
      tl.fromTo(ring, { rotation: 0 }, { rotation: 90, duration: c.dur, ease: "none" }, c.start);
      popIn(tl, b, c.start + 0.3, { rotation: -15 });
      drawIcon(tl, b, c.start + 0.55, 1.1);
      orbits.forEach(function (o, k) { popIn(tl, o, c.start + 0.8 + k * 0.08, { duration: 0.35 }); });
      tl.fromTo(orbits, { x: 0, y: 0 }, { x: function (k) { return Math.cos(k) * 30; }, y: function (k) { return Math.sin(k) * 30; }, duration: c.dur, ease: "sine.inOut" }, c.start);
      bob(tl, b, c.start + 1.2, c.start + c.dur, 14);
      if (cap) slideIn(tl, cap, c.start + 0.9);
    };
  };

  B["icon-row"] = function (v, stage) {
    var grid = el("div", "v-grid n" + v.items.length);
    var cells = v.items.map(function (it) {
      var cell = el("div", "cell");
      var b = badge(it.icon, v.items.length > 3 ? 210 : 240);
      cell.appendChild(b);
      cell.appendChild(labelEl(it.label));
      grid.appendChild(cell);
      return { cell: cell, badge: b };
    });
    stage.appendChild(grid);
    return function (c) {
      cells.forEach(function (x, k) {
        var t = c.beat(k, cells.length);
        popIn(c.tl, x.cell, t - 0.1, { from: 0.5 });
        drawIcon(c.tl, x.badge, t + 0.1, 0.7);
      });
    };
  };

  B.flow = function (v, stage) {
    var col = el("div", "v-flow");
    var n = v.items.length;
    var rowH = n > 4 ? 150 : 175;
    var parts = v.items.map(function (it, k) {
      var row = el("div", "flow-row");
      row.style.height = rowH + "px";
      var b = badge(it.icon, rowH - 30);
      var card = el("div", "flow-card", clip(it.label, 22));
      var num = el("div", "flow-num", String(k + 1));
      row.appendChild(b);
      row.appendChild(card);
      row.appendChild(num);
      col.appendChild(row);
      var conn = null;
      if (k < n - 1) {
        conn = connector(120, 54, true);
        conn.style.marginLeft = (rowH - 30) / 2 - 60 + "px";
        col.appendChild(conn);
      }
      return { row: row, badge: b, card: card, num: num, conn: conn };
    });
    var packet = el("div", "packet");
    col.appendChild(packet);
    stage.appendChild(col);
    return function (c) {
      parts.forEach(function (p, k) {
        var t = c.beat(k, n);
        popIn(c.tl, p.badge, t - 0.15);
        drawIcon(c.tl, p.badge, t, 0.6);
        slideIn(c.tl, p.card, t + 0.05, 80, 0);
        popIn(c.tl, p.num, t + 0.25, { duration: 0.35 });
        if (p.conn) drawConnector(c.tl, p.conn, t + 0.45);
      });
      // A dot travels down the finished flow.
      var startY = (rowH - 30) / 2 - 16;
      var endY = (n - 1) * (rowH + 54) + startY;
      var at = c.beat(n - 1, n) + 0.8;
      c.tl.fromTo(packet, { opacity: 0, y: startY }, { opacity: 1, duration: 0.2 }, at);
      c.tl.to(packet, { y: endY, duration: Math.max(0.8, n * 0.35), ease: "power1.inOut" }, at + 0.1);
      c.tl.to(packet, { opacity: 0, duration: 0.2 }, at + 0.1 + Math.max(0.8, n * 0.35));
    };
  };

  B.cycle = function (v, stage) {
    var wrap = el("div", "v-cycle");
    var n = v.items.length, R = 300, C = 420;
    var arcs = svgEl("svg", { width: 840, height: 840, viewBox: "0 0 840 840", class: "cycle-arcs" });
    var nodes = v.items.map(function (it, k) {
      var a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      var a2 = -Math.PI / 2 + ((k + 1) / n) * Math.PI * 2;
      var pad = 0.36;
      var sx = C + Math.cos(a + pad) * R, sy = C + Math.sin(a + pad) * R;
      var ex = C + Math.cos(a2 - pad) * R, ey = C + Math.sin(a2 - pad) * R;
      var arc = svgEl("path", { d: "M" + sx + " " + sy + " A" + R + " " + R + " 0 0 1 " + ex + " " + ey, pathLength: 1, class: "conn-line" });
      arcs.appendChild(arc);
      var node = el("div", "cycle-node");
      node.style.left = Math.round(C + Math.cos(a) * R - 85) + "px";
      node.style.top = Math.round(C + Math.sin(a) * R - 85) + "px";
      var b = badge(it.icon, 170);
      node.appendChild(b);
      node.appendChild(labelEl(it.label, "small"));
      wrap.appendChild(node);
      return { node: node, badge: b, arc: arc };
    });
    wrap.insertBefore(arcs, wrap.firstChild);
    var center = badge("repeat", 180, "ghost");
    center.classList.add("cycle-center");
    wrap.appendChild(center);
    stage.appendChild(wrap);
    return function (c) {
      popIn(c.tl, center, c.start + 0.3);
      c.tl.fromTo(center, { rotation: 0 }, { rotation: 360, duration: c.dur, ease: "none" }, c.start);
      nodes.forEach(function (p, k) {
        var t = c.beat(k, n);
        popIn(c.tl, p.node, t - 0.1);
        drawIcon(c.tl, p.badge, t + 0.05, 0.6);
        c.tl.fromTo(p.arc, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.6, ease: "power2.inOut" }, t + 0.35);
      });
      var last = c.beat(n - 1, n) + 0.9;
      nodes.forEach(function (p, k) {
        c.tl.to(p.badge, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, last + k * 0.3);
      });
    };
  };

  B.compare = function (v, stage) {
    var wrap = el("div", "v-compare");
    function sideCard(s, cls, mark) {
      var card = el("div", "cmp-card " + cls);
      var b = badge(s.icon, 150, cls === "right" ? "solid" : "muted");
      card.appendChild(b);
      card.appendChild(el("div", "cmp-title", clip(s.title, 20)));
      var pts = (s.points || []).map(function (p) {
        var row = el("div", "cmp-pt");
        row.appendChild(icon(mark, 40, 2.6));
        row.appendChild(el("span", "", clip(p, 30)));
        card.appendChild(row);
        return row;
      });
      wrap.appendChild(card);
      return { card: card, badge: b, pts: pts };
    }
    var L = sideCard(v.left, "left", "x");
    var vs = el("div", "vs", "VS");
    wrap.appendChild(vs);
    var Rr = sideCard(v.right, "right", "check");
    stage.appendChild(wrap);
    return function (c) {
      var t0 = c.beat(0, 3), t1 = c.beat(1, 3), t2 = c.beat(2, 3);
      slideIn(c.tl, L.card, t0, -200, 0);
      drawIcon(c.tl, L.badge, t0 + 0.2, 0.6);
      L.pts.forEach(function (p, k) { slideIn(c.tl, p, t0 + 0.4 + k * 0.25, -40, 0); });
      popIn(c.tl, vs, t0 + 0.7, { rotation: -180 });
      slideIn(c.tl, Rr.card, t1, 200, 0);
      drawIcon(c.tl, Rr.badge, t1 + 0.2, 0.6);
      Rr.pts.forEach(function (p, k) { slideIn(c.tl, p, t1 + 0.4 + k * 0.25, 40, 0); });
      c.tl.to(L.card, { opacity: 0.5, scale: 0.95, duration: 0.5 }, t2);
      c.tl.fromTo(Rr.card, { scale: 1 }, { scale: 1.05, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }, t2);
    };
  };

  B.equation = function (v, stage) {
    var wrap = el("div", "v-eq");
    var row = el("div", "eq-row");
    var parts = [];
    v.items.forEach(function (it, k) {
      if (k > 0) { var plus = el("div", "eq-op", "+"); row.appendChild(plus); parts.push({ op: plus }); }
      var cell = el("div", "cell");
      var b = badge(it.icon, v.items.length > 2 ? 190 : 230);
      cell.appendChild(b);
      cell.appendChild(labelEl(it.label, "small"));
      row.appendChild(cell);
      parts.push({ cell: cell, badge: b });
    });
    wrap.appendChild(row);
    var eq = el("div", "eq-op eq-equals", "=");
    wrap.appendChild(eq);
    var res = el("div", "cell result");
    var rb = badge(v.result.icon, 300, "solid");
    res.appendChild(rb);
    res.appendChild(labelEl(v.result.label, "strong"));
    wrap.appendChild(res);
    stage.appendChild(wrap);
    return function (c) {
      var n = parts.length + 1;
      parts.forEach(function (p, k) {
        var t = c.beat(k, n);
        if (p.op) popIn(c.tl, p.op, t, { duration: 0.35 });
        else { popIn(c.tl, p.cell, t); drawIcon(c.tl, p.badge, t + 0.15, 0.6); }
      });
      var tr = c.beat(n - 1, n);
      popIn(c.tl, eq, tr - 0.3, { duration: 0.35 });
      popIn(c.tl, res, tr, { from: 0.2, ease: "back.out(2.4)" });
      drawIcon(c.tl, rb, tr + 0.2, 0.8);
      bob(c.tl, res, tr + 1, c.start + c.dur, 10);
    };
  };

  B.analogy = function (v, stage) {
    var wrap = el("div", "v-analogy");
    var a = v.items[0], b2 = v.items[1];
    function cell(it, variant) {
      var c = el("div", "cell");
      var b = badge(it.icon, 280, variant);
      c.appendChild(b);
      c.appendChild(labelEl(it.label, "strong"));
      wrap.appendChild(c);
      return { cell: c, badge: b };
    }
    var A = cell(a, "");
    var mid = el("div", "analogy-mid");
    var wave = svgEl("svg", { width: 120, height: 150, viewBox: "0 0 120 150" });
    wave.appendChild(svgEl("path", { d: "M60 6 C 20 40, 100 70, 60 100 S 40 130, 60 144", pathLength: 1, class: "conn-line" }));
    mid.appendChild(wave);
    mid.appendChild(el("div", "analogy-word", "is like"));
    wrap.appendChild(mid);
    var Bb = cell(b2, "solid");
    stage.appendChild(wrap);
    return function (c) {
      var t0 = c.beat(0, 3), t1 = c.beat(1, 3), t2 = c.beat(2, 3);
      popIn(c.tl, A.cell, t0); drawIcon(c.tl, A.badge, t0 + 0.15, 0.7);
      c.tl.fromTo(wave.querySelector("path"), { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.7 }, t1 - 0.2);
      slideIn(c.tl, mid.querySelector(".analogy-word"), t1);
      popIn(c.tl, Bb.cell, t2 - 0.2); drawIcon(c.tl, Bb.badge, t2, 0.7);
      bob(c.tl, A.badge, t0 + 0.8, c.start + c.dur, 8);
      bob(c.tl, Bb.badge, t2 + 0.8, c.start + c.dur, 8);
    };
  };

  function parseNum(s) {
    var m = /^([^\d-]*)(-?[\d.,]+)(.*)$/.exec(String(s));
    if (!m) return null;
    var n = parseFloat(m[2].replace(/,/g, ""));
    return isFinite(n) ? { prefix: m[1], n: n, suffix: m[3], decimals: (m[2].split(".")[1] || "").length } : null;
  }
  /** 36000 -> "36K", 1250000 -> "1.3M"; small numbers keep their decimals. */
  function compact(n, decimals) {
    var a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
    if (a >= 1000) return Math.round(n).toLocaleString("en-US");
    return n.toFixed(decimals || 0);
  }
  function unitText(u) {
    u = clip(u, 8);
    if (!u) return { pre: "", post: "" };
    if (/^[$€£¥]$/.test(u)) return { pre: u, post: "" };
    if (/^(%|x|k|m)$/i.test(u)) return { pre: "", post: u };
    if (/^(dollars?|usd)$/i.test(u)) return { pre: "$", post: "" };
    if (/^(euros?|eur)$/i.test(u)) return { pre: "€", post: "" };
    return { pre: "", post: " " + u };
  }

  function countUp(tl, node, target, at, dur, fmt) {
    var proxy = { n: 0 };
    tl.fromTo(proxy, { n: 0 }, { n: target, duration: dur, ease: "power2.out", onUpdate: function () { node.textContent = fmt(proxy.n); } }, at);
  }

  B["bar-chart"] = function (v, stage) {
    var wrap = el("div", "v-bars");
    var max = Math.max.apply(null, v.bars.map(function (b) { return b.value; })) || 1;
    var cols = v.bars.map(function (b, k) {
      var col = el("div", "bar-col");
      var val = el("div", "bar-val", "0");
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill" + (b.value === max ? " top" : ""));
      fill.style.height = Math.max(4, Math.round((b.value / max) * 100)) + "%";
      track.appendChild(fill);
      col.appendChild(val);
      col.appendChild(track);
      col.appendChild(el("div", "bar-lbl", clip(b.label, 14)));
      wrap.appendChild(col);
      return { col: col, val: val, fill: fill, value: b.value };
    });
    var axis = el("div", "bar-axis");
    wrap.appendChild(axis);
    stage.appendChild(wrap);
    var unit = unitText(v.unit);
    return function (c) {
      c.tl.fromTo(axis, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, c.start + 0.3);
      cols.forEach(function (x, k) {
        var t = c.beat(k, cols.length);
        c.tl.fromTo(x.fill, { scaleY: 0 }, { scaleY: 1, duration: 0.9, ease: "power3.out" }, t);
        slideIn(c.tl, x.col.querySelector(".bar-lbl"), t - 0.1, 0, 20);
        var dec = String(x.value).split(".")[1] ? 1 : 0;
        countUp(c.tl, x.val, x.value, t, 0.9, function (n) { return unit.pre + compact(n, dec) + unit.post; });
        c.tl.fromTo(x.val, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t);
      });
    };
  };

  B["line-chart"] = function (v, stage) {
    var wrap = el("div", "v-line");
    var W = 860, H = 560, P = 40;
    var vals = v.values;
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var pts = vals.map(function (y, i) {
      return [P + (i / (vals.length - 1)) * (W - 2 * P), H - P - ((y - min) / (max - min)) * (H - 2 * P)];
    });
    var s = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "line-svg" });
    for (var g = 0; g < 4; g++) {
      var gy = P + (g / 3) * (H - 2 * P);
      s.appendChild(svgEl("line", { x1: P, y1: gy, x2: W - P, y2: gy, class: "grid-line" }));
    }
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var area = svgEl("path", { d: d + " L" + pts[pts.length - 1][0] + " " + (H - P) + " L" + pts[0][0] + " " + (H - P) + " Z", class: "line-area" });
    var line = svgEl("path", { d: d, pathLength: 1, class: "line-path" });
    s.appendChild(area);
    s.appendChild(line);
    var dots = pts.map(function (p) { var c = svgEl("circle", { cx: p[0], cy: p[1], r: 12, class: "line-dot" }); s.appendChild(c); return c; });
    wrap.appendChild(s);
    var labels = el("div", "line-labels");
    labels.appendChild(el("span", "", clip(v.startLabel, 16)));
    labels.appendChild(el("span", "", clip(v.endLabel, 16)));
    wrap.appendChild(labels);
    var lu = unitText(v.unit);
    var endVal = el("div", "line-end", lu.pre + compact(vals[vals.length - 1], 0) + lu.post);
    endVal.style.left = Math.round(Math.min(W - 200, pts[pts.length - 1][0] - 90)) + "px";
    endVal.style.top = Math.round(Math.max(0, pts[pts.length - 1][1] - 110)) + "px";
    wrap.appendChild(endVal);
    stage.appendChild(wrap);
    return function (c) {
      var t = c.beat(0, 2), drawDur = Math.max(1.2, c.beat(1, 2) - t);
      c.tl.fromTo(line, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: drawDur, ease: "power1.inOut" }, t);
      c.tl.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t + drawDur * 0.6);
      dots.forEach(function (dt, k) {
        c.tl.fromTo(dt, { attr: { r: 0 } }, { attr: { r: 12 }, duration: 0.3, ease: "back.out(3)" }, t + (k / (dots.length - 1)) * drawDur);
      });
      slideIn(c.tl, labels, c.start + 0.4);
      popIn(c.tl, endVal, t + drawDur);
    };
  };

  B.stat = function (v, stage) {
    var wrap = el("div", "v-stat");
    var R = 270, C = 2 * Math.PI * R;
    var ring = svgEl("svg", { width: 600, height: 600, viewBox: "0 0 600 600", class: "stat-ring" });
    ring.appendChild(svgEl("circle", { cx: 300, cy: 300, r: R, class: "ring-bg" }));
    var arc = svgEl("circle", { cx: 300, cy: 300, r: R, class: "ring-arc", transform: "rotate(-90 300 300)", "stroke-dasharray": C, "stroke-dashoffset": C });
    ring.appendChild(arc);
    wrap.appendChild(ring);
    var inner = el("div", "stat-inner");
    var ic = badge(v.icon, 120, "ghost");
    inner.appendChild(ic);
    var num = el("div", "stat-num", clip(v.value, 8));
    // Keep the number inside the ring: shrink with its length.
    var len = clip(v.value, 8).length;
    num.style.fontSize = (len <= 2 ? 200 : len <= 3 ? 170 : len <= 4 ? 140 : len <= 5 ? 116 : 96) + "px";
    inner.appendChild(num);
    wrap.appendChild(inner);
    var sparks = [];
    for (var i = 0; i < 12; i++) { var sp = el("div", "spark"); wrap.appendChild(sp); sparks.push(sp); }
    stage.appendChild(wrap);
    var lbl = v.label ? el("div", "stat-lbl", clip(v.label, 60)) : null;
    if (lbl) stage.appendChild(lbl);
    var parsed = parseNum(v.value);
    var pct = parsed && /%/.test(parsed.suffix) ? Math.min(100, parsed.n) : 100;
    return function (c) {
      var at = c.start + 0.5;
      popIn(c.tl, wrap, c.start + 0.1, { from: 0.6 });
      drawIcon(c.tl, ic, c.start + 0.4, 0.6);
      c.tl.fromTo(arc, { attr: { "stroke-dashoffset": C } }, { attr: { "stroke-dashoffset": C * (1 - pct / 100) }, duration: 1.6, ease: "power2.out" }, at);
      if (parsed) countUp(c.tl, num, parsed.n, at, 1.6, function (n) { return parsed.prefix + n.toFixed(parsed.decimals) + parsed.suffix; });
      sparks.forEach(function (sp, k) {
        var a = (k / sparks.length) * Math.PI * 2;
        c.tl.fromTo(sp, { x: 0, y: 0, opacity: 0, scale: 1 }, { x: Math.cos(a) * 360, y: Math.sin(a) * 360, opacity: 1, scale: 0.2, duration: 0.8, ease: "power3.out" }, at + 1.5);
        c.tl.to(sp, { opacity: 0, duration: 0.25 }, at + 2.05);
      });
      c.tl.fromTo(num, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1 }, at + 1.55);
      if (lbl) slideIn(c.tl, lbl, at + 0.9);
    };
  };

  B.pictogram = function (v, stage) {
    var wrap = el("div", "v-picto");
    var cols = v.total <= 10 ? 5 : v.total <= 12 ? 4 : 5;
    wrap.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    var size = v.total <= 10 ? 150 : 120;
    var cells = [];
    for (var i = 0; i < v.total; i++) {
      var cell = el("div", "picto");
      cell.appendChild(icon(v.icon, size, 2));
      wrap.appendChild(cell);
      cells.push(cell);
    }
    stage.appendChild(wrap);
    var big = el("div", "picto-count");
    big.appendChild(el("span", "hl", String(v.highlight)));
    big.appendChild(el("span", "", " / " + v.total));
    stage.appendChild(big);
    var lbl = v.label ? el("div", "stat-lbl", clip(v.label, 60)) : null;
    if (lbl) stage.appendChild(lbl);
    return function (c) {
      cells.forEach(function (cell, k) { popIn(c.tl, cell, c.start + 0.3 + k * 0.05, { duration: 0.35 }); });
      var t = c.beat(1, 3);
      cells.slice(0, v.highlight).forEach(function (cell, k) {
        c.tl.to(cell, { color: c.accent, scale: 1.12, duration: 0.25, ease: "back.out(2)" }, t + k * 0.12);
      });
      popIn(c.tl, big, t);
      if (lbl) slideIn(c.tl, lbl, t + 0.4);
    };
  };

  B.checklist = function (v, stage) {
    var list = el("div", "v-check");
    var rows = v.lines.map(function (line) {
      var row = el("div", "chk-row");
      var box = svgEl("svg", { width: 72, height: 72, viewBox: "0 0 72 72", class: "chk-box" });
      box.appendChild(svgEl("rect", { x: 4, y: 4, width: 64, height: 64, rx: 18, class: "chk-rect" }));
      var tick = svgEl("path", { d: "M20 37 L31 48 L53 25", pathLength: 1, class: "chk-tick" });
      box.appendChild(tick);
      row.appendChild(box);
      row.appendChild(el("span", "", clip(line, 32)));
      list.appendChild(row);
      return { row: row, tick: tick, rect: box.querySelector("rect") };
    });
    stage.appendChild(list);
    return function (c) {
      rows.forEach(function (r, k) {
        var t = c.beat(k, rows.length);
        slideIn(c.tl, r.row, t - 0.2, 120, 0);
        c.tl.fromTo(r.tick, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "power2.out" }, t + 0.3);
        c.tl.to(r.rect, { attr: { "fill-opacity": 1 }, duration: 0.2 }, t + 0.25);
      });
    };
  };

  B.timeline = function (v, stage) {
    var wrap = el("div", "v-time");
    var rail = el("div", "time-rail");
    wrap.appendChild(rail);
    var items = v.events.map(function (e, k) {
      var row = el("div", "time-row" + (k % 2 ? " alt" : ""));
      var dot = el("div", "time-dot");
      var card = el("div", "time-card");
      card.appendChild(el("div", "time-when", clip(e.when, 12)));
      card.appendChild(el("div", "time-lbl", clip(e.label, 28)));
      row.appendChild(dot);
      row.appendChild(card);
      wrap.appendChild(row);
      return { dot: dot, card: card };
    });
    stage.appendChild(wrap);
    return function (c) {
      c.tl.fromTo(rail, { scaleY: 0 }, { scaleY: 1, duration: Math.max(1, c.beat(items.length - 1, items.length) - c.start), ease: "none" }, c.start + 0.3);
      items.forEach(function (it, k) {
        var t = c.beat(k, items.length);
        popIn(c.tl, it.dot, t - 0.1, { duration: 0.35 });
        slideIn(c.tl, it.card, t, k % 2 ? -80 : 80, 0);
      });
    };
  };

  B.chat = function (v, stage) {
    var phone = el("div", "v-phone chat");
    var top = el("div", "phone-top");
    top.appendChild(badge("message-circle", 64, "solid"));
    top.appendChild(el("span", "", "Chat"));
    phone.appendChild(top);
    var body = el("div", "phone-body");
    var msgs = v.messages.map(function (m) {
      var typing = el("div", "bubble typing " + m.side);
      for (var i = 0; i < 3; i++) typing.appendChild(el("i"));
      var bub = el("div", "bubble " + m.side, clip(m.text, 70));
      body.appendChild(typing);
      body.appendChild(bub);
      return { typing: typing, bub: bub };
    });
    phone.appendChild(body);
    stage.appendChild(phone);
    return function (c) {
      slideIn(c.tl, phone, c.start + 0.1, 0, 120);
      msgs.forEach(function (m, k) {
        var t = c.beat(k, msgs.length);
        c.tl.fromTo(m.typing, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2 }, t - 0.6);
        c.tl.fromTo(m.typing.querySelectorAll("i"), { y: 0 }, { y: -10, duration: 0.15, yoyo: true, repeat: 3, stagger: 0.08 }, t - 0.5);
        c.tl.set(m.typing, { display: "none" }, t);
        popIn(c.tl, m.bub, t, { from: 0.5, duration: 0.4 });
      });
    };
  };

  B.phone = function (v, stage) {
    var phone = el("div", "v-phone");
    var top = el("div", "phone-top");
    top.appendChild(badge(v.icon || "smartphone", 64, "solid"));
    top.appendChild(el("span", "", clip(v.label || "App", 20)));
    phone.appendChild(top);
    var body = el("div", "phone-body");
    var cards = v.lines.map(function (l, k) {
      var card = el("div", "ui-card");
      card.appendChild(el("div", "ui-avatar"));
      var txt = el("div", "ui-text");
      txt.appendChild(el("div", "ui-line", clip(l, 60)));
      txt.appendChild(el("div", "ui-sub"));
      card.appendChild(txt);
      var heart = icon("heart", 46, 2.4);
      heart.classList.add("ui-heart");
      card.appendChild(heart);
      body.appendChild(card);
      return { card: card, heart: heart };
    });
    phone.appendChild(body);
    var cursor = el("div", "tap");
    phone.appendChild(cursor);
    stage.appendChild(phone);
    return function (c) {
      slideIn(c.tl, phone, c.start + 0.1, 0, 140);
      cards.forEach(function (x, k) {
        var t = c.beat(k, cards.length);
        slideIn(c.tl, x.card, t, 0, -60);
        c.tl.fromTo(x.heart, { scale: 1 }, { scale: 1.4, duration: 0.18, yoyo: true, repeat: 1, ease: "back.out(3)" }, t + 0.6);
      });
      var lastT = c.beat(cards.length - 1, cards.length);
      c.tl.fromTo(cursor, { opacity: 0, x: 520, y: 900 }, { opacity: 1, x: 640, y: 260, duration: 0.7, ease: "power2.inOut" }, lastT + 0.3);
      c.tl.fromTo(cursor, { scale: 1 }, { scale: 0.75, duration: 0.12, yoyo: true, repeat: 1 }, lastT + 1.0);
      c.tl.to(cursor, { opacity: 0, duration: 0.3 }, lastT + 1.5);
    };
  };

  B.code = function (v, stage) {
    var win = el("div", "v-code");
    var bar = el("div", "code-bar");
    bar.appendChild(el("i", "r")); bar.appendChild(el("i", "y")); bar.appendChild(el("i", "g"));
    bar.appendChild(el("span", "", clip(v.language || "code", 16)));
    win.appendChild(bar);
    var pre = el("div", "code-body");
    var lines = v.lines.map(function (l, k) {
      var row = el("div", "code-line");
      row.appendChild(el("span", "ln", String(k + 1)));
      var txt = el("span", "code-txt", "");
      row.appendChild(txt);
      pre.appendChild(row);
      return { txt: txt, full: String(l) };
    });
    var caret = el("span", "caret", "|");
    pre.appendChild(caret);
    win.appendChild(pre);
    stage.appendChild(win);
    return function (c) {
      popIn(c.tl, win, c.start + 0.1, { from: 0.8, ease: "power3.out" });
      var span = Math.max(1.5, c.narrEnd - c.narrStart - 0.5);
      var per = span / lines.length;
      lines.forEach(function (ln, k) {
        var proxy = { n: 0 };
        c.tl.fromTo(proxy, { n: 0 }, {
          n: ln.full.length, duration: Math.max(0.3, per * 0.8), ease: "none",
          onUpdate: function () { ln.txt.textContent = ln.full.slice(0, Math.round(proxy.n)); },
        }, c.narrStart + k * per);
      });
      var blinks = Math.max(2, Math.floor(c.dur / 0.5));
      c.tl.fromTo(caret, { opacity: 1 }, { opacity: 0, duration: 0.25, yoyo: true, repeat: blinks, ease: "steps(1)" }, c.start);
    };
  };

  B.definition = function (v, stage) {
    var card = el("div", "v-def");
    var head = el("div", "def-head");
    var b = badge(v.icon, 150, "solid");
    head.appendChild(b);
    var termBox = el("div", "def-termbox");
    termBox.appendChild(el("div", "def-kicker", "Definition"));
    termBox.appendChild(el("div", "def-term", clip(v.term, 28)));
    head.appendChild(termBox);
    card.appendChild(head);
    var line = el("div", "def-rule");
    card.appendChild(line);
    var meaning = el("div", "def-meaning");
    clip(v.meaning, 120).split(" ").forEach(function (w, i, arr) {
      meaning.appendChild(el("span", "dw", w));
      if (i < arr.length - 1) meaning.appendChild(document.createTextNode(" "));
    });
    card.appendChild(meaning);
    stage.appendChild(card);
    return function (c) {
      slideIn(c.tl, card, c.start + 0.15, 0, 80);
      popIn(c.tl, b, c.start + 0.4);
      drawIcon(c.tl, b, c.start + 0.55, 0.7);
      c.tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, c.start + 0.6);
      var words = meaning.querySelectorAll(".dw");
      c.tl.fromTo(words, { opacity: 0.12 }, { opacity: 1, duration: 0.2, stagger: Math.max(0.05, (c.narrEnd - c.narrStart) * 0.8 / Math.max(1, words.length)) }, c.narrStart + 0.3);
    };
  };

  B.quote = function (v, stage) {
    var q = el("div", "v-quote");
    var mark = el("div", "quote-mark", "“");
    q.appendChild(mark);
    var t = el("div", "quote-text");
    clip(v.text, 120).split(" ").forEach(function (w, i, arr) {
      t.appendChild(el("span", "qw", w));
      if (i < arr.length - 1) t.appendChild(document.createTextNode(" "));
    });
    q.appendChild(t);
    var au = v.author ? el("div", "quote-author", "— " + clip(v.author, 40)) : null;
    if (au) q.appendChild(au);
    stage.appendChild(q);
    return function (c) {
      popIn(c.tl, mark, c.start + 0.2, { rotation: -20 });
      var ws = t.querySelectorAll(".qw");
      c.tl.fromTo(ws, { opacity: 0.12 }, { opacity: 1, duration: 0.2, stagger: (c.narrEnd - c.narrStart) / Math.max(1, ws.length) }, c.narrStart);
      if (au) slideIn(c.tl, au, c.narrEnd - 0.4, -40, 0);
    };
  };

  window.EXPLAINER_VISUALS = {
    build: function (visual, stage) {
      var fn = visual && B[visual.kind];
      try {
        if (fn) return fn(visual, stage);
      } catch (e) {
        stage.innerHTML = "";
      }
      return B["icon-hero"]({ kind: "icon-hero", icon: "lightbulb" }, stage);
    },
    icon: icon,
    badge: badge,
    drawIcon: drawIcon,
  };
})();
