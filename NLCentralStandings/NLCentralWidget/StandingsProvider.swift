import WidgetKit
import SwiftUI

struct StandingsEntry: TimelineEntry {
    let date: Date
    let standings: DivisionStandings
    let isPlaceholder: Bool
}

struct StandingsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StandingsEntry {
        StandingsEntry(date: Date(), standings: .placeholder, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (StandingsEntry) -> Void) {
        if context.isPreview {
            completion(StandingsEntry(date: Date(), standings: .placeholder, isPlaceholder: true))
            return
        }
        Task {
            let standings = await loadStandings()
            completion(StandingsEntry(date: Date(), standings: standings, isPlaceholder: false))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StandingsEntry>) -> Void) {
        Task {
            let standings = await loadStandings()
            let entry = StandingsEntry(date: Date(), standings: standings, isPlaceholder: false)
            // Refresh roughly every half hour during the day; WidgetKit may coalesce.
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func loadStandings() async -> DivisionStandings {
        do {
            let fresh = try await MLBStandingsClient.fetchNLCentral()
            StandingsStore.save(fresh)
            return fresh
        } catch {
            return StandingsStore.load() ?? .placeholder
        }
    }
}
