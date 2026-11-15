/* Beispieldaten für Store-Bildschirmfotos und Vorschauvideos (3.0, allgemein).
   „Heute“ ist Dienstag, 3. November 2026. */
const TODAY = '2026-11-03T08:10:00';

const t = (id, title, categoryId, prio, dueDate, extra = {}) => Object.assign({
  id, title, categoryId, prio, dueDate, dueTime: null, remind: 'due', recurrence: 'none',
  recurEvery: 1, recurUnit: 'd', recurFromDone: false, assignee: null, subject: null,
  subtasks: [], images: [], note: '', completed: false, createdAt: Date.parse('2026-10-20T10:00:00') + id.length
}, extra);
const sub = (...xs) => xs.map(([text, done], i) => ({ id: 's' + i + text.length, text, done: !!done }));

const STATE = {
  version: 3,
  categories: [
    { id: 'c1', name: 'Privat',   color: '#059669' },
    { id: 'c2', name: 'Arbeit',   color: '#2563eb' },
    { id: 'c3', name: 'Haushalt', color: '#d97706' },
    { id: 'c4', name: 'Sport',    color: '#db2777' }
  ],
  tasks: [
    t('t01', 'Präsentation fertigstellen', 'c2', 'hoch', '2026-11-05', { dueTime: '14:00', endTime: '15:30', remind: '1h',
      note: 'Raum 3.12 · Beamer vorher testen\nZahlen aus dem Q3-Bericht nehmen',
      subtasks: sub(['Gliederung', 1], ['Zahlen Q3 einarbeiten', 1], ['Beispiele ergänzen'], ['Probelauf mit Jana'], ['Handout drucken']) }),
    t('t02', 'Zahnarzt anrufen', 'c1', 'mittel', '2026-11-03', { dueTime: '11:30' }),
    t('t03', 'Angebot an Firma Berg schicken', 'c2', 'hoch', '2026-11-03', { dueTime: '16:00' }),
    t('t04', 'Wäsche waschen', 'c3', 'niedrig', '2026-11-04'),
    t('t05', 'Altpapier rausstellen', 'c3', 'niedrig', '2026-11-04', { recurrence: 'biweekly' }),
    t('t06', 'Blumen gießen', 'c3', 'niedrig', '2026-11-05', { recurrence: 'custom', recurEvery: 3, recurUnit: 'd' }),
    t('t07', 'Laufschuhe kaufen', 'c4', 'mittel', '2026-11-06'),
    t('t08', 'Geburtstagsgeschenk für Lena', 'c1', 'hoch', '2026-11-07', { remind: '2d' }),
    t('t09', 'Wochenplanung', 'c1', 'mittel', '2026-11-08', { recurrence: 'weekly', dueTime: '18:00' }),
    t('t10', 'Fahrrad zur Inspektion', 'c1', 'niedrig', '2026-11-10'),
    t('t11', 'Steuererklärung abschließen', 'c1', 'hoch', '2026-11-12', {
      subtasks: sub(['Belege sortieren', 1], ['Fahrtkosten eintragen'], ['Abschicken']) }),
    t('t12', 'Reisekosten abrechnen', 'c2', 'mittel', '2026-11-06'),
    t('t13', 'Team-Feedback vorbereiten', 'c2', 'mittel', '2026-11-04', { dueTime: '10:00' }),
    t('t14', 'Fußballtraining', 'c4', 'mittel', '2026-11-05', { dueTime: '18:00', endTime: '19:30', recurrence: 'weekly' }),
    // Erledigtes aus den letzten Wochen: ergibt eine Serie in der Statistik
    ...['Rechnung bezahlen', 'Einkaufen', 'Joggen', 'Mails beantworten', 'Bad putzen', 'Pflanzen gießen',
        'Bericht schicken', 'Auto tanken', 'Training', 'Wohnung saugen', 'Paket abholen', 'Arzttermin',
        'Protokoll schreiben', 'Fahrrad flicken', 'Wochenplanung', 'Bücher zurückgeben', 'Kühlschrank putzen', 'Fenster putzen'
      ].map((title, i) => {
        const d = new Date(Date.UTC(2026, 9, 15 + i, 12)).toISOString().slice(0, 10);
        return t('h' + i, title, ['c1', 'c2', 'c3', 'c4'][i % 4], 'mittel', d,
                 { completed: true, completedAt: Date.parse(d + 'T18:00:00') });
      })
  ],
  lessons: [
    { id: 'l1', day: 2, slot: null, start: '19:00', end: '20:30', subject: 'Volleyball', room: 'Halle 2', color: '#db2777' },
    { id: 'l2', day: 4, slot: null, start: '18:00', end: '19:00', subject: 'Yoga', room: 'Studio Mitte', color: '#7c3aed' },
    { id: 'l3', day: 6, slot: null, start: '10:00', end: '11:30', subject: 'Schwimmen', room: 'Hallenbad', color: '#0891b2' },
    { id: 'l4', day: 1, slot: null, start: '19:30', end: '21:00', subject: 'Chorprobe', room: 'Gemeindehaus', color: '#d97706' }
  ],
  shopLists: [{ id: 's1', name: 'Einkauf' }, { id: 's2', name: 'Drogerie' }],
  shopping: [
    ...[['Milch'], ['Vollkornbrot'], ['Äpfel'], ['Haferflocken'], ['Tomaten'], ['Käse', 1], ['Butter', 1]]
      .map(([text, done], i) => ({ id: 'p' + i, text, done: !!done, listId: 's1', createdAt: Date.parse('2026-11-01T09:00:00') + i * 1000 })),
    ...[['Zahnpasta'], ['Duschgel']].map(([text], i) => ({ id: 'q' + i, text, done: false, listId: 's2', createdAt: Date.parse('2026-11-01T09:00:00') + i * 1000 }))
  ],
  shopHistory: Object.fromEntries(['Milch', 'Vollkornbrot', 'Äpfel', 'Haferflocken', 'Tomaten', 'Käse', 'Butter', 'Kaffee', 'Bananen', 'Joghurt', 'Nudeln', 'Eier']
    .map((x, i) => [x.toLowerCase(), { t: x, n: 12 - i, last: Date.parse('2026-10-30T10:00:00') }])),
  templates: [
    { id: 'tp1', title: 'Urlaub packen', categoryId: 'c1', prio: 'mittel', note: '', subtasks: ['Ausweis und Reisepass', 'Ladekabel und Powerbank', 'Medikamente', 'Sonnencreme', 'Kühlschrank leeren', 'Pflanzen versorgen lassen'] },
    { id: 'tp2', title: 'Wohnung putzen', categoryId: 'c3', prio: 'niedrig', note: '', subtasks: ['Bad', 'Küche', 'Staubsaugen', 'Böden wischen', 'Müll rausbringen'] }
  ],
  habits: [
    { id: 'hb1', name: 'Joggen', perWeek: 3, color: '#db2777' },
    { id: 'hb2', name: 'Lesen', perWeek: 5, color: '#7c3aed' },
    { id: 'hb3', name: 'Wasser trinken', perWeek: 7, color: '#0891b2' },
    { id: 'hb4', name: 'Meditieren', perWeek: 4, color: '#059669' },
    { id: 'hb5', name: 'Früh schlafen', perWeek: 5, color: '#d97706' }
  ],
  habitLog: {
    hb4: ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-25', '2026-10-27', '2026-10-29', '2026-10-30', '2026-11-01', '2026-11-03'],
    hb5: ['2026-10-26', '2026-10-27', '2026-10-29', '2026-11-02'],
    hb1: ['2026-10-12', '2026-10-14', '2026-10-17', '2026-10-19', '2026-10-21', '2026-10-24', '2026-10-26', '2026-10-28', '2026-10-31', '2026-11-02'],
    hb2: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02'],
    hb3: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']
  },
  // Termine aus „verbundenen Kalendern“ (in der App: Gerätekalender)
  extEvents: [
    { date: '2026-11-03', time: '14:00', end: '15:00', title: 'Team-Meeting', cal: 'Arbeit', color: '#34c759' },
    { date: '2026-11-04', time: '19:30', title: 'Elternabend', cal: 'Familie', color: '#ff9500' },
    { date: '2026-11-06', time: '19:00', title: 'Essen bei Paul', cal: 'Privat', color: '#ff2d55' },
    { date: '2026-11-08', time: null,   title: 'Familienbesuch', cal: 'Familie', color: '#ff9500' },
    { date: '2026-11-11', time: '09:00', title: 'Quartalsgespräch', cal: 'Arbeit', color: '#34c759' },
    { date: '2026-11-18', time: '19:30', title: 'Elternabend', cal: 'Familie', color: '#ff9500' },
    { date: '2026-11-21', time: null,   title: 'Hochzeit Anna & Tim', cal: 'Privat', color: '#ff2d55' }
  ],
  settings: {
    features: { calendar: true, extCal: true, timetable: true, habits: true, shopping: true, reminders: true, stats: true,
                assignee: false, drafts: false, gcalLink: false },
    profile: 'everyday', theme: 'light', planMode: 'week', shopListId: 's1',
    reminderTime: '07:30',
    slots: ['08:00-08:45','08:45-09:30','09:55-10:40','10:40-11:25','11:50-12:35','12:35-13:20','14:00-14:45','14:45-15:30'],
    weekDays: 'mofr', devCal: false, devCalHidden: [],
    extCalUrl: '', extCalLastSync: null
  }
};

/* Schul-Szenen: Lehrkraft (Mathe/Physik) in Sachsen. „Heute“ ist Dienstag,
   17. November 2026, Woche A. Mittwoch ist Buß- und Bettag (nur Sachsen). */
const TODAY_SCHOOL = '2026-11-17T07:40:00';
const L = (id, day, slot, subject, room, color, extra = {}) => Object.assign({ id, day, slot, subject, room, color }, extra);
const BLUE = '#2563eb', ORANGE = '#d97706', TEAL = '#0891b2', VIOLET = '#7c3aed';
const note = (course, date, text) => ({ id: 'n' + date + course.length, course, date, text, updatedAt: Date.parse(date + 'T15:00:00') });
const sb = (id, date, type, hours, slot, klass, subject, notetext = '', extra = {}) =>
  Object.assign({ id, date, type, hours, slot, klass, subject, room: '', note: notetext, lessonId: null, pairId: null }, extra);

const SCHOOL = {
  version: 3,
  categories: [{ id: 'u1', name: 'Unterricht', color: BLUE }, { id: 'u2', name: 'Privat', color: '#059669' },
               { id: 'u3', name: 'Haushalt', color: ORANGE }],
  tasks: [
    t('s1', 'Klassenarbeit 7b vorbereiten', 'u1', 'mittel', '2026-11-17', { subject: 'Mathe',
      subtasks: sub(['Aufgaben erstellen', 1], ['Erwartungshorizont'], ['Kopieren']) }),
    t('s2', 'Zahnarzt anrufen', 'u2', 'mittel', '2026-11-17', { dueTime: '13:30' }),
    t('s3', 'Arbeitsblatt Prozentrechnung kopieren', 'u1', 'niedrig', '2026-11-19', { subject: 'Mathe' }),
    t('s4', 'Mathe 7b: Klassenarbeit', 'u1', 'hoch', '2026-11-26', { dueTime: '08:00', subject: 'Mathe', exam: true, course: 'Mathe|7b' }),
    t('s5', 'Fachkonferenz Mathematik', 'u1', 'mittel', '2026-11-19', { dueTime: '14:30' }),
    t('s6', 'Protokolle Versuch 3 lesen', 'u1', 'mittel', '2026-11-20', { subject: 'Physik' }),
    t('s7', 'Geburtstagsgeschenk für Lena', 'u2', 'hoch', '2026-11-21'),
    t('s8', 'Wäsche waschen', 'u3', 'niedrig', '2026-11-18'),
    t('s9', 'Wochenplanung', 'u2', 'mittel', '2026-11-22', { recurrence: 'weekly', dueTime: '18:00' }),
    t('s10', 'Klassenarbeit 7b zurückgeben', 'u1', 'mittel', '2026-12-03', { subject: 'Mathe' })
  ],
  lessons: [
    L('a1', 1, 0, 'Mathe', '7b', BLUE, { span: 2 }),
    L('a2', 1, 2, 'Physik', '9a', ORANGE),
    L('a3', 1, 4, 'Mathe', '10c', TEAL),
    L('a4', 2, 0, 'Mathe', '9a', VIOLET),
    L('a5', 2, 2, 'Physik', '8b', ORANGE, { span: 2 }),
    L('a6', 2, 4, 'Mathe', '7b', BLUE),
    L('a7', 3, 0, 'Mathe', '7b', BLUE),
    L('a8', 3, 2, 'Physik', '9a', ORANGE),
    L('a9', 4, 0, 'Mathe', '7b', BLUE),
    L('a10', 4, 2, 'Mathe', '10c', TEAL, { span: 2 }),
    L('a11', 4, 4, 'Physik-AG', 'R12', '#db2777', { week: 'A' }),
    L('a12', 4, 4, 'Förderkurs', '7b', '#059669', { week: 'B' }),
    L('a13', 5, 0, 'Physik', '9a', ORANGE, { span: 2 }),
    L('a14', 5, 3, 'Mathe', '9a', VIOLET)
  ],
  duties: [
    { id: 'd1', day: 2, after: 1, place: 'Schulhof', week: '' },
    { id: 'd2', day: 4, after: 3, place: 'Pausenhalle', week: '' }
  ],
  lessonEx: { 'a4|2026-11-17': { cancel: true } },
  lessonNotes: [
    note('Mathe|7b', '2026-11-02', 'Brüche erweitern und kürzen – Einstieg mit Pizza-Bild. Gut mitgemacht, AB 1 zu Ende.'),
    note('Mathe|7b', '2026-11-05', 'Brüche vergleichen: gleichnamig machen. Viele Fehler beim Hauptnenner – wiederholen.'),
    note('Mathe|7b', '2026-11-09', 'Hauptnenner geübt (Stationen). Lena und Tim fehlten.'),
    note('Mathe|7b', '2026-11-10', 'Addition und Subtraktion. HA: S. 54 Nr. 3a–d'),
    note('Mathe|7b', '2026-11-12', 'Gemischte Zahlen. Kurztest zurückgegeben, Schnitt 2,4.'),
    note('Mathe|7b', '2026-11-16', 'Wiederholung begonnen, Fragen für die Klassenarbeit gesammelt.'),
    note('Physik|8b', '2026-11-10', 'Versuch 3: Reibung messen. Gruppen 2 und 5 Protokoll fehlt.')
  ],
  subLog: [
    sb('v1', '2026-09-08', 'plus', 1, 3, '8c', 'Englisch', 'Arbeitsblatt Vokabeln'),
    sb('v2', '2026-09-24', 'aufsicht', 1, 1, '', '', 'Hofaufsicht für Frau Krause'),
    sb('v3', '2026-10-01', 'minus', 2, 0, '7b', 'Mathe', 'Wandertag'),
    sb('v4', '2026-10-07', 'plus', 2, 4, '10a', 'Physik', 'Versuch vorbereitet, Ergebnisse gesichert'),
    sb('v5', '2026-11-04', 'plus', 1, 5, '6a', 'Deutsch', 'Lesezeit'),
    sb('v6', '2026-11-11', 'plus', 2, 2, '9b', 'Mathe', 'Übungsaufgaben Prozentrechnung'),
    sb('v7', '2026-11-13', 'aufsicht', 1, 4, '', '', 'Prüfungsaufsicht'),
    sb('v8', '2026-11-17', 'minus', 1, 0, '9a', 'Mathe', '9a im Theater', { lessonId: 'a4' }),
    sb('v9', '2026-11-19', 'plus', 1, 5, '8c', 'Englisch', '')
  ],
  extEvents: [
    { date: '2026-11-17', time: '19:30', title: 'Elternabend 7b', cal: 'Schule', color: '#34c759' },
    { date: '2026-11-18', time: '10:00', title: 'Laufen mit Jana', cal: 'Privat', color: '#ff2d55' },
    { date: '2026-11-20', time: '15:00', title: 'Elternsprechtag', cal: 'Schule', color: '#34c759' },
    { date: '2026-11-22', time: null, title: 'Familienbesuch', cal: 'Familie', color: '#ff9500' }
  ],
  shopLists: STATE.shopLists, shopping: STATE.shopping, shopHistory: STATE.shopHistory,
  settings: { features: { timetable: true, calendar: true, habits: false, extCal: true, shopping: true, reminders: true, stats: true },
              profile: 'teacher', planMode: 'school', theme: 'light', region: 'SN', showFerien: true, weekDays: 'mofr',
              ab: { on: true, anchor: '2026-11-16', type: 'A', skip: true } }
};

module.exports = { TODAY, STATE, TODAY_SCHOOL, SCHOOL };
