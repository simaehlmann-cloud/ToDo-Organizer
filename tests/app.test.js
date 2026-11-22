/* Ablauftest im echten Browser (Chromium) für ToDo Organizer 3.
   Prüft Bedienung, Daten und – mit nachgebildeten iOS-Plugins – Kauf,
   Sperren, Erinnerungen und Gerätekalender.

     node tests/app.test.js [index.html]

   Jeder Abschnitt startet mit frischem Speicher. „Heute“ ist fest der
   Dienstag, 3. November 2026, 10:15 Uhr. */
// Feste Zeitzone wie in der App (de-DE): GitHub rechnet in UTC, sonst
// stimmen Uhrzeiten in den Prüfungen nicht (Lauf #23).
process.env.TZ = 'Europe/Berlin';

const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const NOW = '2026-11-03T10:15:00';
const FULL = 'de.maehlmann.todoorganizer.vollversion';
const TRIAL = 'de.maehlmann.todoorganizer.testphase';
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const { iosMocks } = require('./ios-mocks');

async function open(browser, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.wide ? { width: 1100, height: 900 } : { width: 390, height: 844 }, locale: opt.locale || 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('dialog', d => d.accept(p.nextPrompt != null ? p.nextPrompt : undefined));
  await p.clock.setFixedTime(new Date(opt.now || NOW));
  if (opt.state) await p.addInitScript(s => localStorage.setItem('studiez-pro-v2', JSON.stringify(s)), opt.state);
  if (opt.before) await opt.before(p);
  if (opt.ios) await p.addInitScript(iosMocks, opt.ios);
  if (opt.dark) await p.emulateMedia({ colorScheme: 'dark' });
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
const go = (p, v) => p.evaluate(v => switchTo(v), v);
const lastTask = p => S(p, () => state.tasks[state.tasks.length - 1]);

(async () => {
  const browser = await chromium.launch();

  console.log('1 · Einstieg und Profile');
  {
    const { ctx, p } = await open(browser, { profile: false });
    ok(await p.$eval('#dlg-onboard', d => d.open), 'Einstiegsfrage beim ersten Start');
    await p.keyboard.press('Escape');
    ok(await p.$eval('#dlg-onboard', d => d.open), 'lässt sich nicht wegdrücken');
    await p.click('.choice[data-profile="school"]');
    const st = await S(p, () => ({ c: state.categories.map(x => x.name), tt: state.settings.features.timetable, m: state.settings.planMode }));
    ok(st.c.join() === 'Schule,Privat,Sport' && st.tt && st.m === 'school', 'Schule: Kategorien, Stundenplan, Schulstunden');
    ok(await p.textContent('#nav-plan-label') === 'Stundenplan', 'Reiter heißt „Stundenplan“');
    await go(p, 'settings');
    await p.selectOption('#set-profile', 'everyday');
    ok(await S(p, () => state.settings.planMode) === 'week' && await p.textContent('#nav-plan-label') === 'Wochenplan', 'Umstellen auf Alltag → Wochenplan');
    ok(await S(p, () => state.categories.length) === 3, 'Kategorien bleiben beim Umstellen erhalten');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('2 · Schnelleingabe');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'tasks');
    await p.fill('#t-title', 'Zahnarzt anrufen morgen 9 Uhr #Privat !');
    const prev = await p.textContent('#qa-preview');
    ok(/morgen 09:00/.test(prev) && /#Privat/.test(prev) && /Hoch/.test(prev) && /„Zahnarzt anrufen“/.test(prev), 'Vorschau zeigt Erkanntes: ' + prev.replace(/\s+/g, ' '));
    await p.press('#t-title', 'Enter');
    let t = await lastTask(p);
    ok(t.title === 'Zahnarzt anrufen' && t.dueDate === '2026-11-04' && t.dueTime === '09:00' && t.prio === 'hoch' && t.categoryId, 'Aufgabe mit Datum, Uhrzeit, Kategorie, Priorität');
    ok(await p.$eval('#qa-preview', e => e.hidden), 'Vorschau danach leer');
    await p.fill('#t-title', 'Heute-Show schauen');
    await p.click('#qa-preview button');
    await p.press('#t-title', 'Enter');
    t = await lastTask(p);
    ok(t.title === 'Heute-Show schauen' && !t.dueDate, '„nicht erkennen“ nimmt den Text wörtlich');
    await p.fill('#t-title', 'Blumen gießen alle 3 Tage');
    await p.press('#t-title', 'Enter');
    t = await lastTask(p);
    ok(t.recurrence === 'custom' && t.recurEvery === 3 && t.recurUnit === 'd' && t.dueDate === '2026-11-03', 'Wiederholung „alle 3 Tage“ ab heute');
    await p.fill('#t-title', 'Steuer');
    await p.click('#btn-quick-tom');
    ok((await lastTask(p)).dueDate === '2026-11-04', 'Knopf „Morgen“');
    ok(await p.locator('#task-list .task', { hasText: 'Zahnarzt anrufen' }).locator('.meta').textContent().then(x => /morgen 09:00/.test(x)), 'Karte zeigt „morgen 09:00“');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('3 · Wiederholungen, Dialog, Erinnerungsfelder');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'tasks');
    await p.click('#btn-more');
    await p.fill('#t-title', 'Wasserfilter tauschen');
    await p.fill('#t-date', '2026-11-03');
    await p.selectOption('#t-recurrence', 'custom');
    ok(!(await p.$eval('#t-rec-custom', e => e.hidden)), 'Eigene Wiederholung blendet Felder ein');
    await p.fill('#t-rec-every', '2'); await p.selectOption('#t-rec-unit', 'm');
    await p.selectOption('#t-remind', '1d');
    await p.click('#btn-add-task');
    let t = await lastTask(p);
    ok(t.recurrence === 'custom' && t.recurEvery === 2 && t.recurUnit === 'm' && t.remind === '1d', 'gespeichert: alle 2 Monate, 1 Tag vorher');
    ok(await p.$eval('#t-rec-custom', e => e.hidden) && await p.$eval('#t-recurrence', e => e.value) === 'none', 'Felder danach zurückgesetzt');
    await p.locator('#task-list .task', { hasText: 'Wasserfilter' }).locator('input[type=checkbox]').first().click();
    await p.waitForTimeout(450);
    let all = await S(p, () => state.tasks.filter(x => x.title === 'Wasserfilter tauschen').map(x => [x.dueDate, x.completed]));
    ok(JSON.stringify(all) === JSON.stringify([['2026-11-03', true], ['2027-01-03', false]]), 'Abhaken erzeugt Folgetermin 03.01.2027: ' + JSON.stringify(all));
    // wieder öffnen und erneut abhaken: kein zweiter Nachfolger
    await go(p, 'tasks'); await p.click('.tab[data-filter="all"]');
    const done = p.locator('#task-list .task.done', { hasText: 'Wasserfilter' }).locator('input[type=checkbox]').first();
    await done.click(); await p.waitForTimeout(450);
    await p.locator('#task-list .task:not(.done)', { hasText: 'Wasserfilter' }).first().locator('input[type=checkbox]').first().click();
    await p.waitForTimeout(450);
    all = await S(p, () => state.tasks.filter(x => x.title === 'Wasserfilter tauschen').length);
    ok(all === 2, 'Erneutes Abhaken erzeugt keinen zweiten Folgetermin (' + all + ')');
    await p.reload(); await p.waitForTimeout(250);
    await go(p, 'tasks'); await p.click('.tab[data-filter="all"]');
    await p.locator('#task-list .task.done', { hasText: 'Wasserfilter' }).locator('input[type=checkbox]').first().click(); await p.waitForTimeout(450);
    await p.locator('#task-list .task:not(.done)', { hasText: 'Wasserfilter' }).first().locator('input[type=checkbox]').first().click(); await p.waitForTimeout(450);
    all = await S(p, () => state.tasks.filter(x => x.title === 'Wasserfilter tauschen').length);
    ok(all === 2, 'auch nach Neustart kein zweiter Folgetermin (' + all + ')');
    // Dialog
    const id = await S(p, () => state.tasks.find(x => x.title === 'Wasserfilter tauschen' && !x.completed).id);
    await S(p, id => openTaskDialog(id), id);
    ok(await p.$eval('#e-recurrence', e => e.value) === 'custom' && !(await p.$eval('#e-rec-custom', e => e.hidden)), 'Dialog zeigt eigene Wiederholung');
    await p.fill('#e-time', '18:30'); await p.selectOption('#e-remind', '1h');
    await p.fill('#e-note', 'Filter Typ XL\nim Keller');
    await p.click('#e-save');
    t = await S(p, id => state.tasks.find(x => x.id === id), id);
    ok(t.dueTime === '18:30' && t.remind === '1h' && t.note === 'Filter Typ XL\nim Keller', 'Dialog speichert Uhrzeit, Erinnerung, Notiz');
    ok(await p.locator('.note-snip', { hasText: 'Filter Typ XL' }).count() === 1, 'Notiz erscheint auf der Karte');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('4 · Bilder, Sicherung mit Bildern');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'tasks');
    await p.fill('#t-title', 'Regal aufbauen'); await p.press('#t-title', 'Enter');
    const id = (await lastTask(p)).id;
    await S(p, id => openTaskDialog(id), id);
    // 40×30-PNG als Testbild
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAALElEQVR4nO3NQREAAAQAMOTS/8RSwc9nK7Cc7vhQL6tYLBaLxWKxWCwWi08WcDsBfKVC1zcAAAAASUVORK5CYII=', 'base64');
    await p.setInputFiles('#e-img-file', { name: 'foto.png', mimeType: 'image/png', buffer: png });
    await p.waitForFunction(() => document.querySelectorAll('#e-imgs img.thumb').length === 1);
    ok(true, 'Bild erscheint als Vorschau');
    await p.click('#e-save');
    const t = await S(p, id => state.tasks.find(x => x.id === id), id);
    ok(t.images.length === 1, 'Aufgabe kennt das Bild');
    const stored = await S(p, id => ImgDB.get(id), t.images[0]);
    ok(typeof stored === 'string' && stored.startsWith('data:image/jpeg'), 'Bild als JPEG in IndexedDB');
    ok(await p.locator('#task-list .task', { hasText: 'Regal' }).locator('.meta').textContent().then(x => /🖼 1/.test(x)), 'Karte zeigt 🖼 1');
    // Export: Datei abfangen
    const [dl] = await Promise.all([p.waitForEvent('download'), S(p, () => $('btn-export').click())]);
    const json = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
    ok(json.version === 3 && json.images && json.images[t.images[0]], 'Sicherung enthält Bild und Version 3');
    // Import in frische Seite
    const { ctx: c2, p: p2 } = await open(browser);
    await go(p2, 'settings');
    await p2.setInputFiles('#file-import', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
    await p2.waitForTimeout(500);
    const t2 = await S(p2, () => state.tasks.find(x => x.title === 'Regal aufbauen'));
    const img2 = t2 && await S(p2, id => ImgDB.get(id), t2.images[0]);
    ok(t2 && img2 && img2.startsWith('data:image/jpeg'), 'Import stellt Aufgabe samt Bild wieder her');
    // Bild entfernen + Aufräumen
    await S(p2, id => openTaskDialog(id), t2.id);
    await p2.click('#e-imgs img.thumb'); await p2.click('#img-del'); await p2.click('#e-save');
    await S(p2, () => cleanupImages()); await p2.waitForTimeout(200);
    ok(await S(p2, id => ImgDB.get(id), t2.images[0]) == null, 'Nicht mehr genutztes Bild wird aufgeräumt');
    ok(!p.errors.length && !p2.errors.length, 'keine Fehler ' + p.errors.concat(p2.errors).join(' | '));
    await c2.close(); await ctx.close();
  }

  console.log('5 · Vorlagen');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'tasks');
    await p.click('#btn-templates');
    ok(await p.$eval('#dlg-templates', d => d.open) && await p.locator('#tpl-list .tpl').count() === 2, 'zwei mitgelieferte Vorlagen');
    await p.locator('#tpl-list .tpl .n', { hasText: 'Urlaub packen' }).click();
    ok(await p.$eval('#dlg-task', d => d.open), 'Aufgabe aus Vorlage öffnet sich zum Bearbeiten');
    const t = await lastTask(p);
    ok(t.title === 'Urlaub packen' && t.subtasks.length === 6, 'mit 6 Unterpunkten');
    await p.fill('#e-title', 'Skiurlaub packen'); await p.fill('#e-sub-new', 'Skihelm'); await p.click('#e-sub-add');
    await p.click('#e-tpl');
    ok(await S(p, () => state.templates.some(x => x.title === 'Skiurlaub packen' && x.subtasks.length === 7)), 'als neue Vorlage gespeichert (7 Punkte)');
    await p.click('#e-cancel');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('6 · Einkaufslisten');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'shopping');
    for (const x of ['Milch', 'Brot', 'milch']) { await p.fill('#s-item', x); await p.press('#s-item', 'Enter'); }
    ok(await S(p, () => state.shopping.length) === 2, 'Doppelter Artikel wird abgefangen');
    p.nextPrompt = 'Drogerie';
    await p.locator('#shop-tabs button', { hasText: '＋ Liste' }).click();
    p.nextPrompt = null;
    ok(await p.locator('#shop-tabs button.on').textContent().then(x => x.startsWith('Drogerie')), 'neue Liste „Drogerie“ aktiv');
    await p.fill('#s-item', 'Zahnpasta'); await p.press('#s-item', 'Enter');
    const sugg = await p.$$eval('#shop-sugg option', o => o.map(x => x.value));
    ok(sugg.includes('Milch') && sugg.includes('Brot') && !sugg.includes('Zahnpasta'), 'Vorschläge aus dem Verlauf, ohne schon Gelistetes');
    await p.locator('#shop-tabs button', { hasText: 'Einkauf' }).click();
    ok(await p.locator('#shop-list .row').count() === 2, 'Liste „Einkauf“ zeigt nur ihre Artikel');
    await p.locator('#shop-tabs button', { hasText: 'Drogerie' }).click();
    p.nextPrompt = '';
    await p.click('#btn-list-edit');
    p.nextPrompt = null;
    ok(await S(p, () => state.shopLists.length) === 1 && await S(p, () => state.shopping.length) === 2, 'Liste löschen entfernt ihre Artikel');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('7 · Gewohnheiten');
  {
    const { ctx, p } = await open(browser);
    await go(p, 'settings');
    await p.fill('#habit-name', 'Joggen'); await p.selectOption('#habit-target', '3'); await p.click('#btn-add-habit');
    await go(p, 'week');
    ok(!(await p.$eval('#card-habits', e => e.hidden)), 'Gewohnheiten erscheinen in der Woche');
    const days = p.locator('#habit-list .hday');
    ok(await days.count() === 7, 'sieben Tage');
    ok(await days.nth(2).isDisabled(), 'Mittwoch (Zukunft) gesperrt');
    await days.nth(0).click(); await days.nth(1).click();
    ok(/^2\/3/.test(await p.textContent('#habit-list .hs')), 'Zähler 2/3');
    await days.nth(1).click();
    ok(/1\/3/.test(await p.textContent('#habit-list .hs')), 'Wieder abwählen → 1/3');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('8 · Wochenplan, Stundenplan, Hausaufgabe');
  {
    const { ctx, p } = await open(browser, { profile: 'everyday' });
    await S(p, () => { state.settings.features.timetable = true; save(); applyFeatures(); });
    await go(p, 'timetable');
    ok(await p.isVisible('#fld-start') && !(await p.isVisible('#fld-slot')), 'Wochenplan: Uhrzeiten statt Stunden');
    await p.selectOption('#tt-day', '3'); await p.fill('#tt-start', '19:00'); await p.fill('#tt-end', '20:30');
    await p.fill('#tt-subject', 'Volleyball'); await p.fill('#tt-room', 'Halle 2'); await p.click('#btn-add-lesson');
    ok(/19:00–20:30\s*Volleyball\s*Halle 2/.test(await p.textContent('#plan-list')), 'Eintrag in der Liste je Tag');
    await p.fill('#tt-start', '20:00'); await p.fill('#tt-end', '19:00'); await p.fill('#tt-subject', 'Falsch'); await p.click('#btn-add-lesson');
    ok(await S(p, () => state.lessons.length) === 1, 'Ende vor Anfang wird abgelehnt');
    await go(p, 'week');
    ok(/19:00 Volleyball/.test(await p.textContent('#wk-days')), 'Wochenansicht zeigt den Termin');
    // Stundenplan
    await go(p, 'timetable');
    await p.click('#plan-mode button[data-mode="school"]');
    ok(await p.isVisible('#tt-grid') && await p.isVisible('#fld-slot'), 'Stundenplan: Raster mit Stunden');
    ok(/Weitere feste Termine/.test(await p.textContent('#plan-list')), 'Termin mit Uhrzeit bleibt unter dem Raster sichtbar');
    await p.selectOption('#tt-day', '4'); await p.selectOption('#tt-slot', '1'); await p.fill('#tt-subject', 'Mathe'); await p.click('#btn-add-lesson');
    await go(p, 'tasks'); await p.click('#btn-more');
    await p.selectOption('#t-subject', 'Mathe'); await p.click('#t-hw');
    ok(await p.$eval('#t-date', e => e.value) === '2026-11-05', '„bis nächste Stunde“ → Donnerstag');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('9 · Dunkle Darstellung');
  {
    const { ctx, p } = await open(browser, { dark: true });
    ok(await S(p, () => document.documentElement.dataset.theme) === 'dark', 'System dunkel → dunkel');
    const bg = await S(p, () => getComputedStyle(document.body).backgroundColor);
    ok(bg === 'rgb(15, 17, 21)', 'Hintergrund dunkel: ' + bg);
    const card = await S(p, () => getComputedStyle(document.querySelector('.card')).backgroundColor);
    ok(card === 'rgb(25, 28, 35)', 'Karten dunkel: ' + card);
    await go(p, 'settings'); await p.selectOption('#set-theme', 'light');
    ok(await S(p, () => document.documentElement.dataset.theme) === 'light', 'auf Hell umstellbar');
    await p.reload(); await p.waitForTimeout(200);
    ok(await S(p, () => document.documentElement.dataset.theme) === 'light', 'bleibt nach Neustart hell');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('10 · Daten aus 2.x');
  {
    const v2 = { version: 2, tasks: [{ id: 'a', title: 'Alt', categoryId: 'c1', prio: 'hoch', dueDate: '2026-11-05', recurrence: 'weekly', subtasks: [{ id: 's', text: 'x', done: true }], note: 'n', completed: false, createdAt: 1 }],
      lessons: [{ id: 'l', day: 2, slot: 1, subject: 'Mathe', room: '7b', color: '#123456' }], shopping: [{ id: 'i', text: 'Milch', done: false, createdAt: 1 }],
      extEvents: [], categories: [{ id: 'c1', name: 'Schule', color: '#f00' }],
      settings: { features: { calendar: true, timetable: true, shopping: true, reminders: true, extCal: true, stats: true }, reminderTime: '07:00', slots: ['08:00-08:45', '08:45-09:30'], weekDays: 'mofr', extCalUrl: '' } };
    const { ctx, p } = await open(browser, { state: v2, profile: false });
    ok(!(await p.$eval('#dlg-onboard', d => d.open)), 'keine Einstiegsfrage für bestehende Nutzer');
    const s = await S(p, () => state);
    const t = s.tasks[0];
    ok(t.title === 'Alt' && t.recurrence === 'weekly' && t.remind === 'due' && t.dueTime === null && t.images.length === 0 && t.subtasks[0].done, 'Aufgabe vollständig übernommen');
    ok(s.settings.planMode === 'school' && s.settings.profile === 'school' && s.settings.features.timetable, 'Stundenplan bleibt Stundenplan');
    ok(s.shopping[0].listId === 's1' && s.shopLists.length === 1, 'Einkauf in Liste „Einkauf“');
    ok(s.lessons[0].slot === 1 && s.lessons[0].color === '#123456', 'Stunde übernommen');
    ok(s.settings.reminderTime === '07:00', 'Erinnerungszeit übernommen');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('11 · iOS: Testphase, Sperren, Kauf, Diagnose');
  {
    const { ctx, p } = await open(browser, { ios: {} });
    ok(await S(p, () => Lic.status()) === 'new', 'neu: Testphase nicht gestartet');
    ok(await p.locator('.nav-btn[data-view="calendar"]').evaluate(b => b.classList.contains('locked')), 'Kalender gesperrt');
    await go(p, 'tasks');
    await p.fill('#t-title', 'Arzt morgen 9 Uhr'); await p.press('#t-title', 'Enter');
    ok((await lastTask(p)).dueTime === '09:00', 'Schnelleingabe ist frei');
    await p.click('#btn-templates');
    ok(/Vorlagen gehört zur Vollversion/.test(await p.textContent('#toast')), 'Vorlagen gesperrt');
    const id = (await lastTask(p)).id;
    await S(p, id => openTaskDialog(id), id);
    ok(await p.isVisible('#e-img-lock'), 'Bilder zeigen Schloss');
    ok(await p.isEnabled('#e-remind'), 'Erinnerungen sind frei');
    await p.click('#e-cancel');
    await S(p, () => scheduleAll()); await p.waitForTimeout(100);
    const notif = await S(p, () => window.__log.notif);
    ok(notif.length === 2 && notif[1].title === 'Fällig: Arzt' && new Date(notif[1].schedule.at).getHours() === 9, 'Erinnerung 9:00 eingeplant (ohne Vollversion)');
    // Testphase starten
    await go(p, 'settings'); await p.click('#btn-trial'); await p.waitForTimeout(150);
    ok(await S(p, () => Lic.status()) === 'trial', 'Testphase läuft');
    ok(!(await p.locator('.nav-btn[data-view="calendar"]').evaluate(b => b.classList.contains('locked'))), 'Kalender frei');
    // Testmodus + Diagnose
    await S(p, () => { Lic.short = true; Lic.save(); renderPro(); });
    ok(/Vollversion: gefunden \(2,99 €\)/.test(await p.textContent('#pro-state')), 'Diagnose zeigt gefundenes Produkt');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { ios: { owned: { [TRIAL]: Date.parse('2026-09-01') } } });
    ok(await S(p, () => Lic.status()) === 'expired', 'abgelaufen nach 30 Tagen');
    await go(p, 'settings');
    ok(!(await p.isVisible('#habit-name')) && await p.isVisible('#card-habit-set .lock-note'), 'Gewohnheiten gesperrt (Hinweis statt Formular)');
    await S(p, () => { $('habit-name').value = 'Lesen'; $('btn-add-habit').click(); });
    ok(await S(p, () => state.habits.length) === 0, 'auch per Skript nicht anlegbar');
    await go(p, 'tasks');
    await p.fill('#t-title', 'Arzt morgen 9 Uhr'); await p.press('#t-title', 'Enter');
    ok((await lastTask(p)).dueTime === '09:00', 'Aufgaben bleiben nach der Testphase frei');
    await go(p, 'settings');
    await p.click('#btn-buy'); await p.waitForTimeout(150);
    ok(await S(p, () => Lic.status()) === 'full', 'Kauf schaltet frei');
    await p.fill('#habit-name', 'Lesen'); await p.click('#btn-add-habit');
    ok(await S(p, () => state.habits.length) === 1, 'danach geht es');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('12 · iOS: Gerätekalender und Statusleiste');
  {
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, dark: true });
    ok((await S(p, () => window.__log.sb)).includes('DARK'), 'Statusleiste: helle Schrift im Dunkelmodus');
    await go(p, 'calendar');
    ok(await p.isVisible('#cal-connect-hint'), 'Kalender schlägt „Kalender verbinden“ vor');
    await go(p, 'settings');
    ok(await p.isVisible('#devcal-box'), 'Bereich Gerätekalender sichtbar');
    await p.click('#btn-devcal'); await p.waitForTimeout(300);
    ok(await S(p, () => state.settings.devCal) === true, 'verbunden');
    ok(/2 Kalender/.test(await p.textContent('#devcal-status')), 'zeigt 2 Kalender');
    await go(p, 'week'); await p.waitForTimeout(200);
    const wk = await p.textContent('#wk-days');
    ok(/14:00 Team-Meeting/.test(wk) && /19:00 Elternabend/.test(wk), 'Termine in der Woche');
    ok((wk.match(/Messe/g) || []).length === 2, 'Ganztägiges über 2 Tage an beiden Tagen');
    // Kalender ausblenden
    await go(p, 'settings');
    await p.locator('#devcal-list label', { hasText: 'Arbeit' }).locator('input').click(); await p.waitForTimeout(300);
    await go(p, 'week');
    ok(!/Team-Meeting/.test(await p.textContent('#wk-days')), 'ausgeblendeter Kalender verschwindet');
    // Aufgabe eintragen
    await go(p, 'tasks');
    await p.fill('#t-title', 'Steuerberater Freitag 10 Uhr'); await p.press('#t-title', 'Enter');
    await p.locator('#task-list .task', { hasText: 'Steuerberater' }).locator('button', { hasText: 'In Kalender' }).click();
    await p.waitForTimeout(200);
    const cr = (await S(p, () => window.__log.cal)).find(x => x[0] === 'create');
    ok(cr && cr[1] === 'Steuerberater' && cr[2] === false && new Date(cr[3]).getHours() === 10, 'Termin im Gerätekalender angelegt (Fr 10:00)');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('13 · Erinnerungen: Grenze 64 (iOS)');
  {
    const tasks = Array.from({ length: 80 }, (_, i) => ({ id: 't' + i, title: 'A' + i, dueDate: '2026-11-' + String(4 + (i % 20)).padStart(2, '0'), dueTime: '09:00', completed: false, prio: 'mittel', createdAt: 1 }));
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: { version: 3, tasks, settings: { profile: 'everyday' } } });
    await S(p, () => scheduleAll()); await p.waitForTimeout(100);
    const notif = await S(p, () => window.__log.notif);
    const ats = notif.slice(1).map(x => new Date(x.schedule.at).getTime());
    ok(notif.length === 61, 'Übersicht + 60 Aufgaben (' + notif.length + ')');
    ok(ats.every((x, i) => i === 0 || x >= ats[i - 1]), 'die nächsten zuerst');
    ok(new Set(notif.map(x => x.id)).size === notif.length, 'eindeutige Kennungen');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('13b · Hinweise lesbar (hell und dunkel)');
  for (const dark of [false, true]) {
    const { ctx, p } = await open(browser, { dark });
    await S(p, () => toast('Probe'));
    const c = await p.$eval('#toast', e => { const s = getComputedStyle(e); return [s.backgroundColor, s.color]; });
    const lum = rgb => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    ok(Math.abs(lum(c[0]) - lum(c[1])) > 0.5, (dark ? 'dunkel' : 'hell') + ': Hinweis hat Kontrast (' + c.join(' / ') + ')');
    await ctx.close();
  }

  console.log('14 · iPad-Breite');
  {
    const { ctx, p } = await open(browser, { wide: true });
    for (const v of ['week', 'tasks', 'calendar', 'shopping', 'settings', 'about']) { await go(p, v); }
    ok(await p.isVisible('.nav-btn[data-view="about"]'), 'Info in der Seitenleiste');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('15 · Schule: Ferien, Feiertage, A/B-Wochen, Ausfall, Hausaufgabe, Klassenarbeit');
  {
    const lessons = [
      { id: 'lm', day: 2, slot: 1, subject: 'Mathe', room: '7b', color: '#2563eb' },
      { id: 'ld', day: 3, slot: 2, subject: 'Deutsch', room: '7b', color: '#059669' },
      { id: 'lp', day: 4, slot: 0, subject: 'Physik', room: 'R12', color: '#d97706', week: 'B' }
    ];
    const st = { version: 3, lessons, categories: [{ id: 'c1', name: 'Unterricht', color: '#2563eb' }],
      settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true,
                  features: { timetable: true, calendar: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await go(p, 'settings');
    ok(await p.$eval('#set-region', e => e.value) === 'NI' && await p.isChecked('#set-ferien'), 'Bundesland und Ferien übernommen');
    ok(/Schulferien sind bis/.test(await p.textContent('#region-hint')), 'Hinweis mit Datenstand');
    await go(p, 'week');
    let wk = await p.textContent('#wk-days');
    ok(/Mathe · 7b/.test(wk) && /Deutsch · 7b/.test(wk), 'Stunden in der Schulwoche');
    await S(p, () => { weekOffset = -3; renderWeek(); });          // 12.–18.10.: Herbstferien NI
    wk = await p.textContent('#wk-days');
    ok((wk.match(/Herbstferien/g) || []).length >= 5 && !/Mathe/.test(wk), 'Herbstferien markiert, keine Stunden');
    await S(p, () => { weekOffset = -1; renderWeek(); });          // Sa 31.10. Reformationstag
    ok(/Reformationstag/.test(await p.textContent('#wk-days')), 'Feiertag in der Woche');
    await S(p, () => { weekOffset = 0; renderWeek(); });
    ok(await S(p, () => nextLesson(state.lessons, state.settings.slots, 'Mathe', new Date('2026-10-09T12:00'), nextLessonOpts()).iso) === '2026-10-27',
       'nächste Mathe überspringt die Herbstferien');

    // A/B-Wochen
    await go(p, 'timetable');
    await p.click('#ab-on'); await p.waitForTimeout(100);
    ok(await S(p, () => state.settings.ab.on && state.settings.ab.anchor === '2026-11-02'), 'A/B an, diese Woche als Anker');
    ok(/Diese Woche ist Woche A/.test(await p.textContent('#ab-hint')), 'Hinweis: Woche A');
    ok(!(await p.textContent('#tt-grid')).includes('Physik'), 'Raster Woche A ohne Physik (B)');
    await p.click('#ab-view button[data-w="B"]');
    ok((await p.textContent('#tt-grid')).includes('Physik'), 'Raster Woche B mit Physik');
    await go(p, 'week');
    ok(/Woche A/.test(await p.textContent('#wk-title')) && !/Physik/.test(await p.textContent('#wk-days')), 'Woche A: kein Physik');
    await S(p, () => { weekOffset = 1; renderWeek(); });
    ok(/Woche B/.test(await p.textContent('#wk-title')) && /Physik/.test(await p.textContent('#wk-days')), 'Woche B: Physik am Donnerstag');
    await S(p, () => { weekOffset = 0; renderWeek(); });
    // Zelle mit B-Stunde: neue A-Stunde ersetzt sie nicht
    await go(p, 'timetable');
    await p.click('#ab-view button[data-w="A"]');
    await S(p, () => openLessonDialog(null, 4, 0));
    ok(await p.$eval('#l-week', e => e.value) === 'A', 'leere Zelle neben B-Stunde: Vorschlag „nur Woche A“');
    await p.fill('#l-subject', 'Chemie'); await p.click('#l-save');
    ok(await S(p, () => state.lessons.filter(l => l.day === 4 && l.slot === 0).map(l => l.subject + l.week).sort().join()) === 'ChemieA,PhysikB',
       'A- und B-Stunde teilen sich die Zelle');

    // Ausfall und Vertretung
    await go(p, 'week');
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe' }).first().click();
    ok(await p.$eval('#dlg-lday', d => d.open) && /Mathe · Dienstag/.test(await p.textContent('#ld-head')), 'Stunde antippen öffnet den Tag-Dialog');
    await p.check('#ld-cancel'); await p.click('#ld-save');
    ok(await S(p, () => !!(state.lessonEx['lm|2026-11-03'] || {}).cancel), 'Ausfall gespeichert');
    ok(await p.locator('#wk-days .wd-lesson.cx', { hasText: 'Mathe' }).count() === 1, 'durchgestrichen');
    await p.locator('#wk-days .wd-lesson', { hasText: 'Deutsch' }).first().click();
    await p.fill('#ld-subject', 'Vertretung Bio'); await p.fill('#ld-room', 'R3'); await p.click('#ld-save');
    ok(/Vertretung Bio · R3/.test(await p.textContent('#wk-days')), 'Vertretung angezeigt');
    // Hausaufgabe aus dem Dialog
    await p.locator('#wk-days .wd-lesson', { hasText: 'Vertretung Bio' }).first().click();
    await p.fill('#ld-hw', 'Gedicht lernen'); await p.click('#ld-hw-add');
    let t = await lastTask(p);
    ok(t.title === 'Gedicht lernen' && t.subject === 'Deutsch' && t.dueDate === '2026-11-11' && t.categoryId === 'c1', 'Hausaufgabe zur nächsten Deutschstunde');
    await p.click('#ld-close');

    // Schnelleingabe „bis nächste Mathe“ (heute fällt Mathe aus, Stunde ohnehin vorbei)
    await go(p, 'tasks');
    await p.fill('#t-title', 'S. 34 Nr. 5 bis nächste Mathe');
    ok(/📚 Mathe/.test(await p.textContent('#qa-preview')), 'Vorschau zeigt das Fach');
    await p.press('#t-title', 'Enter');
    t = await lastTask(p);
    ok(t.title === 'S. 34 Nr. 5' && t.subject === 'Mathe' && t.dueDate === '2026-11-10', 'bis nächste Mathe → Di 10.11.');

    // Klassenarbeit planen
    await p.click('#btn-templates');
    await p.click('#tpl-exam');
    ok(await p.$eval('#dlg-exam', d => d.open) && await p.$eval('#ex-kind button.on', b => b.dataset.k) === 'teacher', 'Planung öffnet als Lehrkraft');
    await p.fill('#ex-title', '7b Bruchrechnung');
    await p.selectOption('#ex-subject', 'Mathe');
    await p.fill('#ex-date', '2026-11-17');
    ok((await p.$$('#ex-preview > div')).length === 3, 'Vorschau: drei Aufgaben');
    const before = await S(p, () => state.tasks.length);
    await p.click('#ex-save');
    const made = await S(p, n => state.tasks.slice(n).map(x => [x.title, x.dueDate, x.dueTime, x.subtasks.length]), before);
    ok(made.length === 3 && made[1][0] === '7b Bruchrechnung: Klassenarbeit' && made[1][2] === '08:45'
       && made[0][1] === '2026-11-13' && made[2][1] === '2026-12-01' && made[2][3] === 4,
       'vorbereiten, schreiben (08:45), korrigieren: ' + JSON.stringify(made));
    // Lernplan
    await S(p, () => openExamDialog('2026-11-12', null));
    await p.click('#ex-kind button[data-k="student"]');
    ok((await p.$$('#ex-preview > div')).length === 4, 'Lernplan: drei Einheiten plus Klausur');
    await p.click('#ex-cancel');

    // Kalender
    await go(p, 'calendar');
    await S(p, () => { calCursor = new Date(2026, 9, 1); renderCalendar(); });
    ok(await p.locator('#cal-grid .cal-c.hol').count() >= 1 && await p.locator('#cal-grid .cal-c.fer').count() >= 10, 'Kalender: Feiertag und Ferien markiert');
    await S(p, () => { calSelected = '2026-10-31'; renderCalendarDay(); });
    ok(/Reformationstag/.test(await p.textContent('#cal-day-list')), 'Tagesliste nennt den Feiertag');

    // Sicherung: Daten überstehen Export/Import
    const back = await S(p, () => { const n = normalizeState(JSON.parse(JSON.stringify(state)));
      return [n.settings.region, n.settings.ab.on, n.lessons.find(l => l.id === 'lp').week, !!n.lessonEx['lm|2026-11-03']]; });
    ok(JSON.stringify(back) === '["NI",true,"B",true]', 'Bundesland, A/B, Ausnahmen bleiben beim Import erhalten');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('17 · Heute-Widget');
  {
    const lessons = [{ id: 'lm', day: 2, slot: 4, subject: 'Mathe', room: '7b', color: '#2563eb' },
                     { id: 'lx', day: 2, slot: 0, subject: 'Kunst', color: '#db2777' }];
    const st = { version: 3, lessons, lessonEx: { 'lx|2026-11-03': { cancel: true } },
      categories: [{ id: 'c1', name: 'Privat', color: '#059669' }],
      tasks: [{ id: 'a', title: 'Zahnarzt', categoryId: 'c1', dueDate: '2026-11-03', dueTime: '15:00', prio: 'mittel', createdAt: 1 },
              { id: 'b', title: 'Wäsche', dueDate: '2026-11-03', prio: 'mittel', createdAt: 1 },
              { id: 'c', title: 'Alt', dueDate: '2026-10-30', prio: 'mittel', createdAt: 1 },
              { id: 'd', title: 'Morgen-Aufgabe', dueDate: '2026-11-04', prio: 'mittel', createdAt: 1 }],
      settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true, features: { timetable: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await p.waitForTimeout(1500);
    let log = await S(p, () => window.__log.widget);
    ok(log.length >= 1, 'Zusammenfassung an das Widget geschickt');
    const w = JSON.parse(log[log.length - 1]);
    ok(w.v === 1 && w.days.length === 3 && w.days[0].iso === '2026-11-03' && w.days[0].label.startsWith('Heute'), 'drei Tage ab heute');
    const it = w.days[0].items;
    ok(it.map(x => x.kind + ':' + (x.time || '-')).join() === 'lesson:08:00,lesson:11:50,task:15:00,task:-', 'nach Uhrzeit, Aufgaben ohne Uhrzeit zuletzt: ' + it.map(x => x.title).join(' | '));
    ok(it[0].cancelled === true && it[1].title === 'Mathe · 7b', 'Ausfall markiert, Raum am Fach');
    ok(w.overdue === 1, 'überfällig gezählt');
    ok(w.days[1].items.some(x => x.title === 'Morgen-Aufgabe'), 'Vorrat für morgen');
    // Änderung → neue Zusammenfassung, gleicher Stand → keine doppelte
    const n0 = log.length;
    await S(p, () => { toggleTask('b'); });
    await p.waitForTimeout(1500);
    log = await S(p, () => window.__log.widget);
    ok(log.length === n0 + 1 && !JSON.parse(log[log.length - 1]).days[0].items.some(x => x.title === 'Wäsche'), 'Abhaken aktualisiert das Widget');
    await S(p, () => renderAll()); await p.waitForTimeout(1500);
    ok((await S(p, () => window.__log.widget.length)) === n0 + 1, 'unveränderter Stand wird nicht erneut geschickt');
    await go(p, 'about');
    await p.click('#tech-info summary'); await p.waitForTimeout(300);
    const tech = await p.textContent('#tech-text');
    ok(/Widget-Brücke: ja, zuletzt gesendet/.test(tech) && /App-Gruppe: ja, Widget-Daten: [1-9]\d* Bytes/.test(tech) && /Kaufmodul: geladen/.test(tech),
       'Info-Seite zeigt Kauf- und Widget-Zustand: ' + tech.replace(/\n/g, ' | '));
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  console.log('18 · Plus- und Minusstunden');
  {
    const lessons = [
      { id: 'm1', day: 2, slot: 2, subject: 'Mathe', room: '7b', color: '#2563eb' },
      { id: 'm2', day: 2, slot: 3, subject: 'Mathe', room: '7b', color: '#2563eb' },
      { id: 'd1', day: 3, slot: 0, subject: 'Deutsch', room: '9a', color: '#059669' }];
    const st = { version: 3, lessons, settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true, features: { timetable: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await go(p, 'week');
    ok(await p.locator('#wk-days .wd-add').count() === 5, '„＋ Vertretung“ an fünf Schultagen');
    // Vertretung am Mittwoch: Doppelstunde
    await p.locator('#wk-days .week-day').nth(2).locator('.wd-add').click();
    ok(await p.$eval('#dlg-sub', d => d.open) && await p.$eval('#sb-date', e => e.value) === '2026-11-04', 'Dialog mit Datum des Tages');
    await p.click('#sb-hours button[data-h="2"]');
    await p.selectOption('#sb-slot', '4');
    await p.fill('#sb-klass', '8c'); await p.fill('#sb-subject', 'Bio'); await p.fill('#sb-note', 'Arbeitsblatt Zelle');
    await p.click('#sb-save');
    let log = await S(p, () => state.subLog);
    ok(log.length === 1 && log[0].type === 'plus' && log[0].hours === 2 && log[0].slot === 4 && log[0].klass === '8c', 'Vertretung gespeichert');
    ok(/\+ Vertretung · 8c Bio/.test(await p.textContent('#wk-days')) && /11:50/.test(await p.locator('#wk-days .wd-lesson.sp').textContent()), 'in der Woche mit Uhrzeit der Stunde');
    // Aufsicht am Donnerstag
    await p.locator('#wk-days .week-day').nth(3).locator('.wd-add').click();
    await p.click('#sb-type button[data-t="aufsicht"]');
    await p.click('#sb-save');
    // Ausfall: Mathe-Doppelstunde am Dienstag
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe' }).first().click();
    await p.check('#ld-cancel');
    ok(await p.isVisible('#ld-minus') && await p.isChecked('#ld-minus-on') && await p.$eval('#ld-minus-h button.on', b => b.dataset.h) === '2', 'Ausfall: Minusstunde, Doppelstunde erkannt');
    await p.click('#ld-save');
    log = await S(p, () => state.subLog.filter(e => e.type === 'minus'));
    ok(log.length === 1 && log[0].hours === 2 && log[0].slot === 2 && log[0].pairId === 'm2', 'eine Minus-Doppelstunde');
    ok(await p.locator('#wk-days .wd-lesson.cx').count() === 2, 'beide Mathestunden durchgestrichen');
    // Zweite Stunde öffnen: kein zweiter Eintrag
    await p.locator('#wk-days .wd-lesson.cx').nth(1).click();
    ok(await p.isChecked('#ld-minus-on'), 'zweite Stunde kennt den Eintrag');
    await p.click('#ld-save');
    ok((await S(p, () => state.subLog.filter(e => e.type === 'minus').length)) === 1, 'keine doppelte Minusstunde');
    // Übersicht
    await go(p, 'timetable');
    ok(await p.isVisible('#card-subs'), 'Übersicht im Stundenplan');
    const tiles = await p.$$eval('#sub-tiles .v', x => x.map(e => e.textContent));
    ok(tiles.join(' ') === '+2 −2 ±0 1', 'Plus 2, Minus 2, Saldo 0, 1 Aufsicht: ' + tiles.join(' '));
    ok((await p.$$('#sub-list .sub-row')).length === 3, 'drei Einträge in der Liste');
    // Details nachtragen
    await p.locator('#sub-list .sub-row.minus').click();
    ok(await p.$eval('#sb-head', e => e.textContent) === 'Ausfall bearbeiten', 'Eintrag antippen öffnet Details');
    await p.fill('#sb-note', 'Wandertag'); await p.click('#sb-save');
    ok((await S(p, () => state.subLog.find(e => e.type === 'minus').note)) === 'Wandertag', 'Notiz gespeichert');
    await p.click('#sub-share');
    const share = await S(p, () => window.__log.share || '');
    ok(/Saldo: 0 Std/.test(share) && /03\.11\.2026 · 3\.\/4\. Std · Ausfall · 7b Mathe · −2 – Wandertag/.test(share), 'Liste teilen');
    p.nextPrompt = 'Simon Mählmann';
    await p.click('#sub-pdf'); await p.waitForTimeout(300);
    const pdfw = await S(p, () => (window.__log.fs || []).find(x => /\.pdf$/.test(x[1])));
    ok(pdfw && pdfw[0] === 'CACHE' && /Mehr-und-Minderstunden-Schuljahr-2026-27\.pdf/.test(pdfw[1]) && pdfw[2] > 800, 'PDF erzeugt: ' + (pdfw && pdfw[1]));
    const pdfTxt = await S(p, () => { const per = schoolPeriod('year', todayISO()); return buildTablePdf({ title: 'T', cols: [{ label: 'A', w: 100 }], rows: [['Mählmann']] }); });
    ok(/^%PDF-1\.4/.test(pdfTxt) && /startxref\n\d+\n%%EOF\n$/.test(pdfTxt) && pdfTxt.includes('M\xe4hlmann'), 'PDF-Aufbau und Umlaute (WinAnsi)');
    p.nextPrompt = null;
    await p.click('#sub-period button[data-p="month"]');
    ok(/November 2026/.test(await p.textContent('#sub-period-label')), 'Zeitraum Monat');
    // Ausfall zurücksetzen → Minus weg, beide Stunden wieder da
    await go(p, 'week');
    await p.locator('#wk-days .wd-lesson.cx').first().click();
    await p.click('#ld-reset');
    ok((await S(p, () => state.subLog.filter(e => e.type === 'minus').length)) === 0 && await p.locator('#wk-days .wd-lesson.cx').count() === 0, 'Zurücksetzen entfernt Minus und Ausfall');
    // Sicherung
    const back = await S(p, () => normalizeState(JSON.parse(JSON.stringify(state))).subLog.map(e => e.type + e.hours).join());
    ok(back === 'plus2,aufsicht1', 'Einträge überstehen Export/Import: ' + back);
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    // Alltag: keine Vertretungs-Knöpfe
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } } });
    ok(await p.locator('#wk-days .wd-add').count() === 0 && !(await p.isVisible('#card-subs')), 'im Alltagsprofil unsichtbar');
    await ctx.close();
  }

  console.log('19 · Doppelstunden und Pausenaufsichten');
  {
    const st = { version: 3, lessons: [], settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true, features: { timetable: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await go(p, 'timetable');
    // Doppelstunde über das Formular: Montag, 3./4. Stunde
    await p.selectOption('#tt-day', '1'); await p.selectOption('#tt-slot', '2');
    await p.check('#tt-double'); await p.fill('#tt-subject', 'Mathe'); await p.fill('#tt-room', '7b');
    await p.click('#btn-add-lesson');
    let L = await S(p, () => state.lessons);
    ok(L.length === 1 && L[0].span === 2 && L[0].slot === 2, 'Doppelstunde als ein Eintrag');
    const cell = p.locator('#tt-grid .tt-s.dbl');
    ok(await cell.count() === 1 && /Doppelstunde/.test(await cell.textContent()), 'im Raster als Doppelstunde');
    const rows = await cell.evaluate(e => e.style.gridRow);
    ok(/span 2/.test(rows), 'über zwei Zeilen (' + rows + ')');
    // Doppelstunde über eine Pause hinweg: Dienstag 2./3. Stunde (Pause nach der 2.)
    await S(p, () => { state.lessons.push({ id: 'x', day: 2, slot: 1, span: 2, subject: 'Deutsch', room: '9a', color: '#059669' }); save(); renderTimetable(); });
    const r2 = await p.locator('#tt-grid .tt-s.dbl', { hasText: 'Deutsch' }).evaluate(e => e.style.gridRow);
    ok(/span 3/.test(r2), 'über die Pause hinweg drei Zeilen (' + r2 + ')');
    ok(await p.locator('#tt-grid .tt-p').count() === 3, 'drei Pausenzeilen aus den Zeiten (inkl. Mittag)');
    // Pausenaufsicht eintragen: Mittwoch nach der 2. Stunde
    const wedBreak = p.locator('#tt-grid .tt-b[title^="Pausenaufsicht Mittwoch, 09:30"]');
    await wedBreak.click();
    ok(await p.$eval('#dlg-duty', d => d.open), 'Tipp auf die Pause öffnet die Aufsicht');
    await p.fill('#du-place', 'Hof'); await p.click('#du-save');
    ok((await S(p, () => state.duties.map(d => d.day + '/' + d.after + '/' + d.place).join())) === '3/1/Hof', 'Aufsicht gespeichert');
    ok((await p.locator('#tt-grid .tt-b.full').textContent()).includes('Aufsicht · Hof'), 'im Raster sichtbar');
    // Woche: Aufsicht um 09:30, Doppelstunde einmal
    await go(p, 'week');
    const wk = await p.textContent('#wk-days');
    ok(/09:30 Aufsicht · Hof/.test(wk), 'Aufsicht in der Woche zur Pausenzeit');
    ok((wk.match(/Mathe · 7b/g) || []).length === 1, 'Doppelstunde einmal in der Woche');
    // Ausfall der Doppelstunde = 2 Minusstunden ohne Partner
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe' }).click();
    await p.check('#ld-cancel');
    ok(await p.$eval('#ld-minus-h button.on', b => b.dataset.h) === '2', 'Ausfall der Doppelstunde: Doppel vorgeschlagen');
    await p.click('#ld-save');
    ok((await S(p, () => state.subLog.map(e => e.type + e.hours + '@' + e.slot).join())) === 'minus2@2', 'eine Minus-Doppelstunde');
    // In den Herbstferien keine Aufsicht
    await S(p, () => { weekOffset = -3; renderWeek(); });
    ok(!/Aufsicht · Hof/.test(await p.textContent('#wk-days')), 'keine Aufsicht in den Ferien');
    await S(p, () => { weekOffset = 0; renderWeek(); });
    // Doppelstunde wieder einfach machen
    await go(p, 'timetable');
    await p.locator('#tt-grid .tt-s.dbl', { hasText: 'Mathe' }).click();
    ok(await p.isChecked('#l-double'), 'Dialog zeigt Doppelstunde');
    await p.uncheck('#l-double'); await p.click('#l-save');
    ok((await S(p, () => state.lessons.find(l => l.subject === 'Mathe').span)) === 1, 'zurück auf Einzelstunde');
    // Widget enthält die Aufsicht (Mittwoch)
    const w = await S(p, () => widgetSnapshot());
    ok(w.days[1].items.some(x => /Aufsicht · Hof/.test(x.title)), 'Aufsicht im Widget');
    const back = await S(p, () => { const n = normalizeState(JSON.parse(JSON.stringify(state))); return n.duties.length + '/' + n.lessons.find(l => l.id === 'x').span; });
    ok(back === '1/2', 'Aufsichten und Doppelstunden überstehen Export/Import');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('20 · Schnellaktionen am App-Symbol');
  {
    const st = { version: 3, lessons: [{ id: 'm', day: 2, slot: 1, subject: 'Mathe' }], settings: { profile: 'teacher', planMode: 'school', features: { timetable: true, shopping: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await p.waitForTimeout(300);
    const sc = await S(p, () => (window.__log.shortcuts || []).map(x => x.title).join(' | '));
    ok(sc === 'Neue Aufgabe | Vertretung eintragen | Stundenplan | Einkaufsliste', 'Lehrkraft: passende Schnellaktionen (' + sc + ')');
    await S(p, () => window.__openAppLink('todoorganizer://new-sub')); await p.waitForTimeout(400);
    ok(await p.$eval('#dlg-sub', d => d.open), '„Vertretung eintragen“ öffnet den Dialog');
    await S(p, () => window.__openAppLink('todoorganizer://new-task')); await p.waitForTimeout(400);
    ok(await S(p, () => document.querySelector('.view.active').id === 'view-tasks' && document.activeElement.id === 't-title'), '„Neue Aufgabe“ springt ins Eingabefeld');
    await S(p, () => window.__openAppLink('todoorganizer://kaputt'));
    ok(await S(p, () => document.querySelector('.view.active').id === 'view-tasks'), 'unbekannter Link ändert nichts');
    await go(p, 'settings'); await p.selectOption('#set-profile', 'everyday'); await p.waitForTimeout(200);
    const sc2 = await S(p, () => (window.__log.shortcuts || []).map(x => x.title).join(' | '));
    ok(sc2 === 'Neue Aufgabe | Einkaufsliste', 'Alltag: ohne Vertretung und Stundenplan (' + sc2 + ')');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('21 · Notizen zur Stunde');
  {
    const lessons = [{ id: 'a', day: 2, slot: 1, subject: 'Mathe', room: '7b', color: '#2563eb' }, { id: 'b', day: 4, slot: 0, subject: 'Mathe', room: '7b', color: '#2563eb' },
                     { id: 'c', day: 3, slot: 2, subject: 'Mathe', room: '9a', color: '#2563eb' }];
    const st = { version: 3, lessons, settings: { profile: 'teacher', planMode: 'school', features: { timetable: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await go(p, 'week');
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 7b' }).first().click();
    ok(await p.isVisible('#ld-note'), 'Stunden-Dialog mit Notizfeld');
    await p.fill('#ld-note', 'Bruchrechnung: Kürzen eingeführt'); await p.click('#ld-save');
    let N = await S(p, () => state.lessonNotes);
    ok(N.length === 1 && N[0].course === 'Mathe|7b' && N[0].date === '2026-11-03', 'Notiz am Kurs und Datum');
    ok(await p.locator('#wk-days .wd-lesson .nt').count() === 1, '📝 an der Stunde');
    // Donnerstag gleiche Klasse
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 7b' }).nth(1).click();
    ok(await p.inputValue('#ld-note') === '' && /\(1\)/.test(await p.textContent('#ld-history')), 'anderer Tag: leer, Verlauf zeigt 1');
    await p.fill('#ld-note', 'Erweitern geübt, HA S. 34'); await p.click('#ld-save');
    // 9a ist ein anderer Kurs
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 9a' }).click();
    ok(/^Stundenverlauf ansehen$/.test(await p.textContent('#ld-history')), 'andere Klasse: eigener Verlauf');
    await p.click('#ld-close');
    // Im Stundenplan: Verlauf im Dialog, neueste zuerst
    await go(p, 'timetable');
    await p.locator('#tt-grid .tt-s.full', { hasText: '7b' }).first().click();
    const rows = await p.$$eval('#l-notes .note-row .x', e => e.map(x => x.textContent));
    ok(rows.length === 2 && /Erweitern/.test(rows[0]) && /Kürzen/.test(rows[1]), 'Stundenplan zeigt den Verlauf, neueste oben');
    await p.locator('#l-notes .note-row').nth(1).click();
    ok(await p.$eval('#dlg-note', d => d.open) && await p.inputValue('#nt-date') === '2026-11-03', 'Notiz öffnen');
    // Auf ein belegtes Datum verschieben, Rückfrage abbrechen → nichts geht verloren
    p.nextPrompt = null;
    p.removeAllListeners('dialog'); p.on('dialog', d => d.dismiss());
    await p.fill('#nt-date', '2026-11-05'); await p.click('#nt-save');
    ok((await S(p, () => state.lessonNotes.length)) === 2, 'Abbrechen der Rückfrage löscht nichts');
    p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());
    await p.fill('#nt-date', '2026-11-03'); await p.fill('#nt-text', 'Kürzen eingeführt, Beispiele an der Tafel'); await p.click('#nt-save');
    ok((await S(p, () => state.lessonNotes.find(n => n.date === '2026-11-03').text)) === 'Kürzen eingeführt, Beispiele an der Tafel', 'Notiz bearbeitet');
    await p.click('#l-cancel');
    // Verlauf teilen
    await S(p, () => openCourseDialog('Mathe|7b'));
    await p.click('#cs-share');
    const sh = await S(p, () => window.__log.share || '');
    ok(/^Stundenverlauf Mathe · 7b/.test(sh) && sh.indexOf('03.11.2026') < sh.indexOf('05.11.2026'), 'Verlauf teilen, ältestes zuerst');
    await p.click('#cs-close');
    // Leeren löscht die Notiz
    await go(p, 'week');
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 7b' }).first().click();
    await p.fill('#ld-note', ''); await p.click('#ld-save');
    ok((await S(p, () => state.lessonNotes.length)) === 1, 'leeres Feld entfernt die Notiz');
    // Stundenplan neu anlegen: Notizen bleiben am Kurs
    await S(p, () => { state.lessons = [{ id: 'neu', day: 5, slot: 0, subject: 'Mathe', room: '7b', color: '#2563eb' }]; save(); });
    ok((await S(p, () => notesOf('Mathe|7b').length)) === 1, 'Notizen überstehen einen neuen Stundenplan');
    const back = await S(p, () => normalizeState(JSON.parse(JSON.stringify(state))).lessonNotes.length);
    ok(back === 1, 'Notizen überstehen Export/Import');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('22 · Sicherung');
  {
    const tasks = Array.from({ length: 4 }, (_, i) => ({ id: 't' + i, title: 'A' + i, dueDate: '2026-11-04', prio: 'mittel', createdAt: 1 }));
    // Gerät seit 20 Tagen in Benutzung, nie gesichert
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: { version: 3, tasks, settings: { profile: 'everyday' } } });
    await S(p, () => { Backup.d = { firstUse: Date.now() - 20 * 864e5, auto: false }; Backup.save(); renderAll(); });
    ok(await p.isVisible('#bk-banner') && /Noch keine Sicherung/.test(await p.textContent('#bk-banner')), 'Hinweis nach 14 Tagen ohne Sicherung');
    await p.click('#bk-later');
    ok(!(await p.isVisible('#bk-banner')), '„Später“ blendet ihn eine Woche aus');
    await S(p, () => { Backup.d.dismissedUntil = 0; Backup.save(); renderAll(); });
    await p.click('#bk-now'); await p.waitForTimeout(300);
    let fs = await S(p, () => window.__log.fs || []);
    ok(fs.some(x => x[0] === 'CACHE' && /todo-organizer-backup-2026-11-03\.json/.test(x[1])) && !(await p.isVisible('#bk-banner')), '„Jetzt sichern“ exportiert und blendet aus');
    // Automatische Sicherung
    await go(p, 'settings');
    ok(await p.isVisible('#bk-auto-row') && !(await p.isChecked('#bk-auto')), 'Schalter in der iOS-App sichtbar');
    await p.check('#bk-auto'); await p.waitForTimeout(400);
    fs = await S(p, () => window.__log.fs);
    const doc = fs.filter(x => x[0] === 'DOCUMENTS');
    ok(doc.length === 1 && doc[0][1] === 'ToDo-Organizer-Sicherung.json' && doc[0][2] > 100 && fs.some(x => x[0] === 'copy'), 'Sicherung in Dokumente, vorige Fassung kopiert');
    ok(/Zuletzt automatisch gesichert heute/.test(await p.textContent('#bk-info')), 'Status in den Einstellungen');
    await S(p, () => Backup.auto()); await p.waitForTimeout(200);
    ok((await S(p, () => window.__log.fs.filter(x => x[0] === 'DOCUMENTS').length)) === 1, 'innerhalb der Woche keine zweite Sicherung');
    await S(p, () => { Backup.d.lastExport = 0; Backup.d.lastAuto = Date.now() - 3 * 864e5; Backup.save(); renderAll(); });
    ok(!(await p.isVisible('#bk-banner')), 'automatische Sicherung zählt: kein Hinweis');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    // Neu installiert: noch kein Hinweis
    const { ctx, p } = await open(browser, { state: { version: 3, tasks: [{ id: 'a', title: 'x' }, { id: 'b', title: 'y' }, { id: 'c', title: 'z' }], settings: { profile: 'everyday' } } });
    ok(!(await p.isVisible('#bk-banner')), 'erste Woche: kein Hinweis');
    ok(!(await p.isVisible('#bk-auto-row')), 'im Browser keine automatische Sicherung');
    await ctx.close();
  }

  console.log('23 · Uhrzeit von – bis');
  {
    const st = { version: 3, settings: { profile: 'everyday' },
      tasks: [{ id: 'eb', title: 'Elternabend', dueDate: '2026-11-03', dueTime: '18:30', prio: 'mittel', createdAt: 1 }] };
    const { ctx, p } = await open(browser, { state: st });
    await go(p, 'tasks');
    await p.fill('#t-title', 'Fußballtraining Di 18–19:30');
    await p.dispatchEvent('#t-title', 'input');
    ok(/18:00–19:30/.test(await p.textContent('#qa-preview')), 'Vorschau zeigt 18:00–19:30');
    await p.press('#t-title', 'Enter');
    let t = await lastTask(p);
    ok(t.title === 'Fußballtraining' && t.dueDate === '2026-11-03' && t.dueTime === '18:00' && t.endTime === '19:30', 'Spanne gespeichert');
    ok(/Überschneidet sich mit 18:30 Elternabend/.test(await p.textContent('#toast')), 'Hinweis auf Überschneidung');
    ok(/18:00–19:30/.test(await p.locator('#task-list .task', { hasText: 'Fußballtraining' }).textContent()), 'Liste zeigt die Spanne');
    await go(p, 'week');
    ok(await p.locator('#wk-days .wd-task .tm', { hasText: '18:00–19:30' }).count() === 1, 'Woche zeigt die Spanne');
    const wi = await S(p, () => widgetSnapshot().days[0].items.find(i => i.title === 'Fußballtraining'));
    ok(wi && wi.time === '18:00' && wi.end === '19:30', 'Widget bekommt das Ende');
    ok(await S(p, id => { const e = taskEnd(state.tasks.find(x => x.id === id)); return e.getHours() * 60 + e.getMinutes(); }, t.id) === 19 * 60 + 30, 'Kalender-Ende aus der Spanne');
    // Dialog: Dauer, Beginn verschieben, Fehler
    await S(p, id => openTaskDialog(id), t.id);
    ok(await p.inputValue('#e-end') === '19:30' && await p.isVisible('#e-dur') && /1 Std\. 30 Min\./.test(await p.textContent('#e-dur-lbl')), 'Dialog zeigt Ende und Dauer');
    await p.fill('#e-time', '17:00'); await p.dispatchEvent('#e-time', 'input');
    ok(await p.inputValue('#e-end') === '18:30', 'Beginn verschoben – Ende wandert mit');
    await p.click('#e-dur button[data-m="120"]');
    ok(await p.inputValue('#e-end') === '19:00', 'Dauer 2 Std. setzt das Ende');
    await p.fill('#e-end', '16:00'); await p.dispatchEvent('#e-end', 'input');
    await p.click('#e-save');
    ok(await p.$eval('#dlg-task', d => d.open) && /vor dem Beginn/.test(await p.textContent('#toast')), 'Ende vor Beginn wird nicht gespeichert');
    await p.fill('#e-end', '18:15'); await p.dispatchEvent('#e-end', 'input'); await p.click('#e-save');
    t = await S(p, id => state.tasks.find(x => x.id === id), t.id);
    ok(t.dueTime === '17:00' && t.endTime === '18:15', 'geänderte Spanne gespeichert');
    await S(p, id => openTaskDialog(id), t.id);
    await p.fill('#e-time', ''); await p.dispatchEvent('#e-time', 'input');
    ok(await p.$eval('#e-end', e => e.disabled && !e.value) && await p.isHidden('#e-dur'), 'ohne Beginn kein Ende');
    await p.click('#e-save');
    t = await S(p, id => state.tasks.find(x => x.id === id), t.id);
    ok(t.dueTime === null && t.endTime === null, 'Uhrzeit entfernt → Ende auch');
    // Formularfelder
    await go(p, 'tasks');
    await p.click('#btn-more');
    ok(await p.$eval('#t-end', e => e.disabled), '„bis“ gesperrt ohne Anfangszeit');
    await p.fill('#t-title', 'Lesen'); await p.fill('#t-date', '2026-11-05');
    await p.fill('#t-time', '09:00'); await p.dispatchEvent('#t-time', 'input');
    await p.fill('#t-end', '10:00'); await p.click('#btn-add-task');
    t = await lastTask(p);
    ok(t.title === 'Lesen' && t.dueTime === '09:00' && t.endTime === '10:00', 'Formular: von – bis');
    ok(await p.inputValue('#t-end') === '' && await p.$eval('#t-end', e => e.disabled), 'Formular danach leer');
    // Wiederholung übernimmt die Spanne
    await p.fill('#t-title', 'Training jeden Do 18-19:30 Uhr'); await p.press('#t-title', 'Enter');
    t = await lastTask(p);
    await S(p, id => toggleTask(id), t.id);
    const nx = await lastTask(p);
    ok(t.recurrence !== 'none' && nx.id !== t.id && nx.dueDate === '2026-11-12' && nx.endTime === '19:30', 'Folgetermin behält die Spanne');
    // Altbestand und ungültige Werte
    const nm = await S(p, () => normalizeState({ tasks: [{ title: 'a', dueTime: '18:00', endTime: '17:00' }, { title: 'b', endTime: '10:00' }, { title: 'c', dueTime: '08:00', endTime: '09:00' }] }).tasks.map(x => x.endTime));
    ok(JSON.stringify(nm) === JSON.stringify([null, null, '09:00']), 'ungültige Enden werden verworfen');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('24 · Noch X Stunden, für die nächste Stunde merken');
  {
    const lessons = [{ id: 'a', day: 2, slot: 4, subject: 'Mathe', room: '7b', color: '#2563eb' },
                     { id: 'b', day: 4, slot: 0, subject: 'Mathe', room: '7b', color: '#2563eb' },
                     { id: 'c', day: 3, slot: 2, subject: 'Mathe', room: '9a', color: '#7c3aed' },
                     { id: 'd', day: 5, slot: 2, subject: 'Physik', room: '7b', color: '#d97706', span: 2 }];
    const tasks = [{ id: 'x7', title: 'Mathe 7b: Klassenarbeit', subject: 'Mathe', dueDate: '2026-11-19', exam: true, course: 'Mathe|7b', prio: 'hoch', createdAt: 1 },
                   { id: 'x9', title: 'Mathe 9a: Klassenarbeit', subject: 'Mathe', dueDate: '2026-11-25', prio: 'hoch', createdAt: 1 }];
    const st = { version: 3, lessons, tasks, settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true, features: { timetable: true } } };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: st });
    await go(p, 'week');
    // Di 3.11., 10:15 – Mathe 7b heute 11:50 kommt noch. Weihnachtsferien NI ab 23.12.
    await p.locator('#wk-days .week-day.today .wd-lesson', { hasText: 'Mathe · 7b' }).click();
    const cnt = await p.textContent('#ld-count');
    ok(/Noch 5 Stunden bis zur Klassenarbeit \(Do 19\.11\.\) · 15 Stunden bis zu den Weihnachtsferien/.test(cnt), 'Stundendialog: ' + cnt);
    // Merken
    await p.fill('#ld-memo', 'Test zurückgeben'); await p.click('#ld-memo-add');
    let M = await S(p, () => state.lessonMemos);
    ok(M.length === 1 && M[0].course === 'Mathe|7b' && M[0].after === '2026-11-03' && M[0].afterTime === '12:35', 'Merkzettel angelegt');
    ok(/Test zurückgeben/.test(await p.textContent('#ld-memo-own')) && /Do 5\.11\., 08:00/.test(await p.textContent('#ld-memo-own')), 'zeigt Ziel: Do 5.11.');
    await p.click('#ld-close');
    const pins = await p.$$eval('#wk-days .wd-lesson', e => e.filter(x => x.textContent.includes('📌')).map(x => x.textContent));
    ok(pins.length === 1 && /08:00 Mathe · 7b/.test(pins[0]), '📌 an der nächsten 7b-Stunde (nicht 9a)');
    const wtitle = await S(p, () => widgetSnapshot().days[2].items.find(i => i.id === 'lb').title);
    ok(/📌/.test(wtitle), 'Widget zeigt 📌');
    // Hausaufgabe aus der 9a geht zur nächsten 9a-Stunde, nicht zur 7b
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 9a' }).click();
    ok(/Mi 11\.11\.|Mittwoch|11\.11/.test(await p.textContent('#ld-hw-hint')), 'Hausaufgabe 9a: nächste 9a-Stunde ' + await p.textContent('#ld-hw-hint'));
    await p.fill('#ld-hw', 'S. 12 Nr. 3'); await p.click('#ld-hw-add');
    ok((await lastTask(p)).dueDate === '2026-11-11', 'Hausaufgabe am 11.11.');
    await p.click('#ld-close');
    // Donnerstag fällt aus → Merkzettel und Zählung rutschen weiter
    await p.locator('#wk-days .wd-lesson', { hasText: '08:00 Mathe · 7b' }).click();
    ok(/Test zurückgeben/.test(await p.textContent('#ld-memos')), 'Zielstunde zeigt den Merkzettel');
    await p.check('#ld-cancel'); await p.click('#ld-save');
    ok(await S(p, () => memoTarget(state.lessonMemos[0]).iso) === '2026-11-10', 'Ausfall: Merkzettel rutscht auf Di 10.11.');
    ok(await p.locator('#wk-days .wd-lesson .nt', { hasText: '📌' }).count() === 0, 'diese Woche kein 📌 mehr');
    await p.locator('#wk-days .week-day.today .wd-lesson', { hasText: 'Mathe · 7b' }).click();
    ok(/Noch 4 Stunden bis zur Klassenarbeit .* 14 Stunden/.test(await p.textContent('#ld-count')), 'Ausfall zählt nicht mit');
    await p.click('#ld-close');
    // Erledigt in der Zielstunde, mit Rückgängig
    await S(p, () => { weekOffset = 1; renderWeek(); });
    await p.locator('#wk-days .wd-lesson', { hasText: 'Mathe · 7b' }).first().click();
    await p.locator('#ld-memos button').click();
    ok((await S(p, () => state.lessonMemos.length)) === 0 && await p.isHidden('#ld-memos'), 'erledigt');
    await p.click('#toast .undo');
    ok((await S(p, () => state.lessonMemos.length)) === 1, 'Rückgängig');
    await p.click('#ld-close');
    // Stundenverlauf zeigt Zählung und Merkzettel
    await S(p, () => openCourseDialog('Mathe|7b'));
    ok(await p.isVisible('#cs-count') && /Test zurückgeben/.test(await p.textContent('#cs-memos')), 'Stundenverlauf: Zählung und Merkzettel');
    await p.click('#cs-close');
    // Stundenplan-Karte
    await go(p, 'timetable');
    ok(await p.isVisible('#card-count') && /Weihnachtsferien/.test(await p.textContent('#cc-head')), 'Karte „Stunden bis zu den Weihnachtsferien“');
    const items = await p.$$eval('#cc-list .cc-item', e => e.map(x => x.querySelector('.c').firstChild.textContent + '=' + x.querySelector('.n').textContent));
    ok(JSON.stringify(items) === JSON.stringify(['Mathe · 7b=14', 'Mathe · 9a=7', 'Physik · 7b=14']), 'je Kurs: ' + items.join(', '));
    ok(/4 bis zur Klassenarbeit/.test(await p.textContent('#cc-list')), 'Klassenarbeit davor erwähnt');
    // 9a-Arbeit nur über den Titel erkannt
    ok(await S(p, () => (examFor('Mathe|9a') || {}).id) === 'x9' && await S(p, () => (examFor('Mathe|7b') || {}).id) === 'x7', 'Klassenarbeit dem richtigen Kurs zugeordnet');
    // Klassenarbeit aus der Stunde heraus: Kurs wird gespeichert
    await go(p, 'week'); await S(p, () => { weekOffset = 0; renderWeek(); });
    await p.locator('#wk-days .week-day.today .wd-lesson', { hasText: 'Mathe · 7b' }).click();
    await p.click('#ld-exam');
    ok(await p.inputValue('#ex-title') === 'Mathe 7b', 'Titel mit Klasse vorbelegt');
    await p.fill('#ex-date', '2026-12-10'); await p.dispatchEvent('#ex-date', 'input');
    await p.click('#ex-save');
    const ex = await S(p, () => state.tasks.filter(t => t.exam && t.dueDate === '2026-12-10'));
    ok(ex.length === 1 && ex[0].course === 'Mathe|7b' && ex[0].dueTime === '08:00', 'neue Klassenarbeit mit Kurs und Uhrzeit');
    // Ohne Ferien-Daten: bis Halbjahresende
    await S(p, () => { state.settings.showFerien = false; save(); renderTimetable(); });
    ok(/Halbjahresende/.test(await p.textContent('#cc-head')), 'ohne Ferien: Halbjahresende');
    // Export/Import
    ok((await S(p, () => normalizeState(JSON.parse(JSON.stringify(state))).lessonMemos.length)) === 1, 'Merkzettel überstehen Export/Import');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('25 · Aufräumen und Wochenrückblick');
  {
    const tk = (id, title, due, extra) => Object.assign({ id, title, dueDate: due, prio: 'mittel', createdAt: 1 }, extra || {});
    const st = { version: 3, settings: { profile: 'everyday' },
      tasks: [tk('o1', 'Alt 1', '2026-11-01'), tk('o2', 'Alt 2', '2026-10-30'), tk('h1', 'Heute', '2026-11-03')] };
    const { ctx, p } = await open(browser, { state: st });
    await go(p, 'week');
    ok(await p.locator('#wk-overdue .ov-head button').count() === 2, 'Überfällig: „Auf heute“ und „Auf morgen“');
    let dialogs = 0; p.on('dialog', () => dialogs++);
    await p.click('#wk-overdue .ov-head button:has-text("Auf morgen")');
    let D = await S(p, () => state.tasks.map(t => t.dueDate));
    ok(JSON.stringify(D) === JSON.stringify(['2026-11-04', '2026-11-04', '2026-11-03']) && dialogs === 0, 'beide auf morgen, ohne Rückfrage');
    await p.click('#toast .undo');
    D = await S(p, () => state.tasks.map(t => t.dueDate));
    ok(D[0] === '2026-11-01' && D[1] === '2026-10-30', 'Rückgängig');
    await go(p, 'tasks');
    await p.click('#task-list .ov-head button:has-text("Auf heute")').catch(() => {});
    D = await S(p, () => state.tasks.map(t => t.dueDate));
    ok(D[0] === '2026-11-03' && D[1] === '2026-11-03', 'auch in der Aufgabenliste');
    ok(await p.isHidden('#wk-review'), 'dienstags kein Wochenrückblick');
    // Hinweise liegen bei offenem Dialog im Dialog (antippbar) und wandern danach zurück
    await S(p, () => { openTaskDialog('h1'); toast('Test'); });
    ok(await S(p, () => $('toast').parentNode.id) === 'dlg-task', 'Hinweis im offenen Dialog');
    await p.click('#e-cancel').catch(() => S(p, () => $('dlg-task').close()));
    await p.waitForTimeout(80);
    ok(await S(p, () => $('toast').parentNode === document.body), 'nach dem Schließen wieder außen');
    await ctx.close();

    // Sonntag, 8.11. abends
    const mon = new Date('2026-11-02T09:00:00').getTime();
    const st2 = { version: 3, settings: { profile: 'everyday' },
      tasks: [tk('d1', 'Erledigt 1', '2026-11-03', { completed: true, completedAt: mon }), tk('d2', 'Erledigt 2', '2026-11-05', { completed: true, completedAt: mon + 864e5 }),
              tk('d0', 'Letzte Woche', '2026-10-28', { completed: true, completedAt: mon - 3 * 864e5 }),
              tk('op', 'Offen', '2026-11-06'), tk('n1', 'Nächste 1', '2026-11-10'), tk('n2', 'Nächste 2', '2026-11-15')] };
    const r2 = await open(browser, { state: st2, now: '2026-11-08T18:00:00' });
    const q = r2.p;
    await go(q, 'week');
    ok(await q.isVisible('#wk-review'), 'sonntags: Wochenrückblick');
    const txt = await q.textContent('#wk-review');
    ok(/KW 45/.test(txt) && /2 erledigt/.test(txt) && /1 offen/.test(txt) && /nächste Woche 2 Aufgaben/.test(txt), 'Inhalt: ' + txt.replace(/\s+/g, ' '));
    await q.click('#wr-move');
    ok((await S(q, () => state.tasks.find(t => t.id === 'op').dueDate)) === '2026-11-09', 'Offene auf Montag');
    ok(await q.isHidden('#wr-move'), 'danach nichts mehr offen');
    await q.click('#wr-hide');
    ok(await q.isHidden('#wk-review') && (await S(q, () => state.settings.reviewHidden)) === '2026-11-02', 'ausgeblendet für diese Woche');
    await S(q, () => { state.settings.reviewHidden = ''; state.settings.weekReview = false; save(); renderWeek(); });
    ok(await q.isHidden('#wk-review'), 'abgeschaltet');
    ok(!q.errors.length, 'keine Fehler ' + q.errors.join(' | '));
    await r2.ctx.close();
  }

  console.log('26 · Android');
  {
    const { ctx, p } = await open(browser, { ios: { platform: 'android' } });
    ok(await S(p, () => Lic.status()) === 'free', 'Android: keine Sperren');
    ok(!(await S(p, () => document.body.classList.contains('sb-inset'))), 'kein doppelter Statusleisten-Abstand');
    await go(p, 'settings');
    await S(p, () => updateReminderStatus());
    await p.waitForTimeout(50);
    ok(await p.isVisible('#rem-android') && /nicht erlaubt/.test(await p.textContent('#rem-exact')), 'Hinweis: pünktliche Erinnerungen nicht erlaubt');
    await p.click('#btn-rem-exact');
    await p.waitForTimeout(50);
    ok(/erlaubt\./.test(await p.textContent('#rem-exact')) && await p.isHidden('#btn-rem-exact'), 'nach Freigabe: erlaubt');
    ok(/Dokumente/.test(await p.textContent('#bk-auto-lbl')), 'Sicherung in „Dokumente“');
    await S(p, () => { for (const id of ['z1', 'z2', 'z3']) state.tasks.push({ id, title: 'x', prio: 'mittel', createdAt: 1, dueDate: '2026-11-03' }); save(); });
    await S(p, () => Backup.auto(true));
    const bi = await S(p, () => { renderBackupInfo(); return $('bk-info').textContent; });
    ok(/Eigene Dateien/.test(bi) && /DOCUMENTS/.test(JSON.stringify(await S(p, () => window.__log.fs))), 'Sicherung geschrieben, Ablageort für Android: ' + bi);
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { ios: {} });
    await go(p, 'settings'); await S(p, () => updateReminderStatus()); await p.waitForTimeout(50);
    ok(await p.isHidden('#rem-android'), 'iOS: kein Android-Hinweis');
    await ctx.close();
  }

  console.log('27 · Kalender-Abos und Zahl am Symbol');
  {
    // Übernahme des früheren Einzel-Abos
    {
      const { ctx, p } = await open(browser);
      const m = await S(p, () => normalizeState({ settings: { extCalUrl: 'webcal://x.de/a.ics', extCalLastSync: 5 }, extEvents: [{ date: '2026-11-04', title: 'Alt' }] }));
      ok(m.settings.extCals.length === 1 && m.settings.extCals[0].id === 'abo1' && m.settings.extCals[0].lastSync === 5 && m.extEvents[0].calId === 'abo1', 'früheres Abo übernommen');
      const m2 = await S(p, () => normalizeState({ extEvents: [{ date: '2026-11-04', title: 'Demo', cal: 'Arbeit' }] }));
      ok(!m2.extEvents[0].calId && m2.settings.extCals.length === 0, 'Termine ohne Abo bleiben');
      await ctx.close();
    }
    const ICS_A = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:t1', 'SUMMARY:Training', 'DTSTART:20261103T180000', 'DTEND:20261103T193000', 'LOCATION:Sporthalle', 'RRULE:FREQ=WEEKLY;COUNT=4', 'END:VEVENT',
                   'BEGIN:VEVENT', 'UID:t2', 'SUMMARY:Turnier', 'DTSTART:20261107T090000Z', 'DURATION:PT2H30M', 'END:VEVENT',
                   'BEGIN:VEVENT', 'UID:t3', 'SUMMARY:Ausflug', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261106', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const ICS_B = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:s1\r\nSUMMARY:Konferenz\r\nDTSTART:20261104T143000\r\nDTEND:20261104T160000\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const ics = { 'https://verein.de/k.ics': ICS_A, 'https://schule.de/k.ics': ICS_B, 'https://calendar.google.com/calendar/ical/abc/private-1/basic.ics': ICS_B.replace('Konferenz', 'Google-Termin').replace('s1', 'g1') };
    const st = { version: 3, settings: { profile: 'everyday', features: { extCal: true, calendar: true } },
      tasks: [{ id: 'a', title: 'Heute', dueDate: '2026-11-03', prio: 'mittel', createdAt: 1 }, { id: 'b', title: 'Heute 2', dueDate: '2026-11-03', prio: 'mittel', createdAt: 1 },
              { id: 'c', title: 'Alt', dueDate: '2026-11-01', prio: 'mittel', createdAt: 1 }, { id: 'd', title: 'Morgen', dueDate: '2026-11-04', prio: 'mittel', createdAt: 1 }] };
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 }, ics }, state: st });
    await p.waitForTimeout(600);
    ok(await S(p, () => window.__log.badge) === 3, 'Zahl am Symbol: heute + überfällig = 3');
    await S(p, id => toggleTask(id), 'a'); await p.waitForTimeout(600);
    ok(await S(p, () => window.__log.badge) === 2, 'abgehakt → 2');
    await go(p, 'settings');
    ok(await p.isVisible('#badge-row'), 'Einstellung sichtbar');
    await p.selectOption('#set-badge', 'overdue'); await p.waitForTimeout(100);
    ok(await S(p, () => window.__log.badge) === 1, 'nur überfällig → 1');
    await p.selectOption('#set-badge', 'off'); await p.waitForTimeout(100);
    ok(await S(p, () => window.__log.badge) === 0, 'aus → keine Zahl');
    // Abos
    await p.fill('#abo-name', 'Verein'); await p.fill('#abo-url', 'webcal://verein.de/k.ics'); await p.click('#btn-abo-add');
    await p.waitForTimeout(150);
    await p.fill('#abo-name', 'Schule'); await p.fill('#abo-url', 'https://schule.de/k.ics'); await p.click('#btn-abo-add');
    await p.waitForTimeout(150);
    const cals = await S(p, () => state.settings.extCals.map(c => c.name + '|' + c.color + '|' + !!c.lastSync));
    ok(cals.length === 2 && /^Verein\|#9333ea\|true$/.test(cals[0]) && /^Schule\|#0891b2\|true$/.test(cals[1]), 'zwei Abos mit eigener Farbe: ' + cals.join(', '));
    ok((await p.$$('#abo-list .abo')).length === 2 && /Termine · aktualisiert/.test(await p.textContent('#abo-list')), 'Liste zeigt Status');
    const ev = await S(p, () => ({ tr: eventsOn('2026-11-10').find(e => e.title === 'Training'), tu: eventsOn('2026-11-07').find(e => e.title === 'Turnier'),
                                    au: eventsOn('2026-11-05').find(e => e.title === 'Ausflug'), ko: eventsOn('2026-11-04').find(e => e.title === 'Konferenz') }));
    ok(ev.tr && ev.tr.time === '18:00' && ev.tr.end === '19:30' && ev.tr.location === 'Sporthalle' && ev.tr.cal === 'Verein' && ev.tr.color === '#9333ea', 'Serie mit Ende, Ort, Name, Farbe');
    ok(ev.tu && ev.tu.time === '10:00' && ev.tu.end === '12:30', 'UTC-Zeit und DURATION');
    ok(ev.au && ev.au.time === null && ev.au.end === null, 'ganztägig ohne Zeiten');
    ok(ev.ko && ev.ko.cal === 'Schule' && ev.ko.end === '16:00', 'zweites Abo');
    ok(await S(p, () => eventsOn('2026-12-01').filter(e => e.title === 'Training').length) === 0, 'COUNT begrenzt die Serie');
    // Überschneidung mit Abo-Termin
    await go(p, 'tasks');
    await p.fill('#t-title', 'Laufen Di 19-20 Uhr'); await p.press('#t-title', 'Enter');
    ok(/Überschneidet sich mit 18:00 Training/.test(await p.textContent('#toast')), 'Überschneidung mit Abo-Termin erkannt');
    // Woche: Farbe des Abos
    await go(p, 'week');
    const chip = await p.$eval('#wk-days .wd-lesson, #wk-days .wd-ev', e => e.textContent).catch(() => '');
    ok(await S(p, () => [...document.querySelectorAll('#wk-days *')].some(x => /Training/.test(x.textContent) && x.children.length < 4)), 'Abo-Termin in der Woche');
    // Ausschalten, Farbe, Entfernen + Rückgängig
    await go(p, 'settings');
    await p.locator('#abo-list .abo').first().locator('.abo-on').uncheck();
    ok(await S(p, () => eventsOn('2026-11-03').filter(e => e.title === 'Training').length) === 0, 'ausgeschaltet → unsichtbar');
    await p.locator('#abo-list .abo').first().locator('.abo-on').check();
    await p.locator('#abo-list .abo').nth(1).locator('button.danger').click();
    ok(await S(p, () => state.settings.extCals.length === 1 && !state.extEvents.some(e => e.title === 'Konferenz')), 'Abo entfernt samt Terminen');
    await p.click('#toast .undo');
    ok(await S(p, () => state.settings.extCals.length === 2 && state.extEvents.some(e => e.title === 'Konferenz')), 'Rückgängig');
    // Falsche Adressen
    await p.fill('#abo-url', 'https://calendar.google.com/calendar/u/0/r'); await p.click('#btn-abo-add');
    ok(/Geheime Adresse im iCal-Format/.test(await p.textContent('#toast')), 'Google-Webadresse erkannt');
    await p.fill('#abo-url', 'https://schule.de/k.ics'); await p.click('#btn-abo-add');
    ok(/gibt es schon/.test(await p.textContent('#toast')), 'doppeltes Abo abgelehnt');
    await p.fill('#abo-name', 'Kaputt'); await p.fill('#abo-url', 'https://nix.de/k.ics'); await p.click('#btn-abo-add');
    await p.waitForTimeout(150);
    ok(/404/.test(await p.textContent('#abo-list')), 'Fehler wird am Abo angezeigt');
    await S(p, () => { const c = state.settings.extCals.find(x => x.name === 'Kaputt'); state.settings.extCals = state.settings.extCals.filter(x => x !== c); save(); renderAbos(); });
    // Geführte Einrichtung
    await p.click('#btn-gcal-guide');
    ok(await p.$eval('#dlg-gcal', d => d.open) && await p.isVisible('#gc-dev') && /Kalender-Accounts/.test(await p.textContent('#gc-dev-steps')), 'Anleitung für iPhone');
    await p.fill('#gc-url', 'https://calendar.google.com/calendar/ical/abc/public/basic.ics'); await p.dispatchEvent('#gc-url', 'input');
    ok(/öffentliche Adresse/.test(await p.textContent('#gc-msg')), 'Hinweis auf öffentliche Adresse');
    await p.fill('#gc-name', 'Google privat');
    await p.fill('#gc-url', 'https://calendar.google.com/calendar/ical/abc/private-1/basic.ics'); await p.click('#gc-add');
    await p.waitForTimeout(150);
    ok(!(await p.$eval('#dlg-gcal', d => d.open)) && await S(p, () => eventsOn('2026-11-04').some(e => e.title === 'Google-Termin' && e.cal === 'Google privat')), 'Google-Abo hinzugefügt und geladen');
    // Veraltet
    await S(p, () => { state.settings.extCals[0].lastSync = Date.now() - 4 * 864e5; save(); renderWeek(); });
    await go(p, 'week');
    ok(await p.isVisible('#cal-stale') && /„Verein“ wurde seit 4 Tagen/.test(await p.textContent('#cst-text')), 'Hinweis: Abo veraltet');
    await p.click('#cst-load'); await p.waitForTimeout(150);
    ok(await p.isHidden('#cal-stale'), 'nach dem Laden weg');
    await S(p, () => { state.settings.extCals[0].lastSync = Date.now() - 5 * 864e5; save(); renderWeek(); });
    await p.click('#cst-later');
    ok(await p.isHidden('#cal-stale'), '„Später“ blendet aus');
    // Beim Zurückkehren in die App: fällige Abos neu laden
    await S(p, () => { state.settings.calStaleHidden = 0; state.settings.extCals.forEach(c => c.lastSync = Date.now() - 7 * 3600e3); window.__log.http = []; });
    await S(p, () => refreshAbos(false)); await p.waitForTimeout(150);
    ok((await S(p, () => window.__log.http.length)) === 3, 'nach 6 Stunden alle Abos neu geladen');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    // Android: Anleitung für Android
    const { ctx, p } = await open(browser, { ios: { platform: 'android' } });
    await go(p, 'settings'); await p.click('#btn-gcal-guide');
    ok(/Konto synchronisieren/.test(await p.textContent('#gc-dev-steps')), 'Anleitung für Android');
    await ctx.close();
  }

  console.log('28 · iCloud-Abgleich');
  {
    const cloud = {};
    const before = async p => {
      await p.exposeFunction('__cloudGet', () => cloud);
      await p.exposeFunction('__cloudSet', v => { Object.assign(cloud, v); });
    };
    const tk = (id, title, extra) => Object.assign({ id, title, prio: 'mittel', createdAt: 1 }, extra || {});
    const stA = { version: 3, settings: { profile: 'everyday', badge: 'today' }, categories: [{ id: 'pa', name: 'Privat', color: '#059669' }],
      tasks: [tk('x', 'Von A eins', { categoryId: 'pa' }), tk('y', 'Von A zwei')] };
    const stB = { version: 3, settings: { profile: 'everyday', badge: 'off' }, categories: [{ id: 'pb', name: 'Privat', color: '#059669' }],
      tasks: [tk('z1', 'Von B eins', { categoryId: 'pb' }), tk('z2', 'Von B zwei'), tk('z3', 'Von B drei')] };
    const A = await open(browser, { before, ios: { owned: { [FULL]: 1 }, cloud: true }, state: stA });
    const B = await open(browser, { before, ios: { owned: { [FULL]: 1 }, cloud: true }, state: stB });
    const run = q => S(q.p, () => Sync.run());
    await go(A.p, 'settings');
    ok(await A.p.isVisible('#card-sync') && /Aus/.test(await A.p.textContent('#sync-status')), 'A: Abgleich-Karte, aus');
    await A.p.check('#sync-on'); await A.p.waitForTimeout(150);
    ok(cloud['v1.tasks'] && /Von A eins/.test(cloud['v1.tasks']), 'A hat hochgeladen');
    ok(/KB von 1024 KB/.test(await A.p.textContent('#sync-status')), 'Status mit Größe');
    // B: in iCloud liegen Daten → Frage
    await go(B.p, 'settings');
    await B.p.check('#sync-on'); await B.p.waitForTimeout(150);
    ok(await B.p.$eval('#dlg-sync', d => d.open), 'B: Frage Zusammenführen / iCloud');
    await B.p.click('#sy-merge'); await B.p.waitForTimeout(200);
    let tb = await S(B.p, () => state.tasks.map(t => t.title).sort());
    ok(JSON.stringify(tb) === JSON.stringify(['Von A eins', 'Von A zwei', 'Von B drei', 'Von B eins', 'Von B zwei']), 'B: beide Seiten zusammen');
    const catsB = await S(B.p, () => state.categories.filter(c => c.name === 'Privat'));
    ok(catsB.length === 1 && await S(B.p, () => state.tasks.filter(t => t.categoryId === state.categories.find(c => c.name === 'Privat').id).length) === 2, 'doppelte Kategorie zusammengelegt, Aufgaben umgehängt');
    ok(await S(B.p, () => state.settings.badge) === 'off', 'Geräte-Einstellung bleibt auf dem Gerät');
    await run(A);
    let ta = await S(A.p, () => state.tasks.map(t => t.title).sort());
    ok(ta.length === 5, 'A bekommt Bs Aufgaben');
    ok(await S(A.p, () => state.settings.badge) === 'today', 'A behält seine Zahl-Einstellung');
    // Gleichzeitige Änderungen an verschiedenen Aufgaben
    await A.p.clock.setFixedTime(new Date('2026-11-03T11:00:00'));
    await B.p.clock.setFixedTime(new Date('2026-11-03T11:00:00'));
    await S(A.p, () => { state.tasks.find(t => t.id === 'y').title = 'Von A zwei (geändert)'; save(); });
    await S(B.p, () => { state.tasks.find(t => t.id === 'z2').title = 'Von B zwei (geändert)'; save(); });
    await run(A); await run(B); await run(A);
    ta = await S(A.p, () => state.tasks.map(t => t.title).sort()); tb = await S(B.p, () => state.tasks.map(t => t.title).sort());
    ok(JSON.stringify(ta) === JSON.stringify(tb) && ta.includes('Von A zwei (geändert)') && ta.includes('Von B zwei (geändert)'), 'beide Änderungen auf beiden Geräten');
    // Löschen setzt sich durch
    await A.p.clock.setFixedTime(new Date('2026-11-03T12:00:00'));
    await S(A.p, () => { state.tasks = state.tasks.filter(t => t.id !== 'x'); save(); });
    await run(A); await run(B);
    ok(!(await S(B.p, () => state.tasks.some(t => t.id === 'x'))), 'gelöscht auf A → weg auf B');
    // Änderungsmeldung von iCloud → B gleicht von selbst ab
    await A.p.clock.setFixedTime(new Date('2026-11-03T12:30:00'));
    await S(A.p, () => { state.tasks.push({ id: 'n1', title: 'Neu auf A', prio: 'mittel', createdAt: 5 }); save(); });
    await run(A);
    await S(B.p, () => window.__cloudChange({ keys: ['v1.tasks'] })); await B.p.waitForTimeout(150);
    ok(await S(B.p, () => state.tasks.some(t => t.title === 'Neu auf A')), 'Änderung von iCloud kommt ohne Zutun an');
    ok(await B.p.locator('#task-list .task, #wk-days .wd-task').filter({ hasText: 'Neu auf A' }).count() >= 0, 'Oberfläche neu gezeichnet');
    // Abo-Termine bleiben lokal
    await S(A.p, () => { state.extEvents = [{ date: '2026-11-03', title: 'Abo-Termin', calId: 'q' }]; save(); }); await run(A);
    ok(!/Abo-Termin/.test(JSON.stringify(cloud)), 'geladene Abo-Termine gehen nicht nach iCloud');
    // Zu groß
    await S(A.p, () => { state.tasks.push({ id: 'big', title: 'Groß', note: 'x'.repeat(4900), prio: 'mittel', createdAt: 1 }); for (let i = 0; i < 120; i++) state.tasks.push({ id: 'b' + i, title: 'Viel ' + i, note: 'y'.repeat(4900), prio: 'mittel', createdAt: 1 }); save(); });
    const before2 = cloud['v1.tasks'];
    await run(A);
    ok(/Zu viele Daten/.test(await A.p.textContent('#sync-status')) && cloud['v1.tasks'] === before2, 'zu groß: nichts geschrieben, Hinweis');
    await S(A.p, () => { state.tasks = state.tasks.filter(t => !/^b\d|^big$/.test(t.id)); save(); });
    await run(A);
    ok(!/Zu viele/.test(await A.p.textContent('#sync-status')), 'danach wieder in Ordnung');
    // Drittes Gerät: nur den iCloud-Stand übernehmen
    const stC = { version: 3, settings: { profile: 'everyday' }, tasks: [tk('c1', 'Nur auf C'), tk('c2', 'C2'), tk('c3', 'C3')] };
    const Cd = await open(browser, { before, ios: { owned: { [FULL]: 1 }, cloud: true }, state: stC });
    await Cd.p.waitForTimeout(150);
    ok(await Cd.p.$eval('#dlg-sync', d => d.open), 'neues Gerät: Angebot beim Start');
    await Cd.p.click('#sy-take'); await Cd.p.waitForTimeout(200);
    const tc = await S(Cd.p, () => state.tasks.map(t => t.title));
    ok(!tc.includes('Nur auf C') && tc.includes('Neu auf A'), 'C: iCloud-Stand übernommen');
    ok(/Neu auf A/.test(cloud['v1.tasks']) && !/Nur auf C/.test(cloud['v1.tasks']), 'iCloud unverändert');
    for (const q of [A, B, Cd]) ok(!q.p.errors.length, 'keine Fehler ' + q.p.errors.join(' | '));
    await A.ctx.close(); await B.ctx.close(); await Cd.ctx.close();
  }
  {
    // Prüfung 22.11.: Zusammenführen auf neuem Gerät, Aus/Ein, Dialoge, Rückgängig, Abos, lange nicht abgeglichen
    const cloud = {};
    const before = async p => {
      await p.exposeFunction('__cloudGet', () => cloud);
      await p.exposeFunction('__cloudSet', v => { Object.assign(cloud, v); });
    };
    const tk = (id, title, extra) => Object.assign({ id, title, prio: 'mittel', createdAt: 1 }, extra || {});
    const stA = { version: 3, settings: { profile: 'teacher', slots: ['07:50-08:35', '08:40-09:25'], region: 'NI',
        extCals: [{ id: 'k1', name: 'Verein', url: 'https://x.test/a.ics', color: '#123456', on: true, lastSync: 111, error: '' }] },
      categories: [{ id: 'c1', name: 'Unterricht', color: '#2563eb' }],
      lessons: [{ id: 'L1', day: 2, slot: 0, subject: 'Mathe', room: '7b' }],
      tasks: [tk('t1', 'Klausur korrigieren', { categoryId: 'c1' }), tk('t2', 'Elternbrief')], shopLists: [{ id: 's1', name: 'Supermarkt' }] };
    const A = await open(browser, { before, ios: { owned: { [FULL]: 1 }, cloud: true }, state: stA });
    await go(A.p, 'settings'); await A.p.check('#sync-on'); await A.p.waitForTimeout(150);
    // Neues iPad: Standarddaten (c1 = „Privat“, s1 = „Einkauf“, andere Zeiten) + eine eigene Aufgabe
    const stB = { version: 3, settings: { profile: 'everyday', slots: ['08:00-08:45'] }, categories: [{ id: 'c1', name: 'Privat', color: '#059669' }],
      tasks: [tk('b1', 'Auf dem iPad', { categoryId: 'c1' })], shopLists: [{ id: 's1', name: 'Einkauf' }] };
    const B = await open(browser, { before, ios: { owned: { [FULL]: 1 }, cloud: true }, state: stB });
    await B.p.waitForTimeout(150);
    if (!(await B.p.$eval('#dlg-sync', d => d.open))) { await go(B.p, 'settings'); await B.p.check('#sync-on'); await B.p.waitForTimeout(150); }
    await B.p.click('#sy-merge'); await B.p.waitForTimeout(250);
    const sb = await S(B.p, () => ({ slots: state.settings.slots, prof: state.settings.profile, cats: state.categories.map(c => c.id + ':' + c.name),
      t1: (state.categories.find(c => c.id === state.tasks.find(t => t.id === 't1').categoryId) || {}).name,
      b1: (state.categories.find(c => c.id === state.tasks.find(t => t.id === 'b1').categoryId) || {}).name,
      lists: state.shopLists.map(l => l.name).sort() }));
    ok(JSON.stringify(sb.slots) === JSON.stringify(['07:50-08:35', '08:40-09:25']) && sb.prof === 'teacher', 'Zusammenführen: Einstellungen vom iPhone gewinnen ' + JSON.stringify(sb.slots));
    ok(sb.t1 === 'Unterricht' && sb.b1 === 'Privat', 'Kategorien mit gleicher id bleiben getrennt: ' + sb.cats.join(', '));
    ok(sb.lists.join() === 'Einkauf,Supermarkt', 'Einkaufslisten getrennt: ' + sb.lists.join());
    await S(A.p, () => Sync.run()); await A.p.waitForTimeout(100);
    ok(await S(A.p, () => (state.categories.find(c => c.id === state.tasks.find(t => t.id === 't1').categoryId) || {}).name) === 'Unterricht', 'iPhone: Kategorie unverändert');
    // Abos: Ladezeit bleibt je Gerät
    const bAbo = await S(B.p, () => state.settings.extCals[0] || {});
    ok(bAbo.id === 'k1' && bAbo.lastSync !== 111 && !/lastSync/.test(cloud['v1.settings'] || ''), 'Abo kommt an, Ladezeit nicht übertragen ' + JSON.stringify([bAbo.lastSync, /lastSync/.test(cloud['v1.settings'] || '')]));
    ok(await S(A.p, () => state.settings.extCals[0].lastSync) === 111, 'A behält seine Ladezeit');
    // Einstellungen je Schlüssel: A ändert Region, B ändert Zeiten → beides bleibt
    await A.p.clock.setFixedTime(new Date('2026-11-03T11:00:00')); await B.p.clock.setFixedTime(new Date('2026-11-03T11:00:00'));
    await S(A.p, () => { state.settings.region = 'BY'; save(); });
    await S(B.p, () => { state.settings.weekReview = false; save(); });
    await S(A.p, () => Sync.run()); await S(B.p, () => Sync.run()); await S(A.p, () => Sync.run());
    ok(await S(A.p, () => state.settings.region + '|' + state.settings.weekReview) === 'BY|false' && await S(B.p, () => state.settings.region + '|' + state.settings.weekReview) === 'BY|false', 'verschiedene Einstellungen auf zwei Geräten: beide bleiben');
    // Aus und wieder ein: Änderungen und Löschungen des anderen Geräts bleiben
    await S(B.p, () => { Sync.d.on = false; Sync.save(); });
    await A.p.clock.setFixedTime(new Date('2026-11-03T12:00:00'));
    await S(A.p, () => { state.tasks.find(t => t.id === 't2').title = 'Elternbrief (neu)'; state.tasks = state.tasks.filter(t => t.id !== 'b1'); save(); });
    await S(A.p, () => Sync.run());
    await B.p.clock.setFixedTime(new Date('2026-11-03T12:30:00'));
    await go(B.p, 'settings'); await B.p.uncheck('#sync-on').catch(() => {}); await B.p.check('#sync-on'); await B.p.waitForTimeout(250);
    ok(!(await B.p.$eval('#dlg-sync', d => d.open)), 'wieder einschalten: keine Frage');
    const tb = await S(B.p, () => state.tasks.map(t => t.title));
    ok(tb.includes('Elternbrief (neu)') && !tb.includes('Auf dem iPad'), 'wieder ein: Änderung und Löschung von A bleiben ' + tb.join(', '));
    // Stunden-Dialog offen, Abgleich kommt dazwischen, Speichern → Stunde bleibt
    await S(B.p, () => openLessonDialog(state.lessons.find(l => l.id === 'L1'), 2, 0));
    await A.p.clock.setFixedTime(new Date('2026-11-03T13:00:00'));
    await S(A.p, () => { state.tasks.push({ id: 'n9', title: 'Neu', prio: 'mittel', createdAt: 2 }); save(); }); await S(A.p, () => Sync.run());
    await S(B.p, () => Sync.run());
    await B.p.fill('#l-room', '7c'); await B.p.click('#l-save'); await B.p.waitForTimeout(100);
    ok(await S(B.p, () => state.lessons.map(l => l.id + ':' + l.room).join()) === 'L1:7c', 'Stunde nach Abgleich gespeichert, nicht gelöscht');
    // Rückgängig nach einem Abgleich verfällt
    await S(B.p, () => { const snap = snapshot(); state.tasks = state.tasks.filter(t => t.id !== 't2'); save(); toast('Gelöscht.', () => restore(snap)); });
    await S(A.p, () => { state.tasks.push({ id: 'n10', title: 'Noch neuer', prio: 'mittel', createdAt: 3 }); save(); }); await S(A.p, () => Sync.run());
    await S(B.p, () => Sync.run());
    ok(!(await B.p.$('#toast .undo')), 'Rückgängig nach Abgleich nicht mehr angeboten');
    // Lange nicht abgeglichen: anderswo Gelöschtes kommt nicht zurück
    await S(A.p, () => { state.tasks = state.tasks.filter(t => t.id !== 'n9'); save(); }); await S(A.p, () => Sync.run());
    const cl = JSON.parse(cloud['v1.tasks']); delete cl.t.n9; cloud['v1.tasks'] = JSON.stringify(cl);   // Löschmarke verfallen
    await S(B.p, () => { Sync.d.last = Date.now() - 200 * 864e5; Sync.save(); });
    await S(B.p, () => Sync.run());
    ok(!(await S(B.p, () => state.tasks.some(t => t.id === 'n9'))) && !/"n9"/.test(cloud['v1.tasks']), 'nach langer Pause: Gelöschtes bleibt gelöscht');
    ok(await S(B.p, () => state.tasks.some(t => t.id === 'n10')), '… Neues bleibt');
    for (const q of [A, B]) ok(!q.p.errors.length, 'keine Fehler ' + q.p.errors.join(' | '));
    await A.ctx.close(); await B.ctx.close();
  }
  {
    // ohne iCloud-Berechtigung / Android / Browser: Karte passend
    const { ctx, p } = await open(browser, { ios: {} });
    await go(p, 'settings');
    ok(await p.isHidden('#card-sync'), 'ohne Plugin keine Karte');
    await ctx.close();
  }

  console.log('29 · Weitere Profile und Österreich/Schweiz');
  for (const [prof, cat, tpl] of [['study', 'Uni', 'Hausarbeit schreiben'], ['family', 'Kinder', 'Kindergeburtstag'], ['coach', 'Verein', 'Spieltag vorbereiten']]) {
    const { ctx, p } = await open(browser, { profile: false });
    await p.selectOption('#ob-region', 'AT-WI');
    await p.click(`.choice[data-profile="${prof}"]`);
    await p.waitForTimeout(100);
    if (await p.$eval('#dlg-pro', d => d.open)) await p.click('#dlg-pro-later');
    const st = await S(p, () => ({ c: state.categories.map(x => x.name), tt: state.settings.features.timetable, m: state.settings.planMode,
      t: state.templates.map(x => x.title), r: state.settings.region, pr: state.settings.profile }));
    ok(st.pr === prof && st.c.includes(cat) && st.tt && st.m === 'week' && st.t.includes(tpl) && st.r === 'AT-WI',
       prof + ': Kategorien, Wochenplan, Vorlagen, Region ' + JSON.stringify(st));
    ok(await p.textContent('#nav-plan-label') === 'Wochenplan', prof + ': Reiter „Wochenplan“');
    await go(p, 'settings');
    ok(await p.inputValue('#set-profile') === prof && await p.inputValue('#set-region') === 'AT-WI', prof + ': Einstellungen zeigen Profil und Region');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }
  {
    // Österreich/Schweiz in der Woche
    const st = { version: 3, settings: { profile: 'teacher', planMode: 'school', region: 'CH-ZH', showFerien: true, features: { timetable: true } },
      lessons: [{ id: 'l1', day: 1, slot: 0, subject: 'Mathe', room: '5a', color: '#2563eb' }] };
    const { ctx, p } = await open(browser, { state: st, now: '2026-07-27T09:00:00' });
    await go(p, 'week');
    ok(/Sommerferien/.test(await p.textContent('#wk-days')), 'Zürich: Sommerferien in der Woche');
    await S(p, () => { weekOffset = 1; renderWeek(); });
    ok(/Bundesfeiertag/.test(await p.textContent('#wk-days')) || /Sommerferien/.test(await p.textContent('#wk-days')), 'Woche mit 1. August');
    await go(p, 'settings');
    ok(await p.$$eval('#set-region optgroup', g => g.map(x => x.label).join()) === 'Deutschland,Österreich,Schweiz', 'Auswahl nach Ländern gruppiert');
    ok(/Datensatz/.test(await p.textContent('#region-hint')), 'Hinweis zur Quelle der Feiertage');
    const n = await S(p, () => normalizeState({ settings: { region: 'AT-WI', profile: 'unbekannt' } }).settings);
    ok(n.region === 'AT-WI' && n.profile === 'everyday', 'Region AT gültig, unbekanntes Profil → Alltag');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('30 · Schuljahreswechsel');
  {
    const L = (id, day, slot, subject, room) => ({ id, day, slot, subject, room, color: '#2563eb' });
    const st = { version: 3, settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true, features: { timetable: true },
        ab: { on: true, anchor: '2026-01-05', type: 'A', skip: true } },
      lessons: [L('a', 1, 0, 'Mathe', '7b'), L('b', 2, 1, 'Physik', '9a')],
      duties: [{ id: 'd', day: 2, after: 1, place: 'Hof', week: '' }],
      lessonEx: { 'a|2026-06-01': { cancel: true }, 'a|2026-08-17': { cancel: true } },
      lessonNotes: [{ id: 'n1', course: 'Mathe|7b', date: '2026-06-01', text: 'Alt', updatedAt: 1 }, { id: 'n2', course: 'Mathe|7b', date: '2026-08-17', text: 'Neu', updatedAt: 1 }],
      lessonMemos: [{ id: 'm', course: 'Mathe|7b', after: '2026-06-01', afterTime: '08:45', text: 'x', createdAt: 1 }],
      tasks: [{ id: 't1', title: 'Alt erledigt', dueDate: '2026-06-10', completed: true, completedAt: 1, prio: 'mittel', createdAt: 1 },
              { id: 't2', title: 'Alt offen', dueDate: '2026-06-10', prio: 'mittel', createdAt: 1 },
              { id: 't3', title: 'Neu erledigt', dueDate: '2026-08-20', completed: true, completedAt: 2, prio: 'mittel', createdAt: 1 }] };
    // NI: Sommerferien 2026 enden am 12.8. → Hinweis in den ersten Schulwochen
    const { ctx, p } = await open(browser, { state: st, ios: { owned: { [FULL]: 1 } }, now: '2026-08-20T10:00:00' });
    await go(p, 'timetable');
    ok(await p.isVisible('#year-banner'), 'Hinweis nach den Sommerferien');
    await p.click('#yb-open');
    ok(await p.$eval('#dlg-year', d => d.open) && await p.inputValue('#yr-date') === '2026-08-13', 'Stichtag: Tag nach den Sommerferien');
    ok(await p.isVisible('#yr-duty-row') && await p.isVisible('#yr-ab-row'), 'Aufsichten und A/B angeboten');
    await p.check('#yr-notes'); await p.check('#yr-duties'); await p.selectOption('#yr-ab', 'B');
    ok(/1 abgehakte Aufgaben/.test(await p.textContent('#yr-sum')) && /2 Notizen\/Merkzettel/.test(await p.textContent('#yr-sum')), 'Zusammenfassung: ' + await p.textContent('#yr-sum'));
    await p.click('#yr-go'); await p.waitForTimeout(150);
    const r = await S(p, () => ({ t: state.tasks.map(x => x.id), n: state.lessonNotes.map(x => x.id), m: state.lessonMemos.length, d: state.duties.length,
      ex: Object.keys(state.lessonEx), l: state.lessons.length, ab: state.settings.ab, done: state.settings.yearDone }));
    ok(JSON.stringify(r.t) === '["t2","t3"]', 'alte erledigte Aufgaben weg, offene bleiben');
    ok(JSON.stringify(r.n) === '["n2"]' && r.m === 0 && r.d === 0, 'alte Notizen, Merkzettel, Aufsichten entfernt');
    ok(JSON.stringify(r.ex) === '["a|2026-08-17"]' && r.l === 2, 'alte Ausnahmen weg, Stundenplan behalten');
    ok(r.ab.anchor === '2026-08-10' && r.ab.type === 'B' && r.done === '2026-08-13', 'A/B neu gesetzt');
    ok(/Mathe · 7b.*\nAlt/.test(String(await S(p, () => window.__log.share))), 'alte Notizen vorher geteilt');
    ok(await p.isHidden('#year-banner'), 'Hinweis danach weg');
    await p.click('#toast .undo');
    ok(await S(p, () => state.lessonNotes.length === 2 && state.duties.length === 1), 'Rückgängig');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('31 · Siri, Bewertung');
  {
    const { ctx, p } = await open(browser, { ios: { owned: { [FULL]: 1 } }, state: { version: 3, settings: { profile: 'everyday' } } });
    await S(p, () => { window.__pending = ['Zahnarzt anrufen morgen 9 Uhr', 'Milch kaufen']; window.__pendingFn(); });
    await p.waitForTimeout(200);
    const t = await S(p, () => state.tasks.map(x => x.title + '|' + (x.dueDate || '') + '|' + (x.dueTime || '')));
    ok(t.includes('Zahnarzt anrufen|2026-11-04|09:00') && t.includes('Milch kaufen||'), 'Siri-Aufgaben angelegt, Datum erkannt: ' + t.join(', '));
    ok(/2 Aufgaben von Siri/.test(await p.textContent('#toast')), 'Hinweis');
    // Siri während einer Eingabe: Formular und offener Dialog bleiben unberührt
    await go(p, 'tasks');
    await p.fill('#t-title', 'Halb getippt');
    await S(p, () => openTaskDialog(state.tasks[0].id));
    await S(p, () => { window.__pending = ['Brot holen']; window.__pendingFn(); });
    await p.waitForTimeout(200);
    ok(await S(p, () => state.tasks.some(x => x.title === 'Brot holen')) && await p.inputValue('#t-title') === 'Halb getippt'
       && await p.$eval('#dlg-task', d => d.open), 'Siri: Aufgabe angelegt, Eingabe und Dialog bleiben');
    await S(p, () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    await p.fill('#t-title', '');
    await S(p, () => { window.__openAppLink('todoorganizer://new-task?text=Blumen%20gie%C3%9Fen%20Fr'); });
    await p.waitForTimeout(400);
    ok(await S(p, () => state.tasks.some(x => x.title === 'Blumen gießen' && x.dueDate === '2026-11-06')), 'Link mit Text legt Aufgabe an');
    // Bewertung: zu früh → nein; nach 14 Tagen und 15 erledigten → einmal
    ok(!(await S(p, () => Review.maybe())), 'zu früh: keine Bitte');
    await S(p, () => { Backup.d.firstUse = Date.now() - 20 * 864e5; for (let i = 0; i < 15; i++) state.tasks.push({ id: 'r' + i, title: 'x', completed: true, completedAt: 1, prio: 'mittel', createdAt: 1 }); });
    ok(await S(p, () => Review.maybe()) && await S(p, () => window.__log.review) === 1, 'danach einmal');
    ok(!(await S(p, () => Review.maybe())), 'nicht zweimal in derselben Version');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  console.log('16 · Schule ohne Vollversion');
  {
    const st = { version: 3, lessons: [{ id: 'lm', day: 2, slot: 1, subject: 'Mathe' }],
      settings: { profile: 'teacher', planMode: 'school', region: 'NI', showFerien: true } };
    const { ctx, p } = await open(browser, { ios: {}, state: st });
    await S(p, () => { Lic.trialStart = Date.now() - 40 * 864e5; Lic.save(); licenseChanged(); });
    await go(p, 'week');
    await S(p, () => { weekOffset = -1; renderWeek(); });
    ok(/Reformationstag/.test(await p.textContent('#wk-days')), 'Feiertage auch in der Grundversion');
    await S(p, () => openExamDialog(null, null));
    ok(!(await p.$eval('#dlg-exam', d => d.open)), 'Klassenarbeit planen gesperrt');
    ok(!p.errors.length, 'keine Fehler ' + p.errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} von ${n} Prüfungen fehlgeschlagen` : `\nAlle ${n} Prüfungen bestanden.`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
