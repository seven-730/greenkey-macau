/* ==========================================================================
   绿钥 GreenKey — 站点交互与图表引擎（无依赖）
   ========================================================================== */
(function (window, document) {
  "use strict";

  var PALETTE = {
    dark: {
      grid: "rgba(150,255,220,0.075)",
      axis: "rgba(150,255,220,0.16)",
      text: "#6f8a83",
      bandWeekend: "rgba(43,232,166,0.045)",
      bandHoliday: "rgba(233,179,79,0.065)",
      expected: "rgba(232,130,90,0.85)",
      expectedFill: "rgba(232,130,90,0.11)",
      bau: "rgba(233,245,240,0.42)",
      act: "#2be8a6",
      actDot: "#05090b",
      saved: "rgba(43,232,166,0.2)",
      savedLine: "rgba(43,232,166,0.5)"
    },
    light: {
      grid: "rgba(150,255,220,0.075)",
      axis: "rgba(150,255,220,0.16)",
      text: "#6f8a83",
      bandWeekend: "rgba(43,232,166,0.045)",
      bandHoliday: "rgba(233,179,79,0.065)",
      expected: "rgba(232,130,90,0.85)",
      expectedFill: "rgba(232,130,90,0.11)",
      bau: "rgba(233,245,240,0.42)",
      act: "#2be8a6",
      actDot: "#05090b",
      saved: "rgba(43,232,166,0.2)",
      savedLine: "rgba(43,232,166,0.5)"
    }
  };

  function el(tag, attrs, text) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function fmt(n, d) {
    var v = d ? Number(n).toFixed(d) : Math.round(n).toString();
    var parts = v.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function quad(x1, a1, b1, x2, a2, b2) {
    return "M" + x1.toFixed(1) + "," + a1.toFixed(1) +
      "L" + x2.toFixed(1) + "," + a2.toFixed(1) +
      "L" + x2.toFixed(1) + "," + b2.toFixed(1) +
      "L" + x1.toFixed(1) + "," + b1.toFixed(1) + "Z";
  }

  /* ------------------------------------------------------------------ *
   * 28 日双基线图：历史常态 / 入住率校正 BAU / 实测
   * ------------------------------------------------------------------ */
  function dayChart(svg, r, opts) {
    opts = opts || {};
    var P = PALETTE[opts.theme === "light" ? "light" : "dark"];
    var H = opts.height || 320;
    var days = r.days;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    var W = Math.round(svg.getBoundingClientRect().width) || 900;
    if (W < 320) W = 320;
    var compact = W < 620;
    var padL = compact ? 44 : 54, padR = compact ? 12 : 16, padT = 18, padB = 44;
    var iw = W - padL - padR, ih = H - padT - padB;

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    var maxV = 0;
    days.forEach(function (d) {
      maxV = Math.max(maxV, d.expected, d.bau, d.act);
    });
    maxV *= 1.1;

    function X(i) { return padL + (iw * i) / (days.length - 1); }
    function Y(v) { return padT + ih - (ih * v) / maxV; }

    /* 日型色带 */
    var bandG = el("g");
    days.forEach(function (d, i) {
      if (d.type === "workday") return;
      var step = iw / (days.length - 1);
      var x = X(i) - step / 2;
      var w = step;
      if (i === 0) { w += step / 2; x = padL - 4; }
      if (i === days.length - 1) w += step / 2;
      bandG.appendChild(el("rect", {
        x: x, y: padT, width: w, height: ih,
        fill: d.type === "holiday" ? P.bandHoliday : P.bandWeekend
      }));
    });
    svg.appendChild(bandG);

    /* 网格 */
    var gridG = el("g");
    for (var g = 0; g <= 4; g++) {
      var val = (maxV * g) / 4;
      var y = Y(val);
      gridG.appendChild(el("line", { x1: padL, y1: y, x2: W - padR, y2: y, stroke: P.grid, "stroke-width": 1 }));
      if (g > 0)
        gridG.appendChild(el("text", {
          x: padL - 9, y: y + 3.5, "text-anchor": "end", fill: P.text,
          "font-size": 10, "font-family": "JetBrains Mono, monospace"
        }, fmt(val)));
    }
    svg.appendChild(gridG);

    /* 阴影：活动量效应（不计入）+ 强度效应（可核证） */
    var shadeAct = el("g");
    var shadeSave = el("g");
    for (var i = 0; i < days.length - 1; i++) {
      var a = days[i], b = days[i + 1];
      shadeAct.appendChild(el("path", {
        d: quad(X(i), Y(a.expected), Y(a.bau), X(i + 1), Y(b.expected), Y(b.bau)),
        fill: P.expectedFill
      }));
      shadeSave.appendChild(el("path", {
        d: quad(X(i), Y(a.bau), Y(a.act), X(i + 1), Y(b.bau), Y(b.act)),
        fill: P.saved
      }));
    }
    svg.appendChild(shadeAct);
    svg.appendChild(shadeSave);

    /* 三条线 */
    function linePath(key) {
      var d = "";
      days.forEach(function (p, i) {
        d += (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(p[key]).toFixed(1) + " ";
      });
      return d;
    }
    svg.appendChild(el("path", {
      d: linePath("expected"), fill: "none", stroke: P.expected,
      "stroke-width": 1.4, "stroke-dasharray": "2 4"
    }));
    svg.appendChild(el("path", {
      d: linePath("bau"), fill: "none", stroke: P.bau,
      "stroke-width": 1.4, "stroke-dasharray": "5 4"
    }));

    var actPath = el("path", {
      d: linePath("act"), fill: "none", stroke: P.act, "stroke-width": 2.2,
      "stroke-linejoin": "round", "stroke-linecap": "round",
      pathLength: "1", "stroke-dasharray": "1", "stroke-dashoffset": "1"
    });
    actPath.style.transition = "stroke-dashoffset 1.5s cubic-bezier(0.3,0.7,0.2,1)";
    actPath.style.filter = "drop-shadow(0 0 6px rgba(43,232,166,0.55))";
    svg.appendChild(actPath);
    setTimeout(function () { actPath.setAttribute("stroke-dashoffset", "0"); }, 60);

    /* X 轴标签 */
    var xg = el("g");
    days.forEach(function (d, i) {
      var show = i === 0 || i === days.length - 1 || (i % 7 === 0);
      if (!show) return;
      xg.appendChild(el("text", {
        x: X(i), y: H - 20, "text-anchor": "middle", fill: P.text,
        "font-size": 10, "font-family": "JetBrains Mono, monospace"
      }, d.label));
      xg.appendChild(el("text", {
        x: X(i), y: H - 7, "text-anchor": "middle", fill: P.text,
        "font-size": 9, "font-family": "JetBrains Mono, monospace", opacity: 0.7
      }, d.dow));
    });
    svg.appendChild(xg);

    /* 节假日标注：取最长的一段连续假期 */
    var runs = [], cur = [];
    days.forEach(function (d) {
      if (d.type === "holiday") cur.push(d);
      else if (cur.length) { runs.push(cur); cur = []; }
    });
    if (cur.length) runs.push(cur);
    if (runs.length) {
      var longest = runs[0];
      runs.forEach(function (rn) { if (rn.length > longest.length) longest = rn; });
      var cx = (X(longest[0].i) + X(longest[longest.length - 1].i)) / 2;
      svg.appendChild(el("text", {
        x: cx, y: padT + 11, "text-anchor": "middle", fill: P.text,
        "font-size": 8.5, "letter-spacing": "0.12em",
        "font-family": "JetBrains Mono, monospace"
      }, opts.holidayLabel || "公 众 假 期"));
    }

    /* 交互 */
    var hover = el("line", {
      x1: 0, y1: padT, x2: 0, y2: padT + ih, stroke: P.act,
      "stroke-width": 1, opacity: 0, "pointer-events": "none"
    });
    svg.appendChild(hover);
    var dotE = el("circle", { r: 3.4, fill: P.expected, opacity: 0, "pointer-events": "none" });
    var dotB = el("circle", { r: 3.4, fill: P.bau, opacity: 0, "pointer-events": "none" });
    var dotA = el("circle", { r: 4.6, fill: P.actDot, stroke: P.act, "stroke-width": 2, opacity: 0, "pointer-events": "none" });
    svg.appendChild(dotE); svg.appendChild(dotB); svg.appendChild(dotA);

    var overlay = el("rect", {
      x: padL - 8, y: padT, width: iw + 16, height: ih,
      fill: "transparent", style: "cursor:crosshair"
    });
    svg.appendChild(overlay);

    function onMove(ev) {
      var rect = svg.getBoundingClientRect();
      var scale = W / rect.width;
      var px = (ev.clientX - rect.left) * scale;
      var idx = Math.round(((px - padL) / iw) * (days.length - 1));
      idx = Math.max(0, Math.min(days.length - 1, idx));
      var d = days[idx];
      var hx = X(idx);
      hover.setAttribute("x1", hx);
      hover.setAttribute("x2", hx);
      hover.setAttribute("opacity", 0.45);
      dotE.setAttribute("cx", hx); dotE.setAttribute("cy", Y(d.expected)); dotE.setAttribute("opacity", 0.85);
      dotB.setAttribute("cx", hx); dotB.setAttribute("cy", Y(d.bau)); dotB.setAttribute("opacity", 0.85);
      dotA.setAttribute("cx", hx); dotA.setAttribute("cy", Y(d.act)); dotA.setAttribute("opacity", 1);
      if (opts.onHover) opts.onHover(idx, d);
    }
    function onLeave() {
      hover.setAttribute("opacity", 0);
      dotE.setAttribute("opacity", 0);
      dotB.setAttribute("opacity", 0);
      dotA.setAttribute("opacity", 0);
      if (opts.onLeave) opts.onLeave();
    }
    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("mouseleave", onLeave);
    overlay.addEventListener("touchmove", function (e) {
      if (e.touches[0]) onMove(e.touches[0]);
    }, { passive: true });
    overlay.addEventListener("touchend", onLeave);
  }

  /* ------------------------------------------------------------------ *
   * 迷你走势
   * ------------------------------------------------------------------ */
  function sparkline(svg, values, color, opts) {
    opts = opts || {};
    var W = 260, H = opts.height || 56, pad = 3;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var mx = Math.max.apply(null, values);
    var mn = Math.min.apply(null, values);
    var d = "";
    for (var i = 0; i < values.length; i++) {
      var x = pad + ((W - pad * 2) * i) / (values.length - 1);
      var y = pad + (H - pad * 2) * (1 - (values[i] - mn) / (mx - mn || 1));
      d += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }
    var ad = d + "L" + (W - pad) + "," + H + " L" + pad + "," + H + " Z";
    var gid = "sp" + Math.random().toString(36).slice(2, 7);
    var grad = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.22 }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
    var defs = el("defs");
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(el("path", { d: ad, fill: "url(#" + gid + ")" }));
    svg.appendChild(el("path", { d: d, fill: "none", stroke: color, "stroke-width": 1.6, "stroke-linecap": "round" }));
  }

  /* ------------------------------------------------------------------ *
   * 绿信分仪表
   * ------------------------------------------------------------------ */
  function gauge(svg, score) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 150 100");
    var cx = 75, cy = 84, r = 62;
    var track = "M13,84 A62,62 0 0 1 137,84";
    var f = Math.max(0, Math.min(1, (score - 300) / 700));
    svg.appendChild(el("path", { d: track, fill: "none", stroke: "rgba(170,226,206,0.16)", "stroke-width": 9, "stroke-linecap": "round" }));
    var val = el("path", {
      d: track, fill: "none", stroke: "#2be8a6", "stroke-width": 9,
      "stroke-linecap": "round", pathLength: "100", "stroke-dasharray": "0 100"
    });
    val.style.transition = "stroke-dasharray 1.1s cubic-bezier(0.3,0.7,0.2,1)";
    val.style.filter = "drop-shadow(0 0 8px rgba(43,232,166,0.6))";
    svg.appendChild(val);
    setTimeout(function () { val.setAttribute("stroke-dasharray", f * 100 + " 100"); }, 60);
    for (var t = 0; t <= 10; t++) {
      var a = Math.PI * (1 - t / 10);
      svg.appendChild(el("line", {
        x1: cx + Math.cos(a) * (r - 11), y1: cy - Math.sin(a) * (r - 11),
        x2: cx + Math.cos(a) * (r - 16), y2: cy - Math.sin(a) * (r - 16),
        stroke: "rgba(150,255,220,0.24)", "stroke-width": 1
      }));
    }
    var na = Math.PI * (1 - f);
    svg.appendChild(el("circle", {
      cx: cx + Math.cos(na) * r * f, cy: cy - Math.sin(na) * r * f,
      r: 4, fill: "#05090b", stroke: "#2be8a6", "stroke-width": 2.5
    }));
    svg.appendChild(el("text", {
      x: cx, y: cy - 22, "text-anchor": "middle", fill: "#e9f5f0",
      "font-size": 26, "font-weight": 800, "font-family": "Inter, sans-serif"
    }, String(score)));
    svg.appendChild(el("text", {
      x: cx, y: cy - 6, "text-anchor": "middle", fill: "#6f8a83",
      "font-size": 7.5, "letter-spacing": "0.14em", "font-family": "JetBrains Mono, monospace"
    }, "GCS / 1000"));
  }

  /* ------------------------------------------------------------------ *
   * 封面：用 28 日用电量堆出的城市天际线
   * ------------------------------------------------------------------ */
  function skyline(svg, r, opts) {
    var W = 1600, H = 460;
    var base = H * 0.84;
    var days = r.days;
    var n = days.length;
    var maxKwh = 0;
    days.forEach(function (d) { if (d.act > maxKwh) maxKwh = d.act; });
    var unit = (base * 0.70) / maxKwh;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMax meet");

    var gid = "skyG" + Math.random().toString(36).slice(2, 7);
    var defs = el("defs");
    var lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(el("stop", { offset: "0%", "stop-color": "#2be8a6", "stop-opacity": 0.26 }));
    lg.appendChild(el("stop", { offset: "55%", "stop-color": "#2be8a6", "stop-opacity": 0.05 }));
    lg.appendChild(el("stop", { offset: "100%", "stop-color": "#2be8a6", "stop-opacity": 0 }));
    defs.appendChild(lg);
    var gid2 = "skyM" + Math.random().toString(36).slice(2, 7);
    var lg2 = el("linearGradient", { id: gid2, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg2.appendChild(el("stop", { offset: "0%", "stop-color": "#fff", "stop-opacity": 0.8 }));
    lg2.appendChild(el("stop", { offset: "100%", "stop-color": "#fff", "stop-opacity": 0 }));
    defs.appendChild(lg2);
    var mask = el("mask", { id: gid2 + "m" });
    mask.appendChild(el("rect", { x: 0, y: base, width: W, height: H - base, fill: "url(#" + gid2 + ")" }));
    defs.appendChild(mask);
    svg.appendChild(defs);

    svg.appendChild(el("line", { x1: 0, y1: base, x2: W, y2: base, stroke: "rgba(150,255,220,0.2)", "stroke-width": 1 }));

    /* 每天拆成两栋，形成街区 */
    var slots = n * 2;
    var gap = 6;
    var bw = (W - gap * (slots - 1)) / slots;
    var builds = [];
    days.forEach(function (d, i) {
      var jit = [0.82, 1];
      for (var k = 0; k < 2; k++) {
        builds.push({ d: d, h: Math.max(12, d.act * jit[k] * unit), i: i * 2 + k });
      }
    });

    builds.forEach(function (b, idx) {
      var x = idx * (bw + gap);
      var h = b.h;
      var y = base - h;
      var holiday = b.d.type !== "workday";
      var stroke = holiday ? "rgba(233,179,79,0.55)" : "rgba(43,232,166,0.55)";
      var roof = holiday ? "rgba(233,179,79,0.9)" : "rgba(75,247,185,0.9)";
      svg.appendChild(el("rect", {
        x: x, y: y, width: bw, height: h, fill: "url(#" + gid + ")",
        stroke: stroke, "stroke-width": 1
      }));
      svg.appendChild(el("line", { x1: x, y1: y + 0.5, x2: x + bw, y2: y + 0.5, stroke: roof, "stroke-width": 1.5 }));
      var dots = h > 200 ? 4 : h > 120 ? 3 : 2;
      for (var k2 = 0; k2 < dots; k2++) {
        var wy = y + 14 + k2 * 15;
        if (wy > base - 10) break;
        svg.appendChild(el("rect", {
          x: x + bw * 0.32, y: wy, width: Math.max(1.8, bw * 0.2), height: 2.5,
          fill: holiday ? "rgba(233,179,79,0.42)" : "rgba(43,232,166,0.4)"
        }));
      }
      if (idx === 13 || idx === 34 || idx === 49) {
        svg.appendChild(el("line", { x1: x + bw / 2, y1: y, x2: x + bw / 2, y2: y - 22, stroke: "rgba(75,247,185,0.6)", "stroke-width": 1 }));
        svg.appendChild(el("circle", { cx: x + bw / 2, cy: y - 23, r: 1.6, fill: "#4bf7b9" }));
      }
    });

    /* 澳门旅游塔 */
    var tx = W * 0.78;
    var deckY = base - H * 0.60;
    var topY = base - H * 0.73;
    svg.appendChild(el("path", {
      d: "M" + (tx - 8) + "," + base + " L" + (tx - 3.5) + "," + (deckY + 6) +
        " L" + (tx + 3.5) + "," + (deckY + 6) + " L" + (tx + 8) + "," + base + " Z",
      fill: "#05090b", stroke: "rgba(43,232,166,0.9)", "stroke-width": 1.3
    }));
    svg.appendChild(el("rect", {
      x: tx - 12, y: deckY - 4, width: 24, height: 11, rx: 3,
      fill: "#05090b", stroke: "rgba(43,232,166,0.9)", "stroke-width": 1.3
    }));
    svg.appendChild(el("line", { x1: tx, y1: deckY - 4, x2: tx, y2: topY, stroke: "rgba(43,232,166,0.7)", "stroke-width": 1.2 }));
    svg.appendChild(el("circle", { cx: tx, cy: topY - 2, r: 2.2, fill: "#4bf7b9" }));

    /* 水面倒影 */
    var ref = el("g", { opacity: 0.2, mask: "url(#" + gid2 + "m)" });
    builds.forEach(function (b, idx) {
      var x = idx * (bw + gap);
      ref.appendChild(el("rect", {
        x: x, y: base + 2, width: bw, height: b.h * 0.45,
        fill: b.d.type === "workday" ? "rgba(43,232,166,0.5)" : "rgba(233,179,79,0.5)"
      }));
    });
    svg.appendChild(ref);
  }

  /* ------------------------------------------------------------------ *
   * 通用
   * ------------------------------------------------------------------ */
  function countUp(node, target, opts) {
    opts = opts || {};
    var dur = opts.duration || 1200, dec = opts.dec || 0, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(target * e, dec);
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = fmt(target, dec);
    }
    requestAnimationFrame(step);
  }

  function initNav() {
    var toggle = document.querySelector(".nav__toggle");
    var links = document.querySelector(".nav__links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initReveal() {
    var nodes = [].slice.call(document.querySelectorAll("[data-reveal], .flow__item, .meter__fill"));
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        if (en.target.classList.contains("meter__fill")) {
          var pct = en.target.getAttribute("data-pct");
          if (pct) en.target.style.width = pct + "%";
        }
        io.unobserve(en.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function initCounters() {
    /* 直接落到终值：数字是论据，不冒险停留在动画中间帧 */
    [].slice.call(document.querySelectorAll("[data-count]")).forEach(function (n) {
      var target = parseFloat(n.getAttribute("data-count"));
      var dec = parseInt(n.getAttribute("data-dec") || "0", 10);
      if (!isNaN(target)) n.textContent = fmt(target, dec);
    });
  }

  function initTicker() {
    var track = document.querySelector(".ticker__track");
    if (!track || track.getAttribute("data-cloned")) return;
    track.innerHTML = track.innerHTML + track.innerHTML;
    track.setAttribute("data-cloned", "1");
  }

  function initYear() {
    [].slice.call(document.querySelectorAll("[data-year]")).forEach(function (n) {
      n.textContent = new Date().getFullYear();
    });
  }

  function initAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var y = t.getBoundingClientRect().top + window.pageYOffset - 84;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  }

  function initProgress() {
    var bar = document.querySelector(".progress__bar");
    if (!bar) return;
    function upd() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? window.pageYOffset / h : 0;
      bar.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)) + ")";
    }
    window.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    upd();
  }

  function boot() {
    initNav();
    initReveal();
    initCounters();
    initTicker();
    initYear();
    initAnchors();
    initProgress();
  }

  function onResize(fn, ms) {
    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(fn, ms || 180);
    });
  }

  window.GKApp = {
    chart: dayChart,
    skyline: skyline,
    spark: sparkline,
    gauge: gauge,
    fmt: fmt,
    countUp: countUp,
    onResize: onResize,
    palette: PALETTE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window, document);
