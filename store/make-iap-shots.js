/* Prüfungs-Bildschirmfotos für die beiden In-App-Käufe (App Store Connect →
   In-App-Käufe → Informationen zur Prüfung).

     node store/make-iap-shots.js

   Die App läuft dafür als iOS-App mit nachgebildetem App Store (gleiche
   Schnittstelle wie das Kauf-Plugin, Preis 2,99 €). Ergebnis in
   store/out/iap/, iPhone 6,3" (1206 × 2622), ohne Rahmen und Überschrift. */
const fs = require('fs');
const path = require('path');
const { chromium, DEVICES, openApp } = require('./device.js');

const OUT = path.join(__dirname, 'out', 'iap');
const TRIAL = 'de.maehlmann.todoorganizer.testphase';

/* owned: Produkt-ID → Kaufdatum (ms), werden beim Start als gekauft gemeldet. */
function mockStore(owned) {
  const handlers = { approved: [], finished: [], productUpdated: [], receiptUpdated: [] };
  const products = {}, own = Object.assign({}, owned);
  const fire = (ev, x) => handlers[ev].forEach(f => f(x));
  const tx = (id, date) => ({ products: [{ id }], purchaseDate: new Date(date), finish() { fire('finished', this); } });
  const product = id => ({ id, get owned() { return id in own; },
    pricing: { price: id.endsWith('testphase') ? 'Gratis' : '2,99 €' },
    getOffer() { return { order: async () => {} }; } });
  const chain = {};
  for (const k of Object.keys(handlers)) chain[k] = f => { handlers[k].push(f); return chain; };
  window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true, Plugins: {} };
  window.CdvPurchase = {
    ProductType: { NON_CONSUMABLE: 'non consumable' }, Platform: { APPLE_APPSTORE: 'ios-appstore' },
    ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    store: { register(l) { l.forEach(p => products[p.id] = product(p.id)); }, when() { return chain; }, error() {},
      async initialize() { for (const id of Object.keys(own)) fire('approved', tx(id, own[id])); },
      get(id) { return products[id]; }, async restorePurchases() {} }
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const dev = DEVICES.iphone;

  // 1 · Testphase: Begrüßung beim ersten Start mit „30 Tage kostenlos testen“
  {
    const { ctx, page } = await openApp(browser, dev, { init: [[mockStore, {}]] });
    await page.waitForSelector('#dlg-pro[open]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, 'iap-testphase.png') });
    await ctx.close();
  }
  // 2 · Vollversion: Testphase abgelaufen, Kaufkarte unter Einstellungen
  {
    const start = Date.parse('2026-11-03T08:10:00') - 31 * 86400000;
    const { ctx, page } = await openApp(browser, dev, { init: [[mockStore, { [TRIAL]: start }]] });
    await page.waitForTimeout(200);
    await page.evaluate(() => { switchTo('settings'); document.querySelectorAll('.view').forEach(v => v.style.animation = 'none'); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, 'iap-vollversion.png') });
    await ctx.close();
  }
  await browser.close();
  console.log('  store/out/iap/iap-testphase.png, iap-vollversion.png');
})().catch(e => { console.error(e); process.exit(1); });
