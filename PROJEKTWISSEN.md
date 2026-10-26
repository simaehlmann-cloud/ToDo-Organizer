# ToDo Organizer – Projektwissen, Stand 2.4 (TestFlight mit Testphase und Kauf)

## Entscheidungen

- **Zwei Apps, nicht verwechseln:** Der ToDo Organizer (`de.maehlmann.todoorganizer`,
  Versionen 2.x) ist die öffentliche App. MyToDo (1.x, Google, IServ, Referendare)
  ist privat und wird nicht veröffentlicht.
- **Paketkennung:** `de.maehlmann.todoorganizer` (iOS und Android, unveränderlich nach dem ersten Upload).
- **Nur iPhone** (`TARGETED_DEVICE_FAMILY = 1`), nur Hochformat. Auf dem iPad läuft
  die App im iPhone-Modus. Später auf universal erweiterbar – umgekehrt nicht.
  Store braucht damit nur iPhone-Bildschirmfotos.
- **Preis:** kostenlos laden, 30 Tage alles frei, dann Einmalkauf „Vollversion“
  für 2,99 €, kein Abo, Familienfreigabe an.
- **Testphase** als kostenloses, nicht verbrauchbares Produkt „30-Tage-Testphase“
  (Apples vorgesehener Weg für Apps ohne Abo, Richtlinie 3.1.1). Die 30 Tage zählen
  ab dessen Kaufdatum. StoreKit 2 liefert das ursprüngliche Datum bei jedem Start
  mit – eine Neuinstallation verlängert die Testphase nicht.
- **Nach der Testphase frei:** nur die Aufgaben – Wochenansicht, Aufgabenliste,
  Kategorien, Unterpunkte, Wiederholungen, Verschieben, E-Mail-Zuweisung,
  Google-Kalender-Link, einfacher Export und Import (auch verschlüsselter Import).
- **Vollversion:** Kalender, Stundenplan (samt Fach bei Aufgaben und Stunden in
  der Wochenansicht), Einkaufsliste, Erinnerungen, externer Kalender (ICS),
  verschlüsseltes Backup, Kalenderdatei-Export, Statistik.
- **Gesperrt wird nur die Anzeige.** Daten bleiben gespeichert, stecken im Export
  und sind nach dem Kauf sofort wieder da. Abgelaufene Erinnerungen werden beim
  nächsten Start abbestellt.
- **Sperren vorerst nur iOS** (`LIMIT_PLATFORMS = ["ios"]`). Android bleibt frei,
  bis die Produkte in der Play Console angelegt sind. Im Browser gibt es keinen
  Store und keine Sperre.
- **Kein eigener Server, kein Prüfserver.** Einmal gekauft bleibt gekauft
  (in localStorage gemerkt); Erstattungen werden nicht nachgezogen – wie bei Zirkelwerk.

## Technik

- Alles in `index.html`, ein Inline-Skript. Speicher: localStorage
  (`studiez-pro-v2` für die Daten, `todo-organizer-license` für Testphase/Kauf).
- **Lizenz:** Objekt `Lic` mit `status()` = `free | new | trial | expired | full`.
  `feat(k)` = Schalter an **und** (kein Pro-Bereich oder `Lic.full()`);
  `wantFeat(k)` = nur der Schalter. Gesperrte Karten tragen `data-pro`.
- **Kauf:** `capacitor-plugin-cdv-purchase` (StoreKit 2, gleiche Schnittstelle
  wie `cordova-plugin-purchase` bei Zirkelwerk). Die App hat keinen Bundler: Der
  Workflow bündelt das Plugin mit esbuild zu `purchase.js`
  (`tools/make-purchase-js.js`, `@capacitor/core` durch `window.Capacitor`
  ersetzt). index.html lädt die Datei nur in der iOS-App nach.
- `approved` kommt mit StoreKit 2 bei jedem Start für alle Käufe des Kontos –
  daraus stammt das Startdatum der Testphase (`purchaseDate`, frühestes zählt).
- **Testmodus:** Info-Seite, siebenmal auf die Versionszeile tippen → Testphase
  3 Minuten. Kann nur verkürzen, nie freischalten; bleibt deshalb im Store-Build.
- **Export auf iOS:** `<a download>` tut im WKWebView nichts. `download()` schreibt
  die Datei mit `@capacitor/filesystem` in den Cache und öffnet das Teilen-Menü
  (`@capacitor/share`). Im Browser und in der Android-App wie bisher.
- **Erinnerungen:** `@capacitor/local-notifications`, höchstens 60 einzelne plus
  die tägliche Übersicht (iOS erlaubt 64 geplante Mitteilungen).
- **ICS-Abruf:** `CapacitorHttp` (in Capacitor enthalten), umgeht CORS.
- Seit 2.4: `[hidden]{display:none!important}` – vorher hebelten `.grid` und ein
  Inline-Stil das Attribut aus (Mehr-Felder, Passwortfelder). Toast ist unsichtbar,
  solange er nicht gezeigt wird.

## iOS-Build (GitHub Actions)

- Das Xcode-Projekt liegt **nicht** im Repository. Jeder Lauf erzeugt es frisch:
  `npx cap add ios --packagemanager SPM`, `npx cap sync ios`, dann
  `tools/ios-setup.rb` (Ruby-Gem xcodeproj) und PlistBuddy.
- `tools/ios-setup.rb`: Bundle-ID, nur iPhone, iOS 15, Version/Build,
  Privacy-Manifest als Ressource, manuelle Signierung nur für Release und nur das
  App-Ziel (Swift-Pakete vertragen keine Profile).
- Info.plist: Anzeigename, Region `de`, `ITSAppUsesNonExemptEncryption = false`
  (nur Standardverschlüsselung des Systems), `UIUserInterfaceStyle = Light`
  (keine Dunkeldarstellung; sonst weiße Statusleistenschrift), nur Hochformat,
  `arm64` statt `armv7`.
- Version = `APP_VERSION` aus index.html, Build-Nummer = Laufnummer des Workflows.
- Secrets wie bei Zirkelwerk, Profil neu für `de.maehlmann.todoorganizer`
  (siehe APPSTORE-CONNECT.md). Upload nur bei manuellem Start.

## Offen

- Android: Produkte in der Play Console anlegen, dann `"android"` in
  `LIMIT_PLATFORMS` aufnehmen und Filesystem/Share ins Android-Projekt übernehmen.
- Warnung bei überfälligem Backup (`settings.lastExport`) und veraltetem
  ICS-Abruf (`settings.extCalLastSync`) – in MyToDo seit 1.27 vorhanden.
- Teilen an den ToDo Organizer (Share Extension) gibt es auf iOS noch nicht.
