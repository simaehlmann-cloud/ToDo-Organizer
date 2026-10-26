/* Store-Bildschirmfotos für iPhone 6,3" und iPad 13".

     node store/make-screenshots.js

   Ergebnis: store/out/screenshots/iphone-6.3/*.png (1206 × 2622) und
   store/out/screenshots/ipad-13/*.png (2064 × 2752), ohne Alphakanal.

   Jedes Bild ist eine echte Ansicht der App mit den Beispieldaten aus
   demo-data.js, gesetzt in einen Geräterahmen mit Überschrift. */
const fs = require('fs');
const path = require('path');
const { chromium, DEVICES, openApp, germanInputs } = require('./device.js');

const OUT = path.join(__dirname, 'out', 'screenshots');
const TMP = path.join(__dirname, 'out', 'tmp');

/* Reihenfolge = Reihenfolge im Store. Die ersten drei sieht man in der
   Suche ohne Antippen – sie müssen allein überzeugen. */
const SCENES = [
  { id: '01-woche', title: 'Deine Woche auf einen Blick', sub: 'Stundenplan, Termine und Aufgaben für jeden Tag',
    go: async p => { await nav(p, 'week'); } },
  { id: '02-aufgaben', title: 'Aufgaben schnell erfasst', sub: 'Mit Kategorien, Prioritäten und Wiederholungen',
    go: async p => { await nav(p, 'tasks'); await scrollTo(p, '#f-search', 18); } },
  { id: '03-unterpunkte', title: 'Große Vorhaben, kleine Schritte', sub: 'Unterpunkte mit Fortschrittsbalken',
    go: async p => { await nav(p, 'tasks'); await p.evaluate(() => openTaskDialog('t01')); await germanInputs(p); } },
  { id: '04-kalender', title: 'Der Monat im Überblick', sub: 'Auf Wunsch mit deinem eigenen Kalender',
    go: async p => { await nav(p, 'calendar'); } },
  { id: '05-stundenplan', title: 'Dein Stundenplan', sub: 'Eigene Zeiten, Fächer und Räume',
    go: async p => {
      await nav(p, 'timetable');
      // Platz zum Weiterscrollen, damit das Raster oben steht (wie nach Wischen)
      await p.evaluate(() => { document.getElementById('main').style.paddingBottom = '600px'; });
      await scrollTo(p, '#tt-grid', 18, true);
    } },
  { id: '06-einkauf', title: 'Die Einkaufsliste ist immer dabei', sub: 'Abhaken, aufräumen, teilen',
    go: async p => { await nav(p, 'shopping'); } },
  { id: '07-privat', title: 'Ohne Konto. Ohne Server.', sub: 'Deine Daten bleiben bei dir – mit verschlüsseltem Backup',
    go: async p => {
      await nav(p, 'settings');
      await p.evaluate(() => { const c = document.getElementById('backup-encrypt'); c.checked = true; c.dispatchEvent(new Event('change')); });
      await p.fill('#backup-pw', 'beispielpasswort'); await p.fill('#backup-pw2', 'beispielpasswort');
      await scrollTo(p, '#backup-encrypt', 18, true);
    } }
];

async function nav(p, view) {
  await p.evaluate(v => {
    document.getElementById('main').style.paddingBottom = '';
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    switchTo(v);
    document.querySelectorAll('.view').forEach(x => x.style.animation = 'none');
  }, view);
  await p.waitForTimeout(120);
}
/* Inhalt so verschieben, dass das Element knapp unter der Statusleiste steht. */
async function scrollTo(p, sel, gap, card) {
  await p.evaluate(({ sel, gap, card }) => {
    const main = document.getElementById('main');
    let el = document.querySelector(sel);
    if (card) el = el.closest('.card');
    const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    const status = document.getElementById('sim-status').offsetHeight;
    const wide = innerWidth > 760;
    main.scrollTop = top - (wide ? 26 : status + gap);
  }, { sel, gap, card: !!card });
  await p.waitForTimeout(80);
}

/* Bühne: Verlauf in den Farben der App, Überschrift, Gerät mit Bildschirmfoto. */
function stageHtml(dev, img, scene, W, H) {
  const phone = !dev.wide;
  const head = phone ? { top: 170, t: 92, s: 46, gap: 26 } : { top: 170, t: 124, s: 62, gap: 34 };
  const frameTop = phone ? 560 : 560;
  const bottom = phone ? 96 : 120;
  const bezel = phone ? 22 : 30;
  const frameH = H - frameTop - bottom;
  const screenH = frameH - 2 * bezel;
  const screenW = Math.round(screenH * dev.viewport.width / dev.viewport.height);
  const frameW = screenW + 2 * bezel;
  const rOuter = phone ? 118 : 74, rInner = rOuter - bezel;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:linear-gradient(150deg,#2563eb 0%,#4f46e5 48%,#7c3aed 100%);font-family:Inter,sans-serif;color:#fff;position:relative}
  body::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(255,255,255,.18),transparent 45%),radial-gradient(circle at 10% 95%,rgba(255,255,255,.10),transparent 40%)}
  .txt{position:absolute;left:0;right:0;top:${head.top}px;text-align:center;padding:0 70px;z-index:2}
  h1,p{text-wrap:balance}
  h1{font-family:"Inter Display",Inter,sans-serif;font-weight:800;font-size:${head.t}px;line-height:1.08;letter-spacing:-.025em}
  p{font-weight:500;font-size:${head.s}px;line-height:1.3;margin-top:${head.gap}px;opacity:.9}
  .dev{position:absolute;left:${Math.round((W - frameW) / 2)}px;top:${frameTop}px;width:${frameW}px;height:${frameH}px;
       background:#0b0f19;border-radius:${rOuter}px;padding:${bezel}px;z-index:2;
       box-shadow:0 40px 90px rgba(17,12,60,.45),0 0 0 3px rgba(255,255,255,.18)}
  .dev img{display:block;width:${screenW}px;height:${screenH}px;border-radius:${rInner}px}
  </style></head><body>
  <div class="txt"><h1>${scene.title}</h1><p>${scene.sub}</p></div>
  <div class="dev"><img src="${img}"></div>
  </body></html>`;
}

const SIZES = { iphone: { dir: 'iphone-6.3', W: 1206, H: 2622 }, ipad: { dir: 'ipad-13', W: 2064, H: 2752 } };

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  for (const key of Object.keys(SIZES)) {
    const dev = DEVICES[key], size = SIZES[key];
    const dir = path.join(OUT, size.dir);
    fs.mkdirSync(dir, { recursive: true });
    const { ctx, page } = await openApp(browser, dev);
    const raws = [];
    for (const sc of SCENES) {
      await sc.go(page);
      const f = path.join(TMP, `${key}-${sc.id}.png`);
      await page.screenshot({ path: f });
      raws.push([sc, f]);
    }
    await ctx.close();

    const sctx = await browser.newContext({ viewport: { width: size.W, height: size.H }, deviceScaleFactor: 1 });
    const sp = await sctx.newPage();
    for (const [sc, raw] of raws) {
      const html = path.join(TMP, `stage-${key}.html`);
      fs.writeFileSync(html, stageHtml(dev, path.basename(raw), sc, size.W, size.H));
      await sp.goto('file://' + html);
      await sp.evaluate(() => document.fonts.ready);
      await sp.waitForFunction(() => [...document.images].every(i => i.complete));
      // JPEG-Zwischenschritt entfernt jeden Alphakanal; danach verlustarm als PNG.
      const out = path.join(dir, `${sc.id}.png`);
      await sp.screenshot({ path: out, omitBackground: false });
      console.log('  ' + path.relative(process.cwd(), out));
    }
    await sctx.close();
  }
  await browser.close();
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { SCENES, nav, scrollTo };
