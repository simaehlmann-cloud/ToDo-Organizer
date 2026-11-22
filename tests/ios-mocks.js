/* Nachbildungen der iOS-Plugins (für app.test.js und i18n.test.js).
   Läuft im Browser über page.addInitScript(iosMocks, optionen). */
function iosMocks(o) {
  o = o || {};
  window.__log = { notif: [], cal: [], sb: [], widget: [] };
  const own = Object.assign({}, o.owned || {});
  const handlers = { approved: [], finished: [], productUpdated: [], receiptUpdated: [] };
  const products = {};
  const fire = (ev, x) => handlers[ev].forEach(f => f(x));
  const tx = (id, date) => ({ products: [{ id }], purchaseDate: new Date(date), finish() { fire('finished', this); } });
  const chain = {};
  for (const k of Object.keys(handlers)) chain[k] = f => { handlers[k].push(f); return chain; };
  const P = {
    LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
      getPending: async () => ({ notifications: [] }), cancel: async () => {},
      schedule: async x => { window.__log.notif = x.notifications; }, registerActionTypes: async () => {}, addListener: () => {},
      checkExactNotificationSetting: async () => ({ exact_alarm: window.__exact || 'denied' }),
      changeExactNotificationSetting: async () => { window.__exact = 'granted'; return { exact_alarm: 'granted' }; }
    },
    StatusBar: { setStyle: async x => { window.__log.sb.push(x.style); } },
    WidgetData: { set: async x => { window.__log.widget.push(x.json); }, status: async () => ({ group: true, bytes: (window.__log.widget.slice(-1)[0] || '').length }),
      takePending: async () => { const it = window.__pending || []; window.__pending = []; return { items: it }; },
      requestReview: async () => { window.__log.review = (window.__log.review || 0) + 1; return { asked: true }; },
      addListener: (ev, fn) => { if (ev === 'pending') window.__pendingFn = fn; },
      setShortcuts: async x => { window.__log.shortcuts = x.items; return { count: x.items.length }; } },
    Share: { share: async x => { window.__log.share = x.text || x.files; } },
    Filesystem: { writeFile: async x => { (window.__log.fs = window.__log.fs || []).push([x.directory, x.path, (x.data || '').length]); return { uri: 'file:///' + x.path }; },
                  copy: async x => { (window.__log.fs = window.__log.fs || []).push(['copy', x.from, x.to]); } },
    App: { addListener: () => {} },
    Badge: { set: async x => { window.__log.badge = x.count; }, clear: async () => { window.__log.badge = 0; },
             checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
             isSupported: async () => ({ isSupported: true }) },
    CapacitorHttp: { get: async r => {
      (window.__log.http = window.__log.http || []).push(r.url);
      const f = (o.ics || {})[r.url];
      if (f == null) return { status: 404, data: '' };
      return { status: 200, data: f };
    } },
    CapacitorCalendar: {
      checkPermission: async () => ({ result: o.calGranted ? 'granted' : 'prompt' }),
      requestFullCalendarAccess: async () => ({ result: 'granted' }),
      listCalendars: async () => ({ result: [{ id: 'k1', title: 'Privat (iCloud)', color: '#ff2d55' }, { id: 'k2', title: 'Arbeit', color: '#34c759' }] }),
      listEventsInRange: async r => {
        window.__log.cal.push(['list', r.from, r.to]);
        const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
        return { result: [
          { id: 'e1', title: 'Elternabend', calendarId: 'k1', startDate: at(4, 19, 0), endDate: at(4, 20, 30), isAllDay: false },
          { id: 'e2', title: 'Messe', calendarId: 'k2', startDate: at(5, 0, 0), endDate: at(7, 0, 0), isAllDay: true },
          { id: 'e3', title: 'Team-Meeting', calendarId: 'k2', startDate: at(3, 14, 0), endDate: at(3, 15, 0), isAllDay: false }
        ] };
      },
      createEvent: async x => { window.__log.cal.push(['create', x.title, x.isAllDay, x.startDate]); return { id: 'new1' }; }
    }
  };
  if (o.cloud) P.CloudSync = {
    status: async () => ({ available: true, enabled: true }),
    getAll: async () => ({ values: await window.__cloudGet() }),
    set: async x => { await window.__cloudSet(x.values); return { ok: true }; },
    remove: async () => ({}),
    addListener: (ev, fn) => { window.__cloudChange = fn; }
  };
  if (o.platform === 'android') delete P.WidgetData;
  window.Capacitor = { getPlatform: () => o.platform || 'ios', isNativePlatform: () => true, Plugins: P };
  window.CdvPurchase = {
    ProductType: { NON_CONSUMABLE: 'nc' }, Platform: { APPLE_APPSTORE: 'ios-appstore' }, ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    store: {
      register(l) { l.forEach(p => products[p.id] = { id: p.id, get owned() { return p.id in own; }, pricing: { price: p.id.endsWith('testphase') ? 'Gratis' : '2,99 €' },
        getOffer() { return { order: async () => { own[p.id] = Date.now(); fire('approved', tx(p.id, own[p.id])); } }; } }); },
      when() { return chain; }, error() {},
      async initialize() { for (const id of Object.keys(own)) fire('approved', tx(id, own[id])); },
      get(id) { return products[id]; }, async restorePurchases() {}
    }
  };
}

module.exports = { iosMocks };
