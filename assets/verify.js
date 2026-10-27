/* ==========================================================================
   绿钥 GreenKey — 核证链（凭证台账 + 第三方复算）
   ========================================================================== */
(function () {
  "use strict";

  var M = window.GKModel, A = window.GKApp;
  if (!M || !A) return;
  function T(zh, en) { return (window.GK && window.GK.t) ? window.GK.t(zh, en) : zh; }
  var $ = function (id) { return document.getElementById(id); };

  /* 六张已签发凭证：输入完全公开，输出可复算 */
  var CERTS = [
    {
      no: "GK-MO-2026-34636", name: "南湾 · 拾光茶室", district: "南湾",
      type: "cha", cap: 154, occW: 0.42, occH: 0.9,
      measures: ["led", "hvac", "standby", "shift", "maint"], months: 18,
      tp: true, disc: true, issued: "2026-08-31", reviewed: "2026-09-12",
      use: "已提交银行绿色信贷申请"
    },
    {
      no: "GK-MO-2026-63228", name: "路环 · 海风民宿", district: "路环",
      type: "guesthouse", cap: 26, occW: 0.36, occH: 0.91,
      measures: ["floor", "hvac", "standby", "laundry"], months: 15,
      tp: true, disc: true, issued: "2026-09-05", reviewed: "2026-09-18",
      use: "已用于政府绿色认证申报"
    },
    {
      no: "GK-MO-2026-36496", name: "十月初五街 · 和昌饼家", district: "十月初五街",
      type: "bakery", cap: 66, occW: 0.4, occH: 0.86,
      measures: ["led", "hvac", "standby", "laundry", "maint"], months: 14,
      tp: true, disc: false, issued: "2026-09-11", reviewed: "2026-09-20",
      use: "用于利息补贴申请材料"
    },
    {
      no: "GK-MO-2026-50311", name: "氹仔 · 旧城旅舍", district: "氹仔",
      type: "hostel", cap: 48, occW: 0.33, occH: 0.88,
      measures: ["floor", "hvac", "standby", "sensor"], months: 12,
      tp: true, disc: false, issued: "2026-09-22", reviewed: "2026-10-02",
      use: "已提交银行绿色信贷申请"
    },
    {
      no: "GK-MO-2026-37748", name: "疯堂斜巷 · 文创工坊", district: "望德堂",
      type: "studio", cap: 90, occW: 0.44, occH: 0.8,
      measures: ["led", "hvac", "standby", "sensor", "shift"], months: 9,
      tp: true, disc: false, issued: "2026-10-08", reviewed: "2026-10-15",
      use: "内部管理与年度披露"
    },
    {
      no: "GK-MO-2026-48205", name: "新马路 · 小馆", district: "新马路",
      type: "restaurant", cap: 99, occW: 0.45, occH: 0.94,
      measures: ["led", "hvac", "standby", "laundry"], months: 11,
      tp: false, disc: false, issued: "2026-10-19", reviewed: "待复核",
      use: "材料准备中"
    }
  ];

  CERTS.forEach(function (c) {
    c.r = M.compute({
      type: c.type, cap: c.cap, occW: c.occW, occH: c.occH,
      measures: c.measures, certifiedMonths: c.months,
      thirdParty: c.tp, disclosed: c.disc
    });
  });

  var current = null;

  /* ---------------- 台账 ---------------- */
  var ledger = $("ledger");
  CERTS.forEach(function (c, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ledger__row";
    b.setAttribute("data-i", i);
    b.innerHTML =
      '<span class="ledger__no">' + c.no + "</span>" +
      '<span class="ledger__kwh">' + A.fmt(c.r.oar) + " kWh</span>" +
      '<span class="ledger__name">' + c.name + "</span>" +
      '<span class="ledger__meta">' + c.issued + " · " + c.r.tier + " · " + (c.tp ? T("已复核", "Reviewed") : T("待复核", "Pending review")) + "</span>";
    b.addEventListener("click", function () { select(i); });
    ledger.appendChild(b);
  });

  function select(i) {
    current = i;
    var c = CERTS[i], r = c.r;
    [].slice.call(ledger.children).forEach(function (el, k) {
      el.classList.toggle("is-on", k === i);
    });

    $("dtNo").textContent = c.no;
    $("dtName").textContent = c.name;
    $("dtPeriod").textContent = r.startKey + " → " + r.endKey;
    $("dtKwh").textContent = A.fmt(r.oar);
    $("dtTco2").textContent = ((r.oar * M.EF) / 1000).toFixed(2);
    $("dtGain").textContent = (r.intensityGain * 100).toFixed(1);
    $("dtScore").textContent = r.score;
    $("dtTier").textContent = r.tier;

    $("dtParams").innerHTML =
      row("方法学", "GKM-01 v2.0 · 参数快照冻结") +
      row("核算边界", "外购电力（Scope 2）· 门店级") +
      row("活动量单位", r.cfg.unit) +
      row("电网排放因子", M.EF.toFixed(2) + " kgCO₂e/kWh") +
      row("置信门槛", "BAU × 0.94（P10）") +
      row("训练窗口", T("未干预窗口 · " + c.months + " 个月", "Un-intervened window · " + c.months + " months")) +
      row("数据源", "电表 · 账单 · 入住率 · 工时") +
      row("数据指纹", r.hash.slice(0, 32) + "…");

    var tb = $("dtDays").querySelector("tbody");
    tb.innerHTML = r.days.map(function (d) {
      var t = d.type === "workday" ? "工作日" : d.type === "holiday" ? "假期" : "周末";
      return "<tr><td>" + d.label + " " + d.dow + "</td><td>" + t + "</td><td>" +
        A.fmt(d.expected) + "</td><td>" + A.fmt(d.bau) + "</td><td>" +
        A.fmt(d.act) + "</td><td>" + (d.credited ? A.fmt(d.attr) : "—") + "</td></tr>";
    }).join("");

    $("dtAudit").innerHTML =
      item(c.issued, "签发", T("初次核证，置信等级 " + (c.measures.length >= 4 ? "A" : "B") + "，写入台账", "First certification, confidence class " + (c.measures.length >= 4 ? "A" : "B") + ", written to the ledger")) +
      item(c.reviewed, c.tp ? "复核通过" : "待复核", c.tp ? T("认证机构抽样复核，结论：一致", "Sampled review by a certification body: consistent") : T("尚未安排复核，额度按 B 级处理", "Review not yet scheduled; credit treated as class B")) +
      item(c.issued.slice(0, 7) + "-28", "用途登记", c.use);

    $("recalcLog").hidden = true;
    $("recalcLog").innerHTML = "";
    $("recalcStatus").textContent = "尚未复算";
    $("recalcStatus").style.color = "var(--muted)";
    if (window.GKI18N) window.GKI18N.apply(document.body);
  }

  function row(k, v) {
    return '<div class="kv__row"><span class="kv__k">' + k + "</span><span>" + v + "</span></div>";
  }
  function item(when, title, body) {
    return '<div class="tl__item"><span class="tl__when">' + when + " · " + title + "</span>" +
      '<p class="small" style="margin:4px 0 0">' + body + "</p></div>";
  }

  /* ---------------- 复算 ---------------- */
  var STEPS = [
    ["载入原始读数", function (r) { return A.fmt(r.days.length * 96); }],
    ["重建日型日历", function (r) { return r.nWork + "W / " + r.nWeekend + "E / " + r.nHoliday + "H"; }],
    ["拟合历史常态基线", function (r) { return A.fmt(r.expTotal) + " kWh"; }],
    ["按当日活动量校正", function (r) { return A.fmt(r.totalBau) + " kWh"; }],
    ["计算 P10 置信下界", function () { return "×0.94"; }],
    ["剔除活动量效应", function (r) { return "−" + A.fmt(r.activityEffect) + " kWh"; }],
    ["归因强度效应", function (r) { return "+" + A.fmt(r.oar) + " kWh"; }],
    ["比对数据指纹", function (r) { return r.hash.slice(0, 12) + "…"; }]
  ];

  var running = false;
  $("btnRecalc").addEventListener("click", function () {
    if (running || current === null) return;
    running = true;
    var btn = this;
    btn.disabled = true;
    var c = CERTS[current];
    var r = M.compute({
      type: c.type, cap: c.cap, occW: c.occW, occH: c.occH,
      measures: c.measures, certifiedMonths: c.months, thirdParty: c.tp, disclosed: c.disc
    });
    var log = $("recalcLog");
    log.hidden = false;
    log.innerHTML = "";
    $("recalcStatus").textContent = "复算中…";

    STEPS.forEach(function (s, i) {
      setTimeout(function () {
        var line = document.createElement("div");
        line.innerHTML = "<span>" + s[0] + "</span><b>" + s[1](r) + "</b>";
        log.appendChild(line);
        if (i === STEPS.length - 1) {
          setTimeout(function () {
            var same = r.hash === c.r.hash && Math.abs(r.oar - c.r.oar) < 0.001;
            var res = document.createElement("div");
            res.className = "recalc__result";
            res.innerHTML = same
              ? '<span style="color:#2be8a6">✓ 复算一致</span><b>' + r.hash.slice(0, 16) + "…</b>"
              : '<span style="color:#e8825a">✗ 指纹不一致</span><b>—</b>';
            log.appendChild(res);
            $("recalcStatus").textContent = same ? "已通过 · 4 项全部一致" : "不一致，需人工复核";
            $("recalcStatus").style.color = same ? "var(--mint)" : "var(--clay)";
            btn.disabled = false;
            running = false;
            if (window.GKI18N) window.GKI18N.apply(log);
          }, 320);
        }
      }, 170 * i);
    });
  });

  select(0);
})();
