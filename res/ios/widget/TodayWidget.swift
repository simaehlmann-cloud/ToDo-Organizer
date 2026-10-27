// Heute-Widget des ToDo Organizers.
//
// Liest die Zusammenfassung, die die App in der App-Gruppe ablegt
// (WidgetDataPlugin), und zeigt den Tag: Aufgaben, Stunden und Termine nach
// Uhrzeit. Die App liefert drei Tage im Voraus; um Mitternacht und zu jeder
// Uhrzeit des Tages zeichnet iOS das Widget ohne die App neu. Kein Netz.
import UIKit
import WidgetKit
import SwiftUI

// MARK: - Daten (Aufbau siehe widgetSnapshot() in index.html)

struct WItem: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String          // "task" | "lesson" | "event"
    let time: String?         // "HH:MM", ohne Uhrzeit nil
    let title: String
    let color: String         // "#rrggbb"
    let cancelled: Bool?
}

struct WDay: Decodable {
    let iso: String           // "JJJJ-MM-TT"
    let label: String         // "Heute, Di 3.11."
    let off: String?          // Feiertag oder Ferien
    let items: [WItem]
}

struct WSnapshot: Decodable {
    let v: Int
    let days: [WDay]
    let overdue: Int
}

enum WidgetStore {
    static let group = "group.de.maehlmann.todoorganizer"

    /// Ergebnis des Lesens: Daten oder ein Grund, warum es keine gibt
    enum Result {
        case ok(WSnapshot)
        case noGroup      // App-Gruppe fehlt (Signierung/Profil)
        case noData       // App hat noch nichts abgelegt
        case unreadable   // Daten da, aber nicht lesbar
    }

    /// Zuerst die Datei im gemeinsamen Ordner (zuverlässig zwischen App und
    /// Widget), sonst UserDefaults der App-Gruppe.
    static func read() -> Result {
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            return .noGroup
        }
        var data = try? Data(contentsOf: dir.appendingPathComponent("widget.json"))
        if data == nil, let text = UserDefaults(suiteName: group)?.string(forKey: "snapshot") {
            data = text.data(using: .utf8)
        }
        guard let bytes = data else { return .noData }
        guard let snap = try? JSONDecoder().decode(WSnapshot.self, from: bytes) else { return .unreadable }
        return .ok(snap)
    }

    static func load() -> WSnapshot? {
        if case .ok(let s) = read() { return s }
        return nil
    }

    static func hint() -> String {
        switch read() {
        case .noGroup: return "Widget ohne App-Gruppe – bitte dem Entwickler melden."
        case .unreadable: return "Daten nicht lesbar – bitte die App einmal öffnen."
        default: return "Öffne den ToDo Organizer einmal – dann erscheint hier dein Tag."
        }
    }
}

private func formatted(_ date: Date, _ pattern: String) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = pattern
    return f.string(from: date)
}

/// „HH:MM“ von heute als Zeitpunkt
private func todayAt(_ time: String, _ base: Date) -> Date? {
    let parts = time.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return nil }
    return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: base)
}

// MARK: - Zeitleiste

struct DayEntry: TimelineEntry {
    let date: Date
    let label: String
    let off: String?
    let items: [WItem]
    let overdue: Int
    let hasData: Bool
    var hint: String = ""

    static func empty(_ date: Date) -> DayEntry {
        DayEntry(date: date, label: "Heute", off: nil, items: [], overdue: 0, hasData: false, hint: WidgetStore.hint())
    }

    static func sample(_ date: Date) -> DayEntry {
        DayEntry(date: date, label: "Heute", off: nil, items: [
            WItem(id: "1", kind: "lesson", time: "08:00", title: "Mathe · 7b", color: "#2563eb", cancelled: nil),
            WItem(id: "2", kind: "task", time: "11:30", title: "Zahnarzt anrufen", color: "#059669", cancelled: nil),
            WItem(id: "3", kind: "event", time: "14:00", title: "Team-Meeting", color: "#34c759", cancelled: nil),
            WItem(id: "4", kind: "task", time: nil, title: "Wäsche waschen", color: "#d97706", cancelled: nil)
        ], overdue: 0, hasData: true)
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry.sample(Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        let now = Date()
        if let snap = WidgetStore.load() {
            completion(entry(at: now, snap: snap))
        } else {
            completion(context.isPreview ? DayEntry.sample(now) : DayEntry.empty(now))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let now = Date()
        let cal = Calendar.current
        guard let snap = WidgetStore.load() else {
            completion(Timeline(entries: [DayEntry.empty(now)], policy: .never))
            return
        }
        var dates: Set<Date> = [now]
        // Zu jeder Uhrzeit von heute neu zeichnen, damit Begonnenes verschwindet
        if let today = snap.days.first(where: { $0.iso == formatted(now, "yyyy-MM-dd") }) {
            for item in today.items {
                if let t = item.time, let at = todayAt(t, now), at > now { dates.insert(at) }
            }
        }
        // Um Mitternacht die nächsten Tage aus dem Vorrat zeigen
        var midnight = cal.startOfDay(for: now)
        for _ in 0..<2 {
            midnight = cal.date(byAdding: .day, value: 1, to: midnight) ?? midnight
            dates.insert(midnight)
        }
        let entries = dates.sorted().map { entry(at: $0, snap: snap) }
        completion(Timeline(entries: entries, policy: .after(midnight)))
    }

    func entry(at date: Date, snap: WSnapshot) -> DayEntry {
        let iso = formatted(date, "yyyy-MM-dd")
        let clock = formatted(date, "HH:mm")
        let day = snap.days.first(where: { $0.iso == iso })
        // Stunden und Termine verschwinden, sobald sie begonnen haben.
        // Aufgaben bleiben stehen, bis sie in der App abgehakt sind.
        let items = (day?.items ?? []).filter { item in
            guard item.kind != "task", let t = item.time else { return true }
            return t >= clock
        }
        // Offene Aufgaben früherer Tage aus dem Vorrat sind inzwischen überfällig
        var overdue = snap.overdue
        for d in snap.days where d.iso < iso {
            overdue += d.items.filter { $0.kind == "task" }.count
        }
        return DayEntry(date: date, label: day?.label ?? "Heute", off: day?.off,
                        items: items, overdue: overdue, hasData: day != nil,
                        hint: day == nil ? "Öffne die App, um diesen Tag zu laden." : "")
    }
}

// MARK: - Darstellung

private let brand = Color(red: 0.145, green: 0.388, blue: 0.922)

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        if s.count != 6 { v = 0x2563eb }
        self.init(red: Double((v >> 16) & 0xff) / 255,
                  green: Double((v >> 8) & 0xff) / 255,
                  blue: Double(v & 0xff) / 255)
    }
}

struct ItemRow: View {
    let item: WItem
    let small: Bool

    var body: some View {
        HStack(spacing: 5) {
            if item.kind == "task" {
                Image(systemName: "circle")
                    .font(.system(size: small ? 9 : 10, weight: .semibold))
                    .foregroundColor(Color(hex: item.color))
            } else {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Color(hex: item.color))
                    .frame(width: 3, height: small ? 12 : 14)
            }
            if let t = item.time, !small || item.kind != "task" {
                Text(t)
                    .font(.system(size: small ? 10 : 11, weight: .semibold).monospacedDigit())
                    .foregroundColor(.secondary)
            }
            Text(item.title)
                .font(.system(size: small ? 11 : 12))
                .strikethrough(item.cancelled == true)
                .foregroundColor(item.cancelled == true ? .secondary : .primary)
                .lineLimit(1)
        }
    }
}

struct TodayView: View {
    @Environment(\.widgetFamily) var family
    let entry: DayEntry

    private var small: Bool { family == .systemSmall }
    private var maxItems: Int {
        switch family {
        case .systemSmall: return 4
        case .systemMedium: return 4
        default: return 11
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: small ? 3 : 4) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(entry.label)
                    .font(.system(size: small ? 13 : 14, weight: .bold))
                    .foregroundColor(brand)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if entry.overdue > 0 {
                    Text(small ? "\(entry.overdue) !" : "\(entry.overdue) überfällig")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.red)
                }
            }
            if let off = entry.off {
                Text(off)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.green)
                    .lineLimit(1)
            }
            if !entry.hasData {
                Text(entry.hint.isEmpty ? "Öffne den ToDo Organizer einmal – dann erscheint hier dein Tag." : entry.hint)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                Spacer(minLength: 0)
            } else if entry.items.isEmpty {
                Spacer(minLength: 0)
                Text("Für heute ist nichts mehr offen.")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                Spacer(minLength: 0)
            } else {
                ForEach(entry.items.prefix(maxItems)) { item in
                    ItemRow(item: item, small: small)
                }
                if entry.items.count > maxItems {
                    Text("+ \(entry.items.count - maxItems) weitere")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "todoorganizer://week"))
    }
}

extension View {
    /// Hintergrund: ab iOS 17 über containerBackground (Pflicht), davor klassisch.
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Color(UIColor.systemBackground) }
        } else {
            self.padding(14).background(Color(UIColor.systemBackground))
        }
    }
}

// MARK: - Widget

@main
struct TodayWidget: Widget {
    let kind = "TodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TodayView(entry: entry).widgetBackground()
        }
        .configurationDisplayName("Heute")
        .description("Fällige Aufgaben, Stunden und Termine von heute.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
