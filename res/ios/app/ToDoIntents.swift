// Siri und Kurzbefehle (App Intents, ab iOS 16).
//
//   „Hey Siri, neue Aufgabe in ToDo Organizer“ → Siri fragt nach dem Text,
//     die App öffnet sich und legt die Aufgabe an (über WidgetData.takePending). Der Text läuft durch die
//     Schnelleingabe: „Zahnarzt morgen 9 Uhr“ bekommt Datum und Uhrzeit.
//   „Hey Siri, was steht heute an in ToDo Organizer?“ → Siri liest den Tag vor,
//     ohne die App zu öffnen (aus der Zusammenfassung fürs Heute-Widget).
//
// Beide stehen auch in der Kurzbefehle-App. Kein Netz, kein Server.
import AppIntents
import Foundation
import UIKit

@available(iOS 16.0, *)
struct NeueAufgabeIntent: AppIntent {
    static let title: LocalizedStringResource = "Neue Aufgabe"
    static let description = IntentDescription("Legt im ToDo Organizer eine neue Aufgabe an. Datum und Uhrzeit im Text werden erkannt.")
    static let openAppWhenRun: Bool = true

    @Parameter(title: "Aufgabe", requestValueDialog: "Was soll ich eintragen?")
    var text: String

    @MainActor
    func perform() async throws -> some IntentResult {
        // Vormerken; die App holt den Text beim Start bzw. beim Wechsel in den
        // Vordergrund ab (WidgetData.takePending) – unabhängig davon, wie
        // schnell die Web-App geladen ist.
        let key = "todo.pendingTasks"
        var list = UserDefaults.standard.stringArray(forKey: key) ?? []
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { list.append(String(t.prefix(300))) }
        UserDefaults.standard.set(Array(list.suffix(20)), forKey: key)
        NotificationCenter.default.post(name: Notification.Name("ToDoPendingTasks"), object: nil)
        return .result()
    }
}

@available(iOS 16.0, *)
struct HeuteIntent: AppIntent {
    static let title: LocalizedStringResource = "Was steht heute an?"
    static let description = IntentDescription("Liest die heutigen Aufgaben, Stunden und Termine vor.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = HeuteIntent.summary()
        return .result(dialog: "\(text)")
    }

    /// Text aus widget.json (App-Gruppe); ohne Widget-Daten ein Hinweis.
    /// Sprache wie in der App eingestellt (Feld „lang“), sonst wie das Gerät.
    static func summary() -> String {
        let geraetEN = !(Locale.preferredLanguages.first ?? "de").hasPrefix("de")
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.de.maehlmann.todoorganizer"),
              let data = try? Data(contentsOf: dir.appendingPathComponent("widget.json")),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let days = obj["days"] as? [[String: Any]] else {
            return geraetEN ? "Open ToDo Organizer once, then I can read your day to you."
                            : "Öffne den ToDo Organizer einmal, dann kann ich dir deinen Tag vorlesen."
        }
        let en = (obj["lang"] as? String).map { $0 == "en" } ?? geraetEN
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let heute = f.string(from: Date())
        guard let tag = days.first(where: { ($0["iso"] as? String) == heute }) else {
            return en ? "Open ToDo Organizer once, then I can read your day to you."
                      : "Öffne den ToDo Organizer einmal, dann kann ich dir deinen Tag vorlesen."
        }
        let items = (tag["items"] as? [[String: Any]]) ?? []
        var saetze: [String] = []
        if let frei = tag["off"] as? String, !frei.isEmpty { saetze.append(en ? "Today is \(frei)." : "Heute ist \(frei).") }
        if items.isEmpty {
            saetze.append(en ? "Nothing is planned for today." : "Für heute ist nichts eingetragen.")
        } else {
            let teile = items.prefix(8).map { it -> String in
                let titel = (it["title"] as? String) ?? ""
                if let zeit = it["time"] as? String, !zeit.isEmpty { return "\(zeit) \(titel)" }
                return titel
            }
            let n = items.count
            if en {
                saetze.append("Today you have \(n == 1 ? "one entry" : "\(n) entries"): " + teile.joined(separator: ", ") + (n > 8 ? " and more." : "."))
            } else {
                saetze.append("Heute \(n == 1 ? "steht ein Eintrag" : "stehen \(n) Einträge") an: " + teile.joined(separator: ", ") + (n > 8 ? " und weitere." : "."))
            }
        }
        if let ueber = obj["overdue"] as? Int, ueber > 0 {
            if en { saetze.append(ueber == 1 ? "One task is overdue." : "\(ueber) tasks are overdue.") }
            else { saetze.append(ueber == 1 ? "Eine Aufgabe ist überfällig." : "\(ueber) Aufgaben sind überfällig.") }
        }
        return saetze.joined(separator: " ")
    }
}

@available(iOS 16.0, *)
struct ToDoShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: NeueAufgabeIntent(), phrases: [
            "Neue Aufgabe in \(.applicationName)",
            "\(.applicationName) neue Aufgabe",
            "Aufgabe in \(.applicationName) eintragen"
        ])
        AppShortcut(intent: HeuteIntent(), phrases: [
            "Was steht heute an in \(.applicationName)",
            "\(.applicationName) heute",
            "Mein Tag in \(.applicationName)"
        ])
    }
}
