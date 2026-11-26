/* YouTube-Werbevideo (Querformat 1920 × 1080, 30 fps, ca. 70 s) mit Musik.

     node store/make-youtube.js

   Ergebnis in store/out/youtube/: ToDo-Organizer-Werbevideo.mp4,
   thumbnail.png (1280 × 720) und die Musik als WAV. Texte für YouTube
   stehen in store/YOUTUBE.md.

   Ablauf: Die echte App wird in vier Abschnitten bedient und per
   Bildschirm-Mitschnitt aufgenommen (iPhone hochkant, iPad quer). Jeder
   Abschnitt kommt in eine Bühne mit Gerät und Einblendungen, die
   Abschnitte werden mit Überblendungen verbunden. Die Musik erzeugt das
   Skript selbst (keine fremden Rechte). Braucht ffmpeg. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, DEVICES, openApp, DATA, DATE_SEP } = require('./device.js');
const { TODAY_SCHOOL, SCHOOL } = DATA;

const OUT = path.join(__dirname, 'out', 'youtube');
const TMP = path.join(__dirname, 'out', 'tmp', 'youtube');
const W = 1920, H = 1080, FPS = 30, XF = 0.5;   // Überblendung in Sekunden
const ICON = 'file://' + path.resolve(__dirname, '..', 'icons', 'icon-512.png');

/* Geräte für die Aufnahme. Bildschirmgröße in der Bühne: sw × sh. */
const PHONE = { dev: DEVICES.iphone, viewport: { width: 402, height: 874 }, scale: 2, sw: 404, sh: 878 };
const TABLET = { dev: DEVICES.ipadLand, viewport: { width: 1180, height: 820 }, scale: 1.5, sw: 1180, sh: 820 };

const ffmpeg = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();

/* ---- Aufnahme ------------------------------------------------------------ */
async function prepare(page) {
  await page.addStyleTag({ content: `
    .pv-tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;z-index:9999;pointer-events:none;
      background:rgba(37,99,235,.28);border:2.5px solid rgba(37,99,235,.85);animation:pvtap .5s ease-out forwards}
    @keyframes pvtap{from{transform:scale(.5);opacity:1}to{transform:scale(1.35);opacity:0}}` });
  await page.evaluate(sep => {
    document.addEventListener('pointerdown', e => {
      const host = document.querySelector('dialog[open]') || document.body;
      const d = document.createElement('div'); d.className = 'pv-tap';
      const r = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
      d.style.left = (e.clientX - r.left) + 'px'; d.style.top = (e.clientY - r.top) + 'px';
      if (host !== document.body) d.style.position = 'absolute';
      host.append(d); setTimeout(() => d.remove(), 600);
    }, true);
    // Datumsfelder in deutscher Schreibweise zeigen (Chromium: US-Format), vor dem Speichern zurück
    const show = i => { i.dataset.iso = i.value; i.dataset.typ = i.type; i.type = 'text';
      i.value = i.dataset.typ === 'date' && i.value ? i.value.split('-').reverse().join(sep) : i.value; };
    const openT = window.openTaskDialog;
    window.openTaskDialog = id => { openT(id); document.querySelectorAll('#dlg-task input[type=date],#dlg-task input[type=time]').forEach(show); };
    const openS = window.openSubDialog;
    window.openSubDialog = (...a) => { openS(...a); show(document.getElementById('sb-date')); };
    const restore = () => document.querySelectorAll('dialog input[data-iso]').forEach(i => {
      i.type = i.dataset.typ || 'date'; i.value = i.dataset.iso; delete i.dataset.iso; delete i.dataset.typ; });
    document.getElementById('e-save').addEventListener('pointerdown', restore, true);
    document.getElementById('sb-save').addEventListener('pointerdown', restore, true);
  }, DATE_SEP);
}

/* Ein Abschnitt: Gerät öffnen, Drehbuch abspielen, Bilder mitschneiden.
   cap() merkt sich Zeitpunkt und Text der Einblendung. */
async function record(name, rig, opts, script) {
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=' + rig.scale] });
  const { ctx, page } = await openApp(browser, rig.dev, { viewport: rig.viewport, scale: rig.scale, ...opts });
  await page.evaluate(() => document.getElementById('main').scrollTo(0, 0));
  await prepare(page);
  await page.evaluate(() => document.querySelectorAll('.view').forEach(v => v.style.animation = ''));

  const dir = path.join(TMP, 'frames-' + name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [], cues = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  const vw = Math.round(rig.viewport.width * rig.scale), vh = Math.round(rig.viewport.height * rig.scale);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vw, maxHeight: vh, everyNthFrame: 1 });
  await page.evaluate(() => document.getElementById('sim-status').style.opacity = '0.999');
  await page.waitForTimeout(300);
  const t0 = Date.now() / 1000;
  const cap = (text, sub = '') => cues.push({ t: Date.now() / 1000 - t0, text, sub });
  await script(page, cap);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await ctx.close(); await browser.close();

  // Bilder mit ihrer echten Dauer aneinanderreihen
  const f0 = frames[0].ts, last = Math.max(frames[frames.length - 1].ts + 0.04, end);
  let list = '';
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].ts : last;
    list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
  });
  list += `file '${frames[frames.length - 1].file}'\n`;
  const lf = path.join(TMP, name + '.txt'); fs.writeFileSync(lf, list);
  const mp4 = path.join(TMP, name + '-app.mp4');
  const shift = t0 - f0;   // Einblendungen auf die Zeit des Mitschnitts beziehen
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', lf, '-vf', `scale=${rig.sw * 2}:${rig.sh * 2}:flags=lanczos,fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', mp4]);
  console.log(`  ${name}: ${frames.length} Bilder, ${(last - f0).toFixed(1)} s`);
  return { mp4, cues: cues.map(c => ({ ...c, t: c.t + shift })), length: last - f0, rig };
}

const wait = (p, ms) => p.waitForTimeout(ms);
const tap = async (p, loc) => { await loc.scrollIntoViewIfNeeded(); await loc.click({ delay: 60 }); };
async function smoothTo(p, sel, offset, text) {
  await p.evaluate(({ sel, offset, text }) => {
    const main = document.getElementById('main');
    const el = [...document.querySelectorAll(sel)].find(e => !text || e.textContent.includes(text));
    const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    main.scrollTo({ top: top - offset, behavior: 'smooth' });
  }, { sel, offset, text });
}
const nav = (p, v) => p.locator(`.nav-btn[data-view="${v}"]`);

/* Abschnitt 1 · iPad quer · Lehrkraft: Woche, Stunde mit Notiz und Hausaufgabe, Stundenverlauf */
async function schoolTablet(p, cap) {
  const today = p.locator('#wk-days .week-day.today');
  cap('Unterricht und Alltag in einer Woche', 'Stunden, Aufgaben, Termine und Aufsichten – nach Uhrzeit');
  await wait(p, 3200);
  cap('Notizen zu jeder Stunde', 'Antippen, eintragen – fertig');
  await tap(p, today.locator('.wd-lesson', { hasText: 'Mathe · 7b' }));
  await wait(p, 600);
  await tap(p, p.locator('#ld-note'));
  await p.keyboard.type('Prozente als Brüche – Einstieg mit Rabatt-Plakaten', { delay: 30 });
  await wait(p, 500);
  cap('Hausaufgabe bis zur nächsten Stunde', 'Die App weiß, wann die Klasse wieder Mathe hat');
  await tap(p, p.locator('#ld-hw'));
  await p.keyboard.type('S. 56 Nr. 4', { delay: 50 });
  await tap(p, p.locator('#ld-hw-add'));
  await p.locator('#ld-hw').blur();
  await wait(p, 1700);
  cap('Der Stundenverlauf je Klasse', 'Was war dran? Alles nach Datum');
  await tap(p, p.locator('#ld-history'));
  await wait(p, 3000);
  await tap(p, p.locator('#cs-close'));
  await wait(p, 500);
}

/* Abschnitt 2 · iPhone · Lehrkraft: Vertretung, Plus/Minus, Stundenplan */
async function schoolPhone(p, cap) {
  const off = PHONE.dev.status + 20;
  const today = p.locator('#wk-days .week-day.today');
  cap('Vertretung eintragen', 'Mit einem Tipp – direkt am Tag');
  await smoothTo(p, '#wk-days .week-day.today', off);
  await wait(p, 900);
  await tap(p, today.locator('.wd-add'));
  await wait(p, 500);
  await tap(p, p.locator('#sb-klass'));
  await p.keyboard.type('6a', { delay: 70 });
  await tap(p, p.locator('#sb-subject'));
  await p.keyboard.type('Deutsch', { delay: 60 });
  await wait(p, 300);
  await tap(p, p.locator('#sb-save'));
  await wait(p, 1000);
  cap('Plus- und Minusstunden im Blick', 'Übersicht je Schuljahr – als PDF für die Schulleitung');
  await tap(p, nav(p, 'timetable'));
  await wait(p, 400);
  await smoothTo(p, '#card-subs', off);
  await wait(p, 3000);
  cap('Stundenplan mit A/B-Wochen', 'Ferien und Feiertage sind schon drin');
  await p.evaluate(() => document.getElementById('main').scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(p, 3200);
}

/* Abschnitt 3 · iPhone · Alltag: Schnelleingabe, Aufgabe mit Unterpunkten, Gewohnheiten */
async function everydayPhone(p, cap) {
  const off = PHONE.dev.status + 20;
  cap('Schreib einfach, was zu tun ist', 'Datum, Uhrzeit und Kategorie erkennt die App');
  await tap(p, nav(p, 'tasks'));
  await wait(p, 500);
  await tap(p, p.locator('#t-title'));
  await p.keyboard.type('Laufen Sa 8–9:30 #Sport', { delay: 55 });
  await wait(p, 1000);
  await tap(p, p.locator('#btn-add-task'));
  await p.locator('#t-title').blur();
  await wait(p, 900);
  cap('Uhrzeit, Erinnerung, Unterpunkte', 'Alles zu einer Aufgabe an einem Ort');
  await smoothTo(p, '#task-list .task', off, 'Präsentation fertigstellen');
  await wait(p, 700);
  await tap(p, p.locator('#task-list .task', { hasText: 'Präsentation fertigstellen' }).locator('.title'));
  await wait(p, 1000);
  await tap(p, p.locator('#e-subs .sub-edit', { hasText: 'Beispiele ergänzen' }).locator('input[type=checkbox]'));
  await wait(p, 800);
  await tap(p, p.locator('#e-save'));
  await wait(p, 600);
  cap('Gute Gewohnheiten', 'Wochenziel setzen, abhaken, Serie halten');
  await tap(p, nav(p, 'week'));
  await wait(p, 500);
  await p.evaluate(() => document.getElementById('main').scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(p, 600);
  await tap(p, p.locator('#card-habits .habit', { hasText: 'Lesen' }).locator('.hday.today'));
  await wait(p, 1800);
}

/* Abschnitt 4 · iPad quer · Alltag: Kalender, Einkauf, Dunkelmodus */
async function everydayTablet(p, cap) {
  cap('Mit deinen Kalenderterminen', 'Gerätekalender, Google und Abos von Schule oder Verein');
  await tap(p, nav(p, 'calendar'));
  await wait(p, 700);
  await tap(p, p.locator('#cal-grid .cal-c:not(.out)').filter({ has: p.locator('.n', { hasText: /^4$/ }) }));
  await wait(p, 2200);
  cap('Einkaufslisten, die mitdenken', 'Vorschläge aus dem, was du oft kaufst');
  await tap(p, nav(p, 'shopping'));
  await wait(p, 500);
  await tap(p, p.locator('#s-item'));
  await p.keyboard.type('Kaffee', { delay: 70 });
  await tap(p, p.locator('#btn-add-item'));
  await p.locator('#s-item').blur();
  await wait(p, 500);
  await tap(p, p.locator('#shop-list .row', { hasText: 'Milch' }).locator('input'));
  await wait(p, 400);
  await tap(p, p.locator('#shop-list .row', { hasText: 'Vollkornbrot' }).locator('input'));
  await wait(p, 1200);
  cap('Hell oder dunkel', 'Ganz wie du magst');
  await tap(p, nav(p, 'week'));
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await wait(p, 2600);
}

/* ---- Bühne --------------------------------------------------------------- */
const BG = `background:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 50%,#7c3aed 100%);`;
const BASE_CSS = `*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
  body{font-family:Inter,sans-serif;color:#fff}
  h1{font-family:"Inter Display",Inter,sans-serif;font-weight:800;letter-spacing:-.025em;line-height:1.05;text-wrap:balance}
  p{font-weight:500;opacity:.92;line-height:1.3;text-wrap:balance}`;

/* Gerät und Bildschirmfläche (Position und Maße in Bühnenpixeln) */
function layout(rig) {
  if (rig === PHONE) {
    const sw = rig.sw, sh = rig.sh, x = 1300, y = Math.round((H - sh) / 2);
    return { x, y, sw, sh, bezel: 16, radius: 58, capBox: { left: 140, top: 0, width: 1020, align: 'left', h1: 84, p: 38 } };
  }
  const sw = 1180, sh = 820, x = Math.round((W - sw) / 2), y = H - sh - 52;
  return { x, y, sw, sh, bezel: 18, radius: 34, capBox: { left: 0, top: 46, width: W, align: 'center', h1: 64, p: 30 } };
}

function stageBg(rig) {
  const L = layout(rig);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  body{${BG}position:relative}
  body::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 10%,rgba(255,255,255,.16),transparent 45%),radial-gradient(circle at 8% 92%,rgba(255,255,255,.10),transparent 40%)}
  .dev{position:absolute;left:${L.x - L.bezel}px;top:${L.y - L.bezel}px;width:${L.sw + 2 * L.bezel}px;height:${L.sh + 2 * L.bezel}px;
    background:#0b0f19;border-radius:${L.radius + L.bezel}px;box-shadow:0 40px 90px rgba(17,12,60,.45),0 0 0 3px rgba(255,255,255,.16);z-index:2}
  .brand{position:absolute;left:${rig === PHONE ? 140 : 40}px;bottom:${rig === PHONE ? 70 : 20}px;display:${rig === PHONE ? 'flex' : 'none'};align-items:center;gap:16px;z-index:2;font-weight:700;font-size:30px;opacity:.95}
  .brand img{width:56px;height:56px;border-radius:13px}
  </style></head><body><div class="dev"></div><div class="brand"><img src="${ICON}">ToDo Organizer</div></body></html>`;
}
function stageMask(rig) {
  const L = layout(rig);
  return `<!DOCTYPE html><html><head><style>*{margin:0}html,body{width:${L.sw}px;height:${L.sh}px;background:#000}
  div{width:100%;height:100%;background:#fff;border-radius:${L.radius}px}</style></head><body><div></div></body></html>`;
}
function caption(rig, cue) {
  const c = layout(rig).capBox;
  const pos = rig === PHONE
    ? `left:${c.left}px;width:${c.width}px;top:50%;transform:translateY(-62%)`
    : `left:0;right:0;top:${c.top}px;padding:0 120px`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  .c{position:absolute;${pos};text-align:${c.align}}
  h1{font-size:${c.h1}px} p{font-size:${c.p}px;margin-top:${rig === PHONE ? 26 : 10}px}
  </style></head><body><div class="c"><h1>${cue.text}</h1>${cue.sub ? `<p>${cue.sub}</p>` : ''}</div></body></html>`;
}
const CARD = (title, sub, extra = '') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  body{${BG}display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative}
  body::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 15%,rgba(255,255,255,.18),transparent 45%),radial-gradient(circle at 12% 90%,rgba(255,255,255,.1),transparent 40%)}
  img{width:190px;height:190px;border-radius:44px;box-shadow:0 24px 60px rgba(17,12,60,.45);margin-bottom:44px;position:relative;z-index:1}
  h1{font-size:104px;position:relative;z-index:1} p{font-size:44px;margin-top:22px;position:relative;z-index:1;max-width:1500px}
  .pills{display:flex;gap:18px;margin-top:46px;position:relative;z-index:1}
  .pills span{background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:14px 30px;font-size:32px;font-weight:600}
  </style></head><body><img src="${ICON}"><h1>${title}</h1><p>${sub}</p>${extra}</body></html>`;

async function shoot(browser, html, file, w = W, h = H, transparent = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const f = path.join(TMP, 'stage.html'); fs.writeFileSync(f, html);
  await p.goto('file://' + f);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every(i => i.complete));
  await p.screenshot({ path: file, omitBackground: transparent });
  await ctx.close();
  return file;
}

/* Abschnitt in die Bühne setzen: Hintergrund, App mit runden Ecken, Einblendungen */
async function compose(browser, name, rec) {
  const L = layout(rec.rig);
  const bg = await shoot(browser, stageBg(rec.rig), path.join(TMP, name + '-bg.png'));
  const mask = await shoot(browser, stageMask(rec.rig), path.join(TMP, name + '-mask.png'), L.sw, L.sh);
  const caps = [];
  for (const [i, cue] of rec.cues.entries())
    caps.push(await shoot(browser, caption(rec.rig, cue), path.join(TMP, `${name}-cap${i}.png`), W, H, true));
  const len = rec.length;
  const inputs = ['-loop', '1', '-t', len.toFixed(2), '-i', bg, '-i', rec.mp4, '-loop', '1', '-t', len.toFixed(2), '-i', mask];
  caps.forEach(c => inputs.push('-loop', '1', '-t', len.toFixed(2), '-i', c));
  let f = `[1:v]scale=${L.sw}:${L.sh}:flags=lanczos,format=rgba[app];[2:v]format=gray,scale=${L.sw}:${L.sh}[m];[app][m]alphamerge[am];` +
          `[0:v][am]overlay=${L.x}:${L.y}:shortest=0[v0]`;
  rec.cues.forEach((cue, i) => {
    const a = Math.max(0, cue.t), b = i + 1 < rec.cues.length ? rec.cues[i + 1].t : len + 1;
    // Einblenden 0,35 s; Ausblenden 0,25 s vor der nächsten Einblendung
    f += `;[${3 + i}:v]format=rgba,fade=t=in:st=${a.toFixed(2)}:d=0.35:alpha=1` +
         (i + 1 < rec.cues.length ? `,fade=t=out:st=${Math.max(a + 0.4, b - 0.25).toFixed(2)}:d=0.25:alpha=1` : '') +
         `[c${i}];[v${i}][c${i}]overlay=0:0[v${i + 1}]`;
  });
  const out = path.join(TMP, name + '.mp4');
  ffmpeg([...inputs, '-filter_complex', f, '-map', `[v${rec.cues.length}]`, '-t', len.toFixed(2), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', out]);
  return out;
}

/* Standbild mit sanftem Zoom (Vorspann, Abspann, Zwischentafel) */
async function card(browser, name, html, seconds) {
  const png = await shoot(browser, html, path.join(TMP, name + '.png'));
  const out = path.join(TMP, name + '.mp4');
  const n = Math.round(seconds * FPS);
  ffmpeg(['-loop', '1', '-i', png, '-vf',
    `scale=${W * 2}:${H * 2},zoompan=z='1+0.035*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},format=yuv420p`,
    '-frames:v', String(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', out]);
  return out;
}

/* ---- Musik --------------------------------------------------------------- */
/* Fröhlicher Pop-Groove, 104 bpm, F – C – Dm – B♭: Fläche, gezupfte Achtel,
   Bass, ab Takt 3 Schlagzeug (Bassdrum, Klatschen, Hi-Hat). Die Fläche duckt
   sich bei jeder Bassdrum leicht weg. Ende mit Schlussakkord. 48 kHz Stereo. */
function writeMusic(file, seconds) {
  const SR = 48000, N = Math.ceil((seconds + 1) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const BPM = 104, BEAT = 60 / BPM, BAR = 4 * BEAT;
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  const CH = [[53, 57, 60, 65], [48, 55, 60, 64], [50, 57, 62, 65], [46, 53, 58, 62]];   // F C Dm B♭
  const BASS = [41, 36, 38, 34];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const add = (i, v, pan = 0.5) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan) * 1.4; R[i] += v * pan * 1.4; } };
  const bars = Math.ceil(seconds / BAR);
  const endBar = bars - 1;
  const duck = new Float32Array(N).fill(1);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, ch = CH[b % 4], last = b === endBar;
    const drums = b >= 2 && !last, full = b >= 4 && !last;
    // Bassdrum + Ducking
    if (drums) for (const k of [0, 2, ...(full ? [2.5] : [])]) {
      const s0 = t0 + k * BEAT;
      for (let i = 0; i < 0.35 * SR; i++) {
        const t = i / SR, fr = 50 + 90 * Math.exp(-t * 30);
        add(Math.floor(s0 * SR) + i, 0.42 * Math.exp(-t * 9) * Math.sin(2 * Math.PI * fr * t));
        const j = Math.floor(s0 * SR) + i; if (j < N) duck[j] = Math.min(duck[j], 1 - 0.45 * Math.exp(-t * 7));
      }
    }
    // Klatschen auf 2 und 4
    if (drums) for (const k of [1, 3]) {
      const s0 = Math.floor((t0 + k * BEAT) * SR);
      for (let i = 0; i < 0.18 * SR; i++) { const t = i / SR; add(s0 + i, 0.16 * Math.exp(-t * 22) * rnd(), 0.5); }
    }
    // Hi-Hat in Achteln (ab Takt 5 mit Sechzehnteln am Taktende)
    if (drums) for (let k = 0; k < (full ? 10 : 8); k++) {
      const pos = k < 8 ? k * BEAT / 2 : 3.5 * BEAT + (k - 8 + 1) * BEAT / 4;
      const s0 = Math.floor((t0 + pos) * SR);
      let prev = 0;
      for (let i = 0; i < 0.05 * SR; i++) { const t = i / SR, n = rnd(), h = n - prev; prev = n; add(s0 + i, (k % 2 ? 0.035 : 0.055) * Math.exp(-t * 70) * h, 0.62); }
    }
    // Bass in Achteln
    for (let k = 0; k < (last ? 1 : 8); k++) {
      const s0 = t0 + k * BEAT / 2, fr = f(BASS[b % 4] + (k === 7 ? 12 : 0)), len = last ? 2.5 : BEAT / 2;
      for (let i = 0; i < len * SR; i++) {
        const t = i / SR, env = Math.min(1, t / 0.005) * Math.exp(-t * (last ? 1.2 : 5));
        add(Math.floor(s0 * SR) + i, 0.15 * env * (Math.sin(2 * Math.PI * fr * t) + 0.35 * Math.sin(4 * Math.PI * fr * t)));
      }
    }
    // Fläche
    for (const [k, m] of ch.entries()) {
      const fr = f(m + 12), pan = 0.2 + 0.6 * k / 3, len = last ? 3.2 : BAR + 0.3;
      for (let i = 0; i < len * SR; i++) {
        const t = i / SR, env = Math.min(1, t / 0.25) * Math.min(1, Math.max(0, (len - t) / 0.5)) * (last ? Math.exp(-t * 0.8) : 1);
        const v = env * 0.018 * (Math.sin(2 * Math.PI * fr * t) + 0.4 * Math.sin(2 * Math.PI * fr * 1.004 * t) + 0.2 * Math.sin(4 * Math.PI * fr * t));
        const j = Math.floor(t0 * SR) + i; if (j < N) { L[j] += v * (1 - pan) * duck[j] * 1.4; R[j] += v * pan * duck[j] * 1.4; }
      }
    }
    // Gezupfte Sechzehntel-Figur (Glocke), ab Takt 2
    if (b >= 1 && !last) {
      const arp = [ch[1], ch[2], ch[3], ch[2] + 12, ch[3], ch[2], ch[1] + 12, ch[2]];
      arp.forEach((m, j) => {
        const s0 = t0 + j * BEAT / 2, fr = f(m + 12), pan = j % 2 ? 0.7 : 0.3;
        for (let i = 0; i < 0.6 * SR; i++) {
          const t = i / SR, env = Math.exp(-t * 7) * Math.min(1, t / 0.003);
          add(Math.floor(s0 * SR) + i, env * 0.05 * (Math.sin(2 * Math.PI * fr * t) + 0.3 * Math.sin(2 * Math.PI * 3 * fr * t) * Math.exp(-t * 20)), pan);
        }
      });
    }
  }
  const len = Math.ceil(seconds * SR), buf = Buffer.alloc(44 + len * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / peak;
  for (let i = 0; i < len; i++) {
    const t = i / SR, fade = Math.min(1, t / 0.4, (seconds - t) / 1.2);
    buf.writeInt16LE(Math.round(Math.tanh(L[i] * g * 1.1) * fade * 32767 * 0.95), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i] * g * 1.1) * fade * 32767 * 0.95), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

/* ---- Vorschaubild (1280 × 720) ------------------------------------------- */
function thumbHtml(phoneShot, tabletShot) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  html,body{width:1280px;height:720px}
  body{${BG}position:relative;overflow:hidden}
  body::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 90% 10%,rgba(255,255,255,.2),transparent 45%)}
  .t{position:absolute;left:58px;top:70px;width:640px;z-index:3}
  .t img{width:92px;height:92px;border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
  h1{font-size:86px;margin-top:26px;text-shadow:0 4px 20px rgba(20,10,60,.35)}
  h1 em{font-style:normal;color:#fde047}
  p{font-size:30px;margin-top:20px;font-weight:700;width:600px}
  .tab{position:absolute;left:690px;top:140px;width:820px;border-radius:26px;border:12px solid #0b0f19;box-shadow:0 30px 70px rgba(0,0,0,.45);z-index:1;transform:rotate(-4deg)}
  .ph{position:absolute;left:960px;top:200px;width:270px;border-radius:40px;border:10px solid #0b0f19;box-shadow:0 30px 70px rgba(0,0,0,.5);z-index:2;transform:rotate(5deg)}
  .tab,.ph{display:block}
  </style></head><body>
  <img class="tab" src="${tabletShot}"><img class="ph" src="${phoneShot}">
  <div class="t"><img src="${ICON}"><h1>Unterricht <em>&amp;</em> Alltag in <em>einer</em> App</h1><p>Ohne Konto · ohne Abo · iPhone &amp; iPad</p></div>
  </body></html>`;
}

async function thumbnail(browser) {
  // Rohbilder der App aus derselben Aufnahmeumgebung
  const shots = {};
  for (const [k, rig] of [['phone', PHONE], ['tablet', TABLET]]) {
    const b = await chromium.launch();
    const { ctx, page } = await openApp(b, rig.dev, { viewport: rig.viewport, scale: 1.5, state: SCHOOL, today: TODAY_SCHOOL });
    if (k === 'phone') await page.evaluate(() => { switchTo('timetable'); });
    await page.waitForTimeout(200);
    shots[k] = path.join(TMP, 'thumb-' + k + '.png');
    await page.screenshot({ path: shots[k] });
    await ctx.close(); await b.close();
  }
  return shoot(browser, thumbHtml('file://' + shots.phone, 'file://' + shots.tablet), path.join(OUT, 'thumbnail.png'), 1280, 720);
}

/* ---- Ablauf -------------------------------------------------------------- */
async function main() {
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const recs = [
    ['1-schule-ipad', TABLET, { state: SCHOOL, today: TODAY_SCHOOL }, schoolTablet],
    ['2-schule-iphone', PHONE, { state: SCHOOL, today: TODAY_SCHOOL }, schoolPhone],
    ['3-alltag-iphone', PHONE, {}, everydayPhone],
    ['4-alltag-ipad', TABLET, {}, everydayTablet]
  ];
  const browser = await chromium.launch();
  const parts = [];
  parts.push(await card(browser, '0-intro', CARD('ToDo Organizer', 'Der private Planer für Schule und Alltag'), 4));
  for (const [name, rig, opts, script] of recs) {
    const rec = await record(name, rig, opts, script);
    parts.push(await compose(browser, name, rec));
  }
  parts.push(await card(browser, '5-privat', CARD('Ohne Konto. Ohne Server.', 'Deine Daten bleiben auf deinem Gerät – und auf Wunsch in deinem eigenen iCloud-Konto.'), 4.5));
  parts.push(await card(browser, '6-ende', CARD('ToDo Organizer', 'Im App Store für iPhone und iPad',
    '<div class="pills"><span>30 Tage alles testen</span><span>Einmalkauf statt Abo</span><span>Deutsch &amp; Englisch</span></div>'), 5.5));

  // Abschnitte mit Überblendung verbinden
  const lens = parts.map(dur);
  const inputs = parts.flatMap(p => ['-i', p]);
  let f = '', acc = lens[0], prev = '[0:v]';
  const starts = [0];
  for (let i = 1; i < parts.length; i++) {
    const off = acc - XF;
    starts.push(off);
    const lbl = i === parts.length - 1 ? '[v]' : `[x${i}]`;
    f += `${prev}[${i}:v]xfade=transition=${i === parts.length - 1 ? 'fade' : 'smoothleft'}:duration=${XF}:offset=${off.toFixed(3)}${lbl};`;
    prev = lbl; acc = off + lens[i];
  }
  const total = acc;
  const wav = path.join(OUT, 'musik.wav');
  writeMusic(wav, total);
  const out = path.join(OUT, 'ToDo-Organizer-Werbevideo.mp4');
  ffmpeg([...inputs, '-i', wav, '-filter_complex', f.replace(/;$/, ''), '-map', '[v]', '-map', `${parts.length}:a`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out]);
  console.log(`  ${path.relative(process.cwd(), out)} (${total.toFixed(1)} s)`);
  // Kapitelmarken für die YouTube-Beschreibung (YouTube: ab 0:00, je mindestens 10 s)
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const chapters = [[0, 'Woche, Stundennotizen und Hausaufgaben'], [starts[2], 'Vertretungen, Plus-/Minusstunden, Stundenplan'],
    [starts[3], 'Schnelleingabe, Aufgaben, Gewohnheiten'], [starts[4], 'Kalender, Einkauf, Datenschutz']]
    .map(([s, n]) => `${mmss(s ? Math.ceil(s + XF / 2) : 0)} ${n}`).join('\n');
  fs.writeFileSync(path.join(OUT, 'kapitel.txt'), chapters + '\n');
  console.log(chapters);
  console.log('  ' + path.relative(process.cwd(), await thumbnail(browser)));
  await browser.close();
}

if (process.argv[2] === "thumb") { (async () => { const b = await chromium.launch(); fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true }); console.log(await thumbnail(b)); await b.close(); })(); } else main().catch(e => { console.error(e); process.exit(1); });
