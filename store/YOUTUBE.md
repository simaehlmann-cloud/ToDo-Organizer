# ToDo Organizer – YouTube-Werbevideo

Video, Vorschaubild und Musik erzeugt `node store/make-youtube.js` nach
`store/out/youtube/` (nicht im Repo). Nur das Vorschaubild neu:
`node store/make-youtube.js thumb`.

- **Video:** `ToDo-Organizer-Werbevideo.mp4` – 1920 × 1080, 30 fps, ca. 59 s, H.264 + AAC
- **Vorschaubild:** `thumbnail.png` – 1280 × 720 (YouTube: „Miniaturansicht hochladen“)
- **Musik:** im Skript erzeugt, keine fremden Rechte, kein Content-ID-Anspruch zu erwarten
- Gezeigt wird die echte App mit Beispieldaten (Lehrkraft Mathe/Physik, Alltag).

---

## Titel (max. 100 Zeichen)
```
ToDo Organizer: Unterrichtsplaner und To-do-App für Schule und Alltag | iPhone & iPad
```
Kürzere Alternative:
```
Stundenplan, Vertretungen & Aufgaben in einer App – ToDo Organizer
```

## Beschreibung
Den App-Store-Link nach der Freigabe einsetzen (App Store Connect → App-Informationen → „Im App Store ansehen“).
```
Der private Planer für Schule und Alltag – für Lehrkräfte, Schüler, Studierende und alle, die ihre Woche im Griff haben wollen. Ohne Konto, ohne Server, ohne Abo.

📲 ToDo Organizer im App Store (iPhone und iPad): [App-Store-Link]
ℹ️ Hilfe und häufige Fragen: https://simaehlmann-cloud.github.io/ToDo-Organizer/

FÜR LEHRKRÄFTE
✔ Stundenplan mit Ferien und Feiertagen (Deutschland, Österreich, Schweiz), A/B-Wochen, Doppelstunden und Aufsichten
✔ Notizen zu jeder Stunde und der Stundenverlauf je Klasse
✔ Hausaufgaben „bis zur nächsten Stunde“ – die App weiß, wann die Klasse wieder Unterricht hat
✔ Vertretung und Ausfall mit einem Tipp, Plus- und Minusstunden je Schuljahr, als PDF
✔ Klassenarbeiten planen: vorbereiten, schreiben, zurückgeben
✔ „Noch X Stunden bis zur Klassenarbeit / zu den Ferien“

FÜR DEN ALLTAG
✔ Schnelleingabe in normaler Sprache: „Laufen Sa 8–9:30 #Sport“
✔ Uhrzeit von–bis, Erinnerungen vorab, Wiederholungen, Unterpunkte, Notizen und Fotos
✔ Kalender mit deinen Terminen (auch Google) und Kalender-Abos
✔ Gewohnheiten mit Wochenziel und Serie, Einkaufslisten mit Vorschlägen
✔ Widget, Siri, hell und dunkel, Deutsch und Englisch

DEINE DATEN BLEIBEN BEI DIR
Kein Konto, keine Werbung, kein Tracking. Alles liegt auf deinem Gerät – und auf Wunsch über den iCloud-Abgleich in deinem eigenen iCloud-Konto.

30 Tage alle Funktionen kostenlos testen, danach Einmalkauf statt Abo (mit Familienfreigabe). Aufgaben bleiben immer kostenlos.

KAPITEL
0:00 Woche, Stundennotizen und Hausaufgaben
0:17 Vertretungen, Plus-/Minusstunden, Stundenplan
0:29 Schnelleingabe, Aufgaben, Gewohnheiten
0:40 Kalender, Einkauf, Datenschutz

Fragen, Fehler, Wünsche: smaehlmann.appdev@gmail.com
Entwickelt von Simon Mählmann (Wisdompeak Apps).

#Lehrer #Unterrichtsplanung #ToDoApp
```
Die Kapitelzeiten schreibt das Skript bei jedem Lauf nach `store/out/youtube/kapitel.txt` –
nach einem neuen Lauf von dort übernehmen.

## Tags (max. 500 Zeichen insgesamt)
```
ToDo Organizer, Unterrichtsplaner, Lehrer App, Lehrkräfte, Stundenplan App, Schulplaner, Lehrerkalender, Vertretungsplan, Mehrarbeit Lehrer, Plusstunden, Hausaufgaben App, Klassenarbeit planen, To-do-Liste, Aufgabenplaner, Wochenplaner, Aufgaben App iPhone, iPad App Lehrer, Referendariat, Schule organisieren, Einkaufsliste App, Gewohnheiten Tracker, ohne Abo, Datenschutz App, Planer App
```

## Einstellungen beim Hochladen
- **Sprache des Videos:** Deutsch · **Kategorie:** Bildung (oder „Wissenschaft & Technik“)
- **Zielgruppe:** „Nein, es ist nicht speziell für Kinder“
- **Bezahlte Werbung / Produktplatzierung:** nicht ankreuzen (eigenes Produkt, keine bezahlte Platzierung durch Dritte)
- **Untertitel:** nicht nötig, alle Texte stehen im Bild; der Ton ist nur Musik
- **Endbildschirm:** in den letzten 5 Sekunden (Abspann) Platz für „Abonnieren“ oder ein Video
- **Google Play:** Der YouTube-Link dieses Videos passt als Vorschauvideo im Play-Store-Eintrag.
  Apple nimmt nur die Hochformat-Videos aus `make-previews.js`.
