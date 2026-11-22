# Gerätetest – was nur auf echten Geräten prüfbar ist

Die Browsertests (`tests/*.test.js`) bilden iOS nach. Swift, Widget, iCloud,
Siri, Mitteilungen und Android-Eigenheiten lassen sich nur auf dem Gerät prüfen.
Reihenfolge: erst Sicherung exportieren, dann das Update installieren.

## iPhone (TestFlight)

1. **Start:** Daten sind alle noch da (Aufgaben, Stundenplan, Einkauf).
2. **Widget:** Heute-Widget zeigt den Tag; Aufgabe abhaken → Widget aktualisiert sich nach dem Schließen der App.
3. **Erinnerung:** Aufgabe in 2 Minuten anlegen, App schließen → Mitteilung kommt; „+1 Tag“ aus der Mitteilung verschiebt.
4. **Zahl am Symbol:** Einstellungen → Zahl am App-Symbol „Heute fällig und überfällig“ → Zahl stimmt.
5. **Kalender:** Gerätekalender verbinden → Termine in der Woche; „In Kalender eintragen“ legt einen Termin an.
6. **Kalender-Abo:** Google-Adresse (geheime iCal-Adresse) eintragen → Termine erscheinen in eigener Farbe.
7. **Siri:** „Hey Siri, neue Aufgabe in ToDo Organizer“ → Text sagen → Aufgabe erscheint mit Datum.
   „Hey Siri, was steht heute an in ToDo Organizer“ → Siri liest den Tag vor.
8. **iCloud** (nur wenn eingerichtet, siehe APPSTORE-CONNECT.md Abschnitt 10):
   Einstellungen → „Zwischen meinen Geräten abgleichen“ an. Auf dem iPad dasselbe → Dialog
   „Daten in iCloud gefunden“ → Zusammenführen. Auf dem iPhone eine Aufgabe ändern → nach
   kurzer Zeit (bis ca. 1 Minute, beim Öffnen sofort) auf dem iPad sichtbar. Löschen ebenso.
9. **Englisch:** Einstellungen → „Sprache · Language“ → English → App lädt neu, alles englisch.
   Schnelleingabe „Dentist tomorrow 3pm“ → morgen 15:00. Widget und Mitteilungen englisch.
   Zurück auf „Automatisch“. Optional: iPhone-Sprache auf Englisch → Kamera-/Kalender-Rückfrage englisch.
10. **Sicherung:** Einstellungen → Jetzt sichern → Datei im Teilen-Menü; Import der Datei klappt.
11. **Kauf** (Sandbox): Testphase, Vollversion, Käufe wiederherstellen.

## Samsung / Android (APK aus Actions → Artifacts)

1. **Installieren über die alte Fassung** (gleicher Schlüssel) → Daten bleiben.
2. **Erinnerungen:** Mitteilungen erlauben, „Pünktliche Erinnerungen erlauben“ (Einstellungen der App).
   Aufgabe in 2 Minuten, App wegwischen → Mitteilung kommt pünktlich. Wenn nicht: Akku → „Nicht eingeschränkt“.
3. **Zahl am Symbol:** erscheint am Symbol (One UI zeigt Zahlen; ggf. in den Mitteilungs-Einstellungen
   „App-Symbol-Badges → Mit Zahl“ wählen).
4. **Kalender:** Gerätekalender verbinden → Samsung-/Google-Kalender anhaken → Termine in der Woche.
5. **Teilen:** In Chrome Text markieren → Teilen → ToDo Organizer → Aufgabe vorgeschlagen.
6. **Kurzbefehle:** Lange aufs Symbol drücken → „Neue Aufgabe“, „Woche“ … (bei englischem Gerät englisch).
7. **Zurück-Taste:** schließt erst offene Dialoge, dann zweimal drücken zum Beenden.
8. **Englisch:** wie beim iPhone (Punkt 9).
9. **Dunkelmodus und Schriftgröße:** Systemschrift groß → nichts abgeschnitten.
10. **Sicherung:** automatische Sicherung im Ordner „Dokumente“ (Eigene Dateien → Interner Speicher → Documents).
