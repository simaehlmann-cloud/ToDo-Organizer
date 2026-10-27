/* Schulferien aller 16 Länder in index.html eintragen (Block FERIEN).

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
const lines = regions.map(r => `  ${r}: [${data[r].map(x => `["${x[0]}","${x[1]}",${x[2]}]`).join(',')}]`);
const block = `/* ==FERIEN-BEGIN== Schulferien je Land, erzeugt mit tools/make-ferien.js.
   Quelle: OpenHolidays API Data (openholidaysapi.org), Lizenz ODbL 1.0. Ohne Gewähr. */
const FERIEN_STAND = "${stand}", FERIEN_BIS = "${bis}";
const FERIEN_NAMES = ${JSON.stringify(names)};
const FERIEN = {
${lines.join(',\n')}
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
const n = regions.reduce((s, r) => s + data[r].length, 0);
console.log(`FERIEN: ${regions.length} Länder, ${n} Zeiträume bis ${bis}, ${(block.length / 1024).toFixed(1)} KB.`);
console.log(`Feiertage geprüft: ${geprueft} Termine 2026–2030, keine Abweichung.`);
