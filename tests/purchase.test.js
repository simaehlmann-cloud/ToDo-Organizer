/* Prüft das gebündelte Kaufmodul (www/purchase.js) so, wie die iOS-App es
   lädt: window.Capacitor kommt von der nativen Brücke – mit Plugins, aber
   OHNE registerPlugin (das gibt es nur in @capacitor/core, das die App nicht
   lädt). Bis 3.1 brach das Modul genau daran ab; jeder Kauf meldete dann
   „App Store nicht erreichbar“.   node tests/purchase.test.js www/purchase.js */
const fs = require('fs');
const vm = require('vm');
const file = process.argv[2] || 'www/purchase.js';
if (!fs.existsSync(file)) { console.error(file + ' fehlt – erst node tools/make-purchase-js.js ' + file); process.exit(1); }
const calls = [];
const native = new Proxy({}, { get: (_, k) => k === 'addListener' ? () => ({ remove() {} })
  : (...a) => { calls.push(k); return Promise.resolve({}); } });
const win = { Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true, Plugins: { PurchasePlugin: native } },
              console: { log() {}, warn() {}, error() {}, info() {}, debug() {} }, setTimeout, clearTimeout, setInterval, clearInterval,
              localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: { userAgent: 'iPhone' }, location: { href: 'capacitor://localhost/' },
              document: { addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } }, addEventListener() {} };
win.window = win; win.self = win; win.globalThis = win;
let ok = true;
try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), win); }
catch (e) { ok = false; console.error('✗ purchase.js bricht beim Laden ab: ' + e.message); }
if (ok && !(win.CdvPurchase && win.CdvPurchase.store)) { ok = false; console.error('✗ window.CdvPurchase.store fehlt nach dem Laden'); }
if (ok && !(win.CdvPurchaseCapacitor && win.CdvPurchaseCapacitor.installed)) { ok = false; console.error('✗ Capacitor-Kennung des Plugins fehlt'); }
console.log(ok ? '✓ purchase.js lädt mit der echten Brücke (ohne registerPlugin)' : '\nKaufmodul defekt – Käufe würden „App Store nicht erreichbar“ melden.');
process.exit(ok ? 0 : 1);
