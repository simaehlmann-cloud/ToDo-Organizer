# ToDo Organizer

Aufgaben, Wochenübersicht, Kalender, Stundenplan und Einkaufsliste – ohne
Konto, ohne Server. Alle Daten bleiben auf dem Gerät.
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
tools/ios-setup.rb            passt das erzeugte Xcode-Projekt an
tools/make-purchase-js.js     bündelt das Kauf-Plugin zu purchase.js
make-icons.py                 zeichnet das iOS-Icon
make-legal-pages.js           erzeugt docs/ aus den Rechtstexten
validate.js                   statische Prüfung
smoketest.js                  Ablauftest im Browser: Testphase, Kauf, Sperren
.github/workflows/ios.yml     iOS-Build, Signierung, Upload nach App Store Connect
APPSTORE-CONNECT.md           einmalige Einrichtung bei Apple und GitHub
store/STORE-TEXTE.md          Store-Texte, Kategorien, Prüfnotizen zum Hineinkopieren
store/make-screenshots.js     Store-Bildschirmfotos iPhone 6,3" und iPad 13"
store/make-previews.js        App-Vorschauvideos (braucht ffmpeg)
store/demo-data.js, device.js Beispieldaten und Gerätenachbildung dafür
PROJEKTWISSEN.md              Entscheidungen und Technik
mipmap-*/, playstore-icon-512.png, ANLEITUNG.txt   Icons fürs Android-Projekt
```

## Prüfen

```bash
node make-legal-pages.js   # nach jeder Änderung an einem Rechtstext
node validate.js           # Version, Produkt-IDs, Rechtstexte, Icon, Workflow
node smoketest.js          # Testphase, Kauf und Sperren mit simuliertem App Store
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

## Vollversion

| | |
|---|---|
| Testphase | `de.maehlmann.todoorganizer.testphase` – nicht verbrauchbar, 0,00 €, 30 Tage ab Kaufdatum |
| Vollversion | `de.maehlmann.todoorganizer.vollversion` – nicht verbrauchbar, 2,99 €, Familienfreigabe |

Schalter in `index.html`: `IAP_ENABLED`, `LIMITS_ACTIVE`, `LIMIT_PLATFORMS`.
