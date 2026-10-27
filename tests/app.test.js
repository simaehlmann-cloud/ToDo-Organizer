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

/* ---- Nachbildungen der iOS-Plugins ---- */
function iosMocks(o) {
  o = o || {};
  window.__log = { notif: [], cal: [], sb: [], widget: [] };
  const own = Object.assign({}, o.owned || {});
  const handlers = { approved: [], finished: [], productUpdated: [], receiptUpdated: [] };
  const products = {};
  const fire = (ev, x) => handlers[ev].forEach(f => f(x));
  const tx = (id, date) => ({ products: [{ id }], purchaseDate: new Date(date), finish() { fire('finished', this); } });
  const chain = {};
  for (const k of Object.keys(handlers)) chain[k] = f => { handlers[k].push(f); return chain; };
  const P = {
    LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
      getPending: async () => ({ notifications: [] }), cancel: async () => {},
      schedule: async x => { window.__log.notif = x.notifications; }, registerActionTypes: async () => {}, addListener: () => {}
    },
    StatusBar: { setStyle: async x => { window.__log.sb.push(x.style); } },
    WidgetData: { set: async x => { window.__log.widget.push(x.json); }, status: async () => ({ group: true, bytes: (window.__log.widget.slice(-1)[0] || '').length }) },
    Share: { share: async x => { window.__log.share = x.text; } },
    App: { addListener: () => {} },
    CapacitorCalendar: {
      checkPermission: async () => ({ result: o.calGranted ? 'granted' : 'prompt' }),
      requestFullCalendarAccess: async () => ({ result: 'granted' }),
      listCalendars: async () => ({ result: [{ id: 'k1', title: 'Privat (iCloud)', color: '#ff2d55' }, { id: 'k2', title: 'Arbeit', color: '#34c759' }] }),
      listEventsInRange: async r => {
        window.__log.cal.push(['list', r.from, r.to]);
        const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
        return { result: [
          { id: 'e1', title: 'Elternabend', calendarId: 'k1', startDate: at(4, 19, 0), endDate: at(4, 20, 30), isAllDay: false },
          { id: 'e2', title: 'Messe', calendarId: 'k2', startDate: at(5, 0, 0), endDate: at(7, 0, 0), isAllDay: true },
          { id: 'e3', title: 'Team-Meeting', calendarId: 'k2', startDate: at(3, 14, 0), endDate: at(3, 15, 0), isAllDay: false }
        ] };
      },
      createEvent: async x => { window.__log.cal.push(['create', x.title, x.isAllDay, x.startDate]); return { id: 'new1' }; }
    }
  };
  window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true, Plugins: P };
  window.CdvPurchase = {
    ProductType: { NON_CONSUMABLE: 'nc' }, Platform: { APPLE_APPSTORE: 'ios-appstore' }, ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    store: {
      register(l) { l.forEach(p => products[p.id] = { id: p.id, get owned() { return p.id in own; }, pricing: { price: p.id.endsWith('testphase') ? 'Gratis' : '2,99 €' },
        getOffer() { return { order: async () => { own[p.id] = Date.now(); fire('approved', tx(p.id, own[p.id])); } }; } }); },
      when() { return chain; }, error() {},
      async initialize() { for (const id of Object.keys(own)) fire('approved', tx(id, own[id])); },
      get(id) { return products[id]; }, async restorePurchases() {}
    }
  };
}

async function open(browser, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.wide ? { width: 1100, height: 900 } : { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('dialog', d => d.accept(p.nextPrompt != null ? p.nextPrompt : undefined));
  await p.clock.setFixedTime(new Date(NOW));
  if (opt.state) await p.addInitScript(s => localStorage.setItem('studiez-pro-v2', JSON.stringify(s)), opt.state);
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
