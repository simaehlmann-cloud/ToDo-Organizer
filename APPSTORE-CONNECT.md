# ToDo Organizer – Einrichtung für TestFlight

Einmalige Schritte bei Apple und GitHub, bevor der erste Upload klappt.
Konto, Zertifikat und App-Store-Connect-Schlüssel sind dieselben wie bei
FairMix und Zirkelwerk. Neu sind nur App-ID, Profil, App-Eintrag und die
zwei Kaufprodukte.

## 1. Apple Developer – App-ID und Profil

developer.apple.com → Certificates, Identifiers & Profiles

1. **Identifiers → +** → App IDs → App
   - Description: `ToDo Organizer`
   - Bundle ID (Explicit): `de.maehlmann.todoorganizer`
   - Capabilities: nichts zusätzlich ankreuzen (In-App Purchase ist immer an,
     Erinnerungen sind lokale Mitteilungen und brauchen kein Push)
2. **Profiles → +** → Distribution → **App Store Connect**
   - App ID: `de.maehlmann.todoorganizer`
   - Zertifikat: dasselbe Apple-Distribution-Zertifikat wie bei Zirkelwerk
   - Name: `ToDo Organizer App Store`
   - Herunterladen → `.mobileprovision`

## 2. App Store Connect – App anlegen

appstoreconnect.apple.com → Apps → **+** → Neue App

- Plattform: iOS
- Name: `ToDo Organizer` (falls vergeben: z. B. `ToDo Organizer – Aufgaben`)
- Primäre Sprache: Deutsch
- Bundle-ID: `de.maehlmann.todoorganizer`
- SKU: `todo-organizer`

Danach unter **App-Datenschutz**: „Erfassen Sie Daten von dieser App?“ → **Nein**.
Datenschutz-URL: `https://simaehlmann-cloud.github.io/ToDo-Organizer/todo-organizer/datenschutz.html`
(funktioniert erst, wenn GitHub Pages eingeschaltet ist, siehe 5.)

## 3. Zwei In-App-Käufe anlegen

App → **Monetarisierung → In-App-Käufe → +**. Beide **Nicht verbrauchbar**.

| | Testphase | Vollversion |
|---|---|---|
| Referenzname | 30-Tage-Testphase | Vollversion |
| Produkt-ID | `de.maehlmann.todoorganizer.testphase` | `de.maehlmann.todoorganizer.vollversion` |
| Preis | **0,00 €** (kostenlos) | **2,99 €** |
| Anzeigename (DE) | 30-Tage-Testphase | Vollversion |
| Beschreibung (DE) | 30 Tage alle Funktionen kostenlos testen | Alle Funktionen dauerhaft, ohne Abo |
| Familienfreigabe | aus | **an** |
| Verfügbarkeit | alle Länder | alle Länder |

Die Produkt-IDs müssen exakt so lauten – sie stehen so in `index.html`.
Der Name der Testphase folgt Apples Vorgabe für Testphasen ohne Abo
(Richtlinie 3.1.1: „XX-day Trial“). Englische Lokalisierung, falls gewünscht:
„30-day Trial“ / „Full Version“.

Für jedes Produkt verlangt Apple einen **Screenshot für die Prüfung**
(z. B. die Karte „Vollversion“ unter Einstellungen) und kurze Prüfnotizen.
Ohne diese Angaben steht das Produkt auf „Fehlende Metadaten“ und lädt
auch in TestFlight nicht. Vorschlag für die Prüfnotiz:

> Einstellungen → Vollversion. Die Testphase ist ein kostenloses, nicht
> verbrauchbares Produkt; ab ihrem Kaufdatum sind 30 Tage alle Funktionen frei.
> Danach bleiben Aufgaben frei, Kalender, Stundenplan, Einkaufsliste,
> Erinnerungen, externer Kalender, verschlüsseltes Backup und Statistik
> brauchen die Vollversion.

Voraussetzung: Der Vertrag für kostenpflichtige Apps ist aktiv – das ist er
durch Zirkelwerk bereits.

Die Produkte müssen **nicht** eingereicht sein, damit TestFlight sie
lädt – „Bereit zur Einreichung“ genügt. Beim ersten Einreichen der App zur
Prüfung kommen beide mit derselben Version zur Prüfung.

## 4. GitHub – Secrets im Repository ToDo-Organizer

github.com/simaehlmann-cloud/ToDo-Organizer → Settings → Secrets and
variables → Actions → New repository secret. Secrets gelten pro Repository,
deshalb hier noch einmal eintragen – mit **denselben Werten** wie bei Zirkelwerk,
bis auf das Profil:

| Secret | Inhalt |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | wie bei Zirkelwerk |
| `IOS_CERTIFICATE_PASSWORD` | wie bei Zirkelwerk |
| `IOS_TEAM_ID` | wie bei Zirkelwerk |
| `IOS_PROVISIONING_PROFILE` | **neu:** das Profil aus Schritt 1, base64 |
| `ASC_KEY_ID` | wie bei Zirkelwerk |
| `ASC_ISSUER_ID` | wie bei Zirkelwerk |
| `ASC_KEY_P8` | wie bei Zirkelwerk |

Profil in base64 umwandeln (Windows, PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\ToDo_Organizer_App_Store.mobileprovision")) | Set-Clipboard
```

Danach steht der Text in der Zwischenablage und kann ins Secret eingefügt werden.
`IOS_SIGNING_IDENTITY` braucht dieser Workflow nicht.

Falls ein Wert von Zirkelwerk nicht mehr griffbereit ist: Secrets lassen
sich bei GitHub nicht auslesen. Dann den .p12-Export bzw. die .p8-Datei
von damals nehmen; die .p8 lässt sich bei Apple nicht erneut herunterladen,
notfalls einen neuen App-Store-Connect-Schlüssel anlegen.

## 5. GitHub Pages für die Rechtstexte

Settings → Pages → Branch `main`, Ordner **`/docs`** → Save.
Nach ein bis zwei Minuten erreichbar:

- `https://simaehlmann-cloud.github.io/ToDo-Organizer/todo-organizer/datenschutz.html`
- `https://simaehlmann-cloud.github.io/ToDo-Organizer/todo-organizer/impressum.html`

GitHub Pages ist bei privaten Repositorys im Gratis-Tarif nicht verfügbar.
Ist das Repository privat, die beiden Dateien aus `docs/todo-organizer/`
stattdessen ins Zirkelwerk-Repository nach `docs/todo-organizer/` legen;
die Adressen lauten dann `…/Zirkelwerk/todo-organizer/…`.

## 6. Bauen und hochladen

Actions → **Build ToDo Organizer (iOS)** → **Run workflow**.

- Jeder Push auf `main` baut und prüft, lädt aber nicht hoch.
- Nur der manuelle Start lädt nach App Store Connect hoch.
- Die Build-Nummer ist die Laufnummer des Workflows, sie steigt von selbst.

Nach 5–30 Minuten Verarbeitung erscheint der Build in App Store Connect →
TestFlight. Für **interne Tester** (bis 100 Personen aus dem eigenen Team)
gibt es keine Beta-Prüfung: Gruppe anlegen, Build zuweisen, fertig. Für
externe Tester prüft Apple den ersten Build kurz.

## 7. Testen in TestFlight

- Käufe in TestFlight laufen über die Sandbox und kosten nichts.
- Ende der Testphase prüfen: Info-Seite → **siebenmal auf „Version 2.4“
  tippen** → Testmodus, die Testphase dauert dann 3 Minuten. Erneut
  siebenmal tippen schaltet zurück.
- „Käufe wiederherstellen“ nach Neuinstallation testen: Die Testphase muss
  mit dem ursprünglichen Startdatum wiederkommen.
