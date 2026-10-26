/* ==========================================================================
   绿钥 GreenKey — 开机序列：四层依次解锁
   触发条件：会话内首次进入（sessionStorage），或 ?boot=1 强制播放
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var force = params.get("boot") === "1";

  /* 未通过 head 脚本打上 boot 标记 → 本次不播放，也不做任何淡入 */
  if (params.get("boot") === "0" || (!force && !root.classList.contains("boot"))) return;

  function finish() {
    window.__GK_BOOT_DONE__ = true;
    try { sessionStorage.setItem("gk_boot", "1"); } catch (e) {}
    document.body.classList.add("boot-in");
    root.classList.remove("boot");
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { finish(); return; }

  /* ---------- 内容 ---------- */
  var LAYERS = [
    { n: "01", name: "数据采集", en: "DATA INGEST", read: "4 SOURCES · 15MIN" },
    { n: "02", name: "双轨基线", en: "BAU MODEL", read: "28 DAYS · P10 0.94" },
    { n: "03", name: "验证核证", en: "VERIFICATION", read: "OAR 2,827 kWh" },
    { n: "04", name: "金融联动", en: "FINANCE", read: "GCS 723 · MOP 410K" }
  ];

  var LOG = [
    ["载入核算引擎 GKM-01 v2.0", "BOOT"],
    ["校验企业数据授权 .........", "已签署"],
    ["接入电表 / 账单 / 房态 ....", "4 源"],
    ["载入计费窗口 2026-09-21 → 10-18", "28D"],
    ["拟合历史常态基线 .........", "OK"],
    ["校正当日入住率 ...........", "38% / 92%"],
    ["计算 P10 置信下界 ........", "0.94"],
    ["剔除活动量效应 ...........", "−2,126"],
    ["归因强度效应 .............", "+2,827"],
    ["签发凭证 GK-MO-2026-30700", "SEALED"]
  ];

  /* ---------- DOM ---------- */
  var wrap = document.createElement("div");
  wrap.className = "boot";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", "系统启动中");

  var locksHTML = LAYERS.map(function (l) {
    return (
      '<div class="lock" data-l="' + l.n + '">' +
      '<span class="lock__idx">' + l.n + "</span>" +
      '<span class="lock__name">' + l.name + "<em>" + l.en + "</em></span>" +
      '<span class="lock__read">' + l.read + "</span>" +
      '<span class="lock__state">LOCKED</span>' +
      '<span class="lock__bar"><i></i></span>' +
      "</div>"
    );
  }).join("");

  wrap.innerHTML =
    '<div class="boot__bg"></div><div class="boot__glow"></div><div class="boot__scan"></div>' +
    '<div class="boot__frame">' +
    '<i class="corn tl"></i><i class="corn tr"></i><i class="corn bl"></i><i class="corn br"></i>' +
    '<div class="boot__head">' +
    '<span class="boot__brand"><b>绿钥</b> <i>/</i> OAR ENGINE<span class="boot__cursor"></span></span>' +
    '<span class="boot__meta">MACAU · 22°11′N 113°32′E</span>' +
    "</div>" +
    '<div class="boot__locks">' + locksHTML + "</div>" +
    '<div class="boot__log"></div>' +
    '<div class="boot__foot">' +
    '<div class="boot__seg"><i></i><i></i><i></i><i></i></div>' +
    '<span class="boot__pct">00%</span>' +
    '<button class="boot__skip" type="button">跳过 SKIP</button>' +
    "</div>" +
    '<div class="boot__done"><span>SYSTEM READY</span></div>' +
    "</div>";

  document.body.appendChild(wrap);
  if (window.GKI18N) window.GKI18N.apply(wrap);

  var lockEls = [].slice.call(wrap.querySelectorAll(".lock"));
  var segEls = [].slice.call(wrap.querySelectorAll(".boot__seg i"));
  var logEl = wrap.querySelector(".boot__log");
  var pctEl = wrap.querySelector(".boot__pct");
  var doneEl = wrap.querySelector(".boot__done");

  var timers = [];
  var started = Date.now();
  var TOTAL = 1980;

  function at(ms, fn) {
    timers.push(setTimeout(fn, ms));
  }

  /* 百分比 */
  var raf = null;
  function tick() {
    var p = Math.min(1, (Date.now() - started) / TOTAL);
    var v = Math.min(100, Math.round(p * 100));
    pctEl.textContent = (v < 10 ? "0" : "") + v + "%";
    if (p < 1) raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  /* 逐层解锁 */
  LAYERS.forEach(function (l, i) {
    at(320 + i * 400, function () {
      var el = lockEls[i];
      el.classList.add("is-open");
      el.querySelector(".lock__state").textContent = "UNLOCKED";
      segEls[i].classList.add("on");
    });
  });

  /* 日志流 */
  LOG.forEach(function (row, i) {
    at(140 + i * 178, function () {
      var line = document.createElement("div");
      line.innerHTML = "<b>›</b><span>" + row[0] + "</span><i>" + row[1] + "</i>";
      logEl.appendChild(line);
      if (window.GKI18N) window.GKI18N.apply(line);
      logEl.scrollTop = logEl.scrollHeight;
    });
  });

  /* 收尾 */
  at(TOTAL, function () {
    pctEl.textContent = "100%";
    doneEl.classList.add("on");
  });

  at(TOTAL + 380, function () {
    wrap.classList.add("is-out");
    finish();
  });

  at(TOTAL + 820, function () {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
  });

  /* 跳过 */
  function skip() {
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    wrap.classList.add("is-out");
    finish();
    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 440);
  }
  wrap.querySelector(".boot__skip").addEventListener("click", skip);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") skip();
  });
})();
