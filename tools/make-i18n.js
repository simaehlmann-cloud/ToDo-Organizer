/* Setzt den Übersetzungsblock (==I18N-BEGIN== … ==I18N-END==) in index.html
   aus tools/i18n/ zusammen:
     engine.js    – Laufzeit (Sprachwahl, Übersetzen, MutationObserver)
     en.js        – Wörterbuch Deutsch → Englisch
     en-rules.js  – Regeln für zusammengesetzte Texte (JavaScript-Array)

     node tools/make-i18n.js          schreibt index.html
     node tools/make-i18n.js --check  prüft nur, ob index.html aktuell ist */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'i18n');
const FILE = path.join(__dirname, '..', 'index.html');

const engine = fs.readFileSync(path.join(DIR, 'engine.js'), 'utf8').trim();
delete require.cache[require.resolve('./i18n/en.js')];
const dict = require('./i18n/en.js');
const rules = fs.readFileSync(path.join(DIR, 'en-rules.js'), 'utf8').trim();

// Wörterbuch prüfen: keine leeren Werte, keine Schlüssel mit Rand-Leerraum
for (const [k, v] of Object.entries(dict)) {
  if (typeof v !== 'string' || !v) throw new Error('Leere Übersetzung: ' + k);
  if (k !== k.trim()) throw new Error('Schlüssel mit Leerraum am Rand: ' + JSON.stringify(k));
}
// Regeln müssen sich auswerten lassen
const rx = eval(rules);
if (!Array.isArray(rx) || rx.some(r => !(r[0] instanceof RegExp))) throw new Error('en-rules.js: kein Array aus [RegExp, Ersatz]');
for (const [r] of rx) if (r.flags.includes('g')) throw new Error('Regel mit g-Flag: ' + r);

const lines = Object.keys(dict).map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(dict[k]));
const block = engine
  .replace('/*DICT*/{}/*DICT-END*/', '{\n' + lines.join(',\n') + '\n  }')
  .replace('/*RULES*/[]/*RULES-END*/', rules.replace(/\n/g, '\n  '));
if (block === engine) throw new Error('Platzhalter in engine.js fehlen');

const html = fs.readFileSync(FILE, 'utf8');
const a = html.indexOf('/* ==I18N-BEGIN==');
const END = '/* ==I18N-END== */';
const b = html.indexOf(END);
if (a < 0 || b < a) throw new Error('Marken ==I18N-BEGIN== / ==I18N-END== fehlen in index.html');
const out = html.slice(0, a) + block + html.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (out !== html) { console.error('index.html: Übersetzungsblock ist nicht aktuell – node tools/make-i18n.js ausführen.'); process.exit(1); }
  console.log('Übersetzungsblock aktuell (' + lines.length + ' Einträge, ' + rx.length + ' Regeln).');
} else {
  fs.writeFileSync(FILE, out);
  console.log('Übersetzungsblock geschrieben: ' + lines.length + ' Einträge, ' + rx.length + ' Regeln.');
}
