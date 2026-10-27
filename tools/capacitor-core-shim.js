/* Ersatz für das npm-Paket @capacitor/core beim Bündeln von purchase.js.

   Die App hat keinen Bundler und lädt @capacitor/core nicht. In der
   installierten App legt die native Brücke jedes Plugin selbst unter
   window.Capacitor.Plugins[Name] an (Methoden und addListener) – eine Funktion
   window.Capacitor.registerPlugin gibt es dort NICHT, die käme nur aus
   @capacitor/core. Bis 3.1 rief dieser Ersatz sie trotzdem auf; das Kauf-
   Modul brach beim Laden ab, und jeder Kauf meldete „App Store nicht
   erreichbar“. Jetzt: das nativ angelegte Plugin verwenden. */
export function registerPlugin(name, impl) {
  const cap = window.Capacitor || {};
  if (typeof cap.registerPlugin === 'function') return cap.registerPlugin(name, impl);
  const native = cap.Plugins && cap.Plugins[name];
  if (native) return native;
  // Ohne natives Plugin (Browser): jeder Aufruf schlägt sauber fehl
  return new Proxy({}, {
    get: (_, key) => key === 'then' ? undefined
      : () => Promise.reject(new Error(name + ' ist auf diesem Gerät nicht verfügbar'))
  });
}
