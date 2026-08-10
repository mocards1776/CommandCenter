import SwiftUI
import WidgetKit

/// Compact table for `systemMedium` — fits five NL Central clubs on a Mac desktop widget.
struct StandingsMediumView: View {
    let entry: StandingsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            columnLabels
            ForEach(entry.standings.rows) { row in
                StandingsRowView(row: row, compact: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            ScoreboardBackground()
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("NL CENTRAL")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(Scoreboard.accent)
            Spacer()
            Text(updatedLabel)
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .foregroundStyle(Scoreboard.chalkDim)
        }
    }

    private var columnLabels: some View {
        HStack(spacing: 0) {
            Text("#").frame(width: 16, alignment: .leading)
            Text("TEAM").frame(maxWidth: .infinity, alignment: .leading)
            Text("W").frame(width: 28, alignment: .trailing)
            Text("L").frame(width: 28, alignment: .trailing)
            Text("GB").frame(width: 36, alignment: .trailing)
        }
        .font(.system(size: 9, weight: .semibold, design: .rounded))
        .foregroundStyle(Scoreboard.chalkDim)
        .padding(.bottom, 2)
    }

    private var updatedLabel: String {
        if entry.isPlaceholder { return "PREVIEW" }
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: entry.standings.fetchedAt)
    }
}

/// Roomier table for `systemLarge` / Extra Large — adds PCT + streak for a 16" desktop.
struct StandingsLargeView: View {
    let entry: StandingsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NL CENTRAL")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .tracking(1.4)
                        .foregroundStyle(Scoreboard.accent)
                    Text("\(entry.standings.season) · Major League Baseball")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(Scoreboard.chalk)
                }
                Spacer()
                Text(updatedLabel)
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(Scoreboard.chalkDim)
            }

            HStack(spacing: 0) {
                Text("#").frame(width: 20, alignment: .leading)
                Text("TEAM").frame(maxWidth: .infinity, alignment: .leading)
                Text("W").frame(width: 32, alignment: .trailing)
                Text("L").frame(width: 32, alignment: .trailing)
                Text("PCT").frame(width: 44, alignment: .trailing)
                Text("GB").frame(width: 40, alignment: .trailing)
                Text("STR").frame(width: 36, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .semibold, design: .rounded))
            .foregroundStyle(Scoreboard.chalkDim)
            .padding(.top, 4)

            ForEach(entry.standings.rows) { row in
                StandingsRowView(row: row, compact: false)
            }

            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            ScoreboardBackground()
        }
    }

    private var updatedLabel: String {
        if entry.isPlaceholder { return "PREVIEW" }
        let f = DateFormatter()
        f.dateFormat = "MMM d · h:mm a"
        return f.string(from: entry.standings.fetchedAt)
    }
}
