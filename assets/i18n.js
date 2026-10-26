/* ==========================================================================
   绿钥 GreenKey — 语言切换（默认中文，可切换 EN）
   词典按页分片存放在 assets/lang/，需在本文件之前以 defer 顺序加载。
   ========================================================================== */
(function (window, document) {
  "use strict";

  var KEY = "gk_lang";
  var DICT = window.GK_EN || {};
  var EXTRA = {
    "公 众 假 期": "PUBLIC HOLIDAY",
    "国 庆 黄 金 周": "GOLDEN WEEK",
    "间夜": "room-night",
    "床位夜": "bed-night",
    "客次": "covers",
    "客房": "rooms",
    "床位": "beds",
    "日均客位": "covers/day",
    "已披露": "Disclosed",
    "未复核": "Not reviewed",
    "（示例）": " (example)"
  };

  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/;
  var ATTRS = ["aria-label", "placeholder", "title", "alt"];

  var lang = "zh";
  try { lang = localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch (e) {}

  var touched = [];
  var touchedAttrs = [];
  var titleZh = null;

  /* 归一化：折叠空白并忽略引号字形差异（源码里中英文引号混用） */
  function norm(s) {
    return String(s).replace(/\s+/g, " ").trim();
  }
  function key(s) {
    return norm(s).replace(/["“”'‘’]/g, "");
  }
  var IDX = {};
  (function () {
    var src = [DICT, EXTRA];
    for (var i = 0; i < src.length; i++) {
      for (var k in src[i]) {
        if (Object.prototype.hasOwnProperty.call(src[i], k)) IDX[key(k)] = src[i][k];
      }
    }
  })();
  function lookup(s) {
    return IDX[key(s)];
  }
  function hasCN(s) {
    return /[\u4e00-\u9fa5]/.test(s);
  }

  function walk(root, out) {
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (!p || SKIP.test(p.nodeName)) continue;
      if (!n.nodeValue || !hasCN(n.nodeValue)) continue;
      out.push(n);
    }
  }

  function translateNode(n) {
    if (n.__gkZh === undefined) n.__gkZh = n.nodeValue;
    var src = n.__gkZh;
    var m = src.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m) return;
    var en = lookup(norm(m[2]));
    if (!en) return;
    var target = (m[1] || "") + en + (m[3] || "");
    if (n.nodeValue !== target) n.nodeValue = target;
    if (touched.indexOf(n) < 0) touched.push(n);
  }

  function restoreNode(n) {
    if (n.__gkZh !== undefined && n.nodeValue !== n.__gkZh) n.nodeValue = n.__gkZh;
  }

  function translateAttrs(root) {
    for (var i = 0; i < ATTRS.length; i++) {
      var sel = "[" + ATTRS[i] + "]";
      var els = root.querySelectorAll(sel);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!el.__gkA) el.__gkA = {};
        if (el.__gkA[ATTRS[i]] === undefined) el.__gkA[ATTRS[i]] = el.getAttribute(ATTRS[i]);
        var raw = el.__gkA[ATTRS[i]];
        if (!raw || !hasCN(raw)) continue;
        var en = lookup(norm(raw));
        if (en) {
          el.setAttribute(ATTRS[i], en);
          if (touchedAttrs.indexOf(el) < 0) touchedAttrs.push(el);
        }
      }
    }
  }

  function restoreAttrs() {
    for (var i = 0; i < touchedAttrs.length; i++) {
      var el = touchedAttrs[i];
      if (!el.__gkA) continue;
      for (var k in el.__gkA) {
        if (Object.prototype.hasOwnProperty.call(el.__gkA, k)) el.setAttribute(k, el.__gkA[k]);
      }
    }
  }

  /* 整块替换：元素上写 data-en 时，直接换 innerHTML（用于带单位的数字） */
  var htmlEls = [];
  function translateHTML(root) {
    if (!root.querySelectorAll) return;
    var els = root.querySelectorAll("[data-en]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__gkHtml === undefined) el.__gkHtml = el.innerHTML;
      if (el.innerHTML !== el.getAttribute("data-en")) el.innerHTML = el.getAttribute("data-en");
      if (htmlEls.indexOf(el) < 0) htmlEls.push(el);
    }
  }
  function restoreHTML() {
    for (var i = 0; i < htmlEls.length; i++) {
      if (htmlEls[i].__gkHtml !== undefined) htmlEls[i].innerHTML = htmlEls[i].__gkHtml;
    }
  }

  function translateTitle() {
    if (titleZh === null) titleZh = document.title;
    var en = lookup(norm(titleZh));
    if (en) document.title = en;
  }
  function restoreTitle() {
    if (titleZh !== null) document.title = titleZh;
  }

  /* 对外：翻译指定子树（动态生成内容用） */
  function apply(root) {
    if (lang !== "en") return;
    root = root || document.body;
    if (!root) return;
    var nodes = [];
    walk(root, nodes);
    for (var i = 0; i < nodes.length; i++) translateNode(nodes[i]);
    translateAttrs(root);
    translateHTML(root);
  }

  function restoreAll() {
    for (var i = 0; i < touched.length; i++) restoreNode(touched[i]);
    restoreAttrs();
    restoreHTML();
  }

  /* 动态文案助手：GK.t("中文") 或 GK.t("中文","English") */
  function t(zh, en) {
    if (lang !== "en") return zh;
    if (en !== undefined) return en;
    return lookup(norm(zh)) || zh;
  }

  /* ---------- 切换器 ---------- */
  function syncButtons() {
    var btns = document.querySelectorAll(".lang [data-lang]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-lang") === lang ? "true" : "false");
    }
  }

  function setLang(next) {
    var target = next === "en" ? "en" : "zh";
    if (target === lang) { syncButtons(); return; }
    lang = target;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-Hans");
    if (lang === "en") {
      apply(document.body);
      translateTitle();
    } else {
      restoreAll();
      restoreTitle();
    }
    syncButtons();
    document.dispatchEvent(new CustomEvent("gk:lang", { detail: { lang: lang } }));
  }

  function buildSwitcher() {
    var inner = document.querySelector(".nav__inner");
    if (!inner || inner.querySelector(".lang")) return;
    var box = document.createElement("div");
    box.className = "lang";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Language / 语言");
    box.innerHTML =
      '<button type="button" data-lang="zh" aria-pressed="false">中</button>' +
      '<button type="button" data-lang="en" aria-pressed="false">EN</button>';
    var cta = inner.querySelector(".nav__cta");
    if (cta) inner.insertBefore(box, cta);
    else inner.appendChild(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-lang]") : null;
      if (!b) return;
      setLang(b.getAttribute("data-lang"));
    });
    syncButtons();
  }

  function init() {
    buildSwitcher();
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-Hans");
    if (lang === "en") {
      apply(document.body);
      translateTitle();
    }
    document.documentElement.classList.remove("i18n-pending");
    syncButtons();
    document.dispatchEvent(new CustomEvent("gk:lang", { detail: { lang: lang } }));
  }

  window.GK = { t: t };
  window.GKI18N = {
    apply: apply,
    set: setLang,
    get lang() { return lang; },
    ready: true
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
