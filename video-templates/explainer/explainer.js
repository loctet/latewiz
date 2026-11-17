/*
 * Branded explainer composition. Reads HyperFrames variables, builds one
 * scene per script entry (headline + animated visual from visuals.js),
 * captions, outro and a living background, then registers one paused GSAP
 * timeline. Timing comes from the render worker; without it (Studio
 * preview) scenes are laid out from word counts.
 */
(function () {
  var v = window.__hyperframes.getVariables();
  var root = document.getElementById("root");
  var host = document.getElementById("scenes");
  var V = window.EXPLAINER_VISUALS;

  function text(value, max) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max); }
  function el(tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content != null) n.textContent = content;
    return n;
  }

  // ---------------- Theme ----------------
  var theme = ["minimal", "bold", "gradient", "editorial"].indexOf(v.videoTheme) >= 0 ? v.videoTheme : "bold";
  root.classList.add("theme-" + theme);
  root.style.setProperty("--font", '"' + String(v.fontFamily || "Inter") + '", sans-serif');
  if (theme === "editorial") root.style.setProperty("--display-font", '"Playfair Display", serif');
  if (theme === "minimal" || theme === "editorial") {
    root.style.setProperty("--bg", theme === "minimal" ? "#FAFAF7" : "#F4EFE6");
    root.style.setProperty("--fg", "#141414");
    root.style.setProperty("--muted", "rgba(20, 20, 20, 0.62)");
  }
  if (theme === "gradient") {
    root.style.background = "linear-gradient(165deg, " + (v.primaryColor || "#1E3A5F") + ", " + (v.backgroundColor || "#0F172A") + ")";
  }
  var accent = v.accentColor || "#F2A541";

  // ---------------- Script ----------------
  var DEMO = [
    { heading: "Why posts stall at 200 views", narration: "Ever wonder why your posts stop at two hundred views? It is almost never the algorithm.", visual: { kind: "icon-hero", icon: "trending-down", caption: "Stuck at 200" } },
    { heading: "What is a hook?", narration: "A hook is the first line people see. Think of it like a shop window: it decides if anyone walks in.", visual: { kind: "definition", term: "Hook", meaning: "The first line of a post that makes people stop scrolling.", icon: "eye" } },
    { heading: "One second to decide", narration: "People decide in about one second whether to keep watching.", visual: { kind: "pictogram", icon: "user", total: 10, highlight: 7, label: "scroll past a weak opening" } },
    { heading: "How a good hook works", narration: "First you stop the scroll, then you make a promise, then you deliver it quickly.", visual: { kind: "flow", items: [{ icon: "hand", label: "Stop the scroll" }, { icon: "handshake", label: "Make a promise" }, { icon: "gift", label: "Deliver fast" }] } },
    { heading: "Same post, new first line", narration: "Here is the same post twice. Only the first line changed, and the saves doubled.", visual: { kind: "compare", left: { title: "Warm-up", icon: "clock", points: ["Slow start", "Vague"] }, right: { title: "Payoff first", icon: "zap", points: ["Clear result", "Specific"] } } },
    { heading: "The result", narration: "Say you get one hundred views a day. A better hook can turn that into two hundred.", visual: { kind: "bar-chart", unit: "", bars: [{ label: "Before", value: 100 }, { label: "After", value: 200 }] } },
    { heading: "Try it today", narration: "Try it today: rewrite one hook, post it, and compare the saves.", visual: { kind: "checklist", lines: ["Rewrite one hook", "Post it", "Compare saves"] } }
  ];
  var scenes = [];
  try {
    var parsed = JSON.parse(v.scenes || "[]");
    if (Array.isArray(parsed) && parsed.length) scenes = parsed.slice(0, 22);
  } catch (e) { scenes = []; }
  if (!scenes.length) scenes = DEMO;

  // ---------------- Timing ----------------
  var OVERLAP = 0.5, LEAD = 0.35, OUTRO = v.showOutro ? 4 : 0, MIN_TOTAL = 30;
  var timed = scenes.every(function (s) { return isFinite(Number(s.start)) && Number(s.duration) > 0; });
  if (!timed) {
    var base = scenes.map(function (s) {
      var words = text(s.narration, 400).split(" ").filter(Boolean).length;
      var audio = Number(s.audioDuration) > 0 ? Number(s.audioDuration) : words / 2.4;
      return { audio: audio, duration: Math.max(4, LEAD + audio + 0.7 + OVERLAP) };
    });
    var natural = base.reduce(function (sum, b) { return sum + b.duration - OVERLAP; }, 0) + OVERLAP + OUTRO;
    var stretch = Math.max(0, MIN_TOTAL - natural) / base.length;
    var t0 = 0;
    scenes.forEach(function (s, i) {
      s.start = t0;
      s.duration = base[i].duration + stretch;
      s.audioDuration = base[i].audio;
      t0 += s.duration - OVERLAP;
    });
  }
  scenes.forEach(function (s) { s.start = Number(s.start); s.duration = Number(s.duration); });
  var last = scenes[scenes.length - 1];
  var outroStart = Number(v.outroStart) > 0 ? Number(v.outroStart) : last.start + last.duration - OVERLAP;
  var total = Number(v.totalDuration) > 0 ? Number(v.totalDuration) : outroStart + (OUTRO || OVERLAP);
  var logo = text(v.logo, 300);

  // ---------------- Background particles ----------------
  var particleHost = document.getElementById("particles");
  var particles = [];
  for (var p = 0; p < 16; p++) {
    var dot = el("div", "particle");
    dot.style.left = ((p * 137) % 1000 + 40) + "px";
    dot.style.top = ((p * 293) % 1800 + 60) + "px";
    var size = 6 + (p % 4) * 4;
    dot.style.width = size + "px";
    dot.style.height = size + "px";
    particleHost.appendChild(dot);
    particles.push(dot);
  }

  // ---------------- Scenes ----------------
  function buildHeadline(heading) {
    var box = el("div", "headline");
    var words = text(heading, 60).split(" ").filter(Boolean);
    var n = words.join(" ").length;
    box.style.fontSize = (n <= 18 ? 108 : n <= 30 ? 92 : 78) + "px";
    var hi = 0;
    words.forEach(function (w, i) { if (w.length > words[hi].length) hi = i; });
    words.forEach(function (w, i) {
      var outer = el("span", "w");
      outer.setAttribute("data-layout-allow-overflow", "");
      outer.appendChild(el("span", "wi" + (i === hi ? " hl" : ""), w));
      box.appendChild(outer);
      if (i < words.length - 1) box.appendChild(document.createTextNode(" "));
    });
    box.appendChild(el("div", "underline"));
    return box;
  }

  var built = scenes.map(function (s) {
    var node = el("section", "scene");
    var camera = el("div", "camera");
    node.appendChild(camera);
    var img = null;
    if (s.image) {
      var wrap = el("div", "scene-img");
      wrap.setAttribute("data-layout-allow-overflow", "");
      img = el("img");
      img.src = s.image;
      img.alt = "";
      img.setAttribute("data-layout-allow-overflow", "");
      wrap.appendChild(img);
      camera.appendChild(wrap);
    }
    var headline = buildHeadline(s.heading);
    camera.appendChild(headline);
    var stage = el("div", "stage");
    stage.setAttribute("data-layout-allow-overflow", "");
    camera.appendChild(stage);
    // Visuals are built into an inner box that is scaled to fill the stage.
    var fit = el("div", "stage-fit");
    stage.appendChild(fit);
    var animate = V.build(s.visual || { kind: "icon-hero", icon: "lightbulb" }, fit);
    host.appendChild(node);
    return { node: node, camera: camera, headline: headline, stage: stage, fit: fit, img: img, animate: animate };
  });

  // ---------------- Outro ----------------
  var outro = document.getElementById("outro");
  var outroParts = null;
  if (v.showOutro) {
    outro.appendChild(el("div", "bg"));
    var ringEl = el("div", "ring");
    outro.appendChild(ringEl);
    var inner = el("div", "inner");
    var mark = null;
    if (logo) { mark = el("img", "outro-logo"); mark.src = logo; mark.alt = ""; }
    else if (v.brandName) mark = el("div", "outro-name", text(v.brandName, 40));
    if (mark) inner.appendChild(mark);
    var cta = el("div", "outro-cta", text(v.ctaText, 60) || "Follow for more");
    inner.appendChild(cta);
    var handle = v.handle ? el("div", "outro-handle", text(v.handle, 60)) : null;
    if (handle) inner.appendChild(handle);
    var sign = v.signature ? el("div", "outro-sign", text(v.signature, 80)) : null;
    if (sign) inner.appendChild(sign);
    var site = v.website ? el("div", "outro-site", text(v.website, 120)) : null;
    if (site) inner.appendChild(site);
    outro.appendChild(inner);
    outroParts = { ring: ringEl, mark: mark, cta: cta, handle: handle, sign: sign, site: site };
  } else {
    outro.remove();
  }

  // ---------------- Captions ----------------
  var capHost = document.getElementById("captions");
  var capGroups = [];
  if (v.captions) {
    scenes.forEach(function (s) {
      var words = text(s.narration, 400).split(" ").filter(Boolean);
      if (!words.length) return;
      var audio = Number(s.audioDuration) > 0 ? Number(s.audioDuration) : words.length / 2.4;
      var t = s.start + LEAD;
      var weights = words.map(function (w) { return 1 + w.replace(/[^\w]/g, "").length * 0.18; });
      var sum = weights.reduce(function (a, b) { return a + b; }, 0);
      var times = [];
      words.forEach(function (w, i) { times.push(t); t += (weights[i] / sum) * audio; });
      var group = null, chars = 0;
      words.forEach(function (w, i) {
        if (!group || group.words.length >= 3 || chars + w.length > 18 || /[.!?:]$/.test(words[i - 1] || "")) {
          group = { node: el("div", "cap-group"), words: [] };
          capHost.appendChild(group.node);
          capGroups.push(group);
          chars = 0;
        }
        var span = el("span", "cap-word", w);
        group.node.appendChild(span);
        group.words.push({ el: span, t: times[i], end: i + 1 < times.length ? times[i + 1] : s.start + LEAD + audio });
        chars += w.length + 1;
      });
    });
  } else {
    capHost.remove();
  }

  var bug = document.getElementById("logo-bug");
  if (logo && v.showIntro !== false) {
    bug.src = logo;
    bug.classList.add(["top-left", "top-right", "bottom-left", "bottom-right"].indexOf(v.logoPosition) >= 0 ? v.logoPosition : "top-right");
  } else {
    bug.remove();
  }

  // ---------------- Timeline ----------------
  function build() {
    var tl = gsap.timeline({ paused: true });

    // Scale each visual up to fill its stage (fonts are loaded, layout is final).
    built.forEach(function (p) {
      // .stage-fit shrink-wraps its content, so its box is the content size.
      var sw = p.stage.clientWidth, sh = p.stage.clientHeight;
      var fw = p.fit.offsetWidth, fh = p.fit.offsetHeight;
      if (fw > 0 && fh > 0) {
        var k = Math.min(1.6, (sw * 0.96) / fw, (sh * 0.94) / fh);
        if (k > 1.02 || k < 0.98) gsap.set(p.fit, { scale: k });
      }
    });

    var TRANSITIONS = ["zoom", "push", "circle", "whip"];

    // Living background: glows drift, particles float.
    tl.fromTo("#glow-a", { x: 0, y: 0 }, { x: 320, y: 520, duration: total, ease: "sine.inOut" }, 0);
    tl.fromTo("#glow-b", { x: 0, y: 0 }, { x: -300, y: -480, duration: total, ease: "sine.inOut" }, 0);
    particles.forEach(function (d, k) {
      tl.fromTo(d, { y: 0, x: 0 }, { y: -(220 + (k % 5) * 90), x: (k % 2 ? 1 : -1) * (30 + (k % 3) * 25), duration: total, ease: "none" }, 0);
    });

    built.forEach(function (p, i) {
      var s = scenes[i];
      var start = s.start, dur = s.duration;
      var narrStart = start + LEAD;
      var narrEnd = narrStart + Math.max(1.2, Number(s.audioDuration) || dur - 1.2);
      var node = p.node;

      if (i === 0) {
        tl.set(node, { opacity: 1 }, 0);
      } else {
        var kind = TRANSITIONS[(i - 1) % TRANSITIONS.length];
        var prev = built[i - 1].node;
        var T = OVERLAP;
        if (kind === "zoom") {
          tl.fromTo(prev, { scale: 1, filter: "blur(0px)" }, { scale: 1.3, filter: "blur(14px)", opacity: 0, duration: T, ease: "power2.in" }, start);
          tl.fromTo(node, { opacity: 0, scale: 0.85, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: T + 0.15, ease: "power3.out" }, start + 0.05);
          tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.18, duration: T * 0.5, yoyo: true, repeat: 1, ease: "sine.inOut" }, start);
        } else if (kind === "push") {
          tl.fromTo(prev, { yPercent: 0 }, { yPercent: -100, duration: T + 0.1, ease: "power3.inOut" }, start);
          tl.set(node, { opacity: 1 }, start);
          tl.fromTo(node, { yPercent: 100 }, { yPercent: 0, duration: T + 0.1, ease: "power3.inOut" }, start);
          tl.set(prev, { opacity: 0 }, start + T + 0.1);
        } else if (kind === "circle") {
          tl.set(node, { opacity: 1 }, start);
          tl.fromTo(node, { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(150% at 50% 50%)", duration: T + 0.25, ease: "power2.inOut" }, start);
          tl.fromTo(prev, { scale: 1 }, { scale: 0.92, duration: T + 0.25, ease: "power2.inOut" }, start);
          tl.set(prev, { opacity: 0 }, start + T + 0.25);
        } else {
          tl.fromTo(prev, { xPercent: 0, skewX: 0 }, { xPercent: -100, skewX: 8, duration: T, ease: "power4.in" }, start);
          tl.set(node, { opacity: 1 }, start + 0.05);
          tl.fromTo(node, { xPercent: 100, skewX: -8 }, { xPercent: 0, skewX: 0, duration: T + 0.1, ease: "power4.out" }, start + 0.05);
          tl.set(prev, { opacity: 0 }, start + T + 0.15);
        }
      }

      // Camera: slow push, plus a punch-in at the scene's key moment.
      tl.fromTo(p.camera, { scale: 1 }, { scale: 1.04, duration: dur, ease: "none" }, start);
      var punchAt = start + Math.max(1.6, dur * 0.6);
      tl.to(p.stage, { scale: 1.06, duration: 0.22, ease: "power2.out" }, punchAt);
      tl.to(p.stage, { scale: 1, duration: 0.7, ease: "power2.inOut" }, punchAt + 0.22);

      if (p.img) tl.fromTo(p.img, { scale: 1.05 }, { scale: 1.2, duration: dur + 0.5, ease: "sine.inOut" }, Math.max(0, start - 0.1));

      var wis = p.headline.querySelectorAll(".wi");
      if (i > 0) tl.fromTo(wis, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: "power4.out", stagger: 0.07 }, start + 0.15);
      tl.fromTo(p.headline.querySelector(".underline"), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, start + (i === 0 ? 0.3 : 0.55));

      function beat(k, n) {
        return narrStart + 0.2 + ((narrEnd - narrStart - 0.4) * (k + 0.15)) / Math.max(1, n);
      }
      p.animate({ tl: tl, start: start, dur: dur, narrStart: narrStart, narrEnd: narrEnd, beat: beat, accent: accent });
    });

    // Outro: logo sting + ring burst + CTA.
    if (outroParts) {
      var o = outroParts, os = outroStart;
      tl.fromTo(outro, { opacity: 0, scale: 1.15 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, os);
      tl.to(built[built.length - 1].node, { opacity: 0, duration: 0.6, ease: "power2.in" }, os);
      tl.set(o.ring, { scale: 0.2, opacity: 1 }, os + 0.35);
      tl.to(o.ring, { scale: 2.4, opacity: 0, duration: 1.2, ease: "power2.out" }, os + 0.36);
      if (o.mark) tl.fromTo(o.mark, { scale: 0.4, opacity: 0, rotation: -8 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.8, ease: "back.out(1.7)" }, os + 0.3);
      tl.fromTo(o.cta, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power4.out" }, os + 0.7);
      if (o.handle) {
        tl.fromTo(o.handle, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }, os + 1.0);
        tl.to(o.handle, { scale: 1.06, duration: 0.35, yoyo: true, repeat: 3, ease: "sine.inOut" }, os + 1.8);
      }
      if (o.sign) tl.fromTo(o.sign, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, os + 1.3);
      if (o.site) tl.fromTo(o.site, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, os + 1.45);
    }

    // Captions: one group at a time; the spoken word gets the accent pill.
    capGroups.forEach(function (g, gi) {
      var first = g.words[0].t, lastW = g.words[g.words.length - 1];
      var next = capGroups[gi + 1];
      var hideAt = Math.max(first + 0.25, Math.min(lastW.end + 0.25, next ? next.words[0].t - 0.06 : lastW.end + 0.25));
      tl.fromTo(g.node, { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.14, ease: "back.out(2)" }, first);
      tl.to(g.node, { opacity: 0, duration: 0.05 }, hideAt);
      g.words.forEach(function (w) {
        tl.fromTo(w.el, { backgroundColor: "rgba(0,0,0,0)", color: "#FFFFFF", scale: 1 }, { backgroundColor: accent, color: "#111111", scale: 1.08, duration: 0.08 }, w.t);
        tl.to(w.el, { backgroundColor: "rgba(0,0,0,0)", color: "#FFFFFF", scale: 1, duration: 0.08 }, Math.max(w.t + 0.1, w.end - 0.02));
      });
    });

    if (bug.isConnected) {
      tl.fromTo(bug, { opacity: 0, scale: 0.4 }, { opacity: 0.95, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.4);
      if (outroParts) tl.to(bug, { opacity: 0, duration: 0.3 }, outroStart);
    }

    tl.fromTo("#progress-fill", { scaleX: 0 }, { scaleX: 1, duration: total, ease: "none" }, 0);
    window.__timelines["explainer"] = tl;
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  else build();
})();
