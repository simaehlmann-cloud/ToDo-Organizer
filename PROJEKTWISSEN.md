# ToDo Organizer – Projektwissen, Stand 3.0 (allgemeine To-do-App)

## 3.1 – Schule als Schwerpunkt (Oktober 2026)

- Positionierung: „der private Planer für Schule und Alltag“. Allgemeine To-do-Apps
  sind kostenlos (Apple Erinnerungen) oder Abos; Schule + Alltag + ohne Konto ist die Lücke.
- Feiertage aller 16 Länder werden berechnet (`publicHolidays`, Ostern nach Gauß).
  Schulferien als Block `FERIEN` in index.html aus OpenHolidays (ODbL), erzeugt mit
  `tools/make-ferien.js`, das zugleich die Feiertage gegen den Datensatz prüft.
  Feiertage sind frei, auch in der Grundversion.
- Im Stundenplan (Schulstunden) fallen Stunden an Feiertagen und in den Ferien weg,
  der Wochenplan (Uhrzeiten) läuft weiter.
- A/B-Wochen: `settings.ab = { on, anchor, type, skip }`, Stunde mit `week: "A"|"B"|null`.
  `skip` = Ferienwochen nicht mitzählen. Eine Zelle kann eine A- und eine B-Stunde haben.
- Ausfall/Vertretung je Tag: `state.lessonEx["stundenId|JJJJ-MM-TT"]`, beim Laden nach 60 Tagen weg.
- Hausaufgabe aus der Woche (Stunde antippen) und per Schnelleingabe „bis nächste Mathe“
  (`parseQuick` mit `subjects`/`lessonDate`, `matchSubject` erkennt Anfänge ab 3 Buchstaben).
  `nextLesson` überspringt Ferien, Feiertage, falsche A/B-Woche und Ausfälle.
- Klassenarbeit planen (`planExam`): Lehrkraft → vorbereiten (Werktag davor), schreiben,
  korrigieren mit Frist (Werktag danach); Schüler → Lernplan mit 2–5 Einheiten. Vollversion.
- Gefunden im Review: „Übernehmen“ im Aufgaben-Dialog setzte `spawned` immer zurück –
  nach Wiederöffnen und erneutem Abhaken entstand ein zweiter Folgetermin. Jetzt nur bei
  geänderter Wiederholung oder geändertem Datum.

## Oktober 2026: Unterrichtsplaner-Ausbau

- **Look:** Grund `--bg:#e9ecf0`, Karten weiß mit `--shadow`; die Woche hat keine große Karte mehr
  (`.week-wrap`), die Tage sind eigene Kärtchen; „heute“ hellblau (`--sel`). Innere Flächen über
  `--head`. Toasts haben eine eigene Farbe `--toast` (nie an das Menü koppeln – das gab weiß auf weiß).
- **Menü-Symbole:** eigene SVG-Liniensymbole (`currentColor`), keine Emojis mehr.
- **Notizen zur Stunde:** `state.lessonNotes = [{ course: "Fach|Klasse", date, text }]`, am Kurs statt
  am Stundenplan-Eintrag. Feld im Stunden-Dialog, 📝 in der Woche, Verlauf im Stundenplan-Dialog,
  eigener Notiz-Dialog, „Verlauf teilen“.
- **Sicherung:** pro Gerät in localStorage `todo-organizer-backup` (firstUse, lastExport, lastAuto,
  dismissedUntil). Hinweis in der Woche nach 14 Tagen ohne Sicherung (ab 7 Tagen Nutzung, ab 3
  Einträgen). iOS: wöchentlich `ToDo-Organizer-Sicherung.json` (+ `-vorher`) in DOCUMENTS;
  `UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace` machen den Ordner in der Dateien-App sichtbar.
- **PDF:** `buildTablePdf` im CORE-Block, ohne Bibliothek (Helvetica, WinAnsi), `downloadBytes` gibt
  Binärdaten weiter. Tests prüfen xref-Offsets; lokal mit qpdf/pdftotext gegengeprüft.
- **iPad:** ab 1100 px Breite Woche als Spalten Mo–Fr + Wochenende (`#wk-days.cols`).
- **Schnellaktionen:** `WidgetData.setShortcuts` (je Profil), `SceneDelegate` leitet sie als Link weiter.

## Fehler im Kauf bis 3.1 (gefunden am 27.10.2026)

- `tools/capacitor-core-shim.js` rief `window.Capacitor.registerPlugin` auf. Die iOS-Brücke
  von Capacitor stellt diese Funktion **nicht** bereit (sie stammt aus `@capacitor/core`, das die
  App ohne Bundler nicht lädt) – nur `window.Capacitor.Plugins[Name]`. purchase.js brach beim
  Laden ab, `CdvPurchase` fehlte, jeder Kauf meldete „App Store nicht erreichbar“.
- Jetzt nimmt der Ersatz das nativ angelegte Plugin. `tests/purchase.test.js` lädt das gebündelte
  Modul im Build gegen eine Brücke ohne `registerPlugin`; validate.js prüft den Ersatz.
- Dieselbe Falle gilt für alle Plugins: in index.html immer `window.Capacitor.Plugins.X`
  verwenden, nie `registerPlugin`.

## Mehr- und Minderstunden (3.1, nur Profil „Unterricht“ im Stundenplan-Modus)

- `state.subLog = [{ id, date, type: "plus"|"minus"|"aufsicht", hours: 1|2, slot, klass, subject, room, note, lessonId, pairId }]`.
  Plus = Vertretung, Minus = Ausfall, Aufsicht wird gezählt, aber nicht im Saldo (`subValue`, `subSummary`).
- Erfassen: „＋ Vertretung“ an jedem Schultag der Woche (nicht an Feiertagen/in Ferien) oder eigene
  Stunde antippen → „Fällt aus“ → „als Minusstunde zählen“ (Einzel/Doppel per `lessonBlock`).
  Bei Doppel fällt die Nachbarstunde mit aus und hängt über `pairId` am selben Eintrag –
  so entsteht beim Öffnen der zweiten Stunde kein zweiter Eintrag. Zurücksetzen/Löschen nimmt beides zurück.
- Übersicht im Stundenplan: Monat, Halbjahr (Aug–Jan, Feb–Jul), Schuljahr (ab 1. August), Alle;
  „Liste teilen“ als Text (Share-Plugin, sonst Zwischenablage/Mail).

## Doppelstunden und Pausenaufsichten (3.1)

- Stunde mit `span: 2` belegt `slot` und `slot + 1` (`occupies`). Das Raster setzt jede Zelle
  explizit (`gridRow`), Doppelstunden laufen über zwei Zeilen – über eine Pause hinweg über drei.
- Pausen ergeben sich aus Lücken ≥ 5 Min. zwischen den Stundenzeiten (`breaksOf`). Im Profil
  „Unterricht“ bekommen sie eine Zeile im Raster; ein Tipp legt eine feste Aufsicht an:
  `state.duties = [{ id, day, after, place, week }]`. Aufsichten folgen wie Stunden A/B-Woche,
  Ferien und Feiertagen (`dutiesOn`) und erscheinen in Woche und Widget.
- Vertretungsaufsichten an einzelnen Tagen bleiben Einträge in `subLog` (Typ „aufsicht“).

## Heute-Widget (3.1)

- Swift-Widget (WidgetKit, iOS 15+, klein/mittel/groß) in `res/ios/widget/`. Die App
  schreibt per eigenem Plugin `WidgetData.set({json})` (`res/ios/app/WidgetDataPlugin.swift`)
  eine Zusammenfassung von drei Tagen als Datei `widget.json` in den Ordner der App-Gruppe.
- **Anmeldung des Plugins über `packageClassList` in `capacitor.config.json`** (ios-setup.rb).
  Bis Oktober 2026 lief das über einen eigenen Startbildschirm im Storyboard – in Capacitor 8
  wirkungslos, weil `SceneDelegate` `CAPBridgeViewController()` im Code erzeugt. Folge:
  „Widget-Brücke: nein“, Widget ohne Daten. Der Workflow prüft jetzt den Eintrag.
- `res/ios/app/SceneDelegate.swift` ersetzt die Vorlage (@capacitor/ios 8.5.3) und leitet
  Schnellaktionen am App-Symbol als `todoorganizer://…`-Link weiter (`ApplicationDelegateProxy`).
  Die Einträge setzt die Web-App je nach Profil über `WidgetData.setShortcuts`.
- Fertige Plugins (capacitor-widgetsbridge-plugin) gibt es nur für CocoaPods – unser
  Build nutzt SPM, deshalb die eigene Brücke.
- `widgetSnapshot()` in index.html baut die Daten (Stunden mit Ferien/A/B/Ausfall,
  Termine, Aufgaben); `Widget.soon()` nach Speichern/Neuzeichnen, `Widget.push()` beim
  Verlassen der App. Gleicher Stand wird nicht erneut geschickt.
- Das Widget wechselt um Mitternacht selbst auf den nächsten Tag und blendet begonnene
  Stunden/Termine aus. Tipp öffnet `todoorganizer://week` (CFBundleURLTypes, `appUrlOpen`).
- Build: ohne Signierung immer mit Widget (Swift wird bei jedem Push übersetzt), signiert
  nur mit `IOS_PROVISIONING_PROFILE_WIDGET` und App-Gruppe in beiden Profilen.
- Kostenlos (auch nach der Testphase); Stunden erscheinen nur mit Vollversion, weil der
  Stundenplan dazugehört.

## 3.0 im Überblick (November 2026)

- Vom Schul-Organizer zur **allgemeinen To-do-App**. Beim ersten Start fragt die App
  nach dem Profil (Alltag, Beruf, Schule/Studium, Lehrkraft) und blendet passend ein.
- Neu: Uhrzeit und Vorab-Erinnerung je Aufgabe (`dueTime`, `remind`), flexible
  Wiederholung (`custom` mit `recurEvery`/`recurUnit`, „ab Erledigung“), Schnelleingabe
  in natürlicher Sprache (`parseQuick`), Bilder (IndexedDB), Vorlagen, Gewohnheiten
  mit Wochenziel und Serie, mehrere Einkaufslisten mit Vorschlägen, Dunkelmodus,
  Gerätekalender lesen und Aufgaben dort eintragen, Wochenplan (Uhrzeiten) oder
  Stundenplan (Schulstunden).
- Die reine Logik steht zwischen `==CORE-BEGIN==` und `==CORE-END==` in index.html
  und wird von `tests/core.test.js` herausgelöst und geprüft (ohne Browser).
  `tests/app.test.js` bedient die App in Chromium mit nachgebildeten iOS-Plugins.
- Gerätekalender: `@ebarooni/capacitor-calendar` (EventKit). Termine werden nur zur
  Anzeige gelesen, nicht gespeichert. Das Plugin enthält auch die Erinnerungen-API,
  deshalb braucht die Info.plist die Reminders-Texte (sonst ITMS-90683), obwohl die
  App sie nicht nutzt.
- Statusleiste: `@capacitor/status-bar`, folgt der Darstellung der App.
- Migration: alte Daten (2.x) bekommen Planmodus „Stundenplan“, wenn sie Stunden
  hatten, sonst „Wochenplan“. Speicherschlüssel bleibt `studiez-pro-v2`.


## Entscheidungen

- **Zwei Apps, nicht verwechseln:** Der ToDo Organizer (`de.maehlmann.todoorganizer`,
  Versionen 2.x) ist die öffentliche App. MyToDo (1.x, Google, IServ, Referendare)
  ist privat und wird nicht veröffentlicht.
- **Paketkennung:** `de.maehlmann.todoorganizer` (iOS und Android, unveränderlich nach dem ersten Upload).
- **Universal** (`TARGETED_DEVICE_FAMILY = "1,2"`, entschieden am 26.10.2026 für die
  iPad-Vorschau im Store): iPhone nur Hochformat, iPad alle vier Richtungen (Pflicht).
  Ab 761 px Breite zeigt die App das Layout mit Seitenleiste – auf dem iPad in beiden Lagen.
  Nicht mehr auf iPhone zurückstellbar, sobald hochgeladen.
  Store braucht iPhone 6,3" (1206×2622) und iPad 13" (2064×2752); Vorschauvideos
  886×1920 bzw. 1200×1600. Alles in `store/`, erzeugt mit `store/make-screenshots.js` und `store/make-previews.js`.
- **Preis:** kostenlos laden, 30 Tage alles frei, dann Einmalkauf „Vollversion“
  für 2,99 €, kein Abo, Familienfreigabe an.
- **Testphase** als kostenloses, nicht verbrauchbares Produkt „30-Tage-Testphase“
  (Apples vorgesehener Weg für Apps ohne Abo, Richtlinie 3.1.1). Die 30 Tage zählen
  ab dessen Kaufdatum. StoreKit 2 liefert das ursprüngliche Datum bei jedem Start
  mit – eine Neuinstallation verlängert die Testphase nicht.
- **Nach der Testphase frei (seit 3.0):** die Aufgaben samt Schnelleingabe, Uhrzeit,
  **Erinnerungen**, Wiederholungen, Unterpunkten, Notizen, Wochenansicht, Kategorien,
  E-Mail-Zuweisung, Google-Kalender-Link, einfacher Export und Import.
  Erinnerungen sind frei, weil eine To-do-App ohne sie nicht trägt (validate.js prüft das).
- **Vollversion:** Kalender samt Gerätekalender und ICS, Bilder, Vorlagen, Wochen- bzw.
  Stundenplan, Gewohnheiten, Einkaufslisten, verschlüsseltes Backup,
  Kalenderdatei-Export, Statistik (`PRO_KEYS` plus `showProHint`-Stellen).
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
  Seit 3.0 zeigt die Vollversions-Karte im Testmodus eine Diagnose (Modul geladen,
  Plugin da, Store bereit, Produkte gefunden, letzter Fehler) – für „App Store nicht
  erreichbar“ in TestFlight.
- **Export auf iOS:** `<a download>` tut im WKWebView nichts. `download()` schreibt
  die Datei mit `@capacitor/filesystem` in den Cache und öffnet das Teilen-Menü
  (`@capacitor/share`). Im Browser und in der Android-App wie bisher.
- **Erinnerungen:** `@capacitor/local-notifications`, höchstens 60 einzelne plus
  die tägliche Übersicht (iOS erlaubt 64 geplante Mitteilungen).
- **ICS-Abruf:** `CapacitorHttp` (in Capacitor enthalten), umgeht CORS.
- Seit 2.4: `[hidden]{display:none!important}` – vorher hebelten `.grid` und ein
  Inline-Stil das Attribut aus (Mehr-Felder, Passwortfelder). Toast ist unsichtbar,
  solange er nicht gezeigt wird.

- Seit 2.4 außerdem: Dialoge mit `margin:auto` (die Rücksetzung `*{margin:0}` hatte sie
  an den linken Rand geschoben) und innerhalb der Safe-Area zentriert. Auf dem Handy
  sind es sechs Reiter; „Info“ ist dort über Einstellungen → „Info, Datenschutz und
  Impressum“ erreichbar (sieben passten nicht nebeneinander).

## Store-Medien

- `store/make-screenshots.js`, `store/make-previews.js` nehmen die echte App mit den
  Beispieldaten aus `store/demo-data.js` auf („heute“ = Di, 3.11.2026). Statusleiste und
  Home-Leiste bildet `store/device.js` nach. Ausgabe nach `store/out/` (nicht im Repo).
- Vorschauvideos per Chromium-Bildschirmmitschnitt; nur mit
  `--force-device-scale-factor` kommen die Bilder in Gerätepixeln. Musik und
  Tippgeräusche erzeugt das Skript selbst (keine fremden Rechte).
- Texte: `store/STORE-TEXTE.md`, Längen prüft `validate.js`.

## iOS-Build (GitHub Actions)

- Das Xcode-Projekt liegt **nicht** im Repository. Jeder Lauf erzeugt es frisch:
  `npx cap add ios --packagemanager SPM`, `npx cap sync ios`, dann
  `tools/ios-setup.rb` (Ruby-Gem xcodeproj) und PlistBuddy.
- `tools/ios-setup.rb`: Bundle-ID, iPhone und iPad, iOS 15, Version/Build,
  Privacy-Manifest als Ressource, manuelle Signierung nur für Release und nur das
  App-Ziel (Swift-Pakete vertragen keine Profile).
- Info.plist: Anzeigename, Region `de`, `ITSAppUsesNonExemptEncryption = false`
  (nur Standardverschlüsselung des Systems), seit 3.0 **kein** `UIUserInterfaceStyle`
  (Dunkelmodus), Erlaubnistexte für Kalender, Erinnerungen, Kamera und Fotos,
  iPhone Hochformat, iPad alle Lagen,
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
