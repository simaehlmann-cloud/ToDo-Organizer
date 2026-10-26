# ToDo Organizer – Texte und Angaben für App Store Connect

Alles zum Hineinkopieren, Sprache **Deutsch** (Primärsprache). Die Zahl in
Klammern ist Apples Höchstlänge in Zeichen; `node validate.js` prüft sie.
Inhalte in den Codeblöcken genau so übernehmen.

Bewusst ohne Preisangabe in den Texten: Der Preis steht im Store ohnehin
daneben und unterscheidet sich je Land.

---

## App-Informationen

### Name (max. 30)
```
ToDo Organizer
```
Falls der Name vergeben ist, Ausweichvorschlag: `ToDo Organizer – Wochenplan`

### Untertitel (max. 30)
```
Aufgaben, Stundenplan, Einkauf
```

### Kategorie
- Primär: **Produktivität**
- Sekundär: **Bildung** (wegen Stundenplan; kann auch leer bleiben)

### Altersfreigabe
Fragebogen überall **Keine / Nein** → **4+**.
„Uneingeschränkter Webzugriff“: Nein (Links öffnen im Browser des Systems, die App
hat keinen eigenen Browser). „Nutzergenerierte Inhalte teilen“: Nein.

### Copyright
```
2026 Wisdompeak Apps – Simon Mählmann
```

### Datenschutz-URL
```
https://simaehlmann-cloud.github.io/ToDo-Organizer/todo-organizer/datenschutz.html
```

### Support-URL
```
https://simaehlmann-cloud.github.io/ToDo-Organizer/
```

### App-Datenschutz (Fragebogen)
„Erfassen Sie oder Ihre Drittanbieter Daten von dieser App?“ → **Nein** →
Ergebnis „Keine Daten erfasst“.

---

## Version 2.4

### Werbetext (max. 170)
```
30 Tage alle Funktionen kostenlos testen – danach bleiben die Aufgaben gratis. Die Vollversion ist ein Einmalkauf ohne Abo. Ohne Konto, ohne Server, ohne Werbung.
```

### Beschreibung (max. 4000)
```
Aufgaben, Termine, Stundenplan und Einkaufsliste in einer App – übersichtlich, schnell und privat. Der ToDo Organizer braucht kein Konto und keinen Server: Alle Daten bleiben auf deinem Gerät.

DEINE WOCHE AUF EINEN BLICK
Die Startseite zeigt die ganze Woche: für jeden Tag die Stunden aus deinem Stundenplan, Termine und alle fälligen Aufgaben. Überfälliges steht gesammelt obenauf und lässt sich mit einem Tippen auf heute legen.

AUFGABEN IN SEKUNDEN
• Titel tippen, „Heute“ oder „Morgen“ wählen – fertig
• Eigene Kategorien mit freier Farbwahl
• Prioritäten, Fälligkeitsdatum und Notizen
• Wiederholungen: täglich, wöchentlich, alle zwei Wochen, monatlich, jährlich
• Unterpunkte mit Fortschrittsbalken für größere Vorhaben
• Um einen Tag oder eine Woche verschieben
• Abhaken, Verschieben und Löschen lassen sich rückgängig machen
• Filtern nach Kategorie und Zeitraum, Suche über alle Aufgaben

MONATSKALENDER
Alle Aufgaben mit Datum im Monatsraster, farbig nach Kategorie. Auf Wunsch zeigt der Kalender zusätzlich die Termine deines eigenen Kalenders an – über eine private Kalender-Adresse (ICS), zum Beispiel aus dem Google Kalender. Nur lesend und ohne Anmeldung.

STUNDENPLAN
Ein frei belegbares Wochenraster mit eigenen Zeiten, Fächern, Räumen und Farben – für Schule, Studium, Ausbildung oder feste Wochentermine. Aufgaben lassen sich einem Fach zuordnen; die App zeigt dann, wann die nächste Stunde ist.

EINKAUFSLISTE
Schnell erfassen, im Laden abhaken, Erledigtes aufräumen und die Liste mit einem Tippen teilen.

ERINNERUNGEN
Eine tägliche Übersicht zur gewünschten Uhrzeit und eine Erinnerung am Fälligkeitstag jeder Aufgabe – auch bei geschlossener App. Direkt aus der Mitteilung verschieben oder abhaken.

SICHERUNG
Vollständige Sicherung als Datei, auf Wunsch mit Passwort verschlüsselt (AES-GCM). Ablegen, wo du willst: Dateien-App, iCloud Drive, USB-Stick oder per Mail. Aufgaben mit Datum lassen sich zusätzlich als Kalenderdatei (.ics) exportieren.

STATISTIK
Zeigt, an wie vielen Tagen in Folge du alles Fällige erledigt hast.

PRIVAT VON ANFANG AN
• Kein Konto, keine Registrierung
• Kein Server: Deine Einträge verlassen das Gerät nur, wenn du selbst sie exportierst oder teilst
• Keine Werbung, kein Tracking, keine Analyse

TESTEN UND VOLLVERSION
Die App ist kostenlos. 30 Tage lang kannst du alle Funktionen kostenlos testen. Danach bleiben die Aufgaben mit Wochenansicht, Kategorien, Unterpunkten, Wiederholungen und Sicherung dauerhaft kostenlos. Kalender, Stundenplan, Einkaufsliste, Erinnerungen, externer Kalender, verschlüsselte Sicherung, Kalenderdatei-Export und Statistik gehören zur Vollversion: ein einmaliger Kauf, kein Abo, mit der Familienfreigabe teilbar. Die Testphase endet von selbst – es wird nichts berechnet und nichts verlängert. Deine Einträge bleiben immer gespeichert.

Für iPhone und iPad.
```

### Schlüsselwörter (max. 100)
```
todo,liste,planer,kalender,wochenplaner,schule,lehrer,checkliste,erinnerung,termine,offline,privat
```
Wörter aus Name und Untertitel (Aufgaben, Stundenplan, Einkauf, Organizer) zählt
Apple ohnehin mit – sie stehen deshalb nicht noch einmal hier.

### Neuerungen (nur bei späteren Versionen)
Bei der ersten Version im Store bleibt das Feld leer.

### Hinweise für die Prüfung (App Review → Notizen)
```
No account or login is required. All data is stored locally on the device; the app has no backend.

In-app purchases (both non-consumable):
- de.maehlmann.todoorganizer.testphase – free (0.00) "30-day Trial". Starting it unlocks all features for 30 days from its purchase date (read from StoreKit 2 transaction history, no server). This follows guideline 3.1.1 for free trials of non-subscription apps.
- de.maehlmann.todoorganizer.vollversion – "Full Version", one-time purchase, Family Sharing enabled.

Where to find them: on first launch a dialog offers the trial. Afterwards: Einstellungen (Settings tab, gear icon) → card "Vollversion" at the top, with buttons "30 Tage kostenlos testen", "Vollversion kaufen" and "Käufe wiederherstellen" (restore).

What stays free after the trial: tasks (week view, task list, categories, subtasks, recurrence, backup export/import). Calendar, timetable, shopping list, reminders, external ICS calendar, encrypted backup, .ics export and statistics require the full version. Locked areas show a lock and lead to the purchase card; no data is deleted.

To test the end of the trial quickly: Settings → "Info, Datenschutz und Impressum" (on iPad: "Info" in the sidebar) → tap the line "Version 2.4" seven times. The trial then lasts 3 minutes instead of 30 days. Tapping seven times again switches back.

Network access happens only if the user enters their own ICS calendar URL in Settings, and for StoreKit.
```

### Kontakt für die Prüfung
Vorname/Nachname, Telefon, E-Mail eintragen (`smaehlmann.appdev@gmail.com`).
Anmeldung erforderlich: **Nein** (kein Demo-Konto nötig).

---

## In-App-Käufe (Lokalisierung Deutsch)

### Testphase – Anzeigename (max. 35)
```
30-Tage-Testphase
```

### Testphase – Beschreibung (max. 55)
```
30 Tage alle Funktionen kostenlos testen
```

### Vollversion – Anzeigename (max. 35)
```
Vollversion
```

### Vollversion – Beschreibung (max. 55)
```
Alle Funktionen dauerhaft freischalten, ohne Abo
```

Prüfungs-Screenshot für beide Käufe: `screenshots/iphone-6.3/07-privat.png`
reicht nicht – Apple will die Kaufansicht sehen. Am einfachsten in TestFlight
die Karte „Vollversion“ unter Einstellungen fotografieren (Seitentaste + Lauter).

---

## Medien

| Gerät | Bildschirmfotos | App-Vorschau |
|---|---|---|
| iPhone 6,3" (Pflicht) | `screenshots/iphone-6.3/01…07.png` (1206 × 2622) | `previews/iphone-886x1920.mp4` |
| iPad 13" (Pflicht, da iPad-App) | `screenshots/ipad-13/01…07.png` (2064 × 2752) | `previews/ipad-1200x1600.mp4` |

Größere iPhones (6,9") und kleinere iPads skaliert App Store Connect aus
diesen Bildern; eigene Fassungen sind nicht nötig. Das Titelbild der
Vorschau (Poster) ist standardmäßig Sekunde 5 – passt so.

Neu erzeugen nach Änderungen an der App:
```
node store/make-screenshots.js
node store/make-previews.js
```
