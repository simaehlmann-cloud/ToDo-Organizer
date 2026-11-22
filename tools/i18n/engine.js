/* ==I18N-BEGIN== Englische Oberfläche (seit 3.1, Update 13).
   Die App ist auf Deutsch geschrieben. Ist Englisch eingestellt (Einstellungen →
   Sprache, „Automatisch“ = Sprache des Geräts), übersetzt diese Schicht jeden
   Text, der auf dem Bildschirm landet:
     - feste Texte über das Wörterbuch I18N_EN (ganzer Text eines Textknotens),
     - zusammengesetzte Texte („3 Aufgaben überfällig“) über Regeln in I18N_RX,
     - Sätze und Zeilen einzeln, wenn der ganze Text nicht passt.
   Ein MutationObserver erfasst neue Knoten, Textänderungen und die Attribute
   placeholder, title und aria-label – vor dem Zeichnen, ohne Aufblitzen.
   Nutzerinhalte (Titel, Notizen, Kategorienamen …) tragen translate="no" und
   bleiben unberührt. Was nicht im DOM landet (Mitteilungen, Widget, Teilen,
   PDF, Kalenderdatei, Mails), geht ausdrücklich durch T().
   Erzeugt wird der Block mit tools/make-i18n.js aus tools/i18n/*.js. */
const I18N = (() => {
  const KEY = "todo-lang";
  let pref = "auto";
  try { pref = localStorage.getItem(KEY) || "auto"; } catch { /* privat */ }
  // iOS-App: Gerätesprache vom WidgetDataPlugin (navigator.language kennt dort nur Deutsch/Englisch der App)
  const nav = String((typeof window !== "undefined" && window.TO_SYSLANG)
    || (typeof navigator !== "undefined" && (navigator.languages && navigator.languages[0] || navigator.language)) || "de").toLowerCase();
  const lang = pref === "de" || pref === "en" ? pref : (nav.startsWith("de") ? "de" : "en");
  // Datumsformat: Deutsch → de-DE; Englisch → Gerätesprache, wenn englisch (en-US: 11/24), sonst en-GB
  const locale = lang === "de" ? "de-DE" : (/^en-[a-z]{2}$/.test(nav) ? nav.replace(/-([a-z]{2})$/, (m, c) => "-" + c.toUpperCase()) : "en-GB");
  const EN = /*DICT*/{}/*DICT-END*/;
  const RX = /*RULES*/[]/*RULES-END*/;
  const cache = new Map();
  const has = s => Object.prototype.hasOwnProperty.call(EN, s);

  // Kern: ganzer Text → Regel → Zeilen → Sätze → „ · “-Teile
  function core(s, depth) {
    if (has(s)) return EN[s];
    // Zeilenumbrüche und Einrückung aus dem HTML-Quelltext zählen nicht
    if (/\s\s|\n|\t/.test(s) && !/\n\s*\n/.test(s)) { const f = s.replace(/\s+/g, " "); if (has(f)) return EN[f]; }
    for (const [rx, to] of RX) {
      rx.lastIndex = 0;
      const m = rx.exec(s);
      if (m && m.index === 0 && m[0].length === s.length) {
        return typeof to === "function" ? to(m, x => tr(x, depth + 1)) : s.replace(rx, to);
      }
    }
    if (depth > 4) return null;
    const parts = (sep, join) => {
      const p = s.split(sep);
      if (p.length < 2) return null;
      let changed = false;
      const out = p.map(x => { const y = x.trim() ? tr(x, depth + 1) : x; if (y !== x) changed = true; return y; });
      return changed ? out.join(join) : null;
    };
    return parts(/(\n+)/, "")
        ?? parts(/((?<=[.!?:…])\s+(?=[A-ZÄÖÜ„„(0-9]))/u, "")
        ?? parts(/( · | – | — | → )/, "")
        ?? null;
  }
  function tr(s, depth = 0) {
    if (lang === "de" || s == null) return s;
    s = String(s);
    const lead = s.match(/^\s*/)[0], trail = s.slice(lead.length).match(/\s*$/)[0];
    const mid = s.slice(lead.length, s.length - trail.length);
    if (!mid || !/[A-Za-zÄÖÜäöüß]/.test(mid)) return s;
    let r = cache.get(mid);
    if (r === undefined) {
      r = core(mid, depth);
      // Doppelpunkt am Ende: „Fach:“ → „Subject:“
      if (r == null && /[:.]$/.test(mid)) { const b = core(mid.slice(0, -1), depth); if (b != null) r = b + mid.slice(-1); }
      if (r == null) r = mid;
      if (depth === 0) cache.set(mid, r);
    }
    return lead + r + trail;
  }

  // ---- DOM ----------------------------------------------------------------
  const ATTRS = ["placeholder", "title", "aria-label"];
  const written = new WeakMap();
  const skip = n => {
    for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) {
      if (e.translate === false || e.getAttribute && e.getAttribute("translate") === "no") return true;
      const t = e.tagName;
      if (t === "SCRIPT" || t === "STYLE" || t === "TEXTAREA" || e.isContentEditable) return true;
    }
    return false;
  };
  function text(n) {
    const v = n.nodeValue;
    if (!v || written.get(n) === v || skip(n)) return;
    const t = tr(v);
    written.set(n, t);
    if (t !== v) n.nodeValue = t;
  }
  function attrs(e) {
    for (const a of ATTRS) {
      const v = e.getAttribute(a);
      if (!v) continue;
      const k = "_i18n_" + a;
      if (e[k] === v) continue;
      const t = tr(v);
      e[k] = t;
      if (t !== v) e.setAttribute(a, t);
    }
    // Schaltflächen als <input type=button>
    if (e.tagName === "INPUT" && (e.type === "button" || e.type === "submit") && e.value) {
      const t = tr(e.value); if (t !== e.value) e.value = t;
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && (n.getAttribute("translate") === "no" || n.tagName === "SCRIPT" || n.tagName === "STYLE" || n.tagName === "TEXTAREA"))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? text(n) : attrs(n);
  }
  function start() {
    if (lang === "de") return;
    document.documentElement.lang = "en";
    try { if (new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12) document.documentElement.classList.add("h12"); } catch { /* alt */ }
    document.title = tr(document.title);
    walk(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") text(m.target);
        else if (m.type === "attributes" && !skip(m.target)) attrs(m.target);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Systemdialoge
    for (const f of ["alert", "confirm", "prompt"]) {
      const orig = window[f];
      if (typeof orig === "function") window[f] = (msg, ...rest) => orig.call(window, tr(msg), ...rest);
    }
  }
  function set(v) {
    try { if (v === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* privat */ }
  }
  return { lang, pref, locale, tr, start, set, en: lang === "en" };
})();
/** Für Texte, die nicht auf dem Bildschirm landen (Mitteilungen, Widget, Teilen …) */
const T = s => I18N.tr(s);
const LOC = I18N.locale;
/* ==I18N-END== */
