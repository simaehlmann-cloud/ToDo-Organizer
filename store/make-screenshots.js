/* Store-Bildschirmfotos für iPhone 6,3" und iPad 13".

     node store/make-screenshots.js

   Ergebnis: store/out/screenshots/iphone-6.3/*.png (1206 × 2622) und
   store/out/screenshots/ipad-13/*.png (2064 × 2752), ohne Alphakanal.

   Jedes Bild ist eine echte Ansicht der App mit den Beispieldaten aus
   demo-data.js, gesetzt in einen Geräterahmen mit Überschrift. */
const fs = require('fs');
const path = require('path');
const { chromium, DEVICES, openApp, germanInputs } = require('./device.js');
const { TODAY_SCHOOL, SCHOOL } = require('./demo-data.js');

const OUT = path.join(__dirname, 'out', 'screenshots');
const TMP = path.join(__dirname, 'out', 'tmp');

/* Reihenfolge = Reihenfolge im Store. Die ersten drei sieht man in der
   Suche ohne Antippen – sie müssen allein überzeugen. Deshalb vorn die
   Schule (Beispieldaten SCHOOL, Lehrkraft), danach der Alltag (STATE).
   land: auf dem iPad quer aufgenommen (Wochenspalten). */
const SCENES = [
  { id: '01-woche', data: 'school', land: true,
    title: 'Unterricht und Alltag in einer Woche', sub: 'Stunden, Aufgaben, Termine und Aufsichten – nach Uhrzeit',
    go: async p => { await nav(p, 'week'); } },
  { id: '02-stundenplan', data: 'school', title: 'Stundenplan mit A/B-Wochen', sub: 'Doppelstunden, Aufsichten, Ferien und Feiertage aller Länder',
    go: async p => { await nav(p, 'timetable'); await scrollTo(p, '#tt-grid', 18, true); } },
  { id: '03-notizen', data: 'school', title: 'Notizen zu jeder Stunde', sub: 'Der Stundenverlauf je Klasse – nach Datum',
    go: async p => { await nav(p, 'week'); await p.evaluate(() => openCourseDialog('Mathe|7b')); } },
  { id: '04-stunden', data: 'school', title: 'Plus- und Minusstunden im Blick', sub: 'Vertretung, Ausfall und Aufsicht – als PDF für die Schulleitung',
    go: async p => { await nav(p, 'timetable'); await scrollTo(p, '#card-subs', 18); } },
  { id: '05-klassenarbeit', data: 'school', title: 'Klassenarbeit planen', sub: 'Vorbereiten, schreiben, zurückgeben – die Aufgaben legt die App an',
    go: async p => {
      await nav(p, 'tasks');
      await p.evaluate(() => { openExamDialog('2026-12-10', 'Mathe'); document.getElementById('ex-title').value = '7b Prozentrechnung'; renderExamPreview(); document.activeElement.blur(); });
      await germanInputs(p);
    } },
  { id: '06-schnelleingabe', title: 'Schreib einfach, was zu tun ist', sub: 'Datum, Uhrzeit von–bis, Kategorie und Wiederholung erkennt die App',
    go: async p => {
      await nav(p, 'tasks');
      await p.fill('#t-title', 'Fußballtraining Fr 18–19:30 #Sport');
      await p.dispatchEvent('#t-title', 'input');
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.waitForTimeout(120);
    } },
  { id: '07-aufgabe', title: 'Alles zu einer Aufgabe', sub: 'Uhrzeit von–bis, Erinnerung vorab, Unterpunkte und Notizen',
    go: async p => { await nav(p, 'tasks'); await p.evaluate(() => openTaskDialog('t01')); await germanInputs(p); } },
  { id: '08-gewohnheiten', title: 'Gute Gewohnheiten', sub: 'Wochenziel setzen, abhaken, Serie halten',
    go: async p => { await nav(p, 'week'); await scrollTo(p, '#card-habits', 18); } },
  { id: '09-einkauf', title: 'Einkaufslisten, die mitdenken', sub: 'Vorschläge, abhaken, teilen – auch im Dunkelmodus',
    go: async p => {
      await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
      await nav(p, 'shopping');
    } },
  { id: '10-privat', title: 'Ohne Konto. Ohne Server.', sub: 'Deine Daten bleiben bei dir – mit verschlüsseltem Backup',
    go: async p => {
      await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });
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
    document.getElementById('main').scrollTop = 0;
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
  let frameTop = phone ? 560 : 560;
  const bottom = phone ? 96 : 120;
  const bezel = phone ? 22 : 30;
  let frameH = H - frameTop - bottom;
  let screenH = frameH - 2 * bezel;
  let screenW = Math.round(screenH * dev.viewport.width / dev.viewport.height);
  if (dev.land) {          // quer: Breite gibt das Maß vor, senkrecht mittig
    screenW = W - 2 * 110 - 2 * bezel;
    screenH = Math.round(screenW * dev.viewport.height / dev.viewport.width);
    frameH = screenH + 2 * bezel;
    frameTop = Math.round(frameTop + (H - frameTop - bottom - frameH) / 2);
  }
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
    const raws = [];
    let cur = null;
    for (const sc of SCENES) {
      const d = sc.land && key === 'ipad' ? DEVICES.ipadLand : dev;
      const want = (sc.data || 'everyday') + '|' + d.name;
      if (!cur || cur.want !== want) {
        if (cur) await cur.ctx.close();
        const opts = sc.data === 'school' ? { state: SCHOOL, today: TODAY_SCHOOL } : {};
        cur = { want, ...(await openApp(browser, d, opts)) };
      }
      await sc.go(cur.page);
      const f = path.join(TMP, `${key}-${sc.id}.png`);
      await cur.page.screenshot({ path: f });
      raws.push([sc, f, d]);
    }
    await cur.ctx.close();

    const sctx = await browser.newContext({ viewport: { width: size.W, height: size.H }, deviceScaleFactor: 1 });
    const sp = await sctx.newPage();
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const [sc, raw, d] of raws) {
      const html = path.join(TMP, `stage-${key}.html`);
      fs.writeFileSync(html, stageHtml(d, path.basename(raw), sc, size.W, size.H));
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
