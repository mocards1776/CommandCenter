import Foundation

/// Fetches NL Central standings from the public MLB Stats API.
/// Same source CommandCenter uses (`statsapi.mlb.com`).
enum MLBStandingsClient {
    private static let base = URL(string: "https://statsapi.mlb.com/api/v1")!

    static func fetchNLCentral(season: Int? = nil) async throws -> DivisionStandings {
        let year = season ?? currentSeason()
        var components = URLComponents(
            url: base.appendingPathComponent("standings"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "leagueId", value: String(NLCentral.leagueId)),
            URLQueryItem(name: "season", value: String(year)),
            URLQueryItem(name: "standingsTypes", value: "regularSeason"),
            URLQueryItem(name: "hydrate", value: "division,team"),
        ]

        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(StandingsResponse.self, from: data)
        guard let block = decoded.records.first(where: {
            $0.division?.id == NLCentral.divisionId
                || ($0.division?.name ?? "").localizedCaseInsensitiveContains("Central")
        }) else {
            throw URLError(.cannotParseResponse)
        }

        let rows: [StandingRow] = (block.teamRecords ?? []).enumerated().map { index, r in
            let team = r.team
            let name = team?.name ?? "—"
            let short = team?.teamName
                ?? name
                    .replacingOccurrences(of: "St. Louis ", with: "")
                    .replacingOccurrences(of: "Chicago ", with: "")
                    .replacingOccurrences(of: "Milwaukee ", with: "")
                    .replacingOccurrences(of: "Pittsburgh ", with: "")
                    .replacingOccurrences(of: "Cincinnati ", with: "")
            let gbRaw = r.gamesBack ?? "-"
            let gb = (gbRaw == "0" || gbRaw == "0.0" || gbRaw == "-") ? "—" : gbRaw
            return StandingRow(
                teamId: team?.id ?? index,
                rank: Int(r.divisionRank ?? "") ?? (index + 1),
                abbreviation: team?.abbreviation ?? "—",
                name: name,
                shortName: short,
                wins: r.wins ?? 0,
                losses: r.losses ?? 0,
                pct: formatPct(r.winningPercentage),
                gamesBack: gb,
                streak: r.streak?.streakCode ?? ""
            )
        }
        .sorted { $0.rank < $1.rank }

        return DivisionStandings(
            season: year,
            divisionName: shortDivisionName(block.division?.name),
            fetchedAt: Date(),
            rows: rows
        )
    }

    /// MLB season year: before April, prefer previous year if needed for late spring.
    static func currentSeason(now: Date = Date()) -> Int {
        let cal = Calendar(identifier: .gregorian)
        var eastern = cal
        eastern.timeZone = TimeZone(identifier: "America/Chicago") ?? .current
        let year = eastern.component(.year, from: now)
        let month = eastern.component(.month, from: now)
        // Jan–Feb: still talking about last season until Spring Training settles.
        if month < 3 { return year - 1 }
        return year
    }

    private static func formatPct(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "—" }
        if raw.hasPrefix(".") { return raw }
        if let value = Double(raw) {
            return String(format: ".%03.0f", value * 1000)
        }
        return raw
    }

    private static func shortDivisionName(_ name: String?) -> String {
        guard let name, !name.isEmpty else { return "NL Central" }
        return name
            .replacingOccurrences(of: "National League ", with: "NL ")
            .replacingOccurrences(of: "American League ", with: "AL ")
    }
}

// MARK: - API DTOs

private struct StandingsResponse: Decodable {
    let records: [StandingRecord]
}

private struct StandingRecord: Decodable {
    let division: DivisionDTO?
    let teamRecords: [TeamRecordDTO]?
}

private struct DivisionDTO: Decodable {
    let id: Int?
    let name: String?
    let nameShort: String?
}

private struct TeamRecordDTO: Decodable {
    let team: TeamDTO?
    let wins: Int?
    let losses: Int?
    let divisionRank: String?
    let gamesBack: String?
    let winningPercentage: String?
    let streak: StreakDTO?
}

private struct TeamDTO: Decodable {
    let id: Int?
    let name: String?
    let abbreviation: String?
    let teamName: String?
}

private struct StreakDTO: Decodable {
    let streakCode: String?
}
