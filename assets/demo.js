/* ==========================================================================
   绿钥 GreenKey — 交互演示页（28 日双基线）
   ========================================================================== */
(function () {
  "use strict";

  var M = window.GKModel;
  var A = window.GKApp;
  function T(zh, en) { return (window.GK && window.GK.t) ? window.GK.t(zh, en) : zh; }
  if (!M || !A) return;

  var TYPES = M.TYPES;
  var ALL_IDS = M.MEASURES.map(function (m) { return m.id; });

  var DEFAULTS = {
    type: "boutique",
    cap: TYPES.boutique.cap,
    occW: Math.round(TYPES.boutique.occ.workday * 100),
    occH: Math.round(TYPES.boutique.occ.holiday * 100),
    measures: ["floor", "hours", "hvac", "standby"],
    sources: M.SOURCES.map(function (s) { return s.id; }),
    certifiedMonths: 9,
    thirdParty: true,
    disclosed: false
  };

  var state = JSON.parse(JSON.stringify(DEFAULTS));
  var $ = function (id) { return document.getElementById(id); };
  function setText(id, v) { var n = $(id); if (n) n.textContent = v; }

  /* ---------------- 业态 chips ---------------- */
  var typeChips = $("typeChips");
  Object.keys(TYPES).forEach(function (k) {
    var b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.setAttribute("data-type", k);
    b.setAttribute("aria-pressed", k === state.type ? "true" : "false");
    b.textContent = TYPES[k].label;
    b.addEventListener("click", function () {
      var t = TYPES[k];
      state.type = k;
      state.cap = t.cap;
      state.occW = Math.round(t.occ.workday * 100);
      state.occH = Math.round(t.occ.holiday * 100);
      var capEl = $("cap");
      capEl.min = t.capMin;
      capEl.max = t.capMax;
      capEl.step = t.cap >= 100 ? 2 : 1;
      capEl.value = state.cap;
      $("occW").value = state.occW;
      $("occH").value = state.occH;
      setText("normW", Math.round(t.norm.workday * 100) + "%");
      syncChips();
      render();
    });
    typeChips.appendChild(b);
  });

  function syncChips() {
    [].slice.call(typeChips.children).forEach(function (c) {
      c.setAttribute("aria-pressed", c.getAttribute("data-type") === state.type ? "true" : "false");
    });
  }

  /* ---------------- 措施 ---------------- */
  var measureGrid = $("measureGrid");
  var measureNodes = {};
  M.MEASURES.forEach(function (m) {
    var b = document.createElement("button");
    b.className = "measure";
    b.type = "button";
    b.setAttribute("aria-pressed", state.measures.indexOf(m.id) > -1 ? "true" : "false");
    b.innerHTML =
      '<span class="measure__box"></span>' +
      '<span><span class="measure__name">' + m.name + "</span>" +
      '<span class="measure__desc">' + m.desc + "</span></span>" +
      '<span class="measure__eff">' + (m.weekdayOnly ? "平日" : "全周") + "</span>";
    b.addEventListener("click", function () {
      var i = state.measures.indexOf(m.id);
      if (i > -1) state.measures.splice(i, 1);
      else state.measures.push(m.id);
      b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
      render();
    });
    measureNodes[m.id] = b;
    measureGrid.appendChild(b);
  });

  function syncMeasures() {
    M.MEASURES.forEach(function (m) {
      measureNodes[m.id].setAttribute("aria-pressed", state.measures.indexOf(m.id) > -1 ? "true" : "false");
    });
  }

  $("btnAll").addEventListener("click", function () { state.measures = ALL_IDS.slice(); syncMeasures(); render(); });
  $("btnNone").addEventListener("click", function () { state.measures = []; syncMeasures(); render(); });

  /* ---------------- 数据源 ---------------- */
  var srcRow = $("srcRow");
  var srcNodes = {};
  M.SOURCES.forEach(function (s) {
    var b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.setAttribute("aria-pressed", state.sources.indexOf(s.id) > -1 ? "true" : "false");
    b.innerHTML = '<span class="chip-dot"></span>' + s.name;
    b.addEventListener("click", function () {
      var i = state.sources.indexOf(s.id);
      if (i > -1) state.sources.splice(i, 1);
      else state.sources.push(s.id);
      b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
      render();
    });
    srcNodes[s.id] = b;
    srcRow.appendChild(b);
  });

  $("tpToggle").addEventListener("click", function () {
    state.thirdParty = !state.thirdParty;
    this.setAttribute("aria-pressed", state.thirdParty ? "true" : "false");
    setText("tpVal", state.thirdParty ? T("已复核", "Reviewed") : T("未复核", "Not reviewed"));
    render();
  });
  $("dsToggle").addEventListener("click", function () {
    state.disclosed = !state.disclosed;
    this.setAttribute("aria-pressed", state.disclosed ? "true" : "false");
    setText("dsVal", state.disclosed ? T("已披露", "Disclosed") : T("未披露", "Not disclosed"));
    render();
  });

  /* ---------------- 滑块 ---------------- */
  $("cap").addEventListener("input", function () { state.cap = Number(this.value); render(); });
  $("occW").addEventListener("input", function () { state.occW = Number(this.value); render(); });
  $("occH").addEventListener("input", function () { state.occH = Number(this.value); render(); });
  $("months").addEventListener("input", function () { state.certifiedMonths = Number(this.value); render(); });

  /* ---------------- 渲染 ---------------- */
  var svg = $("dayChart");
  var out = $("chartReadout");
  var gaugeSvg = $("gaugeSvg");
  var pending = false;
  function defaultReadout() { return T("把光标移到图上，逐日查看三条线的位置关系", "Move the cursor over the chart to inspect the three lines day by day"); }

  function readout(d) {
    var typeCN = d.type === "workday" ? T("工作日", "Weekday") : d.type === "holiday" ? T("公众假期", "Public holiday") : T("周末", "Weekend");
    return (
      "<b>" + d.label + " " + d.dow + "</b>" +
      "<span>" + typeCN + " · " + T("入住率", "occupancy") + " <b>" + Math.round(d.occ * 100) + "%</b></span>" +
      "<span>" + T("历史常态", "Historical norm") + " <b>" + A.fmt(d.expected) + "</b></span>" +
      "<span>" + T("校正 BAU", "Adjusted BAU") + " <b>" + A.fmt(d.bau) + "</b></span>" +
      "<span>" + T("实测", "Actual") + " <b>" + A.fmt(d.act) + "</b></span>" +
      (d.credited
        ? "<span style='color:#2be8a6'>✓ " + T("计入", "counted") + " " + A.fmt(d.attr) + " kWh</span>"
        : "<span>— " + T("未越过 P10，不计入", "below P10, not counted") + "</span>")
    );
  }

  function render() {
    var r = M.compute({
      type: state.type,
      cap: state.cap,
      occW: state.occW / 100,
      occH: state.occH / 100,
      measures: state.measures,
      sources: state.sources,
      certifiedMonths: state.certifiedMonths,
      thirdParty: state.thirdParty,
      disclosed: state.disclosed
    });

    /* 标签 */
    setText("capVal", A.fmt(state.cap) + " " + T(r.cfg.capUnit));
    setText("occWVal", state.occW + "%");
    setText("occHVal", state.occH + "%");
    setText("monthsVal", T(state.certifiedMonths + " 个月", state.certifiedMonths + " months"));
    setText("capHint", T("该业态典型规模 " + r.cfg.cap + " " + r.cfg.capUnit + " · " + r.cfg.note, "Typical scale " + r.cfg.cap + " " + T(r.cfg.capUnit) + " · " + r.cfg.noteEn));

    /* KPI */
    setText("kpiKwh", A.fmt(r.annualOar));
    setText("kpiWin", A.fmt(r.oar));
    setText("kpiTco2", r.tco2.toFixed(1));
    setText("kpiTrees", A.fmt((r.tco2 * 1000) / 21));
    setText("kpiGain", (r.intensityGain * 100).toFixed(1));
    setText("kpiInt", r.intensityBau.toFixed(1) + " → " + r.intensityAct.toFixed(1));
    setText("kpiScore", String(r.score));
    setText("kpiTier", T(r.tier) + " · " + r.tierEn);

    /* 分解 */
    var drop = r.expTotal - r.totalAct;
    var dropPct = r.expTotal > 0 ? (drop / r.expTotal) * 100 : 0;
    var actPct = r.expTotal > 0 ? (r.activityEffect / r.expTotal) * 100 : 0;
    var effPct = r.expTotal > 0 ? ((r.totalBau - r.totalAct) / r.expTotal) * 100 : 0;
    var actShare = drop > 0 ? (r.activityEffect / drop) * 100 : 0;
    var effShare = drop > 0 ? ((r.totalBau - r.totalAct) / drop) * 100 : 0;

    setText("dropTag", "−" + dropPct.toFixed(1) + "%");
    setText("dropText", T(
      "与历史常态相比，这家店 28 天的用电少了 " + dropPct.toFixed(1) + "%。其中 " + Math.round(actShare) + "% 只是客人变少了——这部分不计入减排。",
      "Against the historical norm, this venue used " + dropPct.toFixed(1) + "% less electricity over 28 days. " + Math.round(actShare) + "% of that is simply fewer guests — excluded from reduction."));
    $("barAct").style.width = Math.max(0, actShare) + "%";
    $("barEff").style.width = Math.max(0, effShare) + "%";
    setText("barActN", actPct.toFixed(1) + "%");
    setText("barEffN", effPct.toFixed(1) + "%");
    setText("actEff", A.fmt(r.activityEffect) + " kWh");
    setText("effEff", A.fmt(r.totalBau - r.totalAct) + " kWh");
    setText("invGain", (r.intensityGain * 100).toFixed(1) + "%");

    /* 凭证 */
    setText("certNo", r.certNo);
    setText("certKwh", A.fmt(r.oar));
    setText("certTco2", ((r.oar * M.EF) / 1000).toFixed(2));
    setText("certEntity", T(r.cfg.label) + " · " + state.cap + " " + T(r.cfg.capUnit));
    setText("certPeriod", r.startKey + " → " + r.endKey);
    setText("certGain", "−" + (r.intensityGain * 100).toFixed(1) + "% / " + T(r.cfg.unit));
    setText("certTier", r.tier);
    setText("certConf",
      state.sources.length >= 4 ? "A · 四源齐备" : state.sources.length === 3 ? "B · 三源" : "C · 源不足");
    setText("certHash", r.hash.slice(0, 8) + "…" + r.hash.slice(-4));

    /* 金融 */
    setText("finCash", "MOP " + A.fmt(r.savingsMop));
    setText("finRate", "−" + r.rateCut.toFixed(1) + " pp");
    setText("finLoan", "MOP " + A.fmt(r.cashflowLoan));
    setText("finGuar", "MOP " + A.fmt(r.loanGuaranteed));
    setText("finInterest", "MOP " + A.fmt(r.interestSaved));
    setText("finTotal", "MOP " + A.fmt(r.savingsMop + r.interestSaved));

    setText("p1", r.parts.s1.toFixed(3));
    setText("p2", r.parts.s2.toFixed(3));
    setText("p3", r.parts.s3.toFixed(3));
    setText("p4", r.parts.s4.toFixed(3));

    /* 图表 */
    if (!pending) {
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        A.chart(svg, r, {
          theme: "dark",
          height: 340,
          onHover: function (i, d) { out.innerHTML = readout(d); },
          onLeave: function () {
            out.innerHTML =
              "<span>" + T("窗口内可核证", "Certified in window") + " <b>" + A.fmt(r.oar) + "</b> kWh</span>" +
              "<span>" + T("活动量效应", "Activity effect") + " <b>" + A.fmt(r.activityEffect) + "</b> kWh" + T("（不计入）", " (excluded)") + "</span>" +
              "<span>" + T("年度外推", "Annualised") + " <b>" + A.fmt(r.annualOar) + "</b> kWh</span>";
          }
        });
      });
    }
    A.gauge(gaugeSvg, r.score);
    if (window.GKI18N) window.GKI18N.apply(document.body);
  }

  /* ---------------- 按钮 ---------------- */
  $("btnPrint").addEventListener("click", function () { window.print(); });

  $("btnCopy").addEventListener("click", function () {
    var r = M.compute({
      type: state.type, cap: state.cap, occW: state.occW / 100, occH: state.occH / 100,
      measures: state.measures, sources: state.sources,
      certifiedMonths: state.certifiedMonths, thirdParty: state.thirdParty, disclosed: state.disclosed
    });
    var url = "https://verify.greenkey.mo/" + r.certNo.toLowerCase() + "?h=" + r.hash.slice(0, 12);
    var btn = this, label = btn.textContent;
    var done = function () {
      btn.textContent = T("已复制", "Copied");
      setTimeout(function () { btn.textContent = label; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  });

  $("btnReset").addEventListener("click", function () {
    state = JSON.parse(JSON.stringify(DEFAULTS));
    var t = TYPES.boutique;
    $("cap").min = t.capMin; $("cap").max = t.capMax; $("cap").step = 1;
    $("cap").value = state.cap;
    $("occW").value = state.occW;
    $("occH").value = state.occH;
    $("months").value = state.certifiedMonths;
    setText("normW", Math.round(t.norm.workday * 100) + "%");
    syncChips(); syncMeasures();
    M.SOURCES.forEach(function (s) { srcNodes[s.id].setAttribute("aria-pressed", "true"); });
    state.sources = M.SOURCES.map(function (s) { return s.id; });
    $("tpToggle").setAttribute("aria-pressed", "true");
    $("dsToggle").setAttribute("aria-pressed", "false");
    setText("tpVal", T("已复核", "Reviewed"));
    setText("dsVal", T("未披露", "Not disclosed"));
    render();
    out.textContent = defaultReadout();
  });

  /* ---------------- 启动 ---------------- */
  setText("normW", Math.round(TYPES.boutique.norm.workday * 100) + "%");
  render();
  if (A.onResize) A.onResize(function () { render(); });
  document.addEventListener("gk:lang", function () { render(); });
})();
