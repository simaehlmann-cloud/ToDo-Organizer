/* Beispieldaten für Store-Bildschirmfotos und Vorschauvideos.
   „Heute“ ist Dienstag, 3. November 2026 (keine Ferien in Niedersachsen). */
const TODAY = '2026-11-03T08:10:00';

const t = (id, title, categoryId, prio, dueDate, extra = {}) => Object.assign({
  id, title, categoryId, prio, dueDate, recurrence: 'none', assignee: null, subject: null,
  subtasks: [], note: '', completed: false, createdAt: Date.parse('2026-10-20T10:00:00') + id.length
}, extra);

const STATE = {
  version: 2,
  categories: [
    { id: 'c1', name: 'Schule',   color: '#2563eb' },
    { id: 'c3', name: 'Privat',   color: '#059669' },
    { id: 'c2', name: 'Haushalt', color: '#d97706' },
    { id: 'c4', name: 'Verein',   color: '#7c3aed' }
  ],
  tasks: [
    t('t01', 'Klassenarbeit 7b korrigieren', 'c1', 'hoch', '2026-11-05', {
      subject: 'Mathe', note: 'Erwartungshorizont liegt im Fach.',
      subtasks: [
        { id: 's1', text: 'Aufgaben 1–3 bewerten', done: true },
        { id: 's2', text: 'Aufgaben 4–6 bewerten', done: true },
        { id: 's3', text: 'Notenspiegel erstellen', done: false },
        { id: 's4', text: 'Rückgabe vorbereiten', done: false }
      ] }),
    t('t02', 'Arbeitsblatt Bruchrechnung erstellen', 'c1', 'mittel', '2026-11-03', { subject: 'Mathe' }),
    t('t03', 'Zahnarzttermin vereinbaren', 'c3', 'mittel', '2026-11-03'),
    t('t04', 'Wäsche waschen', 'c2', 'niedrig', '2026-11-04'),
    t('t05', 'Kopien für die Projektwoche', 'c1', 'niedrig', '2026-11-04'),
    t('t06', 'Altpapier rausstellen', 'c2', 'niedrig', '2026-11-04', { recurrence: 'biweekly' }),
    t('t07', 'Elternsprechtag vorbereiten', 'c1', 'mittel', '2026-11-06'),
    t('t08', 'Hallenzeiten fürs Training abstimmen', 'c4', 'mittel', '2026-11-05'),
    t('t09', 'Geburtstagsgeschenk für Lena', 'c3', 'hoch', '2026-11-07'),
    t('t10', 'Wochenplanung', 'c3', 'mittel', '2026-11-08', { recurrence: 'weekly' }),
    t('t11', 'Mitgliedsbeiträge prüfen', 'c4', 'niedrig', '2026-11-10'),
    t('t12', 'Steuererklärung abschließen', 'c3', 'hoch', '2026-11-12', {
      subtasks: [
        { id: 's5', text: 'Belege sortieren', done: true },
        { id: 's6', text: 'Fahrtkosten eintragen', done: false },
        { id: 's7', text: 'Abschicken', done: false }
      ] }),
    t('t13', 'Reifenwechsel', 'c3', 'mittel', '2026-11-14'),
    t('t14', 'Fortbildung anmelden', 'c1', 'mittel', '2026-11-02', { completed: true, completedAt: Date.parse('2026-11-02T17:00:00') }),
    t('t15', 'Hausaufgaben 6a einsammeln', 'c1', 'niedrig', '2026-11-02', { completed: true, completedAt: Date.parse('2026-11-02T12:00:00') }),
    // Erledigtes aus den letzten Wochen: ergibt eine Serie in der Statistik
    ...['Unterricht vorbereiten', 'Einkaufen', 'Joggen', 'Mails beantworten', 'Kopien machen', 'Pflanzen gießen',
        'Rechnung bezahlen', 'Vokabeltest korrigieren', 'Training', 'Wohnung saugen', 'Elternbrief schreiben',
        'Arzttermin', 'Protokoll schreiben', 'Fahrrad reparieren', 'Wochenplanung', 'Bücher zurückgeben',
        'Material bestellen', 'Fenster putzen'
      ].map((title, i) => {
        const d = new Date(Date.UTC(2026, 9, 15 + i, 12)).toISOString().slice(0, 10);   // 15.10. – 01.11.
        return t('h' + i, title, ['c1', 'c3', 'c2', 'c4'][i % 4], 'mittel', d,
                 { completed: true, completedAt: Date.parse(d + 'T18:00:00') });
      })
  ],
  lessons: [
    // day: 1 = Montag … 5 = Freitag, slot: 0 = 1. Stunde
    ...[[1,0,'Mathe','7b'],[1,1,'Mathe','7b'],[1,3,'Physik','9a'],[1,4,'Physik','9a'],
        [2,0,'Physik','8c'],[2,2,'Mathe','6a'],[2,3,'Mathe','6a'],[2,5,'AG Robotik','Werkraum'],
        [3,1,'Mathe','7b'],[3,2,'Physik','9a'],[3,4,'Mathe','10b'],[3,5,'Mathe','10b'],
        [4,0,'Mathe','6a'],[4,2,'Physik','8c'],[4,3,'Physik','8c'],
        [5,1,'Mathe','10b'],[5,2,'Mathe','7b'],[5,4,'Physik','9a']
      ].map(([day, slot, subject, room], i) => ({
        id: 'l' + i, day, slot, subject, room,
        color: { 'Mathe': '#2563eb', 'Physik': '#7c3aed', 'AG Robotik': '#0d9488' }[subject]
      }))
  ],
  shopping: [
    ['Milch', false], ['Vollkornbrot', false], ['Äpfel', false], ['Haferflocken', false],
    ['Tomaten', false], ['Käse', true], ['Spülmittel', true]
  ].map(([text, done], i) => ({ id: 'p' + i, text, done, createdAt: Date.parse('2026-11-01T09:00:00') + i * 1000 })),
  extEvents: [
    { date: '2026-11-03', time: '15:00', title: 'Konferenz' },
    { date: '2026-11-04', time: '19:30', title: 'Chorprobe' },
    { date: '2026-11-06', time: '14:00', title: 'Dienstbesprechung' },
    { date: '2026-11-11', time: '19:30', title: 'Chorprobe' },
    { date: '2026-11-18', time: '19:30', title: 'Chorprobe' },
    { date: '2026-11-21', time: null,   title: 'Familienbesuch' }
  ],
  settings: {
    features: { calendar: true, timetable: true, shopping: true, assignee: false, drafts: false,
                gcalLink: false, reminders: true, extCal: true, stats: true },
    reminderTime: '07:00',
    slots: ['08:00-08:45','08:45-09:30','09:55-10:40','10:40-11:25','11:50-12:35','12:35-13:20','14:00-14:45','14:45-15:30'],
    weekDays: 'mofr',
    extCalUrl: 'https://calendar.google.com/calendar/ical/beispiel/private/basic.ics',
    extCalLastSync: Date.parse('2026-11-03T07:58:00')
  }
};

module.exports = { TODAY, STATE };
