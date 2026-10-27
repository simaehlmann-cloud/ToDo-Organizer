/* Test der reinen App-Logik (Block zwischen ==CORE-BEGIN== und ==CORE-END==
   in index.html) ohne Browser.   node tests/core.test.js [index.html] */
// Feste Zeitzone wie in der App (de-DE): GitHub rechnet in UTC, sonst
// stimmen Uhrzeiten in den Prüfungen nicht (Lauf #23).
process.env.TZ = 'Europe/Berlin';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(file, 'utf8');
const a = src.indexOf('/* ==CORE-BEGIN=='), b = src.indexOf('/* ==CORE-END== */');
if (a < 0 || b < 0) { console.error('CORE-Block nicht gefunden'); process.exit(1); }
const fa = src.indexOf('/* ==FERIEN-BEGIN=='), fb = src.indexOf('/* ==FERIEN-END== */');
if (fa < 0 || fb < 0) { console.error('FERIEN-Block nicht gefunden (tools/make-ferien.js)'); process.exit(1); }
const code = src.slice(a, b) + '\n' + src.slice(fa, fb);

let fails = 0, n = 0;
function eq(got, exp, msg) {
  n++;
  const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
  const g = canon(got), e = canon(exp);
  if (g !== e) { fails++; console.log(`  ✗ ${msg}\n      erwartet ${e}\n      erhalten ${g}`); }
}

/* Den Block mit fester „Jetzt“-Zeit laden: Dienstag, 3.11.2026, 10:15 Uhr. */
function load(nowStr) {
  const RealDate = Date;
  const fixed = new RealDate(nowStr).getTime();
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  const ctx = { Date: FakeDate, console };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;globalThis.__ = { isoOf, todayISO, addDays, dowOf, mondayOf, nextDue, recLabel, parseQuick, reminderAt, habitWeek, habitStreak, lessonStart, nextLesson, addMonths, parseISO, matchSubject, easterSunday, publicHolidays, holidayName, ferienName, dayOff, isFerienWeek, abWeekOf, lessonOn, planExam, subValue, subSummary, schoolPeriod, slotLabel, lessonBlock, breaksOf, occupies, FERIEN, FERIEN_NAMES, FERIEN_BIS, REGIONS };', ctx);
  return { ...ctx.__, now: new FakeDate() };
}

const C = load('2026-11-03T10:15:00');      // Dienstag
const cats = [{ id: 'c1', name: 'Privat' }, { id: 'c2', name: 'Arbeit' }, { id: 'c3', name: 'Haus und Garten' }];
const P = t => { const r = C.parseQuick(t, { now: C.now, categories: cats }); delete r.hits; return r; };
const base = { date: null, time: null, catId: null, prio: null, rec: null, every: null, unit: null, subject: null };
const exp = o => Object.assign({}, base, o);

console.log('Datumshelfer');
eq(C.todayISO(), '2026-11-03', 'heute');
eq(C.dowOf('2026-11-03'), 2, 'Dienstag = 2');
eq(C.dowOf('2026-11-08'), 7, 'Sonntag = 7');
eq(C.mondayOf('2026-11-08'), '2026-11-02', 'Montag der Woche');
eq(C.addDays('2026-12-31', 1), '2027-01-01', 'Jahreswechsel');
eq(C.addDays('2026-03-28', 2), '2026-03-30', 'Zeitumstellung März');
eq(C.addDays('2026-10-24', 2), '2026-10-26', 'Zeitumstellung Oktober');

console.log('Wiederholungen');
eq(C.nextDue('2026-11-03', 'daily'), '2026-11-04', 'täglich');
eq(C.nextDue('2026-10-20', 'daily'), '2026-11-04', 'täglich, verspätet abgehakt → nach heute');
eq(C.nextDue('2026-11-03', 'weekly'), '2026-11-10', 'wöchentlich');
eq(C.nextDue('2026-11-03', 'biweekly'), '2026-11-17', '14-tägig');
eq(C.nextDue('2026-01-31', 'monthly'), '2026-11-30', 'monatlich vom 31.1. → 30.11.');
eq(C.nextDue('2026-10-31', 'monthly'), '2026-11-30', 'monatlich 31.10. → 30.11. (geklammert)');
eq(C.nextDue('2026-11-30', 'monthly', { today: '2026-12-01' }), '2026-12-30', 'monatlich 30.11. → 30.12.');
eq(C.nextDue('2024-02-29', 'yearly'), '2027-02-28', 'jährlich 29.2.');
eq(C.nextDue('2026-11-06', 'weekdays'), '2026-11-09', 'werktags Fr → Mo');
eq(C.nextDue('2026-11-03', 'weekdays'), '2026-11-04', 'werktags Di → Mi');
eq(C.nextDue('2026-10-01', 'weekdays'), '2026-11-04', 'werktags, verspätet → nächster Werktag nach heute');
eq(C.nextDue('2026-11-03', 'custom', { every: 3, unit: 'd' }), '2026-11-06', 'alle 3 Tage');
eq(C.nextDue('2026-10-01', 'custom', { every: 3, unit: 'd' }), '2026-11-06', 'alle 3 Tage, verspätet');
eq(C.nextDue('2026-10-01', 'custom', { every: 10, unit: 'd', fromDone: true }), '2026-11-13', 'alle 10 Tage ab Erledigung');
eq(C.nextDue('2026-11-03', 'custom', { every: 2, unit: 'm' }), '2027-01-03', 'alle 2 Monate');
eq(C.nextDue('2026-11-03', 'custom', { every: 1, unit: 'y' }), '2027-11-03', 'jedes Jahr');
eq(C.nextDue('2026-11-03', 'custom', { every: 0, unit: 'w' }), '2026-11-10', 'alle 0 Wochen → mindestens 1');
eq(C.nextDue(null, 'weekly'), '2026-11-10', 'ohne Datum ab heute');
eq(C.nextDue('2026-11-03', 'none'), null, 'keine');
eq(C.nextDue('2026-11-03', 'quatsch'), null, 'unbekannte Regel');
eq(C.recLabel({ recurrence: 'custom', recurEvery: 3, recurUnit: 'w', recurFromDone: true }), 'alle 3 Wochen ab Erledigung', 'Bezeichnung custom');
eq(C.recLabel({ recurrence: 'weekdays' }), 'werktags', 'Bezeichnung werktags');

console.log('Schnelleingabe');
eq(P('Zahnarzt anrufen morgen 9 Uhr #Privat !'), exp({ title: 'Zahnarzt anrufen', date: '2026-11-04', time: '09:00', catId: 'c1', prio: 'hoch' }), 'Beispiel aus der App');
eq(P('Milch kaufen'), exp({ title: 'Milch kaufen' }), 'nichts erkennen');
eq(P('Bericht abgeben übermorgen'), exp({ title: 'Bericht abgeben', date: '2026-11-05' }), 'übermorgen');
eq(P('Steuer heute'), exp({ title: 'Steuer', date: '2026-11-03' }), 'heute');
eq(P('Training am Freitag 18:30'), exp({ title: 'Training', date: '2026-11-06', time: '18:30' }), 'am Freitag 18:30');
eq(P('Meeting Dienstag'), exp({ title: 'Meeting', date: '2026-11-03' }), 'Dienstag am Dienstag = heute');
eq(P('Meeting nächsten Dienstag'), exp({ title: 'Meeting', date: '2026-11-10' }), 'nächsten Dienstag');
eq(P('Urlaub buchen nächste Woche'), exp({ title: 'Urlaub buchen', date: '2026-11-09' }), 'nächste Woche → Montag');
eq(P('Reifen wechseln in 2 Wochen'), exp({ title: 'Reifen wechseln', date: '2026-11-17' }), 'in 2 Wochen');
eq(P('Pass verlängern in einem Monat'), exp({ title: 'Pass verlängern', date: '2026-12-03' }), 'in einem Monat');
eq(P('Geburtstag Oma 12.12.'), exp({ title: 'Geburtstag Oma', date: '2026-12-12' }), '12.12.');
eq(P('Rechnung 01.02.'), exp({ title: 'Rechnung', date: '2027-02-01' }), '01.02. liegt zurück → nächstes Jahr');
eq(P('Termin am 5.1.27 um 14 Uhr'), exp({ title: 'Termin', date: '2027-01-05', time: '14:00' }), '5.1.27 um 14 Uhr');
eq(P('Konzert 24. Dezember'), exp({ title: 'Konzert', date: '2026-12-24' }), '24. Dezember');
eq(P('Party 3. März 2027'), exp({ title: 'Party', date: '2027-03-03' }), '3. März 2027');
eq(P('Falsches Datum 31.02.'), exp({ title: 'Falsches Datum 31.02.' }), '31.02. ist kein Datum');
eq(P('Kollegin anrufen um 9'), exp({ title: 'Kollegin anrufen', date: '2026-11-04', time: '09:00' }), 'um 9 (vorbei) → morgen');
eq(P('Kollegin anrufen um 11'), exp({ title: 'Kollegin anrufen', date: '2026-11-03', time: '11:00' }), 'um 11 → heute');
eq(P('Mittag 12.30 Uhr'), exp({ title: 'Mittag', date: '2026-11-03', time: '12:30' }), '12.30 Uhr');
eq(P('Kapitel 3 lesen'), exp({ title: 'Kapitel 3 lesen' }), 'Zahl ohne Uhr bleibt');
eq(P('Seite 9.30 prüfen'), exp({ title: 'Seite 9.30 prüfen' }), '9.30 ohne Uhr bleibt');
eq(P('Joggen jeden Montag'), exp({ title: 'Joggen', date: '2026-11-09', rec: 'weekly' }), 'jeden Montag');
eq(P('Zeitung lesen täglich'), exp({ title: 'Zeitung lesen', date: '2026-11-03', rec: 'daily' }), 'täglich');
eq(P('Mails werktags 8 Uhr'), exp({ title: 'Mails', date: '2026-11-04', time: '08:00', rec: 'weekdays' }), 'werktags 8 Uhr (heute schon vorbei → morgen)');
eq(P('Mails werktags 11 Uhr'), exp({ title: 'Mails', date: '2026-11-03', time: '11:00', rec: 'weekdays' }), 'werktags 11 Uhr → heute');
eq(P('Blumen gießen alle 3 Tage'), exp({ title: 'Blumen gießen', date: '2026-11-03', rec: 'custom', every: 3, unit: 'd' }), 'alle 3 Tage');
eq(P('Müll alle zwei Wochen'), exp({ title: 'Müll', date: '2026-11-03', rec: 'biweekly' }), 'alle zwei Wochen');
eq(P('Miete monatlich am 1.12.'), exp({ title: 'Miete', date: '2026-12-01', rec: 'monthly' }), 'monatlich am 1.12.');
eq(P('Beet #haus'), exp({ title: 'Beet', catId: 'c3' }), '#haus → „Haus und Garten“');
eq(P('Beet #unbekannt'), exp({ title: 'Beet #unbekannt' }), 'unbekannte Kategorie bleibt im Titel');
eq(P('Wichtig!! !niedrig'), exp({ title: 'Wichtig!!', prio: 'niedrig' }), '!niedrig, „Wichtig!!“ bleibt');
eq(P('morgen'), exp({ title: 'morgen', date: '2026-11-04' }), 'nur Datum → Titel bleibt Text');
eq(P('Morgenlauf'), exp({ title: 'Morgenlauf' }), 'Morgenlauf ist kein Datum');
eq(P('Übergabe Heute-Show'), exp({ title: 'Übergabe -Show', date: '2026-11-03' }), 'Grenzfall Heute-Show (Vorschau zeigt es, abschaltbar)');
eq(P('Arzt am Montag um 8:15'), exp({ title: 'Arzt', date: '2026-11-09', time: '08:15' }), 'am Montag um 8:15');
eq(P('Sonntag Brunch'), exp({ title: 'Brunch', date: '2026-11-08' }), 'Wochentag vorn');
eq(P('Kino heute Abend'), exp({ title: 'Kino', date: '2026-11-03', time: '19:00' }), 'heute Abend → 19:00');
eq(P('Bäcker morgen früh'), exp({ title: 'Bäcker', date: '2026-11-04', time: '08:00' }), 'morgen früh → 08:00');
eq(P('Rasen mähen Samstag nachmittags'), exp({ title: 'Rasen mähen', date: '2026-11-07', time: '15:00' }), 'Samstag nachmittags');
eq(P('Abendessen kochen'), exp({ title: 'Abendessen kochen' }), 'Abendessen ist keine Tageszeit');
eq(P('Spieleabend planen'), exp({ title: 'Spieleabend planen' }), 'Spieleabend ist keine Tageszeit');
// Wochentags-Kürzel (seit Store-Bildern aufgefallen: „Fr“ wurde Teil des Titels)
eq(P('Arzt Fr 15 Uhr #Privat'), exp({ title: 'Arzt', date: '2026-11-06', time: '15:00', catId: 'c1' }), 'Kürzel Fr');
eq(P('Do. Bericht abgeben'), exp({ title: 'Bericht abgeben', date: '2026-11-05' }), 'Kürzel mit Punkt');
eq(P('Brunch am So'), exp({ title: 'Brunch', date: '2026-11-08' }), 'am So');
eq(P('So. Brunch'), exp({ title: 'Brunch', date: '2026-11-08' }), 'So.');
eq(P('Müll raus jeden Di'), exp({ title: 'Müll raus', date: '2026-11-03', rec: 'weekly' }), 'jeden Di');
eq(P('nächsten Mo Meeting'), exp({ title: 'Meeting', date: '2026-11-09' }), 'nächsten Mo');
eq(P('so schnell wie möglich'), exp({ title: 'so schnell wie möglich' }), '„so“ ist kein Sonntag');
eq(P('Mineralwasser kaufen'), exp({ title: 'Mineralwasser kaufen' }), 'Mi im Wort zählt nicht');
eq(P('Doku Sa lesen'), exp({ title: 'Doku lesen', date: '2026-11-07' }), 'Do im Wort zählt nicht, Sa schon');
eq(P('Mittagspause machen'), exp({ title: 'Mittagspause machen' }), 'Mittagspause bleibt');

console.log('Erinnerungen');
const at = (t, d) => { const r = C.reminderAt(t, d); return r ? C.isoOf(r) + ' ' + String(r.getHours()).padStart(2, '0') + ':' + String(r.getMinutes()).padStart(2, '0') : null; };
eq(at({ dueDate: '2026-11-05' }, '07:30'), '2026-11-05 07:30', 'ohne Uhrzeit: allgemeine Zeit');
eq(at({ dueDate: '2026-11-05', dueTime: '09:00' }, '07:30'), '2026-11-05 09:00', 'eigene Uhrzeit');
eq(at({ dueDate: '2026-11-05', dueTime: '09:00', remind: '1h' }, '07:30'), '2026-11-05 08:00', '1 Std. vorher');
eq(at({ dueDate: '2026-11-05', dueTime: '00:10', remind: '15m' }, '07:30'), '2026-11-04 23:55', '15 Min. vorher über Mitternacht');
eq(at({ dueDate: '2026-11-05', remind: '1d' }, '07:30'), '2026-11-04 07:30', '1 Tag vorher');
eq(at({ dueDate: '2026-11-05', remind: '1w' }, '07:30'), '2026-10-29 07:30', '1 Woche vorher');
eq(at({ dueDate: '2026-11-05', remind: 'none' }, '07:30'), null, 'keine');
eq(at({ dueDate: '2026-11-05', completed: true }, '07:30'), null, 'erledigt');
eq(at({ dueDate: null }, '07:30'), null, 'ohne Datum');
eq(at({ dueDate: '2026-11-05', dueTime: '99:99' }, 'xx'), '2026-11-05 08:00', 'kaputte Zeiten → 08:00');

console.log('Gewohnheiten');
const log = ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-30', '2026-11-02'];
eq(C.habitWeek(log, '2026-11-02').count, 1, 'diese Woche 1');
eq(C.habitWeek(log, '2026-10-26').count, 3, 'Vorwoche 3');
eq(C.habitStreak(log, 3, '2026-11-03'), 2, 'Serie: 2 Wochen mit 3×');
eq(C.habitStreak(log, 4, '2026-11-03'), 0, 'Ziel 4× nie erreicht');
eq(C.habitStreak([...log, '2026-11-03', '2026-11-04'], 3, '2026-11-04'), 3, 'laufende Woche erreicht → zählt mit');

console.log('Stundenplan');
const slots = ['08:00-08:45', '08:45-09:30', '09:55-10:40', '10:40-11:25', '11:50-12:35'];
const lessons = [{ day: 2, slot: 0, subject: 'Mathe' }, { day: 2, slot: 4, subject: 'Mathe' }, { day: 4, slot: 1, subject: 'Mathe' },
                 { day: 3, start: '18:00', subject: 'Training' }];
eq(C.lessonStart(lessons[3], slots), '18:00', 'Uhrzeit vor Stunde');
eq(C.lessonStart(lessons[1], slots), '11:50', 'Startzeit aus Stunde');
const NL = (...a) => { const r = C.nextLesson(...a); if (r) delete r.lesson; return r; };
eq(NL(lessons, slots, 'Mathe', C.now), { iso: '2026-11-03', start: '11:50', diff: 0, day: 2 }, 'nächste Mathe heute 11:50');
eq(NL(lessons, slots, 'Training', C.now), { iso: '2026-11-04', start: '18:00', diff: 1, day: 3 }, 'Training morgen');
const C2 = load('2026-11-03T13:00:00');
eq(C2.nextLesson(lessons, slots, 'Mathe', C2.now).iso, '2026-11-05', 'nach der letzten Stunde → Donnerstag');
eq(C.nextLesson(lessons, slots, 'Kunst', C.now), null, 'unbekanntes Fach');


console.log('Feiertage');
eq(C.easterSunday(2026), '2026-04-05', 'Ostern 2026');
eq(C.easterSunday(2027), '2027-03-28', 'Ostern 2027');
eq(C.easterSunday(2038), '2038-04-25', 'Ostern 2038 (spät)');
eq(C.holidayName('2026-10-31', 'NI'), 'Reformationstag', 'Reformationstag in NI');
eq(C.holidayName('2026-10-31', 'NW'), null, 'nicht in NW');
eq(C.holidayName('2026-11-01', 'NW'), 'Allerheiligen', 'Allerheiligen in NW');
eq(C.holidayName('2026-11-18', 'SN'), 'Buß- und Bettag', 'Buß- und Bettag 2026 (Mi vor dem 23.11.)');
eq(C.holidayName('2027-11-17', 'SN'), 'Buß- und Bettag', 'Buß- und Bettag 2027');
eq(C.holidayName('2026-06-04', 'BY'), 'Fronleichnam', 'Fronleichnam 2026');
eq(C.holidayName('2026-09-20', 'TH'), 'Weltkindertag', 'Weltkindertag TH');
eq(C.holidayName('2026-03-08', 'MV'), 'Internationaler Frauentag', 'Frauentag MV');
eq(C.holidayName('2026-10-03', 'BW'), 'Tag der Deutschen Einheit', 'bundesweit');
eq(C.holidayName('2026-10-03', ''), null, 'ohne Bundesland keine Feiertage');
eq(C.holidayName('2025-05-08', 'BE'), '80. Jahrestag des Kriegsendes', 'einmaliger Feiertag Berlin');
eq(Object.keys(C.publicHolidays(2026, 'BE')).every(k => k.startsWith('2026')), true, 'nur Tage des Jahres');

console.log('Ferien');
eq(Object.keys(C.FERIEN).length, 16, '16 Länder');
eq(C.FERIEN_BIS >= '2029-08-01', true, 'Daten reichen mindestens bis Sommer 2029');
const F = r => (iso => C.dayOff(iso, r, C.FERIEN[r], C.FERIEN_NAMES));
eq(F('NI')('2026-10-20').ferien, 'Herbstferien', 'NI Herbstferien 2026');
eq(F('NI')('2026-10-26').ferien, null, 'NI danach Schule');
eq(F('NI')('2026-12-23').ferien, 'Weihnachtsferien', 'NI Weihnachtsferien Beginn');
eq(F('NI')('2027-01-09').ferien, 'Weihnachtsferien', 'Ende einschließlich');
eq(F('BY')('2026-11-04').ferien != null, true, 'BY Herbstferien (Allerheiligen-Woche)');
eq(C.isFerienWeek('2026-10-12', 'NI', C.FERIEN.NI, C.FERIEN_NAMES), true, 'Ferienwoche');
eq(C.isFerienWeek('2026-11-02', 'NI', C.FERIEN.NI, C.FERIEN_NAMES), false, 'Schulwoche');
eq(C.isFerienWeek('2026-11-02', '', null, null), false, 'ohne Land nie Ferien');
for (const r of Object.keys(C.FERIEN)) {
  const ok = C.FERIEN[r].every(x => /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && x[1] >= x[0] && C.FERIEN_NAMES[x[2]]);
  const sommer = C.FERIEN[r].some(x => C.FERIEN_NAMES[x[2]] === 'Sommerferien' && x[0].startsWith('2027'));
  eq(ok && sommer, true, r + ': Daten gültig, Sommerferien 2027 vorhanden');
  eq(C.FERIEN[r].every((x, i, l) => !i || x[0] > l[i - 1][1]), true, r + ': keine doppelten oder überlappenden Zeiträume');
}

console.log('A/B-Wochen');
const ab = { anchor: '2026-11-02', type: 'A', skip: false };
eq(C.abWeekOf('2026-11-04', ab), 'A', 'Ankerwoche A');
eq(C.abWeekOf('2026-11-10', ab), 'B', 'nächste Woche B');
eq(C.abWeekOf('2026-11-17', ab), 'A', 'übernächste A');
eq(C.abWeekOf('2026-10-28', ab), 'B', 'Vorwoche B');
eq(C.abWeekOf('2026-11-10', { ...ab, type: 'B' }), 'A', 'Anker B → nächste A');
const oneFree = m => m === '2026-11-09';                          // eine freie Woche dazwischen
eq(C.abWeekOf('2026-11-16', { ...ab, skip: true }, oneFree), 'B', 'freie Woche zählt nicht: danach B');
eq(C.abWeekOf('2026-11-16', ab, oneFree), 'A', 'ohne Überspringen: A');
eq(C.abWeekOf('2026-11-02', { anchor: '2026-11-16', type: 'A', skip: true }, oneFree), 'B', 'rückwärts über die freie Woche');
eq(C.abWeekOf('2026-11-02', { anchor: '2026-11-16', type: 'A', skip: false }, oneFree), 'A', 'rückwärts ohne Überspringen');
const free = m => C.isFerienWeek(m, 'NI', C.FERIEN.NI, C.FERIEN_NAMES);
eq(C.abWeekOf('2027-01-11', { anchor: '2026-12-21', type: 'A', skip: true }, free), 'B', 'NI: über die Weihnachtsferien');
eq(C.abWeekOf('2026-11-04', {}), null, 'ohne Anker null');

console.log('Stunde an einem Tag');
const ctxA = { week: 'A', off: false }, ctxOff = { week: 'A', off: true };
eq(C.lessonOn({ day: 2, week: null }, '2026-11-03', ctxA), true, 'jede Woche');
eq(C.lessonOn({ day: 2, week: 'B' }, '2026-11-03', ctxA), false, 'nur B in Woche A');
eq(C.lessonOn({ day: 2 }, '2026-11-03', ctxOff), false, 'schulfrei');
eq(C.lessonOn({ day: 3 }, '2026-11-03', ctxA), false, 'falscher Tag');
const abL = [{ id: 'x', day: 2, slot: 4, subject: 'Physik', week: 'B' }, { id: 'y', day: 4, slot: 0, subject: 'Physik', week: 'A' }];
const ctxF = iso => ({ week: C.abWeekOf(iso, ab), off: !!(C.dayOff(iso, 'NI', C.FERIEN.NI, C.FERIEN_NAMES).ferien) });
eq(C.nextLesson(abL, slots, 'Physik', C.now, { ctx: ctxF }).iso, '2026-11-05', 'A-Woche: nächste Physik Do (A)');
const C3 = load('2026-11-06T10:00:00');
eq(C3.nextLesson(abL, slots, 'Physik', C3.now, { ctx: ctxF }).iso, '2026-11-10', 'dann Di der B-Woche');
const C4 = load('2026-12-21T09:00:00');   // NI: Weihnachtsferien ab 23.12.
const wk = [{ id: 'm', day: 3, slot: 0, subject: 'Mathe' }];
const ctxN = iso => ({ week: null, off: !!(C.dayOff(iso, 'NI', C.FERIEN.NI, C.FERIEN_NAMES).ferien || C.holidayName(iso, 'NI')) });
eq(C4.nextLesson(wk, slots, 'Mathe', C4.now, { ctx: ctxN }).iso, '2027-01-13', 'über die Weihnachtsferien hinweg');
eq(C4.nextLesson(wk, slots, 'Mathe', C4.now).iso, '2026-12-23', 'ohne Ferienwissen: 23.12.');
eq(C.nextLesson([{ id: 'z', day: 2, slot: 4, subject: 'Deutsch' }], slots, 'Deutsch', C.now,
   { cancelled: (l, iso) => iso === '2026-11-03' }).iso, '2026-11-10', 'Ausfall heute → nächste Woche');

console.log('Schnelleingabe mit Fach');
const subs = ['Mathematik', 'Deutsch', 'Bio', 'Mathe 7b'];
const ld = sub => ({ Mathematik: { iso: '2026-11-05' }, Deutsch: { iso: '2026-11-04' }, Bio: { iso: '2026-11-09' }, 'Mathe 7b': { iso: '2026-11-06' } })[sub] || null;
const PS = t => { const r = C.parseQuick(t, { now: C.now, categories: cats, subjects: subs, lessonDate: ld }); delete r.hits; return r; };
eq(PS('S. 34 Nr. 5 bis nächste Mathe'), exp({ title: 'S. 34 Nr. 5', date: '2026-11-05', subject: 'Mathematik' }), 'bis nächste Mathe');
eq(PS('Gedicht lernen zur nächsten Stunde Deutsch'), exp({ title: 'Gedicht lernen', date: '2026-11-04', subject: 'Deutsch' }), 'zur nächsten Stunde Deutsch');
eq(PS('Referat bis Bio'), exp({ title: 'Referat', date: '2026-11-09', subject: 'Bio' }), 'bis Bio');
eq(PS('Test zurückgeben nächste Mathe 7b'), exp({ title: 'Test zurückgeben', date: '2026-11-06', subject: 'Mathe 7b' }), 'zwei Wörter: Mathe 7b');
eq(PS('Bericht bis Freitag'), exp({ title: 'Bericht', date: '2026-11-06' }), '„bis Freitag“ ist kein Fach');
eq(PS('Vokabeln bis nächste Woche'), exp({ title: 'Vokabeln', date: '2026-11-09' }), '„nächste Woche“ bleibt Datum');
eq(PS('Aufsatz bis Deutsch am 12.11.'), exp({ title: 'Aufsatz', date: '2026-11-12', subject: 'Deutsch' }), 'genanntes Datum hat Vorrang');
eq(PS('Bis Freitag Bio-Buch kaufen'), exp({ title: 'Bio-Buch kaufen', date: '2026-11-06' }), 'Bio im Wort zählt nicht');
eq(C.parseQuick('bis nächste Mathe', { now: C.now }).subject, null, 'ohne Fächerliste kein Fach');
eq(C.matchSubject(subs, 'ma', null), null, 'zu kurz für Anfang');
eq(C.matchSubject(subs, 'MATHE', null), { subject: 'Mathematik', words: 1 }, 'Anfang, Groß/klein egal');

console.log('Klassenarbeit und Lernplan');
const T = C.planExam({ kind: 'teacher', title: '7b Bruchrechnung', date: '2026-11-12', today: '2026-11-03', prep: 3, corr: 14 });
eq(T.map(x => [x.role, x.dueDate]), [['prep', '2026-11-09'], ['exam', '2026-11-12'], ['corr', '2026-11-26']], 'Lehrkraft: vorbereiten, schreiben, korrigieren');
eq(T[2].subtasks.length, 4, 'Korrektur mit Teilschritten');
eq(T[1].prio, 'hoch', 'Klassenarbeit wichtig');
const T2 = C.planExam({ kind: 'teacher', title: 'X', date: '2026-11-04', today: '2026-11-03', prep: 3, corr: 14 });
eq(T2[0].dueDate, '2026-11-03', 'Vorbereitung nicht in der Vergangenheit');
const T4 = C.planExam({ kind: 'teacher', title: 'X', date: '2026-11-17', today: '2026-11-03', prep: 3, corr: 12 });
eq([T4[0].dueDate, T4[2].dueDate], ['2026-11-13', '2026-11-30'], 'Wochenende: Vorbereitung Fr davor, Rückgabe Mo danach');
const T3 = C.planExam({ kind: 'teacher', title: 'X', date: '2026-11-03', today: '2026-11-03' });
eq(T3.map(x => x.role), ['exam', 'corr'], 'heute: keine Vorbereitung mehr');
const S = C.planExam({ kind: 'student', title: 'Mathe', date: '2026-11-12', today: '2026-11-03', sessions: 3 });
eq(S.map(x => x.dueDate), ['2026-11-07', '2026-11-09', '2026-11-11', '2026-11-12'], 'Lernplan: 5, 3, 1 Tag vorher');
eq(S[0].title, 'Mathe: lernen (1/3)', 'Titel mit Nummer');
const S2 = C.planExam({ kind: 'student', title: 'Bio', date: '2026-11-05', today: '2026-11-03', sessions: 3 });
eq(S2.map(x => x.dueDate), ['2026-11-03', '2026-11-04', '2026-11-05'], 'knapp: 2 Tage → 2 Einheiten');
eq(S2.every(x => x.dueDate >= '2026-11-03'), true, 'nie in der Vergangenheit');
const S3 = C.planExam({ kind: 'student', title: 'Bio', date: '2026-11-03', today: '2026-11-03', sessions: 3 });
eq(S3.map(x => x.role), ['exam'], 'Klausur heute: nur die Klausur');

console.log('Plus-/Minusstunden');
const log2 = [
  { date: '2026-09-10', type: 'plus', hours: 2 }, { date: '2026-11-03', type: 'minus', hours: 1 },
  { date: '2026-11-04', type: 'aufsicht', hours: 1 }, { date: '2026-11-05', type: 'plus', hours: 1 },
  { date: '2027-03-01', type: 'minus', hours: 2 }, { date: '2026-07-20', type: 'plus', hours: 1 }];
eq(C.subValue(log2[0]), 2, 'Vertretung zählt plus');
eq(C.subValue(log2[1]), -1, 'Ausfall zählt minus');
eq(C.subValue(log2[2]), 0, 'Aufsicht zählt nicht');
eq(C.subSummary(log2), { plus: 4, minus: 3, saldo: 1, aufsicht: 1, aufsichtStd: 1, count: 6 }, 'Summe über alles');
const yr = C.schoolPeriod('year', '2026-11-03');
eq([yr.from, yr.to, yr.label], ['2026-08-01', '2027-07-31', 'Schuljahr 2026/27'], 'Schuljahr ab August');
eq(C.subSummary(log2, yr.from, yr.to).saldo, 0, 'Schuljahr: +3 −3 = 0');
const hj = C.schoolPeriod('half', '2026-11-03');
eq([hj.from, hj.to], ['2026-08-01', '2027-01-31'], '1. Halbjahr');
eq(C.schoolPeriod('half', '2027-03-15').from, '2027-02-01', '2. Halbjahr');
eq(C.schoolPeriod('half', '2027-01-20').label, '1. Halbjahr 2026/27', 'Januar gehört zum 1. Halbjahr');
eq(C.schoolPeriod('year', '2027-07-31').label, 'Schuljahr 2026/27', 'Juli gehört zum laufenden Schuljahr');
const mo = C.schoolPeriod('month', '2026-02-10');
eq([mo.from, mo.to], ['2026-02-01', '2026-02-28'], 'Monat Februar');
eq(C.schoolPeriod('all', '2026-11-03').from, null, 'alles');
eq(C.slotLabel(2, 2), '3./4. Std', 'Doppelstunde');
eq(C.slotLabel(0, 1), '1. Std', 'Einzelstunde');
eq(C.slotLabel(null, 2), 'Doppelstunde', 'ohne Stunde');
const blk = [{ day: 2, slot: 2, subject: 'Mathe', room: '7b' }, { day: 2, slot: 3, subject: 'Mathe', room: '7b' }, { day: 2, slot: 5, subject: 'Mathe', room: '9a' }];
eq(C.lessonBlock(blk, blk[0]), { hours: 2, slot: 2 }, 'erste Stunde der Doppelstunde');
eq(C.lessonBlock(blk, blk[1]), { hours: 2, slot: 2 }, 'zweite Stunde der Doppelstunde');
eq(C.lessonBlock(blk, blk[2]), { hours: 1, slot: 5 }, 'Einzelstunde');

console.log('Doppelstunden und Pausen');
eq(C.lessonBlock([], { day: 2, slot: 4, span: 2 }), { hours: 2, slot: 4 }, 'als Doppelstunde eingetragen');
eq([C.occupies({ slot: 4, span: 2 }, 4), C.occupies({ slot: 4, span: 2 }, 5), C.occupies({ slot: 4, span: 2 }, 6), C.occupies({ slot: 4 }, 5)], [true, true, false, false], 'belegte Stunden');
eq(C.breaksOf(['08:00-08:45', '08:45-09:30', '09:55-10:40', '10:40-11:25', '11:50-12:35']),
   [{ after: 1, start: '09:30', end: '09:55' }, { after: 3, start: '11:25', end: '11:50' }], 'Pausen aus den Zeiten');
eq(C.breaksOf(['08:00-08:45', '08:47-09:30']), [], 'zwei Minuten sind keine Pause');
eq(C.breaksOf([]), [], 'ohne Zeiten');

console.log(fails ? `\n${fails} von ${n} Prüfungen fehlgeschlagen` : `\nAlle ${n} Prüfungen bestanden.`);
process.exit(fails ? 1 : 0);
