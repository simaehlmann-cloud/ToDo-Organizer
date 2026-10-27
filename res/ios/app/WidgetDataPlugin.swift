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
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    static let group = "group.de.maehlmann.todoorganizer"
    static let key = "snapshot"

    @objc func set(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json fehlt")
            return
        }
        guard let defaults = UserDefaults(suiteName: WidgetDataPlugin.group) else {
            call.reject("App-Gruppe nicht verfügbar")
            return
        }
        defaults.set(json, forKey: WidgetDataPlugin.key)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
