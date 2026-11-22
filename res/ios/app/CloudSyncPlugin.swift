// Abgleich zwischen iPhone und iPad über iCloud (Schlüssel-Wert-Speicher).
//
// Die Web-App legt je Sammlung (Aufgaben, Stunden, …) einen Eintrag
// „v1.<name>“ ab und führt die Stände selbst zusammen (syncMerge in
// index.html). Dieses Plugin reicht nur Werte durch und meldet, wenn ein
// anderes Gerät etwas geändert hat. Kein eigener Server: iCloud gehört dem
// Nutzer, Apple speichert verschlüsselt im iCloud-Konto.
//
// Grenzen des Speichers (Apple): 1 MB insgesamt, 1024 Schlüssel. Die App prüft
// die Größe vorher und schreibt nichts, was nicht passt.
//
// Ob der Build die iCloud-Berechtigung hat, steht im Info.plist-Schlüssel
// „TOICloudSync“ (setzt der Workflow nur, wenn das Profil iCloud enthält).
import Foundation
import Capacitor

@objc(CloudSyncPlugin)
public class CloudSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSyncPlugin"
    public let jsName = "CloudSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    static let prefix = "v1."
    private var observer: NSObjectProtocol?

    private var store: NSUbiquitousKeyValueStore { NSUbiquitousKeyValueStore.default }

    private var entitled: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "TOICloudSync") as? Bool) == true
    }

    public override func load() {
        observer = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: NSUbiquitousKeyValueStore.default, queue: .main) { [weak self] note in
            let keys = (note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]) ?? []
            let reason = (note.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int) ?? -1
            // 0 Server, 1 erster Abgleich, 2 Speicher voll, 3 Konto gewechselt
            self?.notifyListeners("change", data: ["keys": keys, "reason": reason])
        }
        if entitled { store.synchronize() }
    }

    deinit {
        if let o = observer { NotificationCenter.default.removeObserver(o) }
    }

    /// available: bei iCloud angemeldet · enabled: Build hat die Berechtigung
    @objc func status(_ call: CAPPluginCall) {
        let signedIn = FileManager.default.ubiquityIdentityToken != nil
        call.resolve(["available": signedIn, "enabled": entitled])
    }

    @objc func getAll(_ call: CAPPluginCall) {
        guard entitled else { call.reject("iCloud ist in diesem Build nicht eingerichtet"); return }
        store.synchronize()
        var values: [String: String] = [:]
        for (k, v) in store.dictionaryRepresentation where k.hasPrefix(CloudSyncPlugin.prefix) {
            if let s = v as? String { values[k] = s }
        }
        call.resolve(["values": values])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard entitled else { call.reject("iCloud ist in diesem Build nicht eingerichtet"); return }
        let values = call.getObject("values") ?? [:]
        var n = 0
        for (k, v) in values where k.hasPrefix(CloudSyncPlugin.prefix) {
            if let s = v as? String { store.set(s, forKey: k); n += 1 }
        }
        let ok = store.synchronize()
        call.resolve(["count": n, "ok": ok])
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard entitled else { call.reject("iCloud ist in diesem Build nicht eingerichtet"); return }
        let keys = call.getArray("keys", String.self) ?? []
        for k in keys where k.hasPrefix(CloudSyncPlugin.prefix) { store.removeObject(forKey: k) }
        store.synchronize()
        call.resolve(["count": keys.count])
    }
}
