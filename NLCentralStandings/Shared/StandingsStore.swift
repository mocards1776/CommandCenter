import Foundation

/// Lightweight disk cache so the widget can show yesterday's table offline.
enum StandingsStore {
    private static let filename = "nl-central-standings.json"

    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = base.appendingPathComponent("NLCentralStandings", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(filename)
    }

    static func load() -> DivisionStandings? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(DivisionStandings.self, from: data)
    }

    static func save(_ standings: DivisionStandings) {
        guard let data = try? JSONEncoder().encode(standings) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
