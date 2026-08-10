import SwiftUI

struct StandingsRowView: View {
    let row: StandingRow
    let compact: Bool

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                .fill(TeamPalette.accent(for: row.teamId))
                .frame(width: 3)
                .padding(.trailing, 6)

            Text("\(row.rank)")
                .frame(width: compact ? 14 : 18, alignment: .leading)
                .foregroundStyle(Scoreboard.chalk)

            Text(compact ? row.abbreviation : row.shortName)
                .font(.system(size: compact ? 12 : 13, weight: row.isCardinals ? .bold : .semibold, design: .rounded))
                .foregroundStyle(row.isCardinals ? Scoreboard.cream : Scoreboard.cream.opacity(0.92))
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(1)

            Text("\(row.wins)")
                .frame(width: compact ? 28 : 32, alignment: .trailing)
            Text("\(row.losses)")
                .frame(width: compact ? 28 : 32, alignment: .trailing)

            if !compact {
                Text(row.pct)
                    .frame(width: 44, alignment: .trailing)
                    .foregroundStyle(Scoreboard.chalk)
            }

            Text(row.gamesBack)
                .frame(width: compact ? 36 : 40, alignment: .trailing)

            if !compact {
                Text(row.streak)
                    .frame(width: 36, alignment: .trailing)
                    .foregroundStyle(streakColor)
            }
        }
        .font(.system(size: compact ? 12 : 13, weight: .medium, design: .monospaced))
        .foregroundStyle(Scoreboard.cream)
        .padding(.vertical, compact ? 3 : 5)
        .padding(.horizontal, 6)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(row.isCardinals ? Scoreboard.accentDeep.opacity(0.22) : Color.clear)
        )
    }

    private var streakColor: Color {
        if row.streak.hasPrefix("W") { return Scoreboard.turf }
        if row.streak.hasPrefix("L") { return Scoreboard.accent }
        return Scoreboard.chalk
    }
}

struct ScoreboardBackground: View {
    var body: some View {
        ZStack {
            Scoreboard.field
            LinearGradient(
                colors: [
                    Scoreboard.hero.opacity(0.55),
                    Scoreboard.field.opacity(0.2),
                    Scoreboard.ink.opacity(0.85),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Canvas { context, size in
                let step: CGFloat = 28
                var path = Path()
                stride(from: 0, through: size.width + size.height, by: step).forEach { offset in
                    path.move(to: CGPoint(x: offset, y: 0))
                    path.addLine(to: CGPoint(x: 0, y: offset))
                }
                context.stroke(path, with: .color(.white.opacity(0.035)), lineWidth: 1)
            }
        }
    }
}
