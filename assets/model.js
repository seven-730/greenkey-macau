/* ==========================================================================
   绿钥 GreenKey — 运营归因减排模型 v2（工作日/节假日双轨基线）
   shared: browser + node。全站数字的唯一来源。
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GKModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- 常量 ---------- */
  var EF = 0.5; // kgCO2e / kWh（澳门电网参考值，按核证年度更新）
  var TARIFF = 1.28; // MOP / kWh
  var N_DAYS = 28; // 观察窗口：28 个计费日
  var START = new Date(2026, 8, 21); // 2026-09-21（周一）

  /* 年度日型构成，用于外推 */
  var YEAR_SPLIT = { workday: 250, weekend: 96, holiday: 19 };

  var HOLIDAYS = [
    "2026-09-25", // 中秋节
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    "2026-10-05", "2026-10-06", "2026-10-07" // 国庆黄金周
  ];

  var WD_CN = ["日", "一", "二", "三", "四", "五", "六"];

  /* ---------- 业态画像 ---------- */
  var TYPES = {
    boutique: {
      label: "精品酒店",
      en: "Boutique Hotel",
      unit: "间夜",
      capUnit: "客房",
      cap: 40,
      capMin: 12,
      capMax: 120,
      base: 460, // 每日基载 kWh（公区、厨房、电梯、热水）
      unitKwh: 26, // 每间夜 kWh
      occ: { workday: 0.38, weekend: 0.82, holiday: 0.92 },
      norm: { workday: 0.52, weekend: 0.85, holiday: 0.93 }, // 历史常态入住率
      bench: 230, // 同业中位 kWh/m²·年（仅用于诊断显示）
      areaPerRoom: 55,
      note: "工作日入住率常低于 40%，公区仍按满负荷运行",
      noteEn: "Weekday occupancy often below 40%; public areas still run at full load"
    },
    economy: {
      label: "经济型酒店",
      en: "Budget Hotel",
      unit: "间夜",
      capUnit: "客房",
      cap: 80,
      capMin: 20,
      capMax: 200,
      base: 640,
      unitKwh: 20,
      occ: { workday: 0.45, weekend: 0.88, holiday: 0.95 },
      norm: { workday: 0.58, weekend: 0.9, holiday: 0.96 },
      bench: 175,
      areaPerRoom: 38,
      note: "房量大、单房能耗低，基载占比更高",
      noteEn: "Many rooms, low energy per room; base load dominates"
    },
    hostel: {
      label: "青年旅舍",
      en: "Youth Hostel",
      unit: "床位夜",
      capUnit: "床位",
      cap: 60,
      capMin: 16,
      capMax: 160,
      base: 180,
      unitKwh: 9,
      occ: { workday: 0.35, weekend: 0.78, holiday: 0.9 },
      norm: { workday: 0.48, weekend: 0.8, holiday: 0.91 },
      bench: 150,
      areaPerRoom: 12,
      note: "公共厨房与共享空间是主要负荷",
      noteEn: "Shared kitchen and common space are the main loads"
    },
    restaurant: {
      label: "小型餐饮",
      en: "Small Restaurant",
      unit: "客次",
      capUnit: "日均客位",
      cap: 99,
      capMin: 30,
      capMax: 300,
      base: 210,
      unitKwh: 3.4,
      occ: { workday: 0.45, weekend: 0.85, holiday: 0.94 },
      norm: { workday: 0.55, weekend: 0.86, holiday: 0.94 },
      bench: 420,
      areaPerRoom: 1.4,
      note: "厨房基载刚性，客数波动直接决定排风与冷藏负荷",
      noteEn: "Rigid kitchen base load; covers drive exhaust and refrigeration"
    },
    cha: {
      label: "茶餐厅",
      en: "Cha Chaan Teng",
      unit: "客次",
      capUnit: "日均客位",
      cap: 154,
      capMin: 40,
      capMax: 400,
      base: 320,
      unitKwh: 2.9,
      occ: { workday: 0.42, weekend: 0.8, holiday: 0.9 },
      norm: { workday: 0.52, weekend: 0.82, holiday: 0.9 },
      bench: 470,
      areaPerRoom: 1.2,
      note: "炉具与冷柜构成三重基载，营业时长是最大变量",
      noteEn: "Cooking and refrigeration form a triple base load; opening hours matter most"
    },
    cafe: {
      label: "咖啡 / 烘焙",
      en: "Café & Bakery",
      unit: "客次",
      capUnit: "日均客位",
      cap: 66,
      capMin: 20,
      capMax: 180,
      base: 120,
      unitKwh: 2.6,
      occ: { workday: 0.4, weekend: 0.75, holiday: 0.88 },
      norm: { workday: 0.5, weekend: 0.78, holiday: 0.88 },
      bench: 390,
      areaPerRoom: 1.6,
      note: "烤箱时段集中，展示柜全天运行",
      noteEn: "Ovens run in concentrated bursts; display cases run all day"
    }
  };

  /* ---------- 运营措施 ----------
     base: 对基载（公区/厨房/电梯）的削减比例
     unit: 对单位活动量能耗的削减比例
     weekdayOnly: 仅在工作日实施（对应"平日节能"的核心形态）
  */
  var MEASURES = [
    {
      id: "floor",
      name: "工作日关闭低使用楼层",
      desc: "集中排房，关闭整层公区空调与照明",
      base: 0.075,
      unit: 0,
      weekdayOnly: true,
      tag: "运营"
    },
    {
      id: "hours",
      name: "缩短大堂与餐厅营业时长",
      desc: "非高峰合并动线，减少实际服务面积",
      base: 0.055,
      unit: 0,
      weekdayOnly: true,
      tag: "运营"
    },
    {
      id: "hvac",
      name: "空调 26℃ 与分区控制",
      desc: "按入住率分区启停，公共区温度回调",
      base: 0.035,
      unit: 0.06,
      weekdayOnly: false,
      tag: "设备"
    },
    {
      id: "standby",
      name: "待机管理与公区照明分区",
      desc: "回路分控、定时断电、夜间减光",
      base: 0.03,
      unit: 0.01,
      weekdayOnly: false,
      tag: "行为"
    },
    {
      id: "laundry",
      name: "洗衣与热水错峰调度",
      desc: "避开用电高峰，减少锅炉重复启动",
      base: 0.025,
      unit: 0.02,
      weekdayOnly: false,
      tag: "运营"
    },
    {
      id: "sensor",
      name: "客房人走断电",
      desc: "门卡取电 + 无人自动降载",
      base: 0,
      unit: 0.05,
      weekdayOnly: false,
      tag: "设备"
    }
  ];

  var SOURCES = [
    { id: "meter", name: "智能电表 / 分项计量", w: 0.38 },
    { id: "bill", name: "公用事业账单", w: 0.24 },
    { id: "occupancy", name: "入住率 / 房态 / 客流", w: 0.24 },
    { id: "ops", name: "营业时长 / 楼层使用率", w: 0.14 }
  ];

  /* ---------- 工具 ---------- */
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function round(v, d) {
    var p = Math.pow(10, d || 0);
    return Math.round(v * p) / p;
  }
  function fnv(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function pseudoHex(seed, len) {
    var out = "", h = fnv(seed);
    while (out.length < (len || 40)) {
      h = (h ^ (h << 13)) >>> 0;
      h = (h ^ (h >>> 17)) >>> 0;
      h = (h ^ (h << 5)) >>> 0;
      out += h.toString(16).padStart(8, "0");
    }
    return out.slice(0, len || 40);
  }
  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  /* 28 天日历：日型、天气、本底噪声（固定，保证可复现） */
  var NOISE_A = [0.03, -0.02, 0.05, -0.04, 0.01, 0.06, -0.03, 0.02, -0.05, 0.04, 0.0, -0.02, 0.05, 0.03];
  var NOISE_W = [0.01, -0.01, 0.008, -0.006, 0.004, -0.009, 0.007, 0.002, -0.005, 0.009, -0.003, 0.006, -0.008, 0.004];

  function buildCalendar() {
    var out = [];
    for (var i = 0; i < N_DAYS; i++) {
      var d = new Date(START.getFullYear(), START.getMonth(), START.getDate() + i);
      var key = iso(d);
      var dow = d.getDay();
      var type = "workday";
      if (HOLIDAYS.indexOf(key) > -1) type = "holiday";
      else if (dow === 0 || dow === 6) type = "weekend";
      // 天气：9 月下旬至 10 月中旬，CDD 缓慢下降 + 噪声
      var weather = 1.06 - i * 0.0055 + NOISE_W[i % NOISE_W.length];
      out.push({
        i: i,
        date: d,
        key: key,
        dow: dow,
        label: d.getMonth() + 1 + "/" + d.getDate(),
        dowCN: "周" + WD_CN[dow],
        type: type,
        weather: weather
      });
    }
    return out;
  }

  var CAL = buildCalendar();

  function combine(ids, key) {
    var keep = 1;
    MEASURES.forEach(function (m) {
      if (ids.indexOf(m.id) > -1) keep *= 1 - m[key];
    });
    return 1 - keep;
  }

  /* ---------- 主模型 ---------- */
  function compute(input) {
    input = input || {};
    var cfg = TYPES[input.type] || TYPES.boutique;
    var cap = input.cap != null ? Number(input.cap) : cfg.cap;
    var occW = input.occW != null ? Number(input.occW) : cfg.occ.workday;
    var occH = input.occH != null ? Number(input.occH) : cfg.occ.holiday;
    var measures = input.measures || [];
    var sources = input.sources || SOURCES.map(function (s) { return s.id; });
    var months = input.certifiedMonths != null ? input.certifiedMonths : 9;
    var thirdParty = input.thirdParty !== false;
    var disclosed = !!input.disclosed;

    /* 措施效果：工作日可启用 weekdayOnly 项 */
    var baseEffWd = combine(measures, "base");
    var unitEff = combine(measures, "unit");
    // 节假日：剔除 weekdayOnly 措施
    var baseKeepH = 1;
    MEASURES.forEach(function (m) {
      if (measures.indexOf(m.id) > -1 && !m.weekdayOnly) baseKeepH *= 1 - m.base;
    });
    var baseEffH = 1 - baseKeepH;

    var days = [];
    var sums = {
      workday: { exp: 0, bau: 0, act: 0, oar: 0, act_eff: 0, n: 0, units: 0 },
      weekend: { exp: 0, bau: 0, act: 0, oar: 0, act_eff: 0, n: 0, units: 0 },
      holiday: { exp: 0, bau: 0, act: 0, oar: 0, act_eff: 0, n: 0, units: 0 }
    };

    CAL.forEach(function (c) {
      var occ = c.type === "workday" ? occW : occH;
      // 周末按工作日与节假日之间取值
      if (c.type === "weekend") occ = occW + (occH - occW) * 0.82;
      var noise = NOISE_A[c.i % NOISE_A.length] * (c.type === "workday" ? 1 : 0.6);
      var units = cap * occ * (1 + noise);
      var expUnits = cap * cfg.norm[c.type]; // 历史常态（不校正当日入住率）
      var W = c.weather;
      var expected = cfg.base * W + expUnits * cfg.unitKwh * W;
      var bau = cfg.base * W + units * cfg.unitKwh * W;
      var bEff = c.type === "workday" ? baseEffWd : baseEffH;
      var act = cfg.base * W * (1 - bEff) + units * cfg.unitKwh * W * (1 - unitEff);
      var p10 = bau * 0.94;
      var credited = act < p10;
      var attr = credited ? bau - act : 0;
      var actEff = Math.max(0, expected - bau); // 活动量效应（不计入）
      var s = sums[c.type];
      s.exp += expected;
      s.bau += bau;
      s.act += act;
      s.oar += attr;
      s.act_eff += actEff;
      s.n += 1;
      s.units += units;
      days.push({
        i: c.i,
        label: c.label,
        dow: c.dowCN,
        key: c.key,
        type: c.type,
        occ: occ,
        units: units,
        expUnits: expUnits,
        expected: expected,
        bau: bau,
        p10: p10,
        act: act,
        credited: credited,
        attr: attr,
        actEff: actEff,
        intensityBau: bau / Math.max(units, 0.001),
        intensityAct: act / Math.max(units, 0.001)
      });
    });

    var expTotal = 0, totalBau = 0, totalAct = 0;
    days.forEach(function (d) {
      expTotal += d.expected;
      totalBau += d.bau;
      totalAct += d.act;
    });
    var naive = expTotal / N_DAYS;
    var activityEffect = expTotal - totalBau;
    var oar = 0, falseCredit = 0, missCredit = 0;
    days.forEach(function (d) {
      d.naive = naive;
      oar += d.attr;
      if (d.naive > d.bau) falseCredit += d.naive - d.bau;
      else missCredit += d.bau - d.naive;
    });

    /* 强度口径：kBau / kAct 按活动量加权 */
    var unitsTotal = 0, unitsWeightedBau = 0, unitsWeightedAct = 0;
    days.forEach(function (d) {
      unitsTotal += d.units;
      unitsWeightedBau += d.bau;
      unitsWeightedAct += d.act;
    });
    var intensityBau = unitsWeightedBau / unitsTotal;
    var intensityAct = unitsWeightedAct / unitsTotal;
    var intensityGain = 1 - intensityAct / intensityBau;

    /* 年度外推：按日型均值 × 年度日数 */
    function avg(type, key) {
      var s = sums[type];
      return s.n ? s[key] / s.n : 0;
    }
    var annualOar =
      YEAR_SPLIT.workday * avg("workday", "oar") +
      YEAR_SPLIT.weekend * avg("weekend", "oar") +
      YEAR_SPLIT.holiday * avg("holiday", "oar");
    var annualAct =
      YEAR_SPLIT.workday * avg("workday", "act") +
      YEAR_SPLIT.weekend * avg("weekend", "act") +
      YEAR_SPLIT.holiday * avg("holiday", "act");
    var annualBau =
      YEAR_SPLIT.workday * avg("workday", "bau") +
      YEAR_SPLIT.weekend * avg("weekend", "bau") +
      YEAR_SPLIT.holiday * avg("holiday", "bau");
    var annualExp =
      YEAR_SPLIT.workday * avg("workday", "exp") +
      YEAR_SPLIT.weekend * avg("weekend", "exp") +
      YEAR_SPLIT.holiday * avg("holiday", "exp");

    var tco2 = (annualOar * EF) / 1000;
    var savingsMop = annualOar * TARIFF;

    /* 活动量效应：入住率下降带来的能耗变化，明确排除在核证之外 */
    var activityEffectYr = annualExp - annualBau;

    /* 工作日节能率 */
    var wdGain = sums.workday.bau ? 1 - sums.workday.act / sums.workday.bau : 0;
    var hdGain = sums.holiday.bau ? 1 - sums.holiday.act / sums.holiday.bau : 0;

    /* ---------- 绿信分 ---------- */
    var s1 = clamp(intensityGain / 0.18, 0, 1);
    var s2 = clamp(months / 18, 0, 1) * (oar > 0 ? 1 : 0);
    var s3 = 0;
    SOURCES.forEach(function (s) {
      if (sources.indexOf(s.id) > -1) s3 += s.w;
    });
    var s4 = (thirdParty ? 0.6 : 0) + (disclosed ? 0.4 : 0);
    var w = 0.5 * s1 + 0.18 * s2 + 0.17 * s3 + 0.15 * s4;
    var score = Math.round(300 + 700 * w);
    var tier = score >= 870 ? "示范" : score >= 750 ? "领先" : score >= 600 ? "稳健" : "起步";
    var tierEn = score >= 870 ? "Platinum" : score >= 750 ? "Gold" : score >= 600 ? "Silver" : "Bronze";

    /* ---------- 金融 ---------- */
    var rateCut = round(0.4 + (1.6 * (score - 300)) / 700, 1);
    var cashflowLoan = Math.round((savingsMop * 3.2 * (0.6 + (0.4 * score) / 1000)) / 1000) * 1000;
    var loanGuaranteed = Math.round((cashflowLoan * 3.0) / 10000) * 10000;
    var interestSaved = Math.round(((loanGuaranteed * rateCut) / 100) * 3);

    var certNo =
      "GK-MO-" + (input.year || 2026) + "-" +
      String((fnv(input.type + "|" + Math.round(cap) + "|" + Math.round(occW * 100) + "|" + measures.slice().sort().join(",")) % 90000) + 10000);
    var hash = pseudoHex(certNo + "|" + Math.round(oar), 40);

    return {
      cfg: cfg,
      type: input.type || "boutique",
      cap: cap,
      occW: occW,
      occH: occH,
      measures: measures.slice(),
      days: days,
      naive: naive,
      expTotal: expTotal,
      totalBau: totalBau,
      totalAct: totalAct,
      oar: oar,
      falseCredit: falseCredit,
      missCredit: missCredit,
      activityEffect: activityEffect,
      activityEffectYr: activityEffectYr,
      intensityBau: intensityBau,
      intensityAct: intensityAct,
      intensityGain: intensityGain,
      baseEffWd: baseEffWd,
      baseEffH: baseEffH,
      unitEff: unitEff,
      wdGain: wdGain,
      hdGain: hdGain,
      annualOar: annualOar,
      annualAct: annualAct,
      annualBau: annualBau,
      annualExp: annualExp,
      tco2: tco2,
      savingsMop: savingsMop,
      score: score,
      tier: tier,
      tierEn: tierEn,
      parts: { s1: s1, s2: s2, s3: s3, s4: s4, w: w },
      rateCut: rateCut,
      cashflowLoan: cashflowLoan,
      loanGuaranteed: loanGuaranteed,
      interestSaved: interestSaved,
      certNo: certNo,
      hash: hash,
      startKey: CAL[0].key,
      endKey: CAL[N_DAYS - 1].key,
      nWork: sums.workday.n,
      nWeekend: sums.weekend.n,
      nHoliday: sums.holiday.n
    };
  }

  return {
    compute: compute,
    combine: combine,
    pseudoHex: pseudoHex,
    TYPES: TYPES,
    MEASURES: MEASURES,
    SOURCES: SOURCES,
    EF: EF,
    TARIFF: TARIFF,
    N_DAYS: N_DAYS,
    YEAR_SPLIT: YEAR_SPLIT,
    clamp: clamp,
    round: round
  };
});
