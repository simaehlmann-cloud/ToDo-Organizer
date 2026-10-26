/* App-Vorschauvideos für den App Store.

     node store/make-previews.js            # beide
     node store/make-previews.js iphone     # nur eins

   Ergebnis: store/out/previews/iphone-886x1920.mp4 und ipad-1200x1600.mp4
   – H.264 High, 30 fps, 10 Mbit/s, stilles Stereo-AAC (256 kbit/s, 48 kHz),
   15–30 Sekunden. So verlangt es App Store Connect.

   Aufgenommen wird die echte App mit echter Bedienung (Antippen, Tippen,
   Scrollen) über den Bildschirm-Mitschnitt von Chromium. Überlagert sind
   nur kurze Texteinblendungen und Tipp-Kreise – beides erlaubt Apple
   (Richtlinie 2.3.4). Braucht ffmpeg. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, DEVICES, openApp, germanInputs } = require('./device.js');

const OUT = path.join(__dirname, 'out', 'previews');
const TMP = path.join(__dirname, 'out', 'tmp');
const MAX_SEC = 29.5;   // Apple: höchstens 30 s

const TARGETS = {
  iphone: { file: 'iphone-886x1920.mp4', W: 886, H: 1920, dev: DEVICES.iphone,
            viewport: { width: 443, height: 960 }, scale: 2 },
  ipad:   { file: 'ipad-1200x1600.mp4', W: 1200, H: 1600, dev: DEVICES.ipad,
            viewport: { width: 900, height: 1200 }, scale: 4 / 3 }
};

function overlayCss(dev) {
  const top = dev.status + (dev.wide ? 18 : 10);
  return `
  #pv-cap{position:fixed;inset:auto;margin:0;border:0;overflow:visible;left:50%;top:${top}px;transform:translate(-50%,-14px);opacity:0;z-index:9999;pointer-events:none;
    max-width:${dev.wide ? 620 : 380}px;width:max-content;text-align:center;
    background:linear-gradient(120deg,rgba(37,99,235,.96),rgba(124,58,237,.96));color:#fff;
    font:700 ${dev.wide ? 26 : 19}px/1.25 "Inter Display",Inter,sans-serif;letter-spacing:-.01em;
    padding:${dev.wide ? '15px 26px' : '12px 18px'};border-radius:16px;
    box-shadow:0 10px 30px rgba(30,27,75,.35);transition:opacity .28s,transform .28s}
  #pv-cap.on{opacity:1;transform:translate(-50%,0)}
  .pv-tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;z-index:9999;pointer-events:none;
    background:rgba(37,99,235,.28);border:2.5px solid rgba(37,99,235,.85);animation:pvtap .5s ease-out forwards}
  @keyframes pvtap{from{transform:scale(.5);opacity:1}to{transform:scale(1.35);opacity:0}}`;
}

async function prepare(page, dev) {
  await page.addStyleTag({ content: overlayCss(dev) });
  await page.evaluate(() => {
    const c = document.createElement('div'); c.id = 'pv-cap'; c.popover = 'manual'; document.body.append(c);
    c.showPopover();
    // Nach dem Öffnen eines Dialogs wieder nach oben holen (Top-Layer-Reihenfolge)
    window.pvPromote = () => { c.style.transition = 'none'; c.hidePopover(); c.showPopover(); c.offsetWidth; c.style.transition = ''; };
    // Tipp-Kreise an jeder Berührung (auch über Dialogen: Kreis im Dialog selbst)
    document.addEventListener('pointerdown', e => {
      const host = document.querySelector('dialog[open]') || document.body;
      const d = document.createElement('div'); d.className = 'pv-tap';
      const r = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
      d.style.left = (e.clientX - r.left) + 'px'; d.style.top = (e.clientY - r.top) + 'px';
      if (host !== document.body) d.style.position = 'absolute';
      host.append(d); setTimeout(() => d.remove(), 600);
    }, true);
    window.pvCaption = text => {
      const c = document.getElementById('pv-cap');
      c.classList.remove('on');
      setTimeout(() => { if (text) { c.textContent = text; c.classList.add('on'); } }, text && c.textContent ? 300 : 0);
    };
    // Datumsfelder im Dialog in deutscher Schreibweise zeigen (Chromium: US-Format)
    const open = window.openTaskDialog;
    window.openTaskDialog = id => {
      open(id);
      for (const i of document.querySelectorAll('#dlg-task input[type=date]')) {
        i.dataset.iso = i.value; i.type = 'text'; i.value = i.value ? i.value.split('-').reverse().join('.') : '';
      }
    };
    // … und vor dem Speichern zurück, damit die Daten stimmen
    window.pvRestoreDates = () => {
      for (const i of document.querySelectorAll('#dlg-task input[data-iso]')) {
        i.type = 'date'; i.value = i.dataset.iso; delete i.dataset.iso;
      }
    };
    document.getElementById('e-save').addEventListener('pointerdown', () => window.pvRestoreDates(), true);
  });
}

const cap = (p, t) => p.evaluate(t => pvCaption(t), t);
const wait = (p, ms) => p.waitForTimeout(ms);
async function smooth(p, top) {
  await p.evaluate(top => document.getElementById('main').scrollTo({ top, behavior: 'smooth' }), top);
}
async function smoothTo(p, sel, offset, text) {
  await p.evaluate(({ sel, offset, text }) => {
    const main = document.getElementById('main');
    const el = [...document.querySelectorAll(sel)].find(e => !text || e.textContent.includes(text));
    const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    main.scrollTo({ top: top - offset, behavior: 'smooth' });
  }, { sel, offset, text });
}
let TAPS = [];
const tap = async (p, loc) => {
  await loc.scrollIntoViewIfNeeded();
  TAPS.push(Date.now() / 1000);
  await loc.click({ delay: 60 });
};

/* Das Drehbuch – gleich für iPhone und iPad. */
async function script(p, dev) {
  const nav = v => p.locator(`.nav-btn[data-view="${v}"]`);
  const off = dev.wide ? 30 : dev.status + 70;   // Abstand unter der Einblendung

  // 1 · Woche
  await cap(p, 'Deine Woche auf einen Blick');
  await wait(p, 1300);
  await smooth(p, dev.wide ? 260 : 520);
  await wait(p, 1900);

  // 2 · Aufgabe erfassen
  await cap(p, 'Aufgaben in Sekunden erfassen');
  await tap(p, nav('tasks'));
  await wait(p, 600);
  await p.evaluate(() => { document.getElementById('t-category').value = 'c1'; });
  await tap(p, p.locator('#t-title'));
  await p.keyboard.type('Elternabend vorbereiten', { delay: 55 });
  await wait(p, 250);
  await tap(p, p.locator('#btn-quick-tom'));
  await p.locator('#t-title').blur();
  await wait(p, 1300);

  // 3 · Abhaken mit Rückgängig
  await cap(p, 'Abhaken – mit Rückgängig');
  await smoothTo(p, '#task-list', off);
  await wait(p, 700);
  await tap(p, p.locator('#task-list .task', { hasText: 'Arbeitsblatt Bruchrechnung' }).locator('input[type=checkbox]'));
  await wait(p, 1700);

  // 4 · Unterpunkte
  await cap(p, 'Große Vorhaben in kleinen Schritten');
  await smoothTo(p, '#task-list .task', off, 'Klassenarbeit 7b');
  await wait(p, 750);
  await tap(p, p.locator('#task-list .task', { hasText: 'Klassenarbeit 7b' }).locator('.title'));
  await p.evaluate(() => pvPromote());
  await wait(p, 800);
  await tap(p, p.locator('#e-subs .sub-edit', { hasText: 'Notenspiegel' }).locator('input[type=checkbox]'));
  await wait(p, 650);
  await tap(p, p.locator('#e-save'));
  await wait(p, 900);

  // 5 · Kalender
  await cap(p, 'Der Monat im Überblick');
  await tap(p, nav('calendar'));
  await wait(p, 800);
  await tap(p, p.locator('#cal-grid .cal-c:not(.out)').filter({ has: p.locator('.n', { hasText: /^5$/ }) }));
  await wait(p, 600);
  if (!dev.wide) await smoothTo(p, '#cal-day-title', off + 260);
  await wait(p, 1300);

  // 6 · Stundenplan
  await cap(p, 'Dein Stundenplan');
  await tap(p, nav('timetable'));
  await wait(p, 500);
  await p.evaluate(() => { document.getElementById('main').style.paddingBottom = '600px'; });
  await smoothTo(p, '#tt-grid', off + 20);
  await wait(p, 2100);

  // 7 · Einkauf
  await p.evaluate(() => { document.getElementById('main').style.paddingBottom = ''; });
  await cap(p, 'Die Einkaufsliste ist immer dabei');
  await tap(p, nav('shopping'));
  await wait(p, 500);
  await tap(p, p.locator('#s-item'));
  await p.keyboard.type('Kaffee', { delay: 60 });
  await tap(p, p.locator('#btn-add-item'));
  await p.locator('#s-item').blur();
  await wait(p, 450);
  await tap(p, p.locator('#shop-list .row', { hasText: 'Milch' }).locator('input'));
  await wait(p, 380);
  await tap(p, p.locator('#shop-list .row', { hasText: 'Vollkornbrot' }).locator('input'));
  await wait(p, 1100);

  // 8 · Abschluss
  await cap(p, 'Ohne Konto · ohne Server · ohne Abo');
  await tap(p, nav('week'));
  await wait(p, 2600);
}

async function record(browser, key) {
  const t = TARGETS[key];
  const { ctx, page } = await openApp(browser, t.dev, { viewport: t.viewport, scale: t.scale });
  await page.evaluate(() => document.getElementById('main').scrollTo(0, 0));
  await prepare(page, t.dev);
  // Ansichtswechsel wie in der App mit kurzer Einblendung
  await page.evaluate(() => document.querySelectorAll('.view').forEach(v => v.style.animation = ''));

  const dir = path.join(TMP, 'frames-' + key);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  TAPS = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async f => {
    const n = frames.length;
    const file = path.join(dir, String(n).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: t.W, maxHeight: t.H, everyNthFrame: 1 });
  await page.evaluate(() => document.getElementById('sim-status').style.opacity = '0.999');  // erster Frame
  await page.waitForTimeout(300);
  await script(page, t.dev);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await ctx.close();

  // Frames mit ihrer tatsächlichen Dauer aneinanderreihen, dann auf 30 fps
  const t0 = frames[0].ts;
  const lastTs = Math.max(frames[frames.length - 1].ts + 0.04, end);
  let list = '';
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].ts : lastTs;
    list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
  });
  list += `file '${frames[frames.length - 1].file}'\n`;
  const listFile = path.join(TMP, `frames-${key}.txt`);
  fs.writeFileSync(listFile, list);
  const total = Math.min(MAX_SEC, lastTs - t0);
  if (total < 15) throw new Error('Video kürzer als 15 s');
  const wav = path.join(TMP, `musik-${key}.wav`);
  writeMusic(wav, total, TAPS.map(x => x - t0 + 0.04));
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, t.file);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-i', wav,
    '-t', total.toFixed(2),
    '-vf', `scale=${t.W}:${t.H}:flags=lanczos,setsar=1,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-preset', 'medium',
    // Apple nennt 10–12 Mbit/s als Ziel. Ruhige Bildschirminhalte brauchen
    // weniger; die Rate bleibt dann darunter, die Qualität ist trotzdem voll.
    '-b:v', '10M', '-maxrate', '12M', '-bufsize', '24M', '-r', '30',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-shortest', out]);
  console.log(`  ${path.relative(process.cwd(), out)}  (${frames.length} Bilder, ${total.toFixed(1)} s)`);
  return out;
}

/* Leise Hintergrundmusik, selbst erzeugt (keine fremden Rechte): ruhige
   Akkordflächen C – Am – F – G mit gezupften Achteln, dazu ein weicher Klick
   bei jedem Antippen. Ende mit Ausblendung. 48 kHz, Stereo, 16 Bit. */
function writeMusic(file, seconds, taps) {
  const SR = 48000, N = Math.ceil(seconds * SR) + SR;
  const L = new Float32Array(N), R = new Float32Array(N);
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]];
  const BAR = 2.4;                       // Sekunden je Akkord (100 bpm, 4/4)
  for (let c = 0; c * BAR < seconds + 1; c++) {
    const chord = CHORDS[c % 4], t0 = c * BAR;
    // Fläche
    for (const [k, m] of chord.entries()) {
      const fr = f(m + 12), pan = (k / (chord.length - 1)) * 0.6 + 0.2;
      for (let i = Math.floor(t0 * SR); i < Math.min(N, (t0 + BAR + 0.6) * SR); i++) {
        const t = i / SR - t0;
        const env = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (BAR + 0.6 - t) / 0.7));
        const v = env * 0.022 * (Math.sin(2 * Math.PI * fr * t) + 0.3 * Math.sin(2 * Math.PI * fr * 2.003 * t));
        L[i] += v * (1 - pan); R[i] += v * pan;
      }
    }
    // gezupfte Achtel aus den Akkordtönen
    const arp = [chord[2], chord[3], chord[4], chord[3] + 12, chord[4], chord[3], chord[2] + 12, chord[3]];
    arp.forEach((m, j) => {
      const s0 = t0 + j * BAR / 8, fr = f(m + 12), pan = j % 2 ? 0.65 : 0.35;
      for (let i = Math.floor(s0 * SR); i < Math.min(N, (s0 + 0.9) * SR); i++) {
        const t = i / SR - s0, env = Math.exp(-t * 6) * Math.min(1, t / 0.004);
        const v = env * 0.05 * (Math.sin(2 * Math.PI * fr * t) + 0.25 * Math.sin(4 * Math.PI * fr * t));
        L[i] += v * (1 - pan); R[i] += v * pan;
      }
    });
  }
  // Klick beim Antippen
  for (const s0 of taps) {
    for (let i = Math.floor(s0 * SR); i < Math.min(N, (s0 + 0.05) * SR); i++) {
      const t = i / SR - s0, v = Math.exp(-t * 140) * 0.16 * Math.sin(2 * Math.PI * 1900 * t);
      L[i] += v; R[i] += v;
    }
  }
  // Ein- und Ausblenden, in 16 Bit schreiben
  const len = Math.ceil(seconds * SR), buf = Buffer.alloc(44 + len * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
  for (let i = 0; i < len; i++) {
    const t = i / SR, g = 1.8 * Math.min(1, t / 0.6, (seconds - t) / 1.8);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

async function main() {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TARGETS);
  fs.mkdirSync(TMP, { recursive: true });
  for (const k of keys) {
    // Der Bildschirm-Mitschnitt liefert sonst nur die logische Auflösung
    // (443 × 960 statt 886 × 1920). Mit diesem Schalter rendert Chromium
    // selbst in Gerätepixeln.
    const browser = await chromium.launch({ args: ['--force-device-scale-factor=' + TARGETS[k].scale] });
    await record(browser, k);
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
