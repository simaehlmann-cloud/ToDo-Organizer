// Brücke der Web-App zu iOS: Heute-Widget und Schnellaktionen.
//
// Die Web-App ruft   Capacitor.Plugins.WidgetData.set({ json })   auf, sobald
// sich etwas ändert. Die Zusammenfassung landet im gemeinsamen Ordner der
// App-Gruppe (nur auf diesem Gerät), danach zeichnet iOS das Widget neu.
// Kein Netz, kein Server.
//
// Angemeldet wird das Plugin über die Liste „packageClassList“ in
// capacitor.config.json (tools/ios-setup.rb). Der früher genutzte Weg über
// einen eigenen Startbildschirm im Storyboard greift in Capacitor 8 nicht:
// Dort erzeugt der SceneDelegate den Startbildschirm im Code.
import Foundation
import UIKit
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setShortcuts", returnType: CAPPluginReturnPromise)
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

    /// Schnellaktionen am App-Symbol: [{ type: "todoorganizer://…", title, icon (SF-Symbol) }]
    @objc func setShortcuts(_ call: CAPPluginCall) {
        let list = call.getArray("items", JSObject.self) ?? []
        let items: [UIApplicationShortcutItem] = list.compactMap { o in
            guard let type = o["type"] as? String, let title = o["title"] as? String else { return nil }
            let icon = (o["icon"] as? String).map { UIApplicationShortcutIcon(systemImageName: $0) }
            return UIApplicationShortcutItem(type: type, localizedTitle: title, localizedSubtitle: nil, icon: icon, userInfo: nil)
        }
        DispatchQueue.main.async {
            UIApplication.shared.shortcutItems = items
            call.resolve(["count": items.count])
        }
    }

    /// Für die Diagnose in der App: Gruppe da? Was liegt bereit?
    @objc func status(_ call: CAPPluginCall) {
        let dir = WidgetDataPlugin.folder
        var size = 0
        if let d = dir, let data = try? Data(contentsOf: d.appendingPathComponent("widget.json")) { size = data.count }
        call.resolve(["group": dir != nil, "bytes": size])
    }
}
