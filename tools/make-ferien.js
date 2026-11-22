/* Schulferien aller 16 Länder in index.html eintragen (Block FERIEN),
   dazu Österreich (9 Bundesländer) und die Schweiz (26 Kantone) mit
   Ferien und Feiertagen aus demselben Datensatz.

     git clone --depth 1 https://github.com/openpotato/openholidaysapi.data.git /tmp/oh
     node tools/make-ferien.js /tmp/oh/src/de/holidays

   Quelle: OpenHolidays API Data (openholidaysapi.org), Lizenz ODbL 1.0.
   Die App braucht dafür keine Verbindung – die Termine stecken in der Datei.
   Neu ausführen, sobald die Länder weitere Schuljahre veröffentlichen.

   Nebenbei prüft das Skript die in der App berechneten Feiertage gegen den
   Datensatz (holidays.public.csv) und bricht bei Abweichungen ab. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('Pfad zu …/src/de/holidays angeben.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const AB = '2025-08-01';                 // ältere Ferien braucht niemand mehr

function csv(file) {
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
    .filter(l => l.trim() && !/^﻿?Id;/.test(l)).map(l => l.split(';'));
}
/* CSV mit Kopfzeile → Objekte (Spalten je Datei verschieden) */
function csvObj(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const head = lines.shift().split(';');
  return lines.map(l => { const c = l.split(';'), o = {}; head.forEach((h, i) => o[h] = (c[i] || '').trim()); return o; });
}
const deName = f => (f.split(',').find(x => x.startsWith('DE ')) || f).replace(/^DE /, '').trim();

// ---- Ferien ----------------------------------------------------------------
const names = [], idx = n => { let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
const data = {};
let bis = '';
for (const f of fs.readdirSync(dir).filter(f => /^holidays\.school\.[a-z]{2}\.csv$/.test(f)).sort()) {
  const region = f.split('.')[2].toUpperCase();
  const rows = [];
  for (const c of csv(path.join(dir, f))) {
    const [, , start, end0, type, , name, subs, tags] = c;
    if (type !== 'School' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) continue;
    // Ausnahmen für einzelne Orte (z. B. Inseln und Halligen in SH) gehören nicht zum Landestermin
    if (/Exception/i.test(tags || '')) continue;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(end0) ? end0 : start;
    if (end < AB) continue;
    const s = (subs || '').split(',').map(x => x.trim());
    // Mecklenburg-Vorpommern: allgemeinbildende Schulen (nicht berufliche)
    if (region === 'MV' ? !(s.includes('MV-ABS') || s.includes('MV')) : !s.includes(region)) continue;
    rows.push([start, end, idx(deName(name))]);
    if (end > bis) bis = end;
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  // doppelte Einträge (gleicher Zeitraum) entfernen
  data[region] = rows.filter((r, i) => !i || r[0] !== rows[i - 1][0] || r[1] !== rows[i - 1][1]);
}
const regions = Object.keys(data);
if (regions.length !== 16) { console.error('Erwartet 16 Länder, gefunden: ' + regions.join(',')); process.exit(1); }
// (AT/CH kommen unten dazu)

// ---- Österreich und Schweiz -------------------------------------------------------
// Ferien wie oben; Feiertage kommen hier aus dem Datensatz (keine eigene Rechnung).
const SRC = path.join(dir, '..', '..');                       // …/src
const fnames = [], fidx = n => { let i = fnames.indexOf(n); if (i < 0) { fnames.push(n); i = fnames.length - 1; } return i; };
const extraRegions = {}, feiertage = {};
const day = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function pushFerien(code, rows) {
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const out = [];
  const next = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  for (let r of rows) {
    // gleicher oder überlappender Zeitraum mit gleichem Namen (z. B. Sprachregionen): erster gewinnt
    if (out.some(o => o[2] === r[2] && !(r[1] < o[0] || r[0] > o[1]))) continue;
    // überlappt der Vorgänger (Ostern → Frühlingsferien): erst danach beginnen lassen
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) { if (r[1] <= last[1]) continue; r = [next(last[1]), r[1], r[2]]; }
    out.push(r);
  }
  data[code] = out;
}
const AT_DIR = path.join(SRC, 'at');
if (fs.existsSync(AT_DIR)) {
  const subs = csvObj(path.join(AT_DIR, 'subdivisions.csv'));
  const school = csvObj(path.join(AT_DIR, 'holidays', 'holidays.school.csv'));
  for (const sd of subs) {
    const code = 'AT-' + sd.ShortName;
    extraRegions[code] = deName(sd.Name);
    const rows = [];
    for (const h of school) {
      if (h.Type !== 'School' || !day(h.StartDate)) continue;
      const end = day(h.EndDate) ? h.EndDate : h.StartDate;
      if (end < AB) continue;
      const list = (h.Subdivisions || '').split(',').map(x => x.trim()).filter(Boolean);
      if (list.length && !list.includes(sd.ShortName)) continue;
      rows.push([h.StartDate, end, idx(deName(h.Name))]);
    }
    pushFerien(code, rows);
  }
  const pub = csvObj(path.join(AT_DIR, 'holidays', 'holidays.public.csv'));
  feiertage.AT = pub.filter(h => h.Type === 'Public' && day(h.StartDate) && h.StartDate >= AB && !(h.Subdivisions || '').trim())
    .map(h => [h.StartDate, fidx(deName(h.Name))]).sort((a, b) => a[0].localeCompare(b[0]));
}
const CH_DIR = path.join(SRC, 'ch');
if (fs.existsSync(CH_DIR)) {
  const subs = csvObj(path.join(CH_DIR, 'subdivisions.csv')).filter(s => !s.Parent);
  const pub = csvObj(path.join(CH_DIR, 'holidays', 'holidays.public.csv'));
  for (const sd of subs) {
    const kt = sd.ShortName, code = 'CH-' + kt;
    extraRegions[code] = deName(sd.Name);
    const f = path.join(CH_DIR, 'holidays', 'holidays.school.' + kt.toLowerCase() + '.csv');
    const rows = [];
    const all = fs.existsSync(f) ? csvObj(f) : [];
    // Gibt es Einträge für die Volksschule, nur diese; sonst alle (z. B. SO)
    const hasVS = all.some(h => (h.Groups || '').split(',').map(x => x.trim()).includes(kt + '-VS'));
    for (const h of all) {
      if (h.Type !== 'School' || !day(h.StartDate)) continue;
      const cm = h.Comment || '';
      if (/Exception/i.test(h.Tags || '') || /Ausnahme|Tourismus/i.test(cm)) continue;
      if (/Mittelschul|Berufsfach/i.test(cm) && !/Volksschul|Alle Schulen|Obligatorische/i.test(cm)) continue;
      const groups = (h.Groups || '').split(',').map(x => x.trim()).filter(Boolean);
      if (hasVS && groups.length && !groups.includes(kt + '-VS')) continue;
      const end = day(h.EndDate) ? h.EndDate : h.StartDate;
      if (end < AB) continue;
      rows.push([h.StartDate, end, idx(deName(h.Name))]);
    }
    pushFerien(code, rows);
    // Feiertage: landesweit oder für den ganzen Kanton (nur einzelne Bezirke/Gemeinden: nicht)
    feiertage[code] = pub.filter(h => h.Type === 'Public' && day(h.StartDate) && h.StartDate >= AB)
      .filter(h => { const l = (h.Subdivisions || '').split(',').map(x => x.trim()).filter(Boolean); return !l.length || l.includes(kt); })
      .map(h => [h.StartDate, fidx(deName(h.Name).replace(/%2C/g, ','))]).sort((a, b) => a[0].localeCompare(b[0]));
  }
}

// ---- Feiertage gegenprüfen ---------------------------------------------------
const html = fs.readFileSync(INDEX, 'utf8');
const core = html.slice(html.indexOf('/* ==CORE-BEGIN=='), html.indexOf('/* ==CORE-END== */') + 18);
const ctx = vm.createContext({});
vm.runInContext(core + '\n;globalThis.__ = { publicHolidays, REGIONS };', ctx);
const { publicHolidays, REGIONS } = ctx.__;
const pub = path.join(dir, 'holidays.public.csv');
let fehler = 0, geprueft = 0;
if (fs.existsSync(pub)) {
  // Nur landesweite Feiertage (Subdivisions leer = bundesweit, sonst Liste von Ländern)
  const soll = {};
  for (const c of csv(pub)) {
    const [, , start, , type, scope, , name, subs] = c;
    if (type !== 'Public' || !/^20(2[6-9]|30)/.test(start) || scope === 'Local') continue;
    const list = (subs || '').split(',').map(x => x.trim()).filter(Boolean);
    const lands = list.length ? list.filter(x => /^[A-Z]{2}$/.test(x)) : Object.keys(REGIONS);
    for (const r of lands) (soll[r] = soll[r] || new Set()).add(start + ' ' + deName(name));
  }
  for (const r of Object.keys(REGIONS)) {
    const ist = new Set();
    for (let y = 2026; y <= 2030; y++) for (const [iso] of Object.entries(publicHolidays(y, r))) ist.add(iso);
    const sollDaten = new Set([...(soll[r] || [])].map(x => x.slice(0, 10))
      .filter(iso => ![0, 6].includes(new Date(iso + 'T12:00').getDay()) || true));
    // Sonntage (Ostersonntag, Pfingstsonntag in BB) führt die App nicht – kein Schultag
    for (const iso of sollDaten) {
      if (new Date(iso + 'T12:00').getDay() === 0 && !ist.has(iso)) continue;
      geprueft++;
      if (!ist.has(iso)) { fehler++; console.error(`  ${r}: Feiertag ${iso} fehlt in der App (${[...soll[r]].find(x => x.startsWith(iso))})`); }
    }
    for (const iso of ist) if (!sollDaten.has(iso)) { fehler++; console.error(`  ${r}: ${iso} ist laut Datensatz kein landesweiter Feiertag`); }
  }
  if (fehler) { console.error(fehler + ' Abweichung(en) bei Feiertagen – nichts geschrieben.'); process.exit(1); }
}

// ---- Block schreiben -----------------------------------------------------------
const stand = new Date().toISOString().slice(0, 10);
const allRegions = Object.keys(data);
const key = r => /^[A-Z]{2}$/.test(r) ? r : JSON.stringify(r);
const lines = allRegions.map(r => `  ${key(r)}: [${data[r].map(x => `["${x[0]}","${x[1]}",${x[2]}]`).join(',')}]`);
const flines = Object.keys(feiertage).map(r => `  ${key(r)}: [${feiertage[r].map(x => `["${x[0]}",${x[1]}]`).join(',')}]`);
const block = `/* ==FERIEN-BEGIN== Schulferien je Land, erzeugt mit tools/make-ferien.js.
   Quelle: OpenHolidays API Data (openholidaysapi.org), Lizenz ODbL 1.0. Ohne Gewähr. */
const FERIEN_STAND = "${stand}", FERIEN_BIS = "${bis}";
const FERIEN_NAMES = ${JSON.stringify(names)};
const FERIEN = {
${lines.join(',\n')}
};
/* Österreich und Schweiz: Namen der Länder/Kantone und Feiertage aus dem Datensatz
   (DE rechnet die App selbst, siehe publicHolidays). */
const REGIONS_EXTRA = ${JSON.stringify(extraRegions)};
const FEIERTAG_NAMES = ${JSON.stringify(fnames)};
const FEIERTAGE_EXTRA = {
${flines.join(',\n')}
};
/* ==FERIEN-END== */`;
let out;
if (html.includes('/* ==FERIEN-BEGIN==')) {
  const a = html.indexOf('/* ==FERIEN-BEGIN=='), b = html.indexOf('/* ==FERIEN-END== */') + 20;
  out = html.slice(0, a) + block + html.slice(b);
} else {
  const at = html.indexOf('/* ==CORE-END== */') + 18;
  out = html.slice(0, at) + '\n\n' + block + html.slice(at);
}
fs.writeFileSync(INDEX, out);
const n = allRegions.reduce((s, r) => s + data[r].length, 0);
console.log(`FERIEN: ${allRegions.length} Regionen (DE ${regions.length}, AT/CH ${Object.keys(extraRegions).length}), ${n} Zeiträume bis ${bis}, ${(block.length / 1024).toFixed(1)} KB.`);
const leer = Object.keys(extraRegions).filter(r => !data[r] || !data[r].length);
if (leer.length) console.log('Ohne Ferien-Daten: ' + leer.join(', '));
console.log(`Feiertage geprüft: ${geprueft} Termine 2026–2030, keine Abweichung.`);
