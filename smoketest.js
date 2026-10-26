/* Ablauftest für Testphase, Vollversion und Sperren (2.4).
   Simuliert die iOS-App: window.Capacitor meldet "ios", ein Schein-Store
   ersetzt StoreKit. Aufruf: node smoketest.js [index.html] */
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const FILE = 'file://' + path.resolve(process.argv[2] || 'index.html');
const FULL = 'de.maehlmann.todoorganizer.vollversion';
const TRIAL = 'de.maehlmann.todoorganizer.testphase';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

/* Schein-Store mit der Schnittstelle von capacitor-plugin-cdv-purchase.
   owned: Produkt-IDs mit Kaufdatum (ms), die beim Start „approved“ melden. */
function mockStore(owned) {
  window.__orders = [];
  const handlers = { approved: [], finished: [], productUpdated: [], receiptUpdated: [] };
  const products = {};
  const own = Object.assign({}, owned);
  const fire = (ev, x) => handlers[ev].forEach(f => f(x));
  const tx = (id, date) => ({ products: [{ id }], purchaseDate: new Date(date),
    finish() { fire('finished', this); } });
  const product = id => ({
    id, get owned() { return id in own; },
    pricing: { price: '2,99 €' },
    getOffer() { return { order: async () => {
      window.__orders.push(id);
      own[id] = Date.now();
      fire('approved', tx(id, own[id]));
    } }; }
  });
  const chain = {};
  for (const k of Object.keys(handlers)) chain[k] = f => { handlers[k].push(f); return chain; };
  window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true, Plugins: {} };
  window.CdvPurchase = {
    ProductType: { NON_CONSUMABLE: 'non consumable' },
    Platform: { APPLE_APPSTORE: 'ios-appstore' },
    ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    store: {
      register(list) { list.forEach(p => products[p.id] = product(p.id)); },
      when() { return chain; },
      error() {},
      async initialize() {
        for (const id of Object.keys(own)) fire('approved', tx(id, own[id]));
      },
      get(id) { return products[id]; },
      async restorePurchases() { for (const id of Object.keys(own)) fire('approved', tx(id, own[id])); }
    }
  };
}

async function page(browser, setup, arg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  ✗ Seitenfehler: ' + e.message); fails++; });
  if (setup) await p.addInitScript(setup, arg);
  await p.goto(FILE);
  await p.waitForTimeout(300);
  return p;
}
const navLocked = (p, v) => p.$eval(`.nav-btn[data-view="${v}"]`, b => b.classList.contains('locked'));
const active = p => p.$eval('.view.active', v => v.id);

(async () => {
  const browser = await chromium.launch();
  const DAY = 86400000;

  console.log('Browser (PWA): keine Sperre, kein Kaufbereich');
  {
    const p = await page(browser);
    ok(!(await navLocked(p, 'calendar')), 'Kalender frei');
    ok(await p.$eval('#card-pro', c => c.hidden), 'Kaufbereich verborgen');
    ok(!(await p.$eval('#dlg-pro', d => d.open)), 'keine Begrüßung');
    await p.click('.nav-btn[data-view="shopping"]');
    ok((await active(p)) === 'view-shopping', 'Einkaufsliste öffnet');
    // Fehlerkorrekturen aus dem Video-Chat
    await p.click('.nav-btn[data-view="tasks"]');
    ok(!(await p.isVisible('#t-category')), '„Mehr“-Felder anfangs zu');
    await p.click('#btn-more');
    ok(await p.isVisible('#t-category'), '„Mehr“ klappt auf');
    await p.click('#btn-more');
    ok(!(await p.isVisible('#t-category')), '„Weniger“ klappt wieder zu');
    ok(await p.$eval('#toast', t => getComputedStyle(t).visibility === 'hidden'), 'Toast unsichtbar, wenn nicht gezeigt');
    await p.close();
  }

  console.log('iOS, erster Start: Begrüßung, Sperre, Testphase starten');
  {
    const p = await page(browser, mockStore, {});
    ok(await p.$eval('#dlg-pro', d => d.open), 'Begrüßung offen');
    ok(/2,99 €/.test(await p.textContent('#dlg-pro-after')), 'Preis im Begrüßungstext');
    await p.click('#dlg-pro-later');
    ok(await navLocked(p, 'calendar'), 'Kalender gesperrt vor Testbeginn');
    await p.click('.nav-btn[data-view="calendar"]');
    ok((await active(p)) === 'view-settings', 'gesperrter Bereich führt zum Kaufbereich');
    ok(/gehört zur Vollversion/.test(await p.textContent('#toast')), 'Hinweis erscheint');
    ok(await p.isVisible('#btn-trial'), 'Knopf „30 Tage kostenlos testen“');
    ok(await p.$eval('#backup-encrypt', c => c.disabled), 'verschlüsseltes Backup gesperrt');
    ok(await p.isVisible('[data-pro="Statistik"] .lock-note'), 'Statistik zeigt Schloss');
    // Aufgaben bleiben frei
    await p.click('.nav-btn[data-view="tasks"]');
    await p.fill('#t-title', 'Testaufgabe');
    await p.click('#btn-add-task');
    ok(/Testaufgabe/.test(await p.textContent('#task-list')), 'Aufgabe anlegen geht ohne Kauf');
    await p.click('.nav-btn[data-view="settings"]');
    await p.click('#btn-trial');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => window.__orders.includes('de.maehlmann.todoorganizer.testphase')), 'Testphase bestellt');
    ok(!(await navLocked(p, 'calendar')), 'Kalender nach Teststart frei');
    ok(/noch 30 Tage/.test(await p.textContent('#pro-state')), 'Restlaufzeit 30 Tage');
    ok(!(await p.isVisible('#btn-trial')), 'Testknopf verschwindet');
    await p.click('.nav-btn[data-view="timetable"]');
    ok((await active(p)) === 'view-timetable', 'Stundenplan öffnet in der Testphase');
    await p.close();
  }

  console.log('iOS, Testphase vor 31 Tagen begonnen (Neuinstallation): abgelaufen');
  {
    const p = await page(browser, mockStore, { [TRIAL]: Date.now() - 31 * DAY });
    ok(!(await p.$eval('#dlg-pro', d => d.open)), 'keine Begrüßung mehr');
    ok(await navLocked(p, 'shopping'), 'Einkaufsliste gesperrt');
    ok(/Testphase ist beendet/.test(await p.textContent('#pro-state')), 'Hinweis „beendet“');
    ok(!(await p.isVisible('#btn-trial')), 'kein zweiter Testknopf');
    await p.click('.nav-btn[data-view="settings"]');
    await p.click('#btn-ics');
    ok(/Kalenderdatei-Export gehört zur Vollversion/.test(await p.textContent('#toast')), '.ics-Export gesperrt');
    await p.click('#btn-buy');
    await p.waitForTimeout(200);
    ok(/Vollversion ist freigeschaltet/.test(await p.textContent('#pro-state')), 'Kauf schaltet frei');
    ok(!(await navLocked(p, 'shopping')), 'Einkaufsliste frei nach Kauf');
    ok(!(await p.$eval('#backup-encrypt', c => c.disabled)), 'verschlüsseltes Backup frei');
    ok(await p.$eval('[data-pro="Statistik"]', c => !c.classList.contains('locked')), 'Statistik frei');
    await p.close();
  }

  console.log('iOS, Testphase vor 10 Tagen: läuft noch 20 Tage');
  {
    const p = await page(browser, mockStore, { [TRIAL]: Date.now() - 10 * DAY });
    ok(/noch 20 Tage/.test(await p.textContent('#pro-state')), 'Restlaufzeit 20 Tage');
    await p.close();
  }

  console.log('iOS, gekauft: Vollversion bleibt auch ohne Store-Antwort');
  {
    const p = await page(browser, mockStore, { [FULL]: Date.now() - 100 * DAY });
    ok(!(await navLocked(p, 'calendar')), 'frei mit Kauf');
    await p.evaluate(() => { window.CdvPurchase = undefined; });
    await p.reload(); await p.waitForTimeout(300);
    ok(!(await navLocked(p, 'calendar')), 'nach Neustart ohne Store weiter frei (gemerkt)');
    await p.close();
  }

  console.log('iOS, Testmodus: 7× auf die Version tippen verkürzt auf 3 Minuten');
  {
    const p = await page(browser, mockStore, {});
    await p.click('#dlg-pro-trial');
    await p.waitForTimeout(200);
    await p.click('.nav-btn[data-view="settings"]');
    await p.click('#btn-about');
    for (let i = 0; i < 7; i++) await p.click('#ver-line');
    ok(/Testmodus an/.test(await p.textContent('#toast')), 'Testmodus eingeschaltet');
    ok(/Testmodus, endet um/.test(await p.textContent('#pro-state')), 'Anzeige mit Uhrzeit');
    // Uhr 4 Minuten vorstellen
    await p.evaluate(() => { const real = Date.now; Date.now = () => real() + 4 * 60000; licenseChanged(); });
    ok(await navLocked(p, 'calendar'), 'nach Ablauf gesperrt');
    ok((await active(p)) === 'view-about', 'Info-Seite bleibt offen');
    await p.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} Fehler` : '\nAlle Prüfungen bestanden.');
  process.exit(fails ? 1 : 0);
})();
