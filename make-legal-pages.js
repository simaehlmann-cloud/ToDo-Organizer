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
    .replace(/<title>([^<]*)<\/title>/, '<title>$1</title>\n<meta name="robots" content="index, follow">');
}

const START = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ToDo Organizer – Rechtliches</title>
<meta name="theme-color" content="#2563eb">
<style>
  :root { --bg:#f4f5f7; --card:#fff; --text:#1f2937; --border:#2563eb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16181d; --card:#23272f; --text:#e9ecf1; --border:#93b4f5; }
  }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--text);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height:1.5; }
  main { max-width:640px; margin:0 auto; background:var(--card);
         border:2px solid var(--border); border-radius:14px; padding:24px; }
  h1 { font-size:24px; margin:0 0 8px; }
  ul { margin:0; padding-left:20px; }
  li { margin:6px 0; }
  a { color:var(--border); }
</style>
</head>
<body>
<main>
  <h1>ToDo Organizer</h1>
  <p>Rechtliche Angaben zur App von Wisdompeak Apps – Simon Mählmann.</p>
  <ul>
    <li><a href="${ORDNER}/datenschutz.html">Datenschutzerklärung</a></li>
    <li><a href="${ORDNER}/impressum.html">Impressum</a></li>
  </ul>
  <p>Kontakt: <a href="mailto:smaehlmann.appdev@gmail.com">smaehlmann.appdev@gmail.com</a></p>
</main>
</body>
</html>
`;

function erwarteteDateien() {
  const out = {
    [path.join(ZIEL, 'index.html')]: START,
    [path.join(ZIEL, '.nojekyll')]: ''
  };
  for (const f of ['datenschutz.html', 'impressum.html']) {
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
