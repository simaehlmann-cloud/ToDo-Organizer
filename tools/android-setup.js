/* Passt das frisch erzeugte Android-Projekt an (nach `npx cap add android`).

     node tools/android-setup.js <versionName> <versionCode>

   Wie beim iOS-Lauf liegt im Repository nur der Web-Teil; das Android-Projekt
   entsteht bei jedem Lauf neu. Dieses Skript trägt ein, was Capacitor nicht
   von selbst setzt:
     - App-Symbol (res/android/mipmap-*) statt des Capacitor-Logos
     - Startbildschirm und Fensterhintergrund im Hellgrau der App (dunkel im Nachtmodus)
     - Kalender-Berechtigungen (Termine in der Woche, „In Kalender eintragen“)
     - „Teilen → ToDo Organizer“ für Text aus anderen Apps
     - Link-Schema todoorganizer:// und Kurzbefehle am App-Symbol (lange drücken)
     - Versionsname und -nummer
   Bricht ab, wenn eine erwartete Stelle im Projekt fehlt – dann hat sich die
   Capacitor-Vorlage geändert und das Skript muss nachgezogen werden. */
const fs = require('fs');
const path = require('path');

const [, , versionName, versionCode] = process.argv;
if (!/^\d+(\.\d+)*$/.test(versionName || '') || !/^\d+$/.test(versionCode || '')) {
  console.error('Aufruf: node tools/android-setup.js <versionName> <versionCode>');
  process.exit(1);
}
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'android', 'app');
const MAIN = path.join(APP, 'src', 'main');
const RES = path.join(MAIN, 'res');
const PKG = 'de.maehlmann.todoorganizer';

const read = f => fs.readFileSync(f, 'utf8');
function patch(file, pairs) {
  let s = read(file);
  for (const [from, to, label] of pairs) {
    if (typeof from === 'string' ? !s.includes(from) : !from.test(s)) {
      console.error(`::error::${path.relative(ROOT, file)}: Stelle „${label}“ nicht gefunden.`);
      process.exit(1);
    }
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s);
}
function write(rel, text) {
  const f = path.join(RES, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

// ---- App-Symbol --------------------------------------------------------------
const ICONS = path.join(ROOT, 'res', 'android');
let icons = 0;
for (const d of fs.readdirSync(ICONS).filter(d => d.startsWith('mipmap-'))) {
  fs.mkdirSync(path.join(RES, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(ICONS, d))) {
    fs.copyFileSync(path.join(ICONS, d, f), path.join(RES, d, f));
    icons++;
  }
}
if (icons < 20) { console.error('::error::Zu wenige App-Symbole in res/android gefunden (' + icons + ').'); process.exit(1); }
// Die Vorlage legt das Vordergrundbild teils als drawable ab – unseres liegt
// als mipmap vor (siehe mipmap-anydpi-v26/ic_launcher.xml).

// ---- Farben, Texte, Kurzbefehle ---------------------------------------------
write('values/todo_colors.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="todo_bg">#E9ECF0</color>
</resources>
`);
write('values-night/todo_colors.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="todo_bg">#0F1115</color>
</resources>
`);
write('values/todo_strings.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="sc_task_short">Neue Aufgabe</string>
    <string name="sc_week_short">Woche</string>
    <string name="sc_timetable_short">Stundenplan</string>
    <string name="sc_shopping_short">Einkaufsliste</string>
</resources>
`);
// Sprachen: Android nimmt „values“ für jede Sprache ohne eigenen Ordner. Deshalb
// steht Englisch in values (auch für Französisch usw.) und Deutsch in values-de.
write('values-de/todo_strings.xml', read(path.join(RES, 'values', 'todo_strings.xml')));
write('values/todo_strings.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="sc_task_short">New task</string>
    <string name="sc_week_short">Week</string>
    <string name="sc_timetable_short">Timetable</string>
    <string name="sc_shopping_short">Shopping list</string>
</resources>
`);
const sc = (id, slug, label) => `    <shortcut
        android:shortcutId="${id}"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/${label}">
        <intent
            android:action="android.intent.action.VIEW"
            android:data="todoorganizer://${slug}"
            android:targetPackage="${PKG}"
            android:targetClass="${PKG}.MainActivity" />
    </shortcut>`;
write('xml/shortcuts.xml', `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${sc('new-task', 'new-task', 'sc_task_short')}
${sc('week', 'week', 'sc_week_short')}
${sc('timetable', 'timetable', 'sc_timetable_short')}
${sc('shopping', 'shopping', 'sc_shopping_short')}
</shortcuts>
`);

// ---- Startbildschirm und Hintergrund ----------------------------------------
// Statt des gestreckten Capacitor-Bildes: Hellgrau mit dem App-Symbol
// (Android 12+ zeigt das Symbol selbst, ältere Fassungen nur die Fläche).
patch(path.join(RES, 'values', 'styles.xml'), [
  ['<item name="android:background">@drawable/splash</item>',
   '<item name="android:background">@color/todo_bg</item>\n        <item name="windowSplashScreenBackground">@color/todo_bg</item>\n        <item name="android:windowBackground">@color/todo_bg</item>',
   'Startbildschirm (AppTheme.NoActionBarLaunch)'],
  ['<item name="android:background">@null</item>',
   '<item name="android:background">@null</item>\n        <item name="android:windowBackground">@color/todo_bg</item>',
   'Hintergrund (AppTheme.NoActionBar)']
]);

// ---- Manifest ----------------------------------------------------------------
const MANIFEST = path.join(MAIN, 'AndroidManifest.xml');
patch(MANIFEST, [
  [/(<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN" \/>\s*<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>)/,
   `$1

            <!-- Teilen → ToDo Organizer: Text aus anderen Apps wird zur Aufgabe -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/*" />
            </intent-filter>

            <!-- todoorganizer://week usw. (Kurzbefehle am App-Symbol) -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="todoorganizer" />
            </intent-filter>

            <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />`,
   'Start-Intent der MainActivity'],
  ['<uses-permission android:name="android.permission.INTERNET" />',
   `<uses-permission android:name="android.permission.INTERNET" />
    <!-- Termine aus dem Gerätekalender in der Woche zeigen, Aufgaben auf Wunsch eintragen -->
    <uses-permission android:name="android.permission.READ_CALENDAR" />
    <uses-permission android:name="android.permission.WRITE_CALENDAR" />`,
   'Berechtigungen']
]);

// ---- Version -------------------------------------------------------------------
patch(path.join(APP, 'build.gradle'), [
  [/versionCode \d+/, `versionCode ${versionCode}`, 'versionCode'],
  [/versionName "[^"]*"/, `versionName "${versionName}"`, 'versionName']
]);

console.log(`Android-Projekt angepasst: Version ${versionName} (${versionCode}), ${icons} Symbole.`);
