// Brücke zwischen App und Heute-Widget.
//
// Die Web-App ruft   Capacitor.Plugins.WidgetData.set({ json })   auf, sobald
// sich etwas ändert. Die Zusammenfassung landet im gemeinsamen Speicher der
// App-Gruppe (nur auf diesem Gerät), danach zeichnet iOS das Widget neu.
// Kein Netz, kein Server.
import Foundation
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    static let group = "group.de.maehlmann.todoorganizer"
    static let key = "snapshot"

    /// Gemeinsamer Ordner von App und Widget (nil = App-Gruppe fehlt im Profil)
    static var folder: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json fehlt")
            return
        }
        guard let dir = WidgetDataPlugin.folder else {
            call.reject("App-Gruppe nicht verfügbar")
            return
        }
        do {
            // Datei ist zwischen App und Widget zuverlässiger als UserDefaults
            try json.data(using: .utf8)?.write(to: dir.appendingPathComponent("widget.json"), options: .atomic)
        } catch {
            call.reject("Schreiben fehlgeschlagen: \(error.localizedDescription)")
            return
        }
        if let defaults = UserDefaults(suiteName: WidgetDataPlugin.group) {
            defaults.set(json, forKey: WidgetDataPlugin.key)
            defaults.synchronize()
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["ok": true])
    }

    /// Für die Diagnose in der App: Gruppe da? Was liegt bereit?
    @objc func status(_ call: CAPPluginCall) {
        let dir = WidgetDataPlugin.folder
        var size = 0
        if let d = dir, let data = try? Data(contentsOf: d.appendingPathComponent("widget.json")) { size = data.count }
        call.resolve(["group": dir != nil, "bytes": size])
    }
}
