/* Statische Prüfung vor jedem Build (wie bei Zirkelwerk).
 *
 *   node validate.js
 *
 * Fängt die Fehler ab, die sonst erst auf dem teuren macOS-Läufer oder gar
 * erst in App Store Connect auffallen würden. Bricht mit Code 1 ab, sobald
 * eine Prüfung fehlschlägt.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fehler = [];
const E = m => fehler.push(m);
const lies = f => fs.readFileSync(f, 'utf8');
const gibt = f => fs.existsSync(f);

const APP_ID = 'de.maehlmann.todoorganizer';
const html = lies('index.html');

// ---- Skript übersetzbar --------------------------------------------------
const skripte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!skripte.length) E('index.html: kein Inline-Skript gefunden');
skripte.forEach((s, i) => {
  try { new vm.Script(s, { filename: 'index.html#script' + i }); }
  catch (e) { E('index.html: Syntaxfehler im Skript ' + i + ': ' + e.message); }
});

// ---- Version ---------------------------------------------------------------
const ver = (html.match(/const APP_VERSION = "(\d+\.\d+(?:\.\d+)?)"/) || [])[1];
if (!ver) E('APP_VERSION fehlt oder hat kein Format wie 3.0');

// ---- Kauf und Testphase ----------------------------------------------------
const konst = name => (html.match(new RegExp('const ' + name + ' *= *([^;\\n]+)')) || [])[1];
const full = (konst('PRODUCT_FULL') || '').replace(/"/g, '').trim();
const trial = (konst('PRODUCT_TRIAL') || '').replace(/"/g, '').trim();
if (full !== APP_ID + '.vollversion') E('PRODUCT_FULL ist "' + full + '", erwartet ' + APP_ID + '.vollversion');
if (trial !== APP_ID + '.testphase') E('PRODUCT_TRIAL ist "' + trial + '", erwartet ' + APP_ID + '.testphase');
if (konst('TRIAL_DAYS') !== '30') E('TRIAL_DAYS ist nicht 30 – Produktname in App Store Connect und Texte anpassen');
for (const f of ['README.md', 'APPSTORE-CONNECT.md', 'store/STORE-TEXTE.md']) {
  if (!gibt(f)) { E(f + ' fehlt'); continue; }
  const t = lies(f);
  if (!t.includes(full) || !t.includes(trial)) E(f + ': Produkt-IDs stimmen nicht mit index.html überein');
}
const iapAn = konst('IAP_ENABLED') === 'true', grenzenAn = konst('LIMITS_ACTIVE') === 'true';
if (grenzenAn && !iapAn) E('LIMITS_ACTIVE ohne IAP_ENABLED: Sperre ohne Kaufmöglichkeit – Apple lehnt ab');
if (iapAn) {
  for (const id of ['card-pro', 'btn-buy', 'btn-restore', 'btn-trial', 'dlg-pro'])
    if (!html.includes('id="' + id + '"')) E('Kaufbereich unvollständig: #' + id + ' fehlt');
  // Apple verlangt einen sichtbaren Knopf zum Wiederherstellen.
  if (!/Käufe wiederherstellen/.test(html)) E('Knopf „Käufe wiederherstellen“ fehlt');
}

// ---- Texte und bekannte Fehler ---------------------------------------------
const sichtbar = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
if (/Android-App/.test(sichtbar)) E('Sichtbarer Text nennt „Android-App“ – in der iOS-App falsch (Richtlinie 2.3.10)');
if (/Play Store|Google Play/.test(sichtbar)) E('Sichtbarer Text nennt Google Play (Richtlinie 2.3.10)');
if (!html.includes('[hidden]{display:none!important}')) E('CSS-Regel für [hidden] fehlt (Mehr-Felder, Passwortfelder)');
if (!html.includes('#toast:not(.show){visibility:hidden}')) E('Toast-Korrektur fehlt');
for (const f of ['datenschutz.html', 'impressum.html'])
  if (!html.includes('href="' + f + '"')) E('Info-Seite verlinkt ' + f + ' nicht');

// ---- Rechtstexte -------------------------------------------------------------
for (const f of ['datenschutz.html', 'impressum.html']) {
  if (!gibt(f)) { E(f + ' fehlt'); continue; }
  const t = lies(f);
  if (!t.includes('Oderstraße 13') || !t.includes('smaehlmann.appdev@gmail.com')) E(f + ': Anschrift oder E-Mail fehlt');
  if (!t.includes('href="index.html">Zurück zur App<')) E(f + ': Knopf „Zurück zur App“ fehlt');
}
if (gibt('datenschutz.html') && !/App Store/.test(lies('datenschutz.html'))) E('Datenschutzerklärung erwähnt den In-App-Kauf nicht');
try {
  const { erwarteteDateien } = require('./make-legal-pages.js');
  const diff = Object.entries(erwarteteDateien())
    .filter(([f, inhalt]) => !gibt(f) || lies(f) !== inhalt).map(([f]) => f);
  if (diff.length) E('docs/ veraltet – bitte „node make-legal-pages.js“ ausführen: ' + diff.join(', '));
} catch (e) { E('make-legal-pages.js: ' + e.message); }

// ---- Offline-Cache -------------------------------------------------------------
const sw = lies('sw.js');
if (!/const CACHE = "todo-organizer-v\d+"/.test(sw)) E('sw.js: Cache-Name fehlt');
for (const m of sw.matchAll(/"\.\/([^"]+)"/g))
  if (m[1] && !gibt(m[1])) E('sw.js nennt fehlende Datei ' + m[1]);

// ---- iOS-Projekt -----------------------------------------------------------------
const cap = JSON.parse(lies('capacitor.config.json'));
if (cap.appId !== APP_ID) E('capacitor.config.json: appId ist ' + cap.appId);
if (cap.webDir !== 'www') E('capacitor.config.json: webDir muss www sein (der Workflow kopiert dorthin)');
const setup = lies('tools/ios-setup.rb');
if (!setup.includes("APP_ID = '" + APP_ID + "'")) E('tools/ios-setup.rb: falsche Bundle-ID');
// Universal seit 2.4: Eine iPad-fähige App lässt sich nach dem Upload nicht
// mehr auf iPhone zurückstellen – diese Zeile soll niemand versehentlich ändern.
if (!setup.includes("s['TARGETED_DEVICE_FAMILY'] = '1,2'")) E('tools/ios-setup.rb: Gerätefamilie muss 1,2 (iPhone und iPad) sein');
if (!/min-width:761px[\s\S]{0,600}safe-area-inset-top/.test(html)) E('Breites Layout (iPad) ohne Safe-Area oben – Kopf läge unter der Statusleiste');
const priv = lies('res/ios/PrivacyInfo.xcprivacy');
if (!/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(priv)) E('Privacy-Manifest: NSPrivacyTracking muss false sein');
if (!priv.includes('CA92.1')) E('Privacy-Manifest: Grund CA92.1 (UserDefaults) fehlt');

// App-Icon: 1024 × 1024, RGB ohne Alphakanal (sonst Ablehnung beim Upload)
try {
  const b = fs.readFileSync('res/ios/icon-1024.png');
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), farbtyp = b[25];
  if (w !== 1024 || h !== 1024) E('Icon ist ' + w + '×' + h + ', erwartet 1024×1024');
  if (farbtyp !== 2) E('Icon hat Farbtyp ' + farbtyp + ' – erwartet 2 (RGB ohne Alpha); python3 make-icons.py ausführen');
} catch (e) { E('res/ios/icon-1024.png fehlt'); }

// Feste Paketversionen: TestFlight- und Store-Build sollen gleich bauen.
const pkg = JSON.parse(lies('package.json'));
for (const [n, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }))
  if (!/^\d+\.\d+\.\d+$/.test(v)) E('package.json: ' + n + ' ist nicht fest gepinnt (' + v + ')');
if (!pkg.dependencies['capacitor-plugin-cdv-purchase']) E('Kauf-Plugin fehlt in package.json');

// ---- Store-Texte: Apples Höchstlängen ------------------------------------------------
if (gibt('store/STORE-TEXTE.md')) {
  const st = lies('store/STORE-TEXTE.md');
  let n = 0;
  for (const m of st.matchAll(/### ([^\n(]+)\(max\. (\d+)\)\n```\n([\s\S]*?)\n```/g)) {
    n++;
    const text = m[3], max = +m[2];
    if ([...text].length > max) E('STORE-TEXTE.md: „' + m[1].trim() + '“ hat ' + [...text].length + ' Zeichen, erlaubt ' + max);
    if (/Schlüsselwörter/.test(m[1]) && /, /.test(text)) E('Schlüsselwörter ohne Leerzeichen nach dem Komma (jedes zählt mit)');
  }
  if (n < 8) E('STORE-TEXTE.md: Felder mit Längenangabe nicht gefunden (' + n + ')');
} else E('store/STORE-TEXTE.md fehlt');

// ---- Workflow ------------------------------------------------------------------------
const wf = lies('.github/workflows/ios.yml');
for (const s of ['IOS_CERTIFICATE_P12_BASE64', 'IOS_PROVISIONING_PROFILE', 'IOS_TEAM_ID', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8'])
  if (!wf.includes('secrets.' + s)) E('ios.yml: Secret ' + s + ' wird nicht verwendet');
if (!wf.includes("github.event_name == 'workflow_dispatch'")) E('ios.yml: Upload darf nur beim manuellen Start laufen');
for (const k of ['NSCalendarsFullAccessUsageDescription', 'NSCalendarsWriteOnlyAccessUsageDescription', 'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSRemindersFullAccessUsageDescription'])
  if (!wf.includes(k)) E('ios.yml: Erlaubnistext ' + k + ' fehlt (iOS beendet sonst die App)');
if (/UIUserInterfaceStyle string Light/.test(wf)) E('ios.yml erzwingt helle Darstellung – 3.0 hat einen Dunkelmodus');
if (!wf.includes('node tests/app.test.js') || !wf.includes('node tests/core.test.js')) E('ios.yml: Tests fehlen in der Prüfkette');

// ---- Kauf-Aufteilung: Erinnerungen sind frei ---------------------------------------
const proKeys = (html.match(/const PRO_KEYS\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
if (/reminders/.test(proKeys)) E('Erinnerungen stehen in PRO_KEYS – sie gehören seit 3.0 zur kostenlosen Grundversion');
if (!html.includes('==CORE-BEGIN==') || !html.includes('==CORE-END==')) E('CORE-Block-Markierungen fehlen (tests/core.test.js braucht sie)');

// ---- Heute-Widget (seit 3.1) ---------------------------------------------------------
for (const f of ['res/ios/widget/TodayWidget.swift', 'res/ios/widget/Info.plist', 'res/ios/widget/TodayWidget.entitlements',
                 'res/ios/widget/PrivacyInfo.xcprivacy', 'res/ios/app/WidgetDataPlugin.swift', 'res/ios/app/AppViewController.swift',
                 'res/ios/app/App.entitlements'])
  if (!gibt(f)) E(f + ' fehlt (Heute-Widget)');
if (gibt('res/ios/widget/TodayWidget.swift')) {
  const sw = lies('res/ios/widget/TodayWidget.swift'), pl = lies('res/ios/app/WidgetDataPlugin.swift');
  const grp = 'group.' + 'de.maehlmann.todoorganizer';
  for (const [n, t] of [['TodayWidget.swift', sw], ['WidgetDataPlugin.swift', pl], ['App.entitlements', lies('res/ios/app/App.entitlements')],
                        ['TodayWidget.entitlements', lies('res/ios/widget/TodayWidget.entitlements')]])
    if (!t.includes(grp)) E(n + ': App-Gruppe ' + grp + ' fehlt');
  if (!/jsName = "WidgetData"/.test(pl) || !html.includes('Plugins.WidgetData')) E('Widget-Brücke: Name in Swift und index.html passt nicht (WidgetData)');
  if (!/1C8F\.1/.test(lies('res/ios/PrivacyInfo.xcprivacy'))) E('PrivacyInfo der App: Grund 1C8F.1 (App-Gruppe) fehlt');
}
if (!wf.includes('node tests/purchase.test.js')) E('ios.yml: Ladeprüfung des Kaufmoduls fehlt (tests/purchase.test.js)');
if (/^\s*return window\.Capacitor\.registerPlugin/m.test(lies('tools/capacitor-core-shim.js')))
  E('capacitor-core-shim.js ruft registerPlugin ohne Prüfung auf – die iOS-Brücke hat diese Funktion nicht (Käufe gehen dann nicht)');
if (!wf.includes('IOS_PROVISIONING_PROFILE_WIDGET') || !wf.includes('export WIDGET=1')) E('ios.yml: Heute-Widget nicht eingebunden');
if (!wf.includes('CFBundleURLSchemes') || !html.includes('todoorganizer:')) E('Link-Schema todoorganizer fehlt (Widget öffnet sonst nur die App)');

// ---- Ferien (seit 3.1): Daten vorhanden, Quelle genannt, nicht veraltet ------------
if (!html.includes('/* ==FERIEN-BEGIN==') || !html.includes('/* ==FERIEN-END== */')) E('FERIEN-Block fehlt – node tools/make-ferien.js ausführen');
else {
  const bis = (html.match(/FERIEN_BIS = "(\d{4}-\d{2}-\d{2})"/) || [])[1] || '';
  const regionen = (html.slice(html.indexOf('const FERIEN = {'), html.indexOf('/* ==FERIEN-END== */')).match(/^  [A-Z]{2}: \[/gm) || []).length;
  if (regionen !== 16) E('FERIEN: ' + regionen + ' statt 16 Länder');
  const inEinemJahr = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  if (!bis) E('FERIEN_BIS fehlt');
  else if (bis < inEinemJahr) console.log('Hinweis: Ferientermine reichen nur bis ' + bis + ' – tools/make-ferien.js mit neuen Daten ausführen.');
  if (!/OpenHolidays/.test(html.slice(html.indexOf('id="view-about"')))) E('Quellenangabe OpenHolidays (ODbL) fehlt auf der Info-Seite');
}
for (const f of ['tests/core.test.js', 'tests/app.test.js']) if (!gibt(f)) E(f + ' fehlt');
for (const dep of ['@ebarooni/capacitor-calendar', '@capacitor/status-bar'])
  if (!pkg.dependencies[dep]) E('package.json: ' + dep + ' fehlt');

if (fehler.length) {
  console.error('✗ ' + fehler.length + ' Problem(e):\n  - ' + fehler.join('\n  - '));
  process.exit(1);
}
console.log('✓ validate.js: alles in Ordnung (Version ' + ver + ')');
