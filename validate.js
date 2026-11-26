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
// Englische Fassungen (seit Update 14): privacy.html, legal-notice.html
for (const f of ['privacy.html', 'legal-notice.html']) {
  if (!gibt(f)) { E(f + ' fehlt'); continue; }
  const t = lies(f);
  if (!t.includes('Oderstraße 13') || !t.includes('smaehlmann.appdev@gmail.com')) E(f + ': Anschrift oder E-Mail fehlt');
  if (!t.includes('href="index.html">Back to the app<')) E(f + ': Knopf „Back to the app“ fehlt');
  if (!/<html lang="en">/.test(t)) E(f + ': lang="en" fehlt');
}
if (gibt('privacy.html') && !/App Store/.test(lies('privacy.html'))) E('privacy.html erwähnt den In-App-Kauf nicht');
if (gibt('privacy.html') && !/iCloud/.test(lies('privacy.html'))) E('privacy.html erwähnt den iCloud-Abgleich nicht');
if (!html.includes('["datenschutz.html", "privacy.html"]')) E('App verlinkt auf Englisch nicht privacy.html');
for (const w of ['ios.yml', 'android.yml']) {
  const y = lies('.github/workflows/' + w);
  if (!/privacy\.html legal-notice\.html/.test(y)) E(w + ': privacy.html/legal-notice.html werden nicht ins App-Paket kopiert');
}
if (!/privacy\.html/.test(lies('sw.js'))) E('sw.js: privacy.html fehlt im Offline-Cache');
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
                 'res/ios/widget/PrivacyInfo.xcprivacy', 'res/ios/app/WidgetDataPlugin.swift', 'res/ios/app/SceneDelegate.swift',
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
if (!wf.includes('UIFileSharingEnabled bool true') || !wf.includes('LSSupportsOpeningDocumentsInPlace bool true'))
  E('ios.yml: Dokumente-Ordner nicht freigegeben – die automatische Sicherung wäre in der Dateien-App unsichtbar');
if (!wf.includes('node tests/purchase.test.js')) E('ios.yml: Ladeprüfung des Kaufmoduls fehlt (tests/purchase.test.js)');
if (/^\s*return window\.Capacitor\.registerPlugin/m.test(lies('tools/capacitor-core-shim.js')))
  E('capacitor-core-shim.js ruft registerPlugin ohne Prüfung auf – die iOS-Brücke hat diese Funktion nicht (Käufe gehen dann nicht)');
if (!wf.includes('IOS_PROVISIONING_PROFILE_WIDGET') || !wf.includes('export WIDGET=1')) E('ios.yml: Heute-Widget nicht eingebunden');
if (!/packageClassList[\s\S]{0,80}WidgetDataPlugin/.test(lies('tools/ios-setup.rb'))) E('ios-setup.rb: WidgetDataPlugin wird nicht in packageClassList eingetragen – die Brücke käme nie an');
if (/Main\.storyboard/.test(lies('tools/ios-setup.rb'))) E('ios-setup.rb ändert Main.storyboard – in Capacitor 8 wirkungslos (SceneDelegate)');
if (!wf.includes('CFBundleURLSchemes') || !html.includes('todoorganizer:')) E('Link-Schema todoorganizer fehlt (Widget öffnet sonst nur die App)');

// ---- Ferien (seit 3.1): Daten vorhanden, Quelle genannt, nicht veraltet ------------
if (!html.includes('/* ==FERIEN-BEGIN==') || !html.includes('/* ==FERIEN-END== */')) E('FERIEN-Block fehlt – node tools/make-ferien.js ausführen');
else {
  const bis = (html.match(/FERIEN_BIS = "(\d{4}-\d{2}-\d{2})"/) || [])[1] || '';
  const fb = html.slice(html.indexOf('const FERIEN = {'), html.indexOf('/* ==FERIEN-END== */'));
  const ferienTeil = fb.slice(0, fb.indexOf('};'));
  const regionen = (ferienTeil.match(/^  [A-Z]{2}: \[/gm) || []).length;
  if (regionen !== 16) E('FERIEN: ' + regionen + ' statt 16 Länder');
  const atch = (ferienTeil.match(/^  "(AT|CH)-[^"]+": \[/gm) || []).length;
  if (atch !== 35) E('FERIEN: ' + atch + ' statt 35 Regionen in Österreich/Schweiz');
  if (!fb.includes('const FEIERTAGE_EXTRA = {')) E('FEIERTAGE_EXTRA fehlt (Österreich/Schweiz)');
  const inEinemJahr = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  if (!bis) E('FERIEN_BIS fehlt');
  else if (bis < inEinemJahr) console.log('Hinweis: Ferientermine reichen nur bis ' + bis + ' – tools/make-ferien.js mit neuen Daten ausführen.');
  if (!/OpenHolidays/.test(html.slice(html.indexOf('id="view-about"')))) E('Quellenangabe OpenHolidays (ODbL) fehlt auf der Info-Seite');
}
for (const f of ['tests/core.test.js', 'tests/app.test.js', 'tests/i18n.test.js', 'tests/ios-mocks.js']) if (!gibt(f)) E(f + ' fehlt');

// ---- Englisch: Übersetzungsblock aktuell, Englisch-Dateien fürs Gerät vorhanden --------
{
  const r = require('child_process').spawnSync(process.execPath, ['tools/make-i18n.js', '--check'], { encoding: 'utf8' });
  if (r.status !== 0) E((r.stderr || r.stdout || 'make-i18n.js --check').trim());
  if (!/const T = s => I18N\.tr\(s\);/.test(html)) E('index.html: T() fehlt');
  if (!gibt('res/ios/app/en.lproj/InfoPlist.strings')) E('res/ios/app/en.lproj/InfoPlist.strings fehlt (englische Rückfragen)');
  else {
    const ip = lies('res/ios/app/en.lproj/InfoPlist.strings');
    for (const k of ['NSCalendarsFullAccessUsageDescription', 'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSRemindersFullAccessUsageDescription'])
      if (!ip.includes('"' + k + '"')) E('en.lproj/InfoPlist.strings: ' + k + ' fehlt');
  }
  if (!wf.includes('CFBundleLocalizations')) E('ios.yml: CFBundleLocalizations (de, en) fehlt');
  for (const f of ['InfoPlist.strings', 'AppShortcuts.strings', 'Localizable.strings']) {
    const pf = 'res/ios/app/en.lproj/' + f;
    if (!gibt(pf)) { E(pf + ' fehlt'); continue; }
    lies(pf).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(z => z.trim()).filter(Boolean).forEach(z => {
      if (!/^"(?:[^"\\]|\\.)*" = "(?:[^"\\]|\\.)*";$/.test(z)) E(pf + ': Zeile ungültig: ' + z.slice(0, 60));
    });
  }
  // Siri-Sätze: jeder englische Schlüssel muss in ToDoIntents.swift als deutscher Satz stehen
  const intents = lies('res/ios/app/ToDoIntents.swift');
  for (const m of lies('res/ios/app/en.lproj/AppShortcuts.strings').matchAll(/^"([^"]+)" =/gm))
    if (!intents.includes('"' + m[1].replace('${applicationName}', '\\(.applicationName)') + '"')) E('AppShortcuts.strings: „' + m[1] + '“ steht nicht in ToDoIntents.swift');
}
for (const dep of ['@ebarooni/capacitor-calendar', '@capacitor/status-bar'])
  if (!pkg.dependencies[dep]) E('package.json: ' + dep + ' fehlt');

if (fehler.length) {
  console.error('✗ ' + fehler.length + ' Problem(e):\n  - ' + fehler.join('\n  - '));
  process.exit(1);
}
console.log('✓ validate.js: alles in Ordnung (Version ' + ver + ')');
