/* Ersatz für das npm-Paket @capacitor/core beim Bündeln von purchase.js.
   Die App hat keinen Bundler und lädt Capacitor nicht als Modul: In der
   installierten App stellt die native Brücke window.Capacitor bereit,
   samt registerPlugin. Das Kauf-Plugin braucht nur diese eine Funktion. */
export function registerPlugin(name, impl) {
  return window.Capacitor.registerPlugin(name, impl);
}
