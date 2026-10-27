# ToDo Organizer

Allgemeine To-do-App (3.0): Aufgaben mit Schnelleingabe, Uhrzeit, Erinnerungen,
Wiederholungen, Notizen und Bildern; Wochenübersicht mit Gerätekalender;
Wochen- oder Stundenplan (Schüler, Lehrkräfte); Gewohnheiten, Vorlagen,
Einkaufslisten mit Vorschlägen; Dunkelmodus – ohne Konto, ohne Server. Alle Daten bleiben auf dem Gerät.
Läuft als iOS-App für iPhone und iPad (Capacitor), als Android-App (Capacitor, lokal gebaut)
und als installierbare Web-App (PWA).

Aufbau, Prüfkette und Build nach dem Vorbild von Zirkelwerk.

## Dateien

```
index.html                    komplette App (HTML, CSS, Logik)
manifest.json, sw.js          Web-App (Offline-Cache)
icons/                        Icons der Web-App
datenschutz.html, impressum.html   Rechtstexte (auch in der App verlinkt)
docs/                         dieselben Rechtstexte für GitHub Pages (erzeugt)
capacitor.config.json         Capacitor-Konfiguration (App-ID, Name)
package.json                  native Pakete für den iOS-Build, fest gepinnt
res/ios/                      App-Icon 1024 px, Privacy-Manifest
res/ios/widget/, res/ios/app/ Heute-Widget (Swift) und Brücke in der App
tools/ios-setup.rb            passt das erzeugte Xcode-Projekt an
tools/make-purchase-js.js     bündelt das Kauf-Plugin zu purchase.js
tools/make-ferien.js          trägt die Schulferien aller Länder in index.html ein
make-icons.py                 zeichnet das iOS-Icon
make-legal-pages.js           erzeugt docs/ aus den Rechtstexten
validate.js                   statische Prüfung
tests/core.test.js            Kernlogik: Datumsrechnung, Wiederholung, Schnelleingabe, Erinnerungen
tests/app.test.js             Ablauftest im Browser: Bedienung, Testphase, Kauf, Sperren, Kalender
.github/workflows/ios.yml     iOS-Build, Signierung, Upload nach App Store Connect
APPSTORE-CONNECT.md           einmalige Einrichtung bei Apple und GitHub
store/STORE-TEXTE.md          Store-Texte, Kategorien, Prüfnotizen zum Hineinkopieren
store/make-screenshots.js     Store-Bildschirmfotos iPhone 6,3" und iPad 13"
store/make-previews.js        App-Vorschauvideos (braucht ffmpeg)
store/make-iap-shots.js       Prüfbilder für die beiden In-App-Käufe
store/demo-data.js, device.js Beispieldaten und Gerätenachbildung dafür
PROJEKTWISSEN.md              Entscheidungen und Technik
mipmap-*/, playstore-icon-512.png, ANLEITUNG.txt   Icons fürs Android-Projekt
```

## Prüfen

```bash
node make-legal-pages.js   # nach jeder Änderung an einem Rechtstext
node validate.js           # Version, Produkt-IDs, Rechtstexte, Icon, Workflow
node tests/core.test.js    # Kernlogik, ohne Browser
node tests/app.test.js     # Bedienung, Testphase, Kauf, Sperren mit simuliertem iOS
```

Für den Ablauftest einmalig: `npm install --no-save playwright@1.63.0 && npx playwright install chromium`.

## Bauen

**iOS** läuft bei jedem Push auf `main` (erst die Prüfkette, dann der Bau
auf macOS). Ohne Secrets nur unsigniert, mit Secrets entsteht die IPA.
Hochgeladen wird nur beim manuellen Start (Actions → Run workflow).
Einrichtung: siehe [APPSTORE-CONNECT.md](APPSTORE-CONNECT.md).

**Android** baut weiter lokal im Android-Studio-Projekt (Dateien nach `www/`,
`npx cap copy`, `.\gradlew.bat assembleDebug`). Die Sperren gelten dort
vorerst nicht (`LIMIT_PLATFORMS` in `index.html`).

## Ferien aktualisieren

Die Schulferien stecken als Block `FERIEN` in `index.html` (derzeit bis 2030/31).
Sobald die Länder weitere Schuljahre veröffentlichen:

```bash
git clone --depth 1 https://github.com/openpotato/openholidaysapi.data.git /tmp/oh
node tools/make-ferien.js /tmp/oh/src/de/holidays
```

Das Skript prüft dabei die berechneten Feiertage gegen den Datensatz.
Datenquelle: [OpenHolidays API Data](https://github.com/openpotato/openholidaysapi.data),
lizenziert unter der [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Der daraus erzeugte Block steht unter derselben Lizenz.

## Vollversion

| | |
|---|---|
| Testphase | `de.maehlmann.todoorganizer.testphase` – nicht verbrauchbar, 0,00 €, 30 Tage ab Kaufdatum |
| Vollversion | `de.maehlmann.todoorganizer.vollversion` – nicht verbrauchbar, 2,99 €, Familienfreigabe |

Schalter in `index.html`: `IAP_ENABLED`, `LIMITS_ACTIVE`, `LIMIT_PLATFORMS`.
