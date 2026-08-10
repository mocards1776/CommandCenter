import Foundation

/// One row in the NL Central table.
struct StandingRow: Identifiable, Codable, Hashable {
    var id: Int { teamId }
    let teamId: Int
    let rank: Int
    let abbreviation: String
    let name: String
    let shortName: String
    let wins: Int
    let losses: Int
    let pct: String
    let gamesBack: String
    let streak: String

    var record: String { "\(wins)-\(losses)" }

    var isCardinals: Bool { teamId == 138 }
}

/// Snapshot cached for the widget timeline.
struct DivisionStandings: Codable, Hashable {
    let season: Int
    let divisionName: String
    let fetchedAt: Date
    let rows: [StandingRow]

    static let placeholder = DivisionStandings(
        season: Calendar.current.component(.year, from: Date()),
        divisionName: "NL Central",
        fetchedAt: Date(),
        rows: [
            StandingRow(
                teamId: 158, rank: 1, abbreviation: "MIL", name: "Milwaukee Brewers",
                shortName: "Brewers", wins: 74, losses: 44, pct: ".627",
                gamesBack: "—", streak: "W2"
            ),
            StandingRow(
                teamId: 112, rank: 2, abbreviation: "CHC", name: "Chicago Cubs",
                shortName: "Cubs", wins: 69, losses: 50, pct: ".580",
                gamesBack: "5.5", streak: "W1"
            ),
            StandingRow(
                teamId: 138, rank: 3, abbreviation: "STL", name: "St. Louis Cardinals",
                shortName: "Cardinals", wins: 59, losses: 59, pct: ".500",
                gamesBack: "15.0", streak: "W1"
            ),
            StandingRow(
                teamId: 134, rank: 4, abbreviation: "PIT", name: "Pittsburgh Pirates",
                shortName: "Pirates", wins: 58, losses: 62, pct: ".483",
                gamesBack: "17.0", streak: "L1"
            ),
            StandingRow(
                teamId: 113, rank: 5, abbreviation: "CIN", name: "Cincinnati Reds",
                shortName: "Reds", wins: 56, losses: 61, pct: ".479",
                gamesBack: "17.5", streak: "L3"
            ),
        ]
    )
}

enum NLCentral {
    /// MLB Stats API division id for National League Central.
    static let divisionId = 205
    /// National League.
    static let leagueId = 104
    /// St. Louis Cardinals — highlighted in the widget.
    static let favoriteTeamId = 138
}
