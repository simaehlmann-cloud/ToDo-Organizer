/* Englische Oberfläche: Findet deutsche Reste.

     node tests/i18n.test.js [index.html] [--list]

   Öffnet die App auf einem englischen Gerät (Profile Alltag, Schule,
   Lehrkraft mit den Beispieldaten aus store/demo-data.js), geht alle Ansichten
   und die wichtigsten Dialoge durch und sammelt dabei jeden sichtbaren Text,
   jede Meldung (Hinweis unten, confirm/prompt) und die Texte für Widget und
   Mitteilungen. Was nach Deutsch aussieht, gilt als Fehler. Nutzerinhalte
   (translate="no") und Eigennamen zählen nicht.

   Außerdem: Deutsch bleibt Deutsch (deutsches Gerät, keine Übersetzung),
   die Spracheinstellung wirkt, englische Schnelleingabe. */
process.env.TZ = 'Europe/Berlin';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const { iosMocks } = require('./ios-mocks');
const DEMO = require('../store/demo-data');
const FULL = { owned: { 'de.maehlmann.todoorganizer.vollversion': Date.parse('2026-10-01') } };

const FILE = 'file://' + path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'index.html'));
const LIST = process.argv.includes('--list');
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// Woran man Deutsch erkennt: Umlaute/ß oder typische Wörter (ganze Wörter)
const DE_WORDS = /\b(der|die|das|und|oder|nicht|mit|für|bitte|noch|keine?n?|aufgaben?|stunden?|woche[n]?|heute|morgen|gestern|einstellungen|erledigt|fällig|überfällig|löschen|speichern|abbrechen|eintragen|termine?|kalender|wird|werden|sind|ist|auf|zum|zur|bis|vom|von|ein|eine|einen|alle|neue[rsn]?|nächste[rnms]?|uhr|kategorie|sicherung|vertretung|ausfall|aufsicht|klasse|fach|ferien|feiertag|liste|artikel|gewohnheit(en)?|vollversion|testphase|übernehmen|schließen)\b/i;
const UMLAUT = /[äöüÄÖÜß]/;
// Eigennamen, die deutsch bleiben dürfen (Länder/Kantone, Autor, Beispieldaten)
const ALLOW = [/Mählmann/, /^(Baden-Württemberg|Schleswig-Holstein|Brandenburg|Bremen|Hamburg|Berlin|Saarland|Burgenland|Salzburg|Vorarlberg|Aargau|Bern|Glarus|Jura|Nidwalden|Obwalden|Schaffhausen|Solothurn|Schwyz|Thurgau|Uri|Zug|St\. Gallen|Basel-Stadt|Basel-Landschaft)$/];
// Deutsche Zweige im Quelltext (if (I18N.en) … else …), Technik-Angaben für Rückfragen, Konsole
const SCRIPT_DE_OK = [/^Guten Tag,/, /^Hallo,/, /^(Auf Android ist|Hier unten|Danach in den Einstellungen|iPhone-Einstellungen|Zurück in der App)/,
  /^Feiertage 3, Schulferien/, /^Einkaufslisten, verschlüsselte Sicherung/, /^es wird nichts berechnet/, /NICHT gefunden|^nicht gefunden$/, /^Kalender-Abo:$/,
  /^Auf Deutsch umstellen$/];   // Flagge: Beschriftung bewusst in der Zielsprache
const looksGerman = s => {
  if (ALLOW.some(r => r.test(s))) return false;
  return UMLAUT.test(s) || DE_WORDS.test(s);
};

async function open(browser, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.wide ? { width: 1100, height: 900 } : { width: 390, height: 844 },
    locale: opt.locale || 'en-US', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.errors = []; p.msgs = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('dialog', d => { p.msgs.push(d.message()); d.accept(p.nextPrompt != null ? p.nextPrompt : undefined); });
  await p.clock.setFixedTime(new Date(opt.now || '2026-11-03T10:15:00'));
  if (opt.lang) await p.addInitScript(l => localStorage.setItem('todo-lang', l), opt.lang);
  if (opt.state) await p.addInitScript(s => localStorage.setItem('studiez-pro-v2', JSON.stringify(s)), opt.state);
  if (opt.ios) await p.addInitScript(iosMocks, opt.ios);
  // Hinweise (toast) mitschreiben – nach der Übersetzung
  await p.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      const t = document.getElementById('toast');
      if (t) new MutationObserver(() => setTimeout(() => { const s = t.textContent.trim(); if (s) window.__toasts.push(s); })).observe(t, { childList: true, subtree: true, characterData: true });
    });
  });
  await p.goto(FILE);
  await p.waitForTimeout(250);
  if (opt.profile !== false && await p.$eval('#dlg-onboard', d => d.open)) {
    await p.click(`.choice[data-profile="${opt.profile || 'everyday'}"]`);
    await p.waitForTimeout(120);
  }
  if (await p.$eval('#dlg-pro', d => d.open)) await p.click('#dlg-pro-later');
  return { ctx, p };
}
const S = (p, fn, arg) => p.evaluate(fn, arg);

// Alle Texte der Seite (ohne translate="no", Skripte, Eingabefelder)
const grab = p => p.evaluate(() => {
  const out = [];
  const bad = e => { for (; e; e = e.parentElement) { if (e.getAttribute && e.getAttribute('translate') === 'no') return true; if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(e.tagName)) return true; } return false; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (s && !bad(n.parentElement)) out.push(s);
  }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e => {
    if (bad(e)) return;
    ['placeholder', 'title', 'aria-label'].forEach(k => { const v = e.getAttribute(k); if (v && v.trim()) out.push(v.trim()); });
  });
  out.push(...window.__toasts.splice(0));
  return out;
});

(async () => {
  const browser = await chromium.launch();
  const found = new Map();   // Text → Stelle
  // Nutzerinhalte (Titel, Namen, Notizen …) stehen bewusst auf Deutsch in den Beispieldaten
  const userWords = st => {
    const out = [];
    const add = x => { if (typeof x === 'string' && x.trim().length > 1) out.push(x.trim()); };
    (st.tasks || []).forEach(t => { add(t.title); add(t.note); (t.subtasks || []).forEach(s => add(s.text)); });
    (st.categories || []).forEach(c => add(c.name));
    (st.habits || []).forEach(x => add(x.name));
    (st.shopping || []).forEach(x => add(x.text));
    (st.shopLists || []).forEach(x => add(x.name));
    (st.lessons || []).forEach(l => { add(l.subject); add(l.room); add(l.klass); });
    (st.lessonNotes || []).forEach(x => add(x.text));
    (st.lessonMemos || []).forEach(x => add(x.text));
    (st.subLog || []).forEach(x => { add(x.note); add(x.subject); add(x.klass); add(x.room); });
    (st.duties || []).forEach(x => add(x.place));
    (st.templates || []).forEach(x => { add(x.title); (x.subtasks || []).forEach(s => add(s.text || s)); });
    Object.values(st.lessonEx || {}).forEach(x => { if (x && typeof x === 'object') { add(x.subject); add(x.room); } });
    return out.sort((a, b) => b.length - a.length);
  };
  let USER = [];
  const strip = s => { for (const u of USER) if (s.includes(u)) s = s.split(u).join(' '); return s; };
  const collect = async (p, where) => {
    USER = userWords(await S(p, () => state));
    for (const s of await grab(p)) if (!ALLOW.some(r => r.test(s)) && looksGerman(strip(s)) && !found.has(s)) found.set(s, where);
    for (const s of p.msgs.splice(0)) if (looksGerman(strip(s)) && !found.has(s)) found.set(s, where + ' (Dialog)');
  };
  const views = ['week', 'tasks', 'calendar', 'timetable', 'shopping', 'settings', 'about'];

  console.log('1 · Deutsches Gerät bleibt deutsch');
  {
    const { ctx, p } = await open(browser, { locale: 'de-DE', state: DEMO.STATE });
    ok(await S(p, () => I18N.lang) === 'de' && await p.textContent('#nav-plan-label') === 'Wochenplan', 'Deutsch, keine Übersetzung');
    ok(await p.$eval('html', h => h.lang) === 'de', 'html lang=de');
    await ctx.close();
  }

  console.log('2 · Englisches Gerät: Alltag mit Beispieldaten');
  {
    const { ctx, p } = await open(browser, { state: DEMO.STATE, now: DEMO.TODAY, ios: FULL });
    ok(await S(p, () => I18N.lang) === 'en' && await p.$eval('html', h => h.lang) === 'en', 'Englisch aus der Gerätesprache');
    ok(await S(p, () => DAY_NAMES[1]) === 'Monday', 'Wochentage englisch');
    for (const v of views) { await S(p, v => switchTo(v), v); await p.waitForTimeout(80); await collect(p, 'Alltag/' + v); }
    // Dialoge mit Inhalt
    await S(p, () => switchTo('tasks'));
    await S(p, () => openTaskDialog(state.tasks[0].id)); await p.waitForTimeout(100); await collect(p, 'Aufgabe bearbeiten');
    await S(p, () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    await S(p, () => switchTo('calendar'));
    await S(p, () => { const c = document.querySelector('#cal-grid [data-iso], #cal-grid .day'); if (c) c.click(); }); await p.waitForTimeout(100);
    await collect(p, 'Kalendertag');
    await S(p, () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    // Meldungen
    await S(p, () => { toast('Gespeichert.'); }); await p.waitForTimeout(50); await collect(p, 'Hinweis');
    await S(p, () => switchTo('week'));
    const chk = await p.$('#week .chk, #week input[type=checkbox]');
    if (chk) { await chk.click(); await p.waitForTimeout(100); await collect(p, 'abhaken'); }
    // Widget und Mitteilungen
    await S(p, () => Widget.push && Widget.push()); await p.waitForTimeout(150);
    const wj = await S(p, () => window.__log.widget.slice(-1)[0] || '');
    if (wj) {
      const w = JSON.parse(wj);
      for (const d of w.days || []) for (const s of [d.label, d.off].filter(Boolean)) if (looksGerman(s)) found.set(s, 'Widget');
      ok(w.lang === 'en', 'Widget-Daten mit lang=en');
    }
    const notif = await S(p, () => (window.__log.notif || []).map(x => [x.title, x.body]));
    for (const [a, b] of notif) for (const s of [a, b]) if (s && looksGerman(strip(s))) found.set(s, 'Mitteilung');
    ok(!p.errors.length, 'keine Fehler' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
    await ctx.close();
  }

  console.log('2b · Englisch: neuer Nutzer, Schnelleingabe, Sprachwechsel');
  {
    const { ctx, p } = await open(browser, { profile: 'study', ios: FULL });
    const st = await S(p, () => ({ c: state.categories.map(x => x.name), tp: state.templates.map(x => x.title), sub: state.templates[0].subtasks[0], list: state.shopLists[0].name }));
    ok(st.c.join() === 'Uni,Study,Job,Personal', 'Kategorien englisch angelegt: ' + st.c.join());
    ok(st.tp.includes('Pack for holiday') && st.tp.includes('Write term paper') && st.sub === 'ID card and passport', 'Vorlagen englisch: ' + st.tp.join(', '));
    ok(st.list === 'Shopping', 'Einkaufsliste heißt „Shopping“');
    await S(p, () => switchTo('tasks'));
    await p.fill('#t-title', 'Call dentist tomorrow 9am #Uni !high');
    await p.waitForTimeout(150);
    await collect(p, 'Schnelleingabe-Vorschau');
    const prev = await p.textContent('#qa-preview');
    ok(/tomorrow/.test(prev) && /09:00/.test(prev), 'Vorschau englisch: ' + prev.replace(/\s+/g, ' ').trim());
    await p.press('#t-title', 'Enter');
    await p.waitForTimeout(150);
    const t = await S(p, () => state.tasks[state.tasks.length - 1]);
    ok(t.title === 'Call dentist' && t.dueDate === '2026-11-04' && t.dueTime === '09:00' && t.prio === 'hoch', 'englische Eingabe erkannt: ' + JSON.stringify([t.title, t.dueDate, t.dueTime, t.prio]));
    await collect(p, 'Aufgabe angelegt');
    // Aktionen mit Hinweisen
    await S(p, id => { toggleTask && toggleTask(id); }, t.id).catch(() => {});
    await p.waitForTimeout(100); await collect(p, 'abgehakt');
    // Klassenarbeit / Klausur planen
    await S(p, () => { openExamDialog(); $('ex-date').value = '2026-11-20'; $('ex-title').value = 'Statistics'; $('ex-date').dispatchEvent(new Event('input')); renderExamPreview(); });
    await p.waitForTimeout(100); await collect(p, 'Klausur planen');
    await p.click('#ex-save'); await p.waitForTimeout(150); await collect(p, 'Klausur angelegt');
    const ex = await S(p, () => state.tasks.filter(x => /: /.test(x.title)).map(x => x.title));
    ok(ex.length >= 2 && ex.every(x => /^Statistics: (study|exam)/.test(x)) && !ex.some(x => /lernen|Klausur/.test(x)), 'Lernplan englisch: ' + ex.join(' | '));
    // Sprache umstellen → Deutsch
    await S(p, () => switchTo('settings'));
    await p.selectOption('#set-lang', 'de');
    await p.waitForFunction(() => window.I18N && I18N.lang === 'de' && document.readyState === 'complete', null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(300);
    ok(await S(p, () => I18N.lang) === 'de' && await p.textContent('#nav-plan-label') === 'Wochenplan', 'Umschalten auf Deutsch wirkt nach Neuladen');
    ok(await S(p, () => localStorage.getItem('todo-lang')) === 'de', 'Sprache gespeichert (nur auf diesem Gerät)');
    ok(await S(p, () => !JSON.stringify(state).includes('todo-lang')), 'Sprache nicht in den Daten (kein iCloud-Abgleich)');
    await S(p, () => switchTo('settings'));
    await p.selectOption('#set-lang', 'auto');
    await p.waitForFunction(() => window.I18N && I18N.lang === 'en' && document.readyState === 'complete', null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(300);
    ok(await S(p, () => I18N.lang) === 'en', '„Automatisch“ folgt wieder dem Gerät');
    ok(!p.errors.length, 'keine Fehler' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
    await ctx.close();
  }
  {
    // Deutsches Gerät, Sprache Englisch gewählt
    const { ctx, p } = await open(browser, { locale: 'de-DE', lang: 'en', state: DEMO.STATE, now: DEMO.TODAY });
    ok(await S(p, () => I18N.lang) === 'en' && await p.textContent('#nav-plan-label') === 'Weekly plan', 'Einstellung schlägt Gerätesprache');
    ok(await S(p, () => LOC) === 'en-GB', 'Datumsformat en-GB auf nicht-englischem Gerät');
    await ctx.close();
  }

  {
    // Nutzerinhalte in Auswahllisten bleiben, wie sie sind (Prüfung 22.11.)
    const { ctx, p } = await open(browser, { state: Object.assign({}, DEMO.STATE, { shopHistory: { kuchen: { t: 'Kuchen', n: 5, last: 1 }, 'getränke': { t: 'Getränke', n: 3, last: 1 } },
      categories: [{ id: 'cs', name: 'Schule', color: '#2563eb' }, { id: 'ca', name: 'Arbeit', color: '#059669' }] }), now: DEMO.TODAY, ios: FULL });
    await S(p, () => switchTo('shopping')); await p.waitForTimeout(100);
    const dl = await p.$$eval('#shop-sugg option', o => o.map(x => x.value));
    ok(dl.includes('Kuchen') && !dl.includes('Cake'), 'Einkaufsvorschläge unverändert: ' + dl.join(', '));
    await S(p, () => switchTo('tasks'));
    const cats = await p.$$eval('#t-category option', o => o.map(x => x.textContent));
    ok(cats.includes('Schule') && cats.includes('Arbeit') && cats.includes('No category'), 'Kategorien in der Auswahl unverändert: ' + cats.join(', '));
    await ctx.close();
  }

  for (const [prof, state, now] of [['school', DEMO.SCHOOL, DEMO.TODAY_SCHOOL], ['teacher', Object.assign({}, DEMO.SCHOOL, { settings: Object.assign({}, DEMO.SCHOOL.settings, { profile: 'teacher' }) }), DEMO.TODAY_SCHOOL]]) {
    console.log('3 · Englisch: ' + prof);
    const { ctx, p } = await open(browser, { state, now, ios: FULL, profile: prof });
    for (const v of views) { await S(p, v => switchTo(v), v); await p.waitForTimeout(80); await collect(p, prof + '/' + v); }
    await S(p, () => switchTo('week'));
    const les = await p.$('.wk-lesson, .lesson');
    if (les) { await les.click(); await p.waitForTimeout(120); await collect(p, prof + '/Stunde'); }
    await S(p, () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    const calls = ['openYearDialog()', 'openGcalGuide()', 'openExamDialog()', 'openSubDialog(null, "2026-11-17", "plus")',
      'openSubDialog(null, "2026-11-17", "minus")', 'openCourseDialog(courseRows()[0] && courseRows()[0].course)', 'openNoteDialog(courseRows()[0] && courseRows()[0].course, "2026-11-17")',
      'openLessonDialog(null, 1, 0)', 'openLessonDay(state.lessons[0], "2026-11-17")', 'openCategoryDialog(state.categories[0].id)', 'openTaskDialog()'];
    for (const f of calls) {
      await S(p, f => { try { eval(f); } catch (e) { console.log('call ' + f + ': ' + e.message); } }, f); await p.waitForTimeout(100); await collect(p, prof + '/' + f);
      await S(p, () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    }
    ok(!p.errors.length, 'keine Fehler' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
    await ctx.close();
  }

  console.log('4 · Texte im Skript (Meldungen, Rückfragen, Teilen)');
  {
    // Alle Zeichenketten des Oberflächen-Skripts (ohne Kern, Ferien, Übersetzung, Kommentare);
    // Platzhalter ${…} werden zu „3“. Was nach Deutsch aussieht, muss übersetzt herauskommen.
    const fs = require('fs');
    let src = fs.readFileSync(FILE.replace('file://', ''), 'utf8');
    const cutBlock = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i >= 0 && j > i) src = src.slice(0, i) + src.slice(j + b.length); };
    cutBlock('/* ==I18N-BEGIN==', '/* ==I18N-END== */');
    cutBlock('/* ==CORE-BEGIN==', '/* ==CORE-END== */');
    cutBlock('/* ==FERIEN-BEGIN==', '/* ==FERIEN-END== */');
    const script = src.slice(src.lastIndexOf('<script>'), src.lastIndexOf('</script>'));
    const lits = new Set();
    // grob: Kommentare entfernen, dann "…", '…' und `…` einsammeln
    const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\"'`])\/\/[^\n]*/g, '$1');
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      let s = m[1] != null ? m[1] : m[2];
      s = s.replace(/\$\{[^}]*\}/g, '3').replace(/\\n/g, '\n').replace(/\\"/g, '"');
      if (s.length < 3 || /^[\w.-]+$/.test(s) && !/[äöüß]/.test(s)) continue;          // Schlüssel, IDs
      if (/^(#|\.|\[|<|\(|\^|\\|data:|https?:|mailto:|todoorganizer:|application\/|image\/|text\/)/.test(s)) continue;
      if (/console\.|::error|DTSTART|DESCRIPTION|BEGIN:|END:|RRULE|SUMMARY/.test(s)) continue;
      if (!looksGerman(s)) continue;
      // Bruchstücke („ gelöscht.“, „Noch “) zählen erst im fertigen Satz – den prüfen die Abschnitte 2 und 3
      if (/^[\s,.;:–·)]|[\s(„–·]$|\$\{|\} /.test(s)) continue;
      lits.add(s);
    }
    const { ctx, p } = await open(browser, { state: DEMO.STATE, now: DEMO.TODAY });
    const res = await p.evaluate(list => list.map(s => [s, I18N.tr(s)]), [...lits]);
    const IGN = /Mählmann|ToDo-Organizer-Sicherung|todo-organizer|Plugin|purchase\.js|StoreKit|Widget-Brücke|Store bereit|Testmodus|App-Gruppe|^Kauf:|nicht geladen/;
    for (const [s, t] of res) {
      if (IGN.test(s) || SCRIPT_DE_OK.some(r => r.test(s))) continue;
      if (/(^|\D)3 3\b|3 bis zur 3|Aufgabe3|„3“ wurde seit/.test(s)) continue;   // Platzhalter – echte Sätze prüft Abschnitt 5
      // Platzhalter-Ergebnis darf deutsche Eigennamen behalten
      if (looksGerman(t)) found.set(t === s ? s : s + '  →  ' + t, 'Skript');
    }
    console.log('    ' + lits.size + ' Texte geprüft');
    await ctx.close();
  }

  console.log('5 · Zusammengesetzte Sätze');
  {
    const { ctx, p } = await open(browser, { state: DEMO.STATE, now: DEMO.TODAY });
    const cases = [
      ['3 Aufgaben heute fällig', '3 tasks due today'], ['1 Aufgabe heute fällig', '1 task due today'],
      ['2 überfällig · 1 heute fällig', '2 overdue · 1 due today'], ['4 offene Aufgaben', '4 open tasks'],
      ['2 Aufgaben auf morgen verschoben.', '2 tasks moved to tomorrow.'], ['1 Aufgabe auf Montag verschoben.', '1 task moved to Monday.'],
      ['5 bis zur Klassenarbeit', '5 until the test'], ['nächste Woche 2 Aufgaben', 'next week 2 tasks'],
      ['Kalender-Abo „Verein“ wurde seit 3 Tagen nicht aktualisiert (Server antwortete mit Status 404).', 'Calendar subscription “Verein” hasn\'t been updated for 3 days (Server responded with status 404).'],
      ['Noch 4 Stunden bis zur Klassenarbeit · 9 Stunden bis zu den Weihnachtsferien', '4 lessons left until the test · 9 lessons left until the Christmas holidays'],
      ['🔄 alle 3 Tage ab Erledigung', '🔄 every 3 days from completion'], ['🔄 14-tägig', '🔄 every 2 weeks'],
      ['3./4. Std', 'P3/4'], ['Liste „Drogerie“ mit 2 Artikel(n) löschen?', 'Delete list “Drogerie” with 2 item(s)?'],
      ['Verein: 12 Termine geladen.', 'Verein: 12 events loaded.'], ['Laden fehlgeschlagen: Unter der Adresse liegt kein Kalender (ICS).', 'Loading failed: There\'s no calendar (ICS) at this address.'],
      ['KW 46 · 09.11. – 15.11.2026', 'Wk 46 · 09.11. – 15.11.2026'], ['Diese Woche ist Woche B.', 'This week is week B.'],
      ['Der Speicher ist voll. Bitte exportieren und erledigte Aufgaben löschen.', 'Storage is full. Please export and delete completed tasks.'],
      ['Kein Zugriff.\n\nBitte zuerst freigeben.', 'No access.\n\nPlease allow first.']
    ];
    const got = await p.evaluate(c => c.map(([de]) => I18N.tr(de)), cases);
    cases.forEach(([de, en], i) => ok(got[i] === en, JSON.stringify(de) + ' → ' + JSON.stringify(got[i])));
    await ctx.close();
  }

  console.log('5b · Nachträge (Store-Bilder, 26.11.)');
  {
    const { ctx, p } = await open(browser, { state: DEMO.SCHOOL, now: '2026-11-17T09:00:00', locale: 'en-GB' });
    ok(await S(p, () => $('sb-note').placeholder) === 'e.g. fractions worksheet, entered in the class register', 'Platzhalter in Textfeldern übersetzt (Vertretung)');
    ok(await S(p, () => { switchTo('calendar'); return [...document.querySelectorAll('#cal-grid .cal-d')].map(x => x.textContent).join(' '); }) === 'Mon Tue Wed Thu Fri Sat Sun', 'Kalender: Wochentage englisch');
    const subs = await S(p, () => { switchTo('timetable'); return [$('sub-period-label').textContent, ...[...document.querySelectorAll('#sub-tiles .l')].map(x => x.textContent)]; });
    ok(subs[0] === 'School year 2026/27 (01/08/2026 – 31/07/2027)', 'Zeitraum Plus/Minus englisch: ' + subs[0]);
    ok(subs.includes('Extra (lessons)') && subs.includes('Missed (lessons)'), 'Kacheln Plus/Minus englisch: ' + subs.slice(1).join(', '));
    const month = await S(p, () => { document.querySelector('#sub-period [data-p=month]').click(); return $('sub-period-label').textContent; });
    ok(month.startsWith('November 2026 (01/11/2026'), 'Monat englisch: ' + month);
    const half = await S(p, () => { document.querySelector('#sub-period [data-p=half]').click(); return $('sub-period-label').textContent; });
    ok(half.startsWith('Term 1 2026/27 (01/08/2026'), 'Halbjahr englisch: ' + half);
    await S(p, () => { switchTo('tasks'); $('t-title').value = 'Football practice Fri 6pm'; $('t-title').dispatchEvent(new Event('input')); });
    const chip = await S(p, () => [...$('qa-preview').children].map(x => x.textContent).join(' | '));
    ok(chip.includes('“Football practice”') && !chip.includes('„'), 'Titel in der Vorschau mit englischen Anführungszeichen: ' + chip);
    const links = await S(p, () => [...document.querySelectorAll('.legal-links a')].map(a => a.getAttribute('href')).join(' '));
    ok(links === 'privacy.html legal-notice.html', 'Rechtstexte auf Englisch verlinkt: ' + links);
    const langs = await S(p, () => [...$('set-lang').options].map(o => o.textContent).join(' | '));
    ok(langs === '🌐 Automatisch · Automatic | 🇩🇪 Deutsch | 🇬🇧 English', 'Sprachwahl mit Flaggen: ' + langs);
    ok(!p.errors.length, 'keine Fehler' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
    await ctx.close();
  }
  {
    // Deutsch unverändert
    const { ctx, p } = await open(browser, { state: DEMO.SCHOOL, now: '2026-11-17T09:00:00', locale: 'de-DE' });
    const subs = await S(p, () => { switchTo('timetable'); return [$('sub-period-label').textContent, $('sb-note').placeholder,
      [...document.querySelectorAll('#cal-grid .cal-d')].length]; });
    ok(subs[0] === 'Schuljahr 2026/27 (01.08.2026 – 31.07.2027)' && subs[1].startsWith('z. B. Arbeitsblatt'), 'Deutsch unverändert: ' + subs.slice(0, 2).join(' · '));
    const cal = await S(p, () => { switchTo('calendar'); return [...document.querySelectorAll('#cal-grid .cal-d')].map(x => x.textContent).join(' '); });
    ok(cal === 'Mo Di Mi Do Fr Sa So', 'Kalender deutsch: ' + cal);
    const links = await S(p, () => [...document.querySelectorAll('.legal-links a')].map(a => a.getAttribute('href')).join(' '));
    ok(links === 'datenschutz.html impressum.html', 'Rechtstexte auf Deutsch verlinkt: ' + links);
    // Flagge auf der Startseite
    await S(p, () => switchTo('week'));
    ok(await p.textContent('#lang-flag') === '🇬🇧EN' && await p.isVisible('#lang-flag'), 'Startseite: Flagge 🇬🇧 EN sichtbar (deutsches Gerät)');
    await Promise.all([p.waitForEvent('load'), p.click('#lang-flag')]); await p.waitForFunction(() => typeof state === 'object' && document.getElementById('lang-flag'));
    ok(await S(p, () => I18N.lang) === 'en' && await S(p, () => localStorage.getItem('todo-lang')) === 'en', 'Flagge stellt auf Englisch um');
    ok(await p.textContent('#lang-flag') === '🇩🇪DE', 'danach Flagge 🇩🇪 DE');
    await Promise.all([p.waitForEvent('load'), p.click('#lang-flag')]); await p.waitForFunction(() => typeof state === 'object' && document.getElementById('lang-flag'));
    ok(await S(p, () => I18N.lang) === 'de', 'und zurück auf Deutsch');
    ok(await S(p, () => state.lessons.length) === 14, 'Daten bleiben beim Umschalten erhalten');
    await ctx.close();
  }

  console.log('6 · Deutsche Reste in der englischen Oberfläche');
  const list = [...found].filter(([s]) => !/^(Mo|Di|Mi|Do|Fr|Sa|So)$/.test(s) || true);
  if (LIST) list.forEach(([s, w]) => console.log('    [' + w + '] ' + JSON.stringify(s)));
  ok(list.length === 0, list.length ? list.length + ' Texte wirken deutsch (mit --list anzeigen)' : 'keine deutschen Reste gefunden');

  await browser.close();
  console.log(`\n${n - fails}/${n} Prüfungen bestanden.`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
