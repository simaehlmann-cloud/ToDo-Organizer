/* Gemeinsame Teile für Bildschirmfotos und Vorschauvideos: Gerätemaße,
   Beispieldaten laden, Statusleiste und Home-Leiste nachbilden.

   Die App läuft dafür im Browser (Chromium) – ohne Store, also ohne
   Sperren. env(safe-area-inset-*) liefert dort 0; die Abstände, die iOS
   der App gibt, werden deshalb per CSS nachgestellt. */
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const { TODAY, STATE } = require('./demo-data.js');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

/* Logische Bildschirmgröße (Punkte) und Ränder wie auf dem echten Gerät.
   iPhone 17 Pro (6,3"): 402 × 874 pt, @3x = 1206 × 2622.
   iPad Pro 13":        1032 × 1376 pt, @2x = 2064 × 2752. */
const DEVICES = {
  iphone: { name: 'iPhone 6,3"', viewport: { width: 402, height: 874 }, scale: 3,
            status: 54, home: 34, wide: false },
  /* iPad: Ausgabe 2064 × 2752 (13"), gezeigt wird aber die Ansicht eines
     11"-iPads (860 pt breit). Auf 1032 pt wäre die Schrift im Store-Bild
     winzig; das Layout ist dasselbe. */
  ipad:   { name: 'iPad 13"', viewport: { width: 860, height: 1147 }, scale: 2.4,
            status: 24, home: 20, wide: true }
};

function chromeCss(dev) {
  const inset = dev.wide
    ? `body{padding-top:${dev.status}px!important;padding-bottom:${dev.home}px!important}`
    : `#main{padding-top:${16 + dev.status}px!important}
       #sidebar{padding-bottom:${dev.home}px!important}
       body::before{height:${dev.status}px!important}`;
  return inset + `
  dialog[open]{top:${dev.status}px!important;bottom:${dev.home}px!important;max-height:calc(100% - ${dev.status + dev.home + 24}px)!important}
  *:not(#sim-status *){font-family:Inter,-apple-system,system-ui,sans-serif!important}
  #sim-status{position:fixed;top:0;left:0;right:0;height:${dev.status}px;z-index:9998;pointer-events:none;
    display:flex;align-items:center;justify-content:space-between;
    padding:${dev.wide ? '0 22px' : '6px 34px 0 46px'};
    font:600 ${dev.wide ? 14 : 17}px/1 Inter,-apple-system,system-ui,sans-serif;color:#000;letter-spacing:-.01em}
  #sim-status .r{display:flex;gap:${dev.wide ? 6 : 7}px;align-items:center}
  #sim-status svg{display:block}
  #sim-home{position:fixed;left:50%;bottom:${dev.wide ? 6 : 8}px;transform:translateX(-50%);width:${dev.wide ? 320 : 140}px;height:5px;
    border-radius:3px;background:${dev.wide ? '#000' : '#fff'};z-index:9998;pointer-events:none;opacity:.9}
  :root[data-theme=dark] #sim-status{color:#fff}
  :root[data-theme=dark] #sim-home{background:#fff}`;
}

const ICONS = (wide) => {
  const s = wide ? 0.85 : 1;
  return `
  <svg width="${18 * s}" height="${12 * s}" viewBox="0 0 18 12"><g fill="currentColor">
    <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/>
    <rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
  <svg width="${16 * s}" height="${12 * s}" viewBox="0 0 16 12"><g fill="currentColor">
    <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.3C13.5 1.5 10.9.4 8 .4S2.5 1.5.6 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2z"/>
    <path d="M8 5.6c1.5 0 2.8.6 3.8 1.5L13 5.8C11.7 4.6 9.9 3.8 8 3.8s-3.7.8-5 2l1.2 1.3c1-.9 2.3-1.5 3.8-1.5z"/>
    <path d="M8 9l2.4-2.5C9.8 6 8.9 5.6 8 5.6s-1.8.4-2.4.9L8 9z" transform="translate(0 2)"/></g></svg>
  <svg width="${27 * s}" height="${13 * s}" viewBox="0 0 27 13">
    <rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/>
    <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/>
    <path d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2z" fill="currentColor" opacity=".45"/></svg>`;
};

async function openApp(browser, dev, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || dev.viewport,
    deviceScaleFactor: opts.scale || dev.scale,
    hasTouch: true, isMobile: !dev.wide, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(TODAY));
  await page.addInitScript(state => {
    try { localStorage.setItem('studiez-pro-v2', JSON.stringify(state)); } catch {}
  }, STATE);
  for (const [fn, arg] of (opts.init || [])) await page.addInitScript(fn, arg);
  await page.goto(APP);
  await page.addStyleTag({ content: chromeCss(dev) });
  await page.evaluate(({ icons, wide }) => {
    const s = document.createElement('div');
    s.id = 'sim-status';
    s.innerHTML = `<span>${wide ? '9:41&nbsp;&nbsp;Di. 3. Nov.' : '9:41'}</span><span class="r">${icons}</span>`;
    const h = document.createElement('div'); h.id = 'sim-home';
    document.body.append(s, h);
    // Startansicht ohne Animation
    document.querySelectorAll('.view').forEach(v => v.style.animation = 'none');
  }, { icons: ICONS(dev.wide), wide: dev.wide });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return { ctx, page };
}

/* Chromium zeigt Datums- und Zeitfelder im US-Format, iOS auf einem
   deutschen Gerät nicht. Für die Aufnahme werden sie zu Textfeldern mit
   deutscher Schreibweise (nur Anzeige, die App-Daten bleiben unberührt). */
async function germanInputs(page) {
  await page.evaluate(() => {
    for (const i of document.querySelectorAll('input[type=date],input[type=time]')) {
      if (!i.offsetParent) continue;
      const v = i.value;
      i.type = 'text';
      i.value = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('.') : v;
    }
  });
}

module.exports = { chromium, DEVICES, openApp, germanInputs };
