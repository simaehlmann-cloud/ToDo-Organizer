/* Bündelt das Kauf-Plugin (capacitor-plugin-cdv-purchase, StoreKit 2) zu
   einer einzigen Skriptdatei, die index.html bei Bedarf nachlädt.

     node tools/make-purchase-js.js www/purchase.js

   Läuft im iOS-Workflow nach „npm install“. Das Ergebnis wird nicht ins
   Repository eingecheckt: So passt es immer zur installierten Plugin-Fassung,
   deren nativer Teil gleichzeitig ins Xcode-Projekt kommt. */
const path = require('path');
const esbuild = require('esbuild');

const out = process.argv[2] || 'www/purchase.js';
esbuild.buildSync({
  entryPoints: [require.resolve('capacitor-plugin-cdv-purchase')],
  bundle: true,
  format: 'iife',
  target: 'safari15',
  outfile: out,
  alias: { '@capacitor/core': path.join(__dirname, 'capacitor-core-shim.js') },
  logLevel: 'warning'
});
console.log('purchase.js geschrieben: ' + out);
