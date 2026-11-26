/* English sample data for the store screenshots and preview videos
   (STORE_LANG=en). Same structure and dates as demo-data.js – only the
   user content (titles, notes, categories, subjects …) is in English.
   The app interface itself switches to English via the device language.
   “Today” is Tuesday, 3 November 2026 (everyday) or Tuesday, 17 November
   2026 (school). */
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
    { id: 'c1', name: 'Personal', color: '#059669' },
    { id: 'c2', name: 'Work',     color: '#2563eb' },
    { id: 'c3', name: 'Home',     color: '#d97706' },
    { id: 'c4', name: 'Sport',    color: '#db2777' }
  ],
  tasks: [
    t('t01', 'Finish presentation', 'c2', 'hoch', '2026-11-05', { dueTime: '14:00', endTime: '15:30', remind: '1h',
      note: 'Room 3.12 · test the projector first\nUse the figures from the Q3 report',
      subtasks: sub(['Outline', 1], ['Add Q3 figures', 1], ['Add examples'], ['Dry run with Jane'], ['Print handouts']) }),
    t('t02', 'Call the dentist', 'c1', 'mittel', '2026-11-03', { dueTime: '11:30' }),
    t('t03', 'Send quote to Berg Ltd', 'c2', 'hoch', '2026-11-03', { dueTime: '16:00' }),
    t('t04', 'Do the laundry', 'c3', 'niedrig', '2026-11-04'),
    t('t05', 'Put out the recycling', 'c3', 'niedrig', '2026-11-04', { recurrence: 'biweekly' }),
    t('t06', 'Water the plants', 'c3', 'niedrig', '2026-11-05', { recurrence: 'custom', recurEvery: 3, recurUnit: 'd' }),
    t('t07', 'Buy running shoes', 'c4', 'mittel', '2026-11-06'),
    t('t08', 'Birthday present for Lucy', 'c1', 'hoch', '2026-11-07', { remind: '2d' }),
    t('t09', 'Plan the week', 'c1', 'mittel', '2026-11-08', { recurrence: 'weekly', dueTime: '18:00' }),
    t('t10', 'Bike service', 'c1', 'niedrig', '2026-11-10'),
    t('t11', 'Finish tax return', 'c1', 'hoch', '2026-11-12', {
      subtasks: sub(['Sort receipts', 1], ['Add travel costs'], ['Submit']) }),
    t('t12', 'Submit travel expenses', 'c2', 'mittel', '2026-11-06'),
    t('t13', 'Prepare team feedback', 'c2', 'mittel', '2026-11-04', { dueTime: '10:00' }),
    t('t14', 'Football practice', 'c4', 'mittel', '2026-11-05', { dueTime: '18:00', endTime: '19:30', recurrence: 'weekly' }),
    // Done over the last weeks: gives a streak in the statistics
    ...['Pay the bill', 'Groceries', 'Jogging', 'Answer emails', 'Clean the bathroom', 'Water the plants',
        'Send report', 'Fill up the car', 'Training', 'Hoover the flat', 'Collect parcel', 'Doctor’s appointment',
        'Write minutes', 'Fix the bike', 'Plan the week', 'Return library books', 'Clean the fridge', 'Clean the windows'
      ].map((title, i) => {
        const d = new Date(Date.UTC(2026, 9, 15 + i, 12)).toISOString().slice(0, 10);
        return t('h' + i, title, ['c1', 'c2', 'c3', 'c4'][i % 4], 'mittel', d,
                 { completed: true, completedAt: Date.parse(d + 'T18:00:00') });
      })
  ],
  lessons: [
    { id: 'l1', day: 2, slot: null, start: '19:00', end: '20:30', subject: 'Volleyball', room: 'Hall 2', color: '#db2777' },
    { id: 'l2', day: 4, slot: null, start: '18:00', end: '19:00', subject: 'Yoga', room: 'Studio', color: '#7c3aed' },
    { id: 'l3', day: 6, slot: null, start: '10:00', end: '11:30', subject: 'Swimming', room: 'Leisure centre', color: '#0891b2' },
    { id: 'l4', day: 1, slot: null, start: '19:30', end: '21:00', subject: 'Choir', room: 'Church hall', color: '#d97706' }
  ],
  shopLists: [{ id: 's1', name: 'Groceries' }, { id: 's2', name: 'Pharmacy' }],
  shopping: [
    ...[['Milk'], ['Wholemeal bread'], ['Apples'], ['Oats'], ['Tomatoes'], ['Cheese', 1], ['Butter', 1]]
      .map(([text, done], i) => ({ id: 'p' + i, text, done: !!done, listId: 's1', createdAt: Date.parse('2026-11-01T09:00:00') + i * 1000 })),
    ...[['Toothpaste'], ['Shower gel']].map(([text], i) => ({ id: 'q' + i, text, done: false, listId: 's2', createdAt: Date.parse('2026-11-01T09:00:00') + i * 1000 }))
  ],
  shopHistory: Object.fromEntries(['Milk', 'Wholemeal bread', 'Apples', 'Oats', 'Tomatoes', 'Cheese', 'Butter', 'Coffee', 'Bananas', 'Yoghurt', 'Pasta', 'Eggs']
    .map((x, i) => [x.toLowerCase(), { t: x, n: 12 - i, last: Date.parse('2026-10-30T10:00:00') }])),
  templates: [
    { id: 'tp1', title: 'Pack for holiday', categoryId: 'c1', prio: 'mittel', note: '', subtasks: ['ID and passport', 'Chargers and power bank', 'Medicines', 'Sun cream', 'Empty the fridge', 'Ask someone to water the plants'] },
    { id: 'tp2', title: 'Clean the flat', categoryId: 'c3', prio: 'niedrig', note: '', subtasks: ['Bathroom', 'Kitchen', 'Hoovering', 'Mop the floors', 'Take out the bins'] }
  ],
  habits: [
    { id: 'hb1', name: 'Jogging', perWeek: 3, color: '#db2777' },
    { id: 'hb2', name: 'Reading', perWeek: 5, color: '#7c3aed' },
    { id: 'hb3', name: 'Drink water', perWeek: 7, color: '#0891b2' },
    { id: 'hb4', name: 'Meditate', perWeek: 4, color: '#059669' },
    { id: 'hb5', name: 'Early night', perWeek: 5, color: '#d97706' }
  ],
  habitLog: {
    hb4: ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-25', '2026-10-27', '2026-10-29', '2026-10-30', '2026-11-01', '2026-11-03'],
    hb5: ['2026-10-26', '2026-10-27', '2026-10-29', '2026-11-02'],
    hb1: ['2026-10-12', '2026-10-14', '2026-10-17', '2026-10-19', '2026-10-21', '2026-10-24', '2026-10-26', '2026-10-28', '2026-10-31', '2026-11-02'],
    hb2: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02'],
    hb3: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']
  },
  extEvents: [
    { date: '2026-11-03', time: '14:00', end: '15:00', title: 'Team meeting', cal: 'Work', color: '#34c759' },
    { date: '2026-11-04', time: '19:30', title: 'Parents’ evening', cal: 'Family', color: '#ff9500' },
    { date: '2026-11-06', time: '19:00', title: 'Dinner at Paul’s', cal: 'Personal', color: '#ff2d55' },
    { date: '2026-11-08', time: null,   title: 'Visit the family', cal: 'Family', color: '#ff9500' },
    { date: '2026-11-11', time: '09:00', title: 'Quarterly review', cal: 'Work', color: '#34c759' },
    { date: '2026-11-18', time: '19:30', title: 'Parents’ evening', cal: 'Family', color: '#ff9500' },
    { date: '2026-11-21', time: null,   title: 'Anna & Tim’s wedding', cal: 'Personal', color: '#ff2d55' }
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

/* School scenes: a Maths/Physics teacher. Same holiday region as the German
   version (Saxony), so Wednesday 18 November shows a public holiday. */
const TODAY_SCHOOL = '2026-11-17T07:40:00';
const L = (id, day, slot, subject, room, color, extra = {}) => Object.assign({ id, day, slot, subject, room, color }, extra);
const BLUE = '#2563eb', ORANGE = '#d97706', TEAL = '#0891b2', VIOLET = '#7c3aed';
const note = (course, date, text) => ({ id: 'n' + date + course.length, course, date, text, updatedAt: Date.parse(date + 'T15:00:00') });
const sb = (id, date, type, hours, slot, klass, subject, notetext = '', extra = {}) =>
  Object.assign({ id, date, type, hours, slot, klass, subject, room: '', note: notetext, lessonId: null, pairId: null }, extra);

const SCHOOL = {
  version: 3,
  categories: [{ id: 'u1', name: 'Teaching', color: BLUE }, { id: 'u2', name: 'Personal', color: '#059669' },
               { id: 'u3', name: 'Home', color: ORANGE }],
  tasks: [
    t('s1', 'Prepare 7b test', 'u1', 'mittel', '2026-11-17', { subject: 'Maths',
      subtasks: sub(['Write questions', 1], ['Mark scheme'], ['Photocopy']) }),
    t('s2', 'Call the dentist', 'u2', 'mittel', '2026-11-17', { dueTime: '13:30' }),
    t('s3', 'Copy percentages worksheet', 'u1', 'niedrig', '2026-11-19', { subject: 'Maths' }),
    t('s4', 'Maths 7b: test', 'u1', 'hoch', '2026-11-26', { dueTime: '08:00', subject: 'Maths', exam: true, course: 'Maths|7b' }),
    t('s5', 'Maths department meeting', 'u1', 'mittel', '2026-11-19', { dueTime: '14:30' }),
    t('s6', 'Read experiment 3 write-ups', 'u1', 'mittel', '2026-11-20', { subject: 'Physics' }),
    t('s7', 'Birthday present for Lucy', 'u2', 'hoch', '2026-11-21'),
    t('s8', 'Do the laundry', 'u3', 'niedrig', '2026-11-18'),
    t('s9', 'Plan the week', 'u2', 'mittel', '2026-11-22', { recurrence: 'weekly', dueTime: '18:00' }),
    t('s10', 'Hand back 7b test', 'u1', 'mittel', '2026-12-03', { subject: 'Maths' })
  ],
  lessons: [
    L('a1', 1, 0, 'Maths', '7b', BLUE, { span: 2 }),
    L('a2', 1, 2, 'Physics', '9a', ORANGE),
    L('a3', 1, 4, 'Maths', '10c', TEAL),
    L('a4', 2, 0, 'Maths', '9a', VIOLET),
    L('a5', 2, 2, 'Physics', '8b', ORANGE, { span: 2 }),
    L('a6', 2, 4, 'Maths', '7b', BLUE),
    L('a7', 3, 0, 'Maths', '7b', BLUE),
    L('a8', 3, 2, 'Physics', '9a', ORANGE),
    L('a9', 4, 0, 'Maths', '7b', BLUE),
    L('a10', 4, 2, 'Maths', '10c', TEAL, { span: 2 }),
    L('a11', 4, 4, 'Physics club', 'R12', '#db2777', { week: 'A' }),
    L('a12', 4, 4, 'Support', '7b', '#059669', { week: 'B' }),
    L('a13', 5, 0, 'Physics', '9a', ORANGE, { span: 2 }),
    L('a14', 5, 3, 'Maths', '9a', VIOLET)
  ],
  duties: [
    { id: 'd1', day: 2, after: 1, place: 'Playground', week: '' },
    { id: 'd2', day: 4, after: 3, place: 'Canteen', week: '' }
  ],
  lessonEx: { 'a4|2026-11-17': { cancel: true } },
  lessonNotes: [
    note('Maths|7b', '2026-11-02', 'Equivalent fractions – started with a pizza picture. Good participation, finished sheet 1.'),
    note('Maths|7b', '2026-11-05', 'Comparing fractions: common denominators. Many mistakes with the LCD – revisit.'),
    note('Maths|7b', '2026-11-09', 'Practised common denominators (carousel). Lucy and Tom absent.'),
    note('Maths|7b', '2026-11-10', 'Adding and subtracting. HW: p. 54 ex. 3a–d'),
    note('Maths|7b', '2026-11-12', 'Mixed numbers. Quiz handed back, average 68 %.'),
    note('Maths|7b', '2026-11-16', 'Started revision, collected questions for the test.'),
    note('Physics|8b', '2026-11-10', 'Experiment 3: measuring friction. Groups 2 and 5 still owe their write-up.')
  ],
  subLog: [
    sb('v1', '2026-09-08', 'plus', 1, 3, '8c', 'English', 'Vocabulary worksheet'),
    sb('v2', '2026-09-24', 'aufsicht', 1, 1, '', '', 'Break duty for Mrs Clarke'),
    sb('v3', '2026-10-01', 'minus', 2, 0, '7b', 'Maths', 'School trip'),
    sb('v4', '2026-10-07', 'plus', 2, 4, '10a', 'Physics', 'Prepared experiment, saved results'),
    sb('v5', '2026-11-04', 'plus', 1, 5, '6a', 'History', 'Reading time'),
    sb('v6', '2026-11-11', 'plus', 2, 2, '9b', 'Maths', 'Percentages practice'),
    sb('v7', '2026-11-13', 'aufsicht', 1, 4, '', '', 'Exam invigilation'),
    sb('v8', '2026-11-17', 'minus', 1, 0, '9a', 'Maths', '9a at the theatre', { lessonId: 'a4' }),
    sb('v9', '2026-11-19', 'plus', 1, 5, '8c', 'English', '')
  ],
  extEvents: [
    { date: '2026-11-17', time: '19:30', title: 'Parents’ evening 7b', cal: 'School', color: '#34c759' },
    { date: '2026-11-18', time: '10:00', title: 'Run with Jane', cal: 'Personal', color: '#ff2d55' },
    { date: '2026-11-20', time: '15:00', title: 'Parent consultations', cal: 'School', color: '#34c759' },
    { date: '2026-11-22', time: null, title: 'Visit the family', cal: 'Family', color: '#ff9500' }
  ],
  shopLists: STATE.shopLists, shopping: STATE.shopping, shopHistory: STATE.shopHistory,
  settings: { features: { timetable: true, calendar: true, habits: false, extCal: true, shopping: true, reminders: true, stats: true },
              profile: 'teacher', planMode: 'school', theme: 'light', region: 'SN', showFerien: true, weekDays: 'mofr',
              ab: { on: true, anchor: '2026-11-16', type: 'A', skip: true } }
};

module.exports = { TODAY, STATE, TODAY_SCHOOL, SCHOOL };
