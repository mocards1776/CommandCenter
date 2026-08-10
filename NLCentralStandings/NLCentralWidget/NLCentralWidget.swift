import WidgetKit
import SwiftUI

@main
struct NLCentralWidgetBundle: WidgetBundle {
    var body: some Widget {
        NLCentralStandingsWidget()
    }
}

struct NLCentralStandingsWidget: Widget {
    let kind = "NLCentralStandingsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StandingsProvider()) { entry in
            StandingsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("NL Central")
        .description("Live National League Central standings. Cardinals highlighted.")
        .supportedFamilies(Self.supportedFamilies)
    }

    /// Medium + large fit a five-team table on a 16" MacBook Pro desktop.
    private static var supportedFamilies: [WidgetFamily] {
        #if os(macOS)
        [.systemMedium, .systemLarge, .systemExtraLarge]
        #else
        [.systemMedium, .systemLarge]
        #endif
    }
}

struct StandingsWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: StandingsEntry

    var body: some View {
        switch family {
        case .systemMedium:
            StandingsMediumView(entry: entry)
        default:
            StandingsLargeView(entry: entry)
        }
    }
}

#Preview("Medium", as: .systemMedium) {
    NLCentralStandingsWidget()
} timeline: {
    StandingsEntry(date: .now, standings: .placeholder, isPlaceholder: true)
}

#Preview("Large", as: .systemLarge) {
    NLCentralStandingsWidget()
} timeline: {
    StandingsEntry(date: .now, standings: .placeholder, isPlaceholder: true)
}
