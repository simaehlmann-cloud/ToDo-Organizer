/* Erzeugt aus den Rechtstexten der App die Fassungen für GitHub Pages.
 *
 *   node make-legal-pages.js
 *
 * Wie bei Zirkelwerk: Die Dateien im Wurzelverzeichnis sind die einzige
 * Quelle. Pages liefert nur docs/ aus, die App selbst wird damit nicht
 * veröffentlicht. „Zurück zur App" zeigt im Web auf die Übersichtsseite.
 * Kein Verweis in einen bestimmten Store (Apple-Richtlinie 2.3.10).
 *
 * validate.js führt dieselbe Umformung im Speicher aus und vergleicht.
 * Wer einen Rechtstext ändert und dieses Skript vergisst, fällt durch.
 */
const fs = require('fs');
const path = require('path');

const ZIEL = 'docs';
const ORDNER = 'todo-organizer';

function fuerWeb(html) {
  return html
    .replace(/href="index\.html">Zurück zur App</g, 'href="../">Zur Übersicht<')
    .replace(/href="index\.html">Back to the app</g, 'href="../en/">Overview<')
    .replace(/<title>([^<]*)<\/title>/, '<title>$1</title>\n<meta name="robots" content="index, follow">');
}

const START = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ToDo Organizer – Planer für Schule und Alltag</title>
<meta name="description" content="Der private Planer für Schule und Alltag: Aufgaben, Stundenplan mit Ferien, Stundennotizen, Vertretungen, Kalender und Einkaufslisten – ohne Konto, ohne Server.">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#e9ecf0">
<link rel="icon" href="img/icon.png">
<style>
  :root { --bg:#e9ecf0; --card:#fff; --text:#1f2937; --muted:#5b6472; --accent:#2563eb; --soft:#eef4ff; --line:#dfe3e8; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1115; --card:#191c23; --text:#e7e9ee; --muted:#9aa3b2; --accent:#7ea2ff; --soft:#17223b; --line:#2a2f3a; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); line-height:1.55;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .wrap { max-width:980px; margin:0 auto; padding:0 16px; }
  header { padding:40px 0 18px; }
  .brand { display:flex; align-items:center; gap:14px; }
  .brand img { width:64px; height:64px; border-radius:15px; box-shadow:0 4px 14px rgba(0,0,0,.12); }
  h1 { font-size:clamp(28px,5vw,42px); line-height:1.15; margin:18px 0 10px; letter-spacing:-.01em; }
  .lead { font-size:clamp(17px,2.4vw,20px); color:var(--muted); max-width:680px; margin:0; }
  .pills { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; padding:0; list-style:none; }
  .pills li { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:6px 13px; font-size:14px; font-weight:600; }
  .shots { display:flex; gap:14px; overflow-x:auto; padding:22px 2px 18px; scroll-snap-type:x mandatory; }
  .shots img { width:min(230px,62vw); height:auto; border-radius:18px; scroll-snap-align:start; flex:none;
               box-shadow:0 6px 22px rgba(15,23,42,.14); background:var(--card); }
  section { margin:26px 0; }
  h2 { font-size:24px; margin:0 0 14px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; }
  .card { background:var(--card); border-radius:14px; padding:18px 18px 14px; border:1px solid var(--line); }
  .card h3 { margin:0 0 6px; font-size:17px; }
  .card p { margin:0; color:var(--muted); font-size:15px; }
  .promise { background:var(--soft); border-radius:16px; padding:20px; }
  .promise p { margin:0 0 8px; }
  details { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin:8px 0; }
  summary { font-weight:600; cursor:pointer; }
  details p { margin:10px 0 2px; color:var(--muted); }
  a { color:var(--accent); }
  footer { padding:26px 0 40px; color:var(--muted); font-size:14px; }
  footer a { margin-right:14px; }
</style>
</head>
<body>
<header class="wrap">
  <div class="brand"><img src="img/icon.png" alt="" width="64" height="64"><strong style="font-size:20px">ToDo Organizer</strong></div>
  <h1>Der private Planer für Schule und Alltag</h1>
  <p class="lead">Aufgaben, Termine und Stundenplan an einem Ort – mit Ferien, Notizen zu jeder Stunde und
  Erinnerungen. Ohne Konto, ohne Werbung, ohne Server.</p>
  <ul class="pills"><li>iPhone und iPad</li><li>Einmalkauf statt Abo</li><li>30 Tage alles testen</li></ul>
</header>

<main class="wrap">
  <div class="shots" aria-label="Bildschirmfotos">
    <img src="img/screen-01.jpg" alt="Woche mit Unterricht, Aufgaben und Terminen" loading="lazy" width="540" height="1174">
    <img src="img/screen-02.jpg" alt="Stundenplan mit A/B-Wochen und Doppelstunden" loading="lazy" width="540" height="1174">
    <img src="img/screen-03.jpg" alt="Notizen zu jeder Stunde" loading="lazy" width="540" height="1174">
    <img src="img/screen-04.jpg" alt="Plus- und Minusstunden" loading="lazy" width="540" height="1174">
    <img src="img/screen-06.jpg" alt="Schnelleingabe" loading="lazy" width="540" height="1174">
    <img src="img/screen-09.jpg" alt="Einkaufslisten im Dunkelmodus" loading="lazy" width="540" height="1174">
  </div>

  <section>
    <h2>Für Lehrkräfte ein echter Unterrichtsplaner</h2>
    <div class="grid">
      <div class="card"><h3>Stundenplan mit Ferien</h3><p>Ferien und Feiertage für Deutschland, Österreich und die Schweiz sind eingebaut. A/B-Wochen, Doppelstunden und Aufsichten gehören dazu.</p></div>
      <div class="card"><h3>Notizen zu jeder Stunde</h3><p>Festhalten, was dran war, und „für die nächste Stunde merken“. Der Stundenverlauf je Klasse zeigt alles nach Datum.</p></div>
      <div class="card"><h3>Noch X Stunden bis …</h3><p>Wie viele Stunden bleiben bis zur Klassenarbeit oder zu den Ferien? Die App zählt mit – Ausfälle eingerechnet.</p></div>
      <div class="card"><h3>Plus- und Minusstunden</h3><p>Vertretung und Ausfall mit einem Tipp eintragen, Übersicht je Schuljahr, PDF für die Schulleitung.</p></div>
      <div class="card"><h3>Klassenarbeiten planen</h3><p>Vorbereiten, schreiben, zurückgeben – die Aufgaben legt die App an. Hausaufgaben „bis zur nächsten Stunde“ der Klasse.</p></div>
      <div class="card"><h3>Ohne Schülerdaten</h3><p>Keine Namen, keine Noten, keine Cloud des Anbieters. Darum bleibt die App auch datenschutzrechtlich einfach.</p></div>
    </div>
  </section>

  <section>
    <h2>Und für alle anderen</h2>
    <div class="grid">
      <div class="card"><h3>Schreib einfach los</h3><p>„Training Di 18–19:30 #Sport“ – Datum, Uhrzeit, Kategorie und Wiederholung erkennt die App selbst. Auch per Siri.</p></div>
      <div class="card"><h3>Woche und Kalender</h3><p>Aufgaben, Termine aus deinen Kalendern (auch Google) und Abos von Schule oder Verein in einer Ansicht.</p></div>
      <div class="card"><h3>Familie, Studium, Verein</h3><p>Passende Einstellungen beim Start: Vorlesungen, Termine der Kinder, Trainingszeiten und Spieltage.</p></div>
      <div class="card"><h3>Gewohnheiten und Einkauf</h3><p>Wochenziele mit Serien, Einkaufslisten mit Vorschlägen – und ein Wochenrückblick am Sonntag.</p></div>
      <div class="card"><h3>Widget und Kurzbefehle</h3><p>Der Tag auf dem Home-Bildschirm, die Zahl der fälligen Aufgaben am Symbol, Schnellaktionen per langem Druck.</p></div>
      <div class="card"><h3>iPhone und iPad gleich</h3><p>Abgleich über dein eigenes iCloud-Konto – ohne fremden Server.</p></div>
    </div>
  </section>

  <section class="promise">
    <h2>Deine Daten bleiben bei dir</h2>
    <p>Kein Konto, keine Werbung, keine Analyse-Werkzeuge. Alles liegt auf deinem Gerät – und, wenn du willst,
    in deinem eigenen iCloud-Konto. Sicherungen lassen sich verschlüsseln.</p>
    <p><a href="${ORDNER}/datenschutz.html">Datenschutzerklärung lesen</a></p>
  </section>

  <section>
    <h2>Hilfe und häufige Fragen</h2>
    <details><summary>Wo liegen meine Daten?</summary>
      <p>Auf deinem Gerät. Mit eingeschaltetem iCloud-Abgleich zusätzlich in deinem iCloud-Konto bei Apple. Es gibt keinen Server des Anbieters.
      Sichere regelmäßig unter Einstellungen → Sicherung; die App erinnert dich daran und legt auf Wunsch jede Woche selbst eine Sicherung an.</p></details>
    <details><summary>Wie komme ich auf ein neues Gerät?</summary>
      <p>Mit iCloud-Abgleich: auf beiden Geräten einschalten, fertig. Sonst: auf dem alten Gerät exportieren, die Datei aufs neue bringen
      und dort unter Einstellungen → Sicherung → Importieren einlesen.</p></details>
    <details><summary>Was passiert nach der Testphase?</summary>
      <p>Aufgaben bleiben kostenlos – mit Schnelleingabe, Uhrzeit, Erinnerungen, Wiederholungen, Unterpunkten und Notizen, dazu Ferien und Feiertage.
      Kalender, Stundenplan mit allen Schul-Funktionen, Gewohnheiten, Einkaufslisten, iCloud-Abgleich und Statistik schaltet die Vollversion frei –
      ein Einmalkauf ohne Abo, mit Familienfreigabe. Deine Einträge bleiben in jedem Fall gespeichert.</p></details>
    <details><summary>Wie kommen Ferien und Feiertage in die App?</summary>
      <p>Einstellungen → Feiertage und Ferien → Bundesland oder Kanton wählen. Die Daten für Deutschland, Österreich und die Schweiz
      sind in der App hinterlegt (Quelle: OpenHolidays API, Lizenz ODbL) – ohne Abruf aus dem Netz, ohne Gewähr.</p></details>
    <details><summary>Wie binde ich meinen Google-Kalender ein?</summary>
      <p>Einstellungen → Kalender verbinden → „Google-Kalender hinzufügen“. Die App führt Schritt für Schritt durch beide Wege:
      über das Gerät (empfohlen) oder als Abo mit der geheimen iCal-Adresse.</p></details>
    <details><summary>Wie nutze ich Siri?</summary>
      <p>„Hey Siri, neue Aufgabe in ToDo Organizer“ – Siri fragt nach dem Text, Datum und Uhrzeit werden erkannt.
      „Hey Siri, was steht heute an in ToDo Organizer?“ liest deinen Tag vor. Beides gibt es auch in der Kurzbefehle-App.</p></details>
    <details><summary>Ich habe die Vollversion schon gekauft.</summary>
      <p>Einstellungen → Vollversion → „Käufe wiederherstellen“. Das gilt auch für die Familienfreigabe.</p></details>
    <details><summary>Erinnerungen kommen nicht oder zu spät.</summary>
      <p>iPhone/iPad: Einstellungen → Mitteilungen → ToDo Organizer → Mitteilungen erlauben. Android: in der App unter Einstellungen →
      Erinnerungen „Pünktliche Erinnerungen erlauben“ und das Akkusparen für die App ausschalten.</p></details>
    <p style="margin-top:14px">Fragen, Fehler, Wünsche: <a href="mailto:smaehlmann.appdev@gmail.com">smaehlmann.appdev@gmail.com</a></p>
  </section>
</main>

<footer class="wrap">
  <a href="${ORDNER}/datenschutz.html">Datenschutz</a><a href="${ORDNER}/impressum.html">Impressum</a><a href="en/" lang="en">🇬🇧 English</a>
  <span>ToDo Organizer · Wisdompeak Apps – Simon Mählmann</span>
</footer>
</body>
</html>
`;

/* Englische Übersichtsseite (Support-URL der englischen Store-Lokalisierung):
   gleiches Aussehen, eigener Text, Bilder aus docs/img/en/. */
const STYLE = START.slice(START.indexOf('<style>'), START.indexOf('</style>') + 8);
const START_EN = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ToDo Organizer – Planner for school and life</title>
<meta name="description" content="The private planner for school and everyday life: tasks, timetable with holidays, lesson notes, covers, calendar and shopping lists – no account, no server.">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#e9ecf0">
<link rel="icon" href="../img/icon.png">
${STYLE}
</head>
<body>
<header class="wrap">
  <div class="brand"><img src="../img/icon.png" alt="" width="64" height="64"><strong style="font-size:20px">ToDo Organizer</strong></div>
  <h1>The private planner for school and life</h1>
  <p class="lead">Tasks, events and your timetable in one place – with school holidays, notes for every lesson and
  reminders. No account, no ads, no server.</p>
  <ul class="pills"><li>iPhone and iPad</li><li>One-time purchase, no subscription</li><li>Try everything for 30 days</li></ul>
</header>

<main class="wrap">
  <div class="shots" aria-label="Screenshots">
    <img src="../img/en/screen-01.jpg" alt="Week with lessons, tasks and events" loading="lazy" width="540" height="1174">
    <img src="../img/en/screen-02.jpg" alt="Timetable with A/B weeks and double periods" loading="lazy" width="540" height="1174">
    <img src="../img/en/screen-03.jpg" alt="Notes for every lesson" loading="lazy" width="540" height="1174">
    <img src="../img/en/screen-04.jpg" alt="Extra and missed lessons" loading="lazy" width="540" height="1174">
    <img src="../img/en/screen-06.jpg" alt="Quick entry" loading="lazy" width="540" height="1174">
    <img src="../img/en/screen-09.jpg" alt="Shopping lists in dark mode" loading="lazy" width="540" height="1174">
  </div>

  <section>
    <h2>A real lesson planner for teachers</h2>
    <div class="grid">
      <div class="card"><h3>Timetable with holidays</h3><p>School and public holidays for Germany, Austria and Switzerland are built in. A/B weeks, double periods and duties are included.</p></div>
      <div class="card"><h3>Notes for every lesson</h3><p>Record what you covered and “note for the next lesson”. The lesson log for each class shows everything by date.</p></div>
      <div class="card"><h3>X lessons left until …</h3><p>How many lessons are left until the test or the holidays? The app keeps count – cancellations included.</p></div>
      <div class="card"><h3>Extra and missed lessons</h3><p>Log covers and cancellations in one tap, see the balance per school year, export a PDF for school leaders.</p></div>
      <div class="card"><h3>Plan tests</h3><p>Prepare, write, hand back – the app creates the tasks. Homework “until the next lesson” of the class.</p></div>
      <div class="card"><h3>No pupil data</h3><p>No names, no grades, no developer cloud. That keeps the app simple in terms of data protection, too.</p></div>
    </div>
  </section>

  <section>
    <h2>And for everyone else</h2>
    <div class="grid">
      <div class="card"><h3>Just start typing</h3><p>“Training Tue 6–7:30pm #Sport” – the app recognises date, time, category and repeat by itself. With Siri, too.</p></div>
      <div class="card"><h3>Week and calendar</h3><p>Tasks, events from your calendars (Google too) and subscriptions from school or club in one view.</p></div>
      <div class="card"><h3>Family, studies, club</h3><p>Suitable settings from the start: lectures, the children's appointments, training times and match days.</p></div>
      <div class="card"><h3>Habits and shopping</h3><p>Weekly goals with streaks, shopping lists with suggestions – and a weekly review on Sundays.</p></div>
      <div class="card"><h3>Widget and shortcuts</h3><p>Your day on the home screen, the number of due tasks on the icon, quick actions with a long press.</p></div>
      <div class="card"><h3>iPhone and iPad in sync</h3><p>Sync via your own iCloud account – no third-party server.</p></div>
    </div>
  </section>

  <section class="promise">
    <h2>Your data stays with you</h2>
    <p>No account, no ads, no analytics tools. Everything is stored on your device – and, if you like,
    in your own iCloud account. Backups can be encrypted.</p>
    <p><a href="../${ORDNER}/privacy.html">Read the privacy policy</a></p>
  </section>

  <section>
    <h2>Help and FAQ</h2>
    <details><summary>Where is my data stored?</summary>
      <p>On your device. With iCloud sync turned on, also in your iCloud account at Apple. There is no developer server.
      Back up regularly under Settings → Backup; the app reminds you and, if you like, creates a backup itself every week.</p></details>
    <details><summary>How do I move to a new device?</summary>
      <p>With iCloud sync: turn it on on both devices, done. Otherwise: export on the old device, bring the file to the new one
      and import it there under Settings → Backup → Import.</p></details>
    <details><summary>What happens after the trial?</summary>
      <p>Tasks stay free – with quick entry, times, reminders, repeats, subtasks and notes, plus school and public holidays.
      Calendar, timetable with all school features, habits, shopping lists, iCloud sync and statistics are unlocked by the full version –
      a one-time purchase, no subscription, with Family Sharing. Your entries are always kept.</p></details>
    <details><summary>How do I switch the language?</summary>
      <p>The app follows your device language (German or English). To change it: Settings → “Sprache · Language”.</p></details>
    <details><summary>How do holidays get into the app?</summary>
      <p>Settings → Public and school holidays → choose your state or canton. The data for Germany, Austria and Switzerland
      is included in the app (source: OpenHolidays API, licence ODbL) – nothing is fetched from the internet, no guarantee.</p></details>
    <details><summary>How do I add my Google Calendar?</summary>
      <p>Settings → Connect calendars → “Add Google Calendar”. The app guides you step by step through both ways:
      via the device (recommended) or as a subscription with the secret iCal address.</p></details>
    <details><summary>How do I use Siri?</summary>
      <p>“Hey Siri, new task in ToDo Organizer” – Siri asks for the text; date and time are recognised.
      “Hey Siri, what's on today in ToDo Organizer?” reads out your day. Both are also available in the Shortcuts app.</p></details>
    <details><summary>I have already bought the full version.</summary>
      <p>Settings → Full version → “Restore purchases”. This also works with Family Sharing.</p></details>
    <details><summary>Reminders don't arrive or arrive late.</summary>
      <p>iPhone/iPad: Settings → Notifications → ToDo Organizer → Allow Notifications.</p></details>
    <p style="margin-top:14px">Questions, bugs, ideas: <a href="mailto:smaehlmann.appdev@gmail.com">smaehlmann.appdev@gmail.com</a></p>
  </section>
</main>

<footer class="wrap">
  <a href="../${ORDNER}/privacy.html">Privacy</a><a href="../${ORDNER}/legal-notice.html">Legal notice</a><a href="../" lang="de">🇩🇪 Deutsch</a>
  <span>ToDo Organizer · Wisdompeak Apps – Simon Mählmann</span>
</footer>
</body>
</html>
`;

function erwarteteDateien() {
  const out = {
    [path.join(ZIEL, 'index.html')]: START,
    [path.join(ZIEL, 'en', 'index.html')]: START_EN,
    [path.join(ZIEL, '.nojekyll')]: ''
  };
  for (const f of ['datenschutz.html', 'impressum.html', 'privacy.html', 'legal-notice.html']) {
    out[path.join(ZIEL, ORDNER, f)] = fuerWeb(fs.readFileSync(f, 'utf8'));
  }
  return out;
}

module.exports = { erwarteteDateien, ZIEL, ORDNER };

if (require.main === module) {
  const dateien = erwarteteDateien();
  for (const [ziel, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, inhalt);
    console.log('  ' + ziel);
  }
  console.log(Object.keys(dateien).length + ' Dateien geschrieben.');
  console.log('GitHub Pages: Settings → Pages → Branch main, Ordner /docs');
}
