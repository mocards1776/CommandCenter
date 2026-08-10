import SwiftUI

/// Lightweight host app — widgets require a containing macOS app.
/// Open this once after install, then add the widget from Notification Center / desktop.
struct ContentView: View {
    @State private var standings: DivisionStandings = .placeholder
    @State private var status: String = "Loading…"
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().overlay(Scoreboard.chalkDim.opacity(0.4))
            standingsTable
            Divider().overlay(Scoreboard.chalkDim.opacity(0.4))
            footer
        }
        .frame(width: 400)
        .background(Scoreboard.field)
        .preferredColorScheme(.dark)
        .task { await refresh() }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text("NL CENTRAL")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .tracking(1.6)
                    .foregroundStyle(Scoreboard.accent)
                Text("Desktop widget host")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Scoreboard.chalk)
            }
            Spacer()
            Button {
                Task { await refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .disabled(isLoading)
            .foregroundStyle(Scoreboard.cream)
        }
        .padding(16)
    }

    private var standingsTable: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
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
            .padding(.horizontal, 10)

            ForEach(standings.rows) { row in
                StandingsRowView(row: row, compact: false)
            }
        }
        .padding(12)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(status)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Scoreboard.chalk)
            Text("Add to desktop: right-click wallpaper → Edit Widgets → search “NL Central”.")
                .font(.system(size: 11))
                .foregroundStyle(Scoreboard.chalkDim)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
    }

    @MainActor
    private func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fresh = try await MLBStandingsClient.fetchNLCentral()
            StandingsStore.save(fresh)
            standings = fresh
            let f = DateFormatter()
            f.dateFormat = "h:mm a"
            status = "Updated \(f.string(from: fresh.fetchedAt))"
        } catch {
            if let cached = StandingsStore.load() {
                standings = cached
                status = "Offline — showing cached standings"
            } else {
                status = "Couldn’t load standings"
            }
        }
    }
}

#Preview {
    ContentView()
}
